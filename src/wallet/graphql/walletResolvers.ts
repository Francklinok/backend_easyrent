import { Wallet } from '../models/Wallet';
import { Transaction } from '../models/Transaction';
import { PaymentMethod } from '../models/PaymentMethod';
import { WalletService } from '../services/walletService';
import { PaymentMethodService } from '../services/paymentMethodService';
import { CryptoService } from '../services/cryptoService';
import User from '../../users/models/userModel';
import Property from '../../property/model/propertyModel';
import { Service } from '../../service-marketplace/models/Service';

export const walletResolvers = {
  Query: {
    wallet: async (_, __, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const walletService = new WalletService();
      let wallet = await walletService.getWallet(user.userId);
      
      if (!wallet) {
        wallet = await walletService.createWallet(user.userId);
      }
      
      return wallet;
    },
    
    transaction: async (_, { id }, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const walletService = new WalletService();
      return await walletService.getTransactionById(user.userId, id);
    }
  },

  Mutation: {
    createTransaction: async (_, { input }, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const walletService = new WalletService();
      return await walletService.processPayment(user.userId, input);
    },
    
    transferMoney: async (_, { input }, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const walletService = new WalletService();
      return await walletService.transferMoney(user.userId, input);
    }
  },

  Wallet: {
    user: async (wallet) => {
      return await User.findById(wallet.userId);
    },
    
    transactions: async (wallet, { type, limit }) => {
      const walletService = new WalletService();
      const transactions = await walletService.getTransactions(wallet.userId, limit || 50);
      
      if (type) {
        return transactions.filter(t => t.type === type);
      }
      
      return transactions;
    },
    
    paymentMethods: async (wallet) => {
      const paymentMethodService = new PaymentMethodService();
      return await paymentMethodService.getPaymentMethods(wallet.userId);
    }
  },

  Transaction: {
    user: async (transaction) => {
      return await User.findById(transaction.userId);
    },
    
    recipient: async (transaction) => {
      if (!transaction.recipientId) return null;
      return await User.findById(transaction.recipientId);
    },
    
    relatedProperty: async (transaction) => {
      // Logique pour déterminer si la transaction est liée à une propriété
      // Par exemple, si la description contient "loyer" ou "caution"
      if (transaction.description.toLowerCase().includes('loyer') || 
          transaction.description.toLowerCase().includes('caution')) {
        // Ici on pourrait avoir un champ propertyId dans les métadonnées
        return null; // À implémenter selon votre logique métier
      }
      return null;
    },
    
    relatedService: async (transaction) => {
      // Logique similaire pour les services
      if (transaction.description.toLowerCase().includes('service') ||
          transaction.description.toLowerCase().includes('abonnement')) {
        return null; // À implémenter selon votre logique métier
      }
      return null;
    },
    
    paymentMethod: async (transaction) => {
      if (!transaction.paymentMethodId) return null;
      return await PaymentMethod.findById(transaction.paymentMethodId);
    }
  },

  // Subscriptions pour les mises à jour en temps réel
  Subscription: {
    walletUpdated: {
      subscribe: async function* (_, { userId }) {
        // Implémentation WebSocket/Server-Sent Events
        // À implémenter avec votre système de subscriptions
        yield {
          walletUpdated: {
            wallet: await Wallet.findOne({ userId }),
            type: 'BALANCE_UPDATED'
          }
        };
      }
    }
  }
};