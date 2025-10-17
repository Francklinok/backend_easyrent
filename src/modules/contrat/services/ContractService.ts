import {
  Contract,
  ContractTemplate,
  ContractGenerationRequest,
  ContractSigningRequest,
  ContractUpdateRequest,
  ContractSearchFilters,
  ContractStatus,
  ContractType,
  PartyRole,
  ContractAnalytics
} from '../types';
import { ContractModel } from '../models/Contract';
import { ContractPartyModel } from '../models/ContractParty';
import { ContractTemplateModel } from '../models/ContractTemplate';
import { generateContractPDF } from '../utils/pdfGenerator';
import { generateQRCode } from '../utils/qrGenerator';
import { generateWatermark } from '../utils/watermarkGenerator';
import { validateContractVariables } from '../utils/validator';
import { AIAnalysisService } from '../utils/aiAnalysis';

export class ContractService {
  async createContract(request: ContractGenerationRequest, createdBy: string): Promise<Contract> {
    try {
      // Valider le template
      const template = await ContractTemplateModel.findOne({
        id: request.templateId,
        isActive: true
      });

      if (!template) {
        throw new Error('Template not found or inactive');
      }

      // Valider les variables
      const validationResult = validateContractVariables(template.variables, request.variables);
      if (!validationResult.isValid) {
        throw new Error(`Invalid variables: ${validationResult.errors.join(', ')}`);
      }

      // Créer le contrat
      const contractData: Partial<Contract> = {
        templateId: request.templateId,
        type: request.type,
        variables: request.variables,
        propertyId: request.propertyId,
        reservationId: request.reservationId,
        status: ContractStatus.DRAFT,
        createdBy,
        metadata: request.metadata || {}
      };

      const contract = new ContractModel(contractData);
      await contract.save();

      // Créer les parties du contrat
      const parties = await Promise.all(
        request.parties.map(party => {
          const contractParty = new ContractPartyModel({
            contractId: contract.id,
            role: party.role,
            userId: party.userId
          });
          return contractParty.save();
        })
      );

      // Générer automatiquement le PDF si demandé
      if (request.autoGenerate) {
        await this.generateContractFile(contract.id, createdBy);
      }

      return contract.toObject() as any;
    } catch (error) {
      throw new Error(`Failed to create contract: ${error.message}`);
    }
  }

  async generateContractFile(contractId: string, userId: string): Promise<string> {
    try {
      const contract = await ContractModel.findOne({ id: contractId })
        .populate('parties');

      if (!contract) {
        throw new Error('Contract not found');
      }

      const template = await ContractTemplateModel.findOne({ id: contract.templateId });
      if (!template) {
        throw new Error('Template not found');
      }

      // Générer QR Code et Watermark
      const qrCodeData = await generateQRCode(contractId, contract as any);
      const watermarkData = await generateWatermark(contractId);

      // Générer le PDF
      const fileUri = await generateContractPDF(contract as any, template as any, {
        qrCodeData,
        watermarkData
      });

      // Mettre à jour le contrat
      contract.generatedFileUri = fileUri;
      contract.qrCodeData = qrCodeData;
      contract.watermarkData = watermarkData;
      contract.status = ContractStatus.GENERATED;
      contract.updatedBy = userId;

      // Générer l'analyse IA
      const aiAnalysis = await AIAnalysisService.analyzeContract(contract as any, template as any);
      contract.aiAnalysis = aiAnalysis;

      await contract.save();

      return fileUri;
    } catch (error) {
      throw new Error(`Failed to generate contract file: ${error.message}`);
    }
  }

  async signContract(request: ContractSigningRequest): Promise<Contract> {
    try {
      const party = await ContractPartyModel.findOne({ id: request.partyId });
      if (!party) {
        throw new Error('Party not found');
      }

      // Signer la partie
      await party.sign(request.signature, request.ipAddress, request.deviceInfo);

      // Vérifier si toutes les parties ont signé
      const allSigned = await ContractPartyModel.checkAllSigned(party.contractId);

      // Mettre à jour le statut du contrat
      const contract = await ContractModel.findOne({ id: party.contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      contract.status = allSigned ? ContractStatus.SIGNED : ContractStatus.PENDING_SIGNATURE;
      if (allSigned && !contract.signedAt) {
        contract.signedAt = new Date();
      }

      await contract.save();

      return contract.toObject() as any;
    } catch (error) {
      throw new Error(`Failed to sign contract: ${error.message}`);
    }
  }

  async updateContract(request: ContractUpdateRequest, updatedBy: string): Promise<Contract> {
    try {
      const contract = await ContractModel.findOne({ id: request.contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      if (request.variables) {
        await contract.updateVariables(request.variables, updatedBy);
      }

      if (request.status) {
        await contract.updateStatus(request.status, updatedBy);
      }

      if (request.metadata) {
        contract.metadata = { ...contract.metadata, ...request.metadata };
        contract.updatedBy = updatedBy;
        await contract.save();
      }

      return contract.toObject() as any;
    } catch (error) {
      throw new Error(`Failed to update contract: ${error.message}`);
    }
  }

  async getContract(contractId: string): Promise<Contract | null> {
    try {
      const contract = await ContractModel.findOne({ id: contractId })
        .populate('parties');
      return contract ? contract.toObject() as any : null;
    } catch (error) {
      throw new Error(`Failed to get contract: ${error.message}`);
    }
  }

  async searchContracts(filters: ContractSearchFilters): Promise<Contract[]> {
    try {
      const query: any = {};

      if (filters.type) query.type = filters.type;
      if (filters.status) query.status = filters.status;
      if (filters.propertyId) query.propertyId = filters.propertyId;
      if (filters.createdAfter) query.createdAt = { $gte: filters.createdAfter };
      if (filters.createdBefore) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = filters.createdBefore;
      }

      let contractQuery = ContractModel.find(query);

      // Filtrer par utilisateur si spécifié
      if (filters.userId) {
        const userContracts = await ContractModel.findByUser(filters.userId);
        return userContracts.slice(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50));
      }

      contractQuery = contractQuery
        .sort({ createdAt: -1 })
        .skip(filters.offset || 0)
        .limit(filters.limit || 50)
        .populate('parties');

      const contracts = await contractQuery.exec();
      return contracts.map(contract => contract.toObject() as any);
    } catch (error) {
      throw new Error(`Failed to search contracts: ${error.message}`);
    }
  }

  async getContractsByUser(userId: string): Promise<Contract[]> {
    try {
      const contracts = await ContractModel.findByUser(userId);
      return contracts;
    } catch (error) {
      throw new Error(`Failed to get contracts by user: ${error.message}`);
    }
  }

  async getContractsByProperty(propertyId: string): Promise<Contract[]> {
    try {
      const contracts = await ContractModel.findByProperty(propertyId);
      return contracts.map(contract => contract.toObject() as any);
    } catch (error) {
      throw new Error(`Failed to get contracts by property: ${error.message}`);
    }
  }

  async deleteContract(contractId: string, userId: string): Promise<boolean> {
    try {
      const contract = await ContractModel.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Seul le créateur peut supprimer le contrat et seulement s'il est en brouillon
      if (contract.createdBy !== userId) {
        throw new Error('Unauthorized to delete this contract');
      }

      if (contract.status !== ContractStatus.DRAFT) {
        throw new Error('Cannot delete contract that is not in draft status');
      }

      // Supprimer les parties du contrat
      await ContractPartyModel.deleteMany({ contractId });

      // Supprimer le contrat
      await ContractModel.deleteOne({ id: contractId });

      return true;
    } catch (error) {
      throw new Error(`Failed to delete contract: ${error.message}`);
    }
  }

  async getContractAnalytics(filters: Partial<ContractSearchFilters> = {}): Promise<ContractAnalytics> {
    try {
      const matchFilter: any = {};
      if (filters.type) matchFilter.type = filters.type;
      if (filters.status) matchFilter.status = filters.status;
      if (filters.createdAfter) matchFilter.createdAt = { $gte: filters.createdAfter };

      const analytics = await ContractModel.getAnalytics(matchFilter);

      // Calculer des métriques supplémentaires
      const contractsByType = await ContractModel.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);

      const contractsByStatus = await ContractModel.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      const monthlyTrends = await ContractModel.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            totalValue: { $sum: '$variables.monthlyRent' }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]);

      return {
        totalContracts: analytics[0]?.totalContracts || 0,
        contractsByType: contractsByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<ContractType, number>),
        contractsByStatus: contractsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {} as Record<ContractStatus, number>),
        averageProcessingTime: 0, // À implémenter
        complianceScore: analytics[0]?.avgComplianceScore || 0,
        riskScore: analytics[0]?.avgRiskScore || 0,
        monthlyTrends: monthlyTrends.map(trend => ({
          month: `${trend._id.year}-${trend._id.month.toString().padStart(2, '0')}`,
          count: trend.count,
          value: trend.totalValue || 0
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get contract analytics: ${error.message}`);
    }
  }

  // Template management methods
  async createTemplate(template: Partial<ContractTemplate>, createdBy: string): Promise<ContractTemplate> {
    try {
      const templateData = {
        ...template,
        createdBy,
        isActive: true
      };

      const newTemplate = new ContractTemplateModel(templateData);
      await newTemplate.save();

      return newTemplate.toObject() as any;
    } catch (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  async getTemplates(type?: ContractType): Promise<ContractTemplate[]> {
    try {
      let templates;

      if (type) {
        templates = await ContractTemplateModel.findByType(type);
      } else {
        templates = await ContractTemplateModel.findActiveTemplates();
      }

      return templates.map(template => template.toObject() as any);
    } catch (error) {
      throw new Error(`Failed to get templates: ${error.message}`);
    }
  }

  async updateTemplate(templateId: string, updates: Partial<ContractTemplate>, updatedBy: string): Promise<ContractTemplate> {
    try {
      const template = await ContractTemplateModel.findOne({ id: templateId });
      if (!template) {
        throw new Error('Template not found');
      }

      Object.assign(template, updates);
      (template as any).updatedBy = updatedBy;
      await template.save();

      return template.toObject() as any;
    } catch (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }
  }
}

export default new ContractService();