import { SmartContract, ISmartContract } from '../models/SmartContract';
import { PropertyToken } from '../models/PropertyToken';
import { UnifiedNotificationService } from '../../notification';

export interface CreateSmartContractInput {
  contractType: 'lease' | 'sale' | 'escrow' | 'revenue_sharing' | 'utility_token';
  propertyId: string;
  blockchain: 'ethereum' | 'polygon' | 'bsc' | 'avalanche';
  parties: {
    role: 'landlord' | 'tenant' | 'buyer' | 'seller' | 'investor' | 'platform';
    userId: string;
    walletAddress: string;
  }[];
  terms: any;
  autoExecute?: boolean;
}

export interface DeployContractInput {
  contractId: string;
  gasLimit?: number;
  gasPrice?: number;
}

export class SmartContractService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async createContract(input: CreateSmartContractInput): Promise<ISmartContract> {
    try {
      const contractId = this.generateContractId(input.contractType);

      // Générer l'ABI selon le type de contrat
      const abi = this.generateABI(input.contractType);
      const functions = this.generateFunctions(input.contractType);

      const contract = new SmartContract({
        contractId,
        contractType: input.contractType,
        propertyId: input.propertyId,
        blockchain: input.blockchain,
        abi,
        parties: input.parties,
        terms: input.terms,
        functions,
        status: 'draft',
        security: {
          isAudited: false,
          vulnerabilities: [],
          pausedFunctions: []
        },
        executionHistory: [],
        milestones: this.generateMilestones(input.contractType, input.terms)
      });

      // Configuration spécifique selon le type
      if (input.contractType === 'lease') {
        contract.paymentSchedule = {
          frequency: 'monthly',
          amount: input.terms.monthlyRent,
          currency: input.terms.currency,
          nextPaymentDate: input.terms.startDate,
          totalPayments: input.terms.leaseDuration,
          completedPayments: 0,
          autoExecute: input.autoExecute || false
        };
      }

      await contract.save();

      // Notifications aux parties
      for (const party of input.parties) {
        await this.notificationService.createNotification({
          userId: party.userId,
          type: 'property',
          category: 'message',
          title: `Nouveau contrat intelligent créé`,
          message: `Un contrat intelligent de type ${input.contractType} a été créé pour la propriété`,
          metadata: {
            contractId,
            contractType: input.contractType,
            propertyId: input.propertyId,
            role: party.role,
            actionUrl: `/contracts/${contractId}`
          }
        });
      }

      return contract;
    } catch (error) {
      throw new Error(`Erreur lors de la création du contrat: ${error.message}`);
    }
  }

  async deployContract(input: DeployContractInput): Promise<ISmartContract> {
    try {
      const contract = await SmartContract.findOne({ contractId: input.contractId });
      if (!contract) throw new Error('Contrat non trouvé');

      // Simulation du déploiement - en production, cela interagirait avec Web3
      const contractAddress = this.simulateDeployment(contract.blockchain);

      contract.contractAddress = contractAddress;
      contract.status = 'deployed';
      contract.deployedAt = new Date();

      await contract.save();

      // Notifications de déploiement
      for (const party of contract.parties) {
        await this.notificationService.createNotification({
          userId: party.userId,
          type: 'property',
          category: 'alert',
          title: `Contrat intelligent déployé`,
          message: `Le contrat ${contract.contractType} a été déployé sur ${contract.blockchain}`,
          priority: 'high',
          metadata: {
            contractId: input.contractId,
            contractAddress,
            blockchain: contract.blockchain,
            actionUrl: `/contracts/${input.contractId}`
          }
        });
      }

      return contract;
    } catch (error) {
      throw new Error(`Erreur lors du déploiement: ${error.message}`);
    }
  }

  async executeFunction(
    contractId: string,
    functionName: string,
    parameters: any,
    executedBy: string
  ): Promise<any> {
    try {
      const contract = await SmartContract.findOne({ contractId });
      if (!contract) throw new Error('Contrat non trouvé');
      if (contract.status !== 'active') throw new Error('Contrat non actif');

      // Vérifier les permissions
      const contractFunction = contract.functions.find(f => f.name === functionName);
      if (!contractFunction) throw new Error('Fonction non trouvée');

      if (!this.hasPermission(contract, contractFunction, executedBy)) {
        throw new Error('Permissions insuffisantes');
      }

      // Simulation d'exécution - en production, cela interagirait avec Web3
      const result = await this.simulateExecution(functionName, parameters);
      const transactionHash = this.generateTransactionHash();

      // Enregistrer l'exécution
      contract.executionHistory.push({
        functionName,
        executedBy,
        executedAt: new Date(),
        transactionHash,
        gasUsed: Math.floor(Math.random() * 100000) + 21000,
        success: true,
        parameters,
        result
      });

      // Mettre à jour les milestones si nécessaire
      await this.updateMilestones(contract, functionName, result);

      await contract.save();

      // Notification d'exécution
      await this.notificationService.createNotification({
        userId: executedBy,
        type: 'property',
        category: 'transaction',
        title: `Fonction de contrat exécutée`,
        message: `La fonction ${functionName} a été exécutée avec succès`,
        metadata: {
          contractId,
          functionName,
          transactionHash,
          result,
          actionUrl: `/contracts/${contractId}`
        }
      });

      return result;
    } catch (error) {
      // Enregistrer l'échec
      const contract = await SmartContract.findOne({ contractId });
      if (contract) {
        contract.executionHistory.push({
          functionName,
          executedBy,
          executedAt: new Date(),
          transactionHash: this.generateTransactionHash(),
          gasUsed: 21000,
          success: false,
          parameters,
          error: error.message
        });
        await contract.save();
      }

      throw new Error(`Erreur lors de l'exécution: ${error.message}`);
    }
  }

  async createEscrowContract(paymentData: any): Promise<string> {
    try {
      const contractInput: CreateSmartContractInput = {
        contractType: 'escrow',
        propertyId: paymentData.propertyId,
        blockchain: this.getBlockchainFromNetwork(paymentData.network),
        parties: [
          {
            role: 'tenant',
            userId: paymentData.userId,
            walletAddress: paymentData.fromAddress
          },
          {
            role: 'landlord',
            userId: paymentData.metadata.landlordId,
            walletAddress: paymentData.toAddress
          }
        ],
        terms: {
          escrowAmount: paymentData.amountFiat,
          currency: paymentData.fiatCurrency,
          releaseConditions: paymentData.escrow?.releaseConditions || [],
          startDate: new Date(),
          endDate: paymentData.escrow?.releaseDate
        }
      };

      const contract = await this.createContract(contractInput);
      const deployed = await this.deployContract({ contractId: contract.contractId });

      return deployed.contractAddress!;
    } catch (error) {
      throw new Error(`Erreur lors de la création du contrat d'escrow: ${error.message}`);
    }
  }

  async releaseEscrow(escrowAddress: string, recipient: string): Promise<any> {
    try {
      const contract = await SmartContract.findOne({ contractAddress: escrowAddress });
      if (!contract) throw new Error('Contrat d\'escrow non trouvé');

      return await this.executeFunction(
        contract.contractId,
        'releaseEscrow',
        { recipient },
        'system' // Exécuté par le système
      );
    } catch (error) {
      throw new Error(`Erreur lors de la libération de l'escrow: ${error.message}`);
    }
  }

  async getContract(contractId: string): Promise<ISmartContract | null> {
    try {
      const contract = await SmartContract.findOne({ contractId });
      if (!contract) throw new Error('Contrat non trouvé');
      return contract;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération du contrat: ${error.message}`);
    }
  }

  async getContractsByProperty(propertyId: string): Promise<ISmartContract[]> {
    try {
      return await SmartContract.find({ propertyId })
        .sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des contrats: ${error.message}`);
    }
  }

  async getContractsByUser(userId: string): Promise<ISmartContract[]> {
    try {
      return await SmartContract.find({ 'parties.userId': userId })
        .sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des contrats utilisateur: ${error.message}`);
    }
  }

  async pauseContract(contractId: string, pausedBy: string): Promise<ISmartContract> {
    try {
      const contract = await SmartContract.findOne({ contractId });
      if (!contract) throw new Error('Contrat non trouvé');

      contract.status = 'paused';
      await contract.save();

      // Notifications
      for (const party of contract.parties) {
        await this.notificationService.createNotification({
          userId: party.userId,
          type: 'property',
          category: 'alert',
          title: `Contrat mis en pause`,
          message: `Le contrat ${contract.contractType} a été mis en pause`,
          priority: 'high',
          metadata: {
            contractId,
            pausedBy,
            actionUrl: `/contracts/${contractId}`
          }
        });
      }

      return contract;
    } catch (error) {
      throw new Error(`Erreur lors de la pause du contrat: ${error.message}`);
    }
  }

  async terminateContract(contractId: string, terminatedBy: string, reason: string): Promise<ISmartContract> {
    try {
      const contract = await SmartContract.findOne({ contractId });
      if (!contract) throw new Error('Contrat non trouvé');

      contract.status = 'terminated';
      contract.terminatedAt = new Date();
      await contract.save();

      // Notifications
      for (const party of contract.parties) {
        await this.notificationService.createNotification({
          userId: party.userId,
          type: 'property',
          category: 'alert',
          title: `Contrat terminé`,
          message: `Le contrat ${contract.contractType} a été terminé. Raison: ${reason}`,
          priority: 'high',
          metadata: {
            contractId,
            terminatedBy,
            reason,
            actionUrl: `/contracts/${contractId}`
          }
        });
      }

      return contract;
    } catch (error) {
      throw new Error(`Erreur lors de la terminaison du contrat: ${error.message}`);
    }
  }

  private generateContractId(type: string): string {
    return `SC_${type.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateABI(contractType: string): any[] {
    // ABI basique selon le type de contrat
    const baseABI = [
      {
        "inputs": [],
        "name": "getContractInfo",
        "outputs": [{"type": "string", "name": ""}],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    switch (contractType) {
      case 'lease':
        return [
          ...baseABI,
          {
            "inputs": [{"type": "uint256", "name": "amount"}],
            "name": "payRent",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "terminateLease",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ];

      case 'escrow':
        return [
          ...baseABI,
          {
            "inputs": [{"type": "address", "name": "recipient"}],
            "name": "releaseEscrow",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ];

      default:
        return baseABI;
    }
  }

  private generateFunctions(contractType: string): any[] {
    const baseFunctions = [
      {
        name: 'getContractInfo',
        description: 'Obtenir les informations du contrat',
        parameters: [],
        access: 'public'
      }
    ];

    switch (contractType) {
      case 'lease':
        return [
          ...baseFunctions,
          {
            name: 'payRent',
            description: 'Payer le loyer mensuel',
            parameters: [
              { name: 'amount', type: 'uint256', description: 'Montant du loyer' }
            ],
            access: 'parties_only'
          },
          {
            name: 'terminateLease',
            description: 'Terminer le bail',
            parameters: [],
            access: 'parties_only'
          }
        ];

      case 'escrow':
        return [
          ...baseFunctions,
          {
            name: 'releaseEscrow',
            description: 'Libérer les fonds en escrow',
            parameters: [
              { name: 'recipient', type: 'address', description: 'Adresse du destinataire' }
            ],
            access: 'owner_only'
          }
        ];

      default:
        return baseFunctions;
    }
  }

  private generateMilestones(contractType: string, terms: any): any[] {
    switch (contractType) {
      case 'lease':
        return [
          {
            id: 'lease_start',
            description: 'Début du bail',
            condition: `Date >= ${terms.startDate}`,
            status: 'pending'
          },
          {
            id: 'first_payment',
            description: 'Premier paiement de loyer',
            condition: 'Paiement reçu',
            status: 'pending'
          }
        ];

      case 'sale':
        return [
          {
            id: 'deposit_paid',
            description: 'Acompte payé',
            condition: 'Dépôt reçu',
            status: 'pending'
          },
          {
            id: 'full_payment',
            description: 'Paiement complet',
            condition: 'Montant total reçu',
            status: 'pending'
          }
        ];

      default:
        return [];
    }
  }

  private hasPermission(contract: ISmartContract, contractFunction: any, userId: string): boolean {
    if (contractFunction.access === 'public') return true;

    const userParty = contract.parties.find(p => p.userId === userId);
    if (!userParty) return false;

    if (contractFunction.access === 'parties_only') return true;
    if (contractFunction.access === 'owner_only') {
      return userParty.role === 'landlord' || userParty.role === 'seller';
    }

    return false;
  }

  private async simulateExecution(functionName: string, parameters: any): Promise<any> {
    // Simulation d'exécution de fonction - en production, cela utiliserait Web3
    switch (functionName) {
      case 'payRent':
        return { success: true, rentPaid: parameters.amount };
      case 'releaseEscrow':
        return { success: true, released: true, recipient: parameters.recipient };
      default:
        return { success: true };
    }
  }

  private simulateDeployment(blockchain: string): string {
    // Simulation d'une adresse de contrat
    const prefixes = {
      'ethereum': '0x',
      'polygon': '0x',
      'bsc': '0x',
      'avalanche': '0x'
    };

    const prefix = prefixes[blockchain] || '0x';
    return prefix + Math.random().toString(16).substr(2, 40);
  }

  private generateTransactionHash(): string {
    return '0x' + Math.random().toString(16).substr(2, 64);
  }

  private getBlockchainFromNetwork(network: string): 'ethereum' | 'polygon' | 'bsc' | 'avalanche' {
    const mapping = {
      'ethereum': 'ethereum',
      'polygon': 'polygon',
      'bsc': 'bsc',
      'bitcoin': 'ethereum' // Fallback
    };
    return mapping[network] as any || 'polygon';
  }

  private async updateMilestones(contract: ISmartContract, functionName: string, result: any): Promise<void> {
    switch (functionName) {
      case 'payRent':
        const rentMilestone = contract.milestones.find(m => m.id === 'first_payment');
        if (rentMilestone && rentMilestone.status === 'pending') {
          rentMilestone.status = 'met';
          rentMilestone.completedAt = new Date();
        }
        break;

      case 'releaseEscrow':
        const escrowMilestone = contract.milestones.find(m => m.id === 'escrow_release');
        if (escrowMilestone) {
          escrowMilestone.status = 'met';
          escrowMilestone.completedAt = new Date();
        }
        break;
    }
  }
}