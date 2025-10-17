import { AuthenticationError, ForbiddenError } from '../../../graphql/errors';
import { PubSub } from 'graphql-subscriptions';
import ContractService from '../services/ContractService';
import {
  Contract,
  ContractGenerationRequest,
  ContractSigningRequest,
  ContractUpdateRequest,
  ContractSearchFilters,
  ContractTemplate,
  ContractType
} from '../types';

const pubsub = new PubSub();

// Events
const CONTRACT_STATUS_CHANGED = 'CONTRACT_STATUS_CHANGED';
const CONTRACT_SIGNED = 'CONTRACT_SIGNED';
const NEW_CONTRACT_CREATED = 'NEW_CONTRACT_CREATED';

export const contractResolvers = {
  Query: {
    contract: async (_: any, { id }: { id: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      const contract = await ContractService.getContract(id);
      if (!contract) return null;

      // Vérifier les permissions (utilisateur doit être partie du contrat ou créateur)
      const hasAccess = contract.createdBy === user.id ||
                       contract.parties?.some((party: any) => party.userId === user.id);

      if (!hasAccess) {
        throw new ForbiddenError('Access denied to this contract');
      }

      return contract;
    },

    contracts: async (_: any, { filters }: { filters?: ContractSearchFilters }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      // Admin peut voir tous les contrats, sinon filtrer par utilisateur
      if (!user.isAdmin) {
        filters = { ...filters, userId: user.id };
      }

      return await ContractService.searchContracts(filters || {});
    },

    contractsByUser: async (_: any, { userId }: { userId: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      // Utilisateur ne peut voir que ses propres contrats sauf s'il est admin
      if (!user.isAdmin && user.id !== userId) {
        throw new ForbiddenError('Access denied');
      }

      return await ContractService.getContractsByUser(userId);
    },

    contractsByProperty: async (_: any, { propertyId }: { propertyId: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      return await ContractService.getContractsByProperty(propertyId);
    },

    contractAnalytics: async (_: any, { filters }: { filters?: ContractSearchFilters }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      // Seuls les admins et propriétaires peuvent voir les analytics
      if (!user.isAdmin && !user.isLandlord) {
        throw new ForbiddenError('Access denied to analytics');
      }

      return await ContractService.getContractAnalytics(filters);
    },

    contractTemplate: async (_: any, { id }: { id: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      const templates = await ContractService.getTemplates();
      return templates.find(t => t.id === id) || null;
    },

    contractTemplates: async (_: any, { type }: { type?: ContractType }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      return await ContractService.getTemplates(type);
    },

    contractTemplatesByType: async (_: any, { type }: { type: ContractType }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      return await ContractService.getTemplates(type);
    }
  },

  Mutation: {
    createContract: async (_: any, { input }: { input: ContractGenerationRequest }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      // Vérifier que l'utilisateur est autorisé à créer ce type de contrat
      const isAuthorized = input.parties.some(party => party.userId === user.id) || user.isAdmin;
      if (!isAuthorized) {
        throw new ForbiddenError('Unauthorized to create this contract');
      }

      const contract = await ContractService.createContract(input, user.id);

      // Publier l'événement
      pubsub.publish(NEW_CONTRACT_CREATED, {
        newContractCreated: contract,
        userId: user.id
      });

      return contract;
    },

    generateContractFile: async (_: any, { contractId }: { contractId: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      const contract = await ContractService.getContract(contractId);
      if (!contract) throw new Error('Contract not found');

      // Vérifier les permissions
      const hasAccess = contract.createdBy === user.id ||
                       contract.parties?.some((party: any) => party.userId === user.id);

      if (!hasAccess) {
        throw new ForbiddenError('Access denied to this contract');
      }

      return await ContractService.generateContractFile(contractId, user.id);
    },

    signContract: async (_: any, { input }: { input: ContractSigningRequest }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      // Vérifier que l'utilisateur peut signer en tant que cette partie
      const contract = await ContractService.getContract(input.contractId);
      if (!contract) throw new Error('Contract not found');

      const party = contract.parties?.find((p: any) => p.id === input.partyId);
      if (!party || party.userId !== user.id) {
        throw new ForbiddenError('Unauthorized to sign as this party');
      }

      const signedContract = await ContractService.signContract(input);

      // Publier l'événement
      pubsub.publish(CONTRACT_SIGNED, {
        contractSigned: signedContract,
        contractId: input.contractId
      });

      pubsub.publish(CONTRACT_STATUS_CHANGED, {
        contractStatusChanged: signedContract,
        contractId: input.contractId
      });

      return signedContract;
    },

    updateContract: async (_: any, { input }: { input: ContractUpdateRequest }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      const contract = await ContractService.getContract(input.contractId);
      if (!contract) throw new Error('Contract not found');

      // Seul le créateur peut modifier le contrat
      if (contract.createdBy !== user.id && !user.isAdmin) {
        throw new ForbiddenError('Unauthorized to update this contract');
      }

      const updatedContract = await ContractService.updateContract(input, user.id);

      // Publier l'événement si le statut a changé
      if (input.status) {
        pubsub.publish(CONTRACT_STATUS_CHANGED, {
          contractStatusChanged: updatedContract,
          contractId: input.contractId
        });
      }

      return updatedContract;
    },

    deleteContract: async (_: any, { contractId }: { contractId: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      return await ContractService.deleteContract(contractId, user.id);
    },

    createContractTemplate: async (_: any, { input }: { input: Partial<ContractTemplate> }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      // Seuls les admins peuvent créer des templates
      if (!user.isAdmin) {
        throw new ForbiddenError('Admin access required to create templates');
      }

      return await ContractService.createTemplate(input, user.id);
    },

    updateContractTemplate: async (_: any, { templateId, input }: { templateId: string; input: Partial<ContractTemplate> }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      // Seuls les admins peuvent modifier des templates
      if (!user.isAdmin) {
        throw new ForbiddenError('Admin access required to update templates');
      }

      return await ContractService.updateTemplate(templateId, input, user.id);
    },

    deleteContractTemplate: async (_: any, { templateId }: { templateId: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      // Seuls les admins peuvent supprimer des templates
      if (!user.isAdmin) {
        throw new ForbiddenError('Admin access required to delete templates');
      }

      const templates = await ContractService.getTemplates();
      const template = templates.find(t => t.id === templateId);
      if (!template) throw new Error('Template not found');

      return await ContractService.updateTemplate(templateId, { isActive: false }, user.id);
    },

    activateContractTemplate: async (_: any, { templateId }: { templateId: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      if (!user.isAdmin) {
        throw new ForbiddenError('Admin access required');
      }

      return await ContractService.updateTemplate(templateId, { isActive: true }, user.id);
    },

    deactivateContractTemplate: async (_: any, { templateId }: { templateId: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      if (!user.isAdmin) {
        throw new ForbiddenError('Admin access required');
      }

      return await ContractService.updateTemplate(templateId, { isActive: false }, user.id);
    }
  },

  Subscription: {
    contractStatusChanged: {
      subscribe: (_: any, { contractId }: { contractId: string }, { user }: any) => {
        if (!user) throw new AuthenticationError('Authentication required');
        // @ts-ignore
        return pubsub.asyncIterator([CONTRACT_STATUS_CHANGED]);
      },
      resolve: (payload: any, { contractId }: { contractId: string }) => {
        return payload.contractId === contractId ? payload.contractStatusChanged : null;
      }
    },

    contractSigned: {
      subscribe: (_: any, { contractId }: { contractId: string }, { user }: any) => {
        if (!user) throw new AuthenticationError('Authentication required');
        // @ts-ignore
        return pubsub.asyncIterator([CONTRACT_SIGNED]);
      },
      resolve: (payload: any, { contractId }: { contractId: string }) => {
        return payload.contractId === contractId ? payload.contractSigned : null;
      }
    },

    newContractCreated: {
      subscribe: (_: any, { userId }: { userId: string }, { user }: any) => {
        if (!user) throw new AuthenticationError('Authentication required');

        // Utilisateur ne peut s'abonner qu'à ses propres contrats
        if (user.id !== userId && !user.isAdmin) {
          throw new ForbiddenError('Access denied');
        }

        // @ts-ignore
        return pubsub.asyncIterator([NEW_CONTRACT_CREATED]);
      },
      resolve: (payload: any, { userId }: { userId: string }) => {
        return payload.userId === userId ? payload.newContractCreated : null;
      }
    }
  },

  // Field resolvers
  Contract: {
    template: async (parent: any) => {
      const templates = await ContractService.getTemplates();
      return templates.find(t => t.id === parent.templateId) || null;
    },

    parties: async (parent: any) => {
      // Les parties sont déjà populate dans le service
      return parent.parties || [];
    },

    property: async (parent: any) => {
      if (!parent.propertyId) return null;
      // TODO: Implémenter la récupération de la propriété via le service approprié
      return { id: parent.propertyId, title: 'Property Title' };
    },

    reservation: async (parent: any) => {
      if (!parent.reservationId) return null;
      // TODO: Implémenter la récupération de la réservation via le service approprié
      return { id: parent.reservationId };
    }
  },

  ContractParty: {
    user: async (parent: any) => {
      // TODO: Implémenter la récupération de l'utilisateur via le service approprié
      return { id: parent.userId, fullName: 'User Name', email: 'user@example.com' };
    },

    contract: async (parent: any) => {
      return await ContractService.getContract(parent.contractId);
    }
  }
};

export default contractResolvers;