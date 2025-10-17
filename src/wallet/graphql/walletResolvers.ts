import { Wallet } from '../models/Wallet';
import { EnhancedWallet } from '../models/EnhancedWallet';
import { Transaction } from '../models/Transaction';
import { PaymentMethod } from '../models/PaymentMethod';
import { WalletService } from '../services/walletService';
import { PaymentMethodService } from '../services/paymentMethodService';
import { CryptoService } from '../services/cryptoService';
import { UnifiedPaymentService } from '../services/UnifiedPaymentService';
import { PriceService } from '../services/PriceService';
import { SecurityService } from '../services/SecurityService';
import { MobileMoneyService } from '../services/MobileMoneyService';
import User from '../../users/models/userModel';
import Property from '../../property/model/propertyModel';
import { Service } from '../../service-marketplace/models/Service';
import { Notification } from '../../notification/models/Notification';
import { NotificationPreference } from '../../notification/models/NotificationPreference';
import { NotificationService } from '../../services/notificationServices';
import { InAppNotificationService } from '../../notification/services/InAppNotificationService';
import config from '../../../config';

// Instance globale des services
const notificationService = new NotificationService();
const inAppService = new InAppNotificationService();
const priceService = new PriceService();
const securityService = new SecurityService();
const mobileMoneyService = new MobileMoneyService();

export const walletResolvers = {
  Query: {
    wallet: async (_, __, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const walletService = new WalletService();
        let wallet = await walletService.getWallet(user.userId);

        if (!wallet) {
          wallet = await walletService.createWallet(user.userId);
        }

        return wallet;
      } catch (error) {
        throw new Error(`Error fetching wallet: ${error.message}`);
      }
    },

    transaction: async (_, { id }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const walletService = new WalletService();
        const transaction = await walletService.getTransactionById(user.userId, id);

        if (!transaction) throw new Error('Transaction not found');

        return transaction;
      } catch (error) {
        throw new Error(`Error fetching transaction: ${error.message}`);
      }
    },

    transactions: async (_, { filters, pagination }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const limit = pagination?.limit || 50;
        const skip = ((pagination?.page || 1) - 1) * limit;

        // Construire la query
        const query: any = {
          $or: [{ userId: user.userId }, { recipientId: user.userId }]
        };

        if (filters?.type) query.type = filters.type;
        if (filters?.status) query.status = filters.status;
        if (filters?.currency) query.currency = filters.currency;
        if (filters?.paymentMethodId) query.paymentMethodId = filters.paymentMethodId;

        if (filters?.minAmount || filters?.maxAmount) {
          query.amount = {};
          if (filters.minAmount) query.amount.$gte = filters.minAmount;
          if (filters.maxAmount) query.amount.$lte = filters.maxAmount;
        }

        if (filters?.dateFrom || filters?.dateTo) {
          query.createdAt = {};
          if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
          if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
        }

        const [transactions, total] = await Promise.all([
          Transaction.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
          Transaction.countDocuments(query)
        ]);

        const edges = transactions.map((transaction, index) => ({
          node: transaction,
          cursor: Buffer.from((skip + index).toString()).toString('base64')
        }));

        return {
          edges,
          pageInfo: {
            hasNextPage: skip + limit < total,
            hasPreviousPage: skip > 0,
            startCursor: edges[0]?.cursor,
            endCursor: edges[edges.length - 1]?.cursor
          },
          totalCount: total
        };
      } catch (error) {
        throw new Error(`Error fetching transactions: ${error.message}`);
      }
    },

    paymentMethods: async (_, __, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const paymentMethodService = new PaymentMethodService();
        return await paymentMethodService.getPaymentMethods(user.userId);
      } catch (error) {
        throw new Error(`Error fetching payment methods: ${error.message}`);
      }
    },

    walletStats: async (_, { dateFrom, dateTo }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const query: any = { userId: user.userId };

        if (dateFrom || dateTo) {
          query.createdAt = {};
          if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
          if (dateTo) query.createdAt.$lte = new Date(dateTo);
        }

        const transactions = await Transaction.find(query);

        const stats = {
          totalTransactions: transactions.length,
          totalVolume: transactions.reduce((sum, t) => sum + t.amount, 0),
          averageTransaction: transactions.length > 0
            ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length
            : 0,
          transactionsByType: [],
          transactionsByStatus: [],
          monthlyVolume: [],
          topPaymentMethods: []
        };

        // Analyser par type
        const typeStats = transactions.reduce((acc, t) => {
          acc[t.type] = (acc[t.type] || 0) + 1;
          return acc;
        }, {});

        stats.transactionsByType = Object.entries(typeStats).map(([type, count]) => ({
          type,
          count,
          volume: transactions.filter(t => t.type === type).reduce((sum, t) => sum + t.amount, 0),
          percentage: (count as number / transactions.length) * 100
        }));

        // Analyser par statut
        const statusStats = transactions.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {});

        stats.transactionsByStatus = Object.entries(statusStats).map(([status, count]) => ({
          status,
          count,
          percentage: (count as number / transactions.length) * 100
        }));

        return stats;
      } catch (error) {
        throw new Error(`Error fetching wallet stats: ${error.message}`);
      }
    },

    // Notification queries
    notifications: async (_, { filters, pagination }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const limit = pagination?.limit || 50;
        const offset = ((pagination?.page || 1) - 1) * limit;

        const query: any = { userId: user.userId };

        if (filters?.type) query.type = filters.type;
        if (filters?.category) query.category = filters.category;
        if (filters?.priority) query.priority = filters.priority;
        if (typeof filters?.isRead === 'boolean') query.isRead = filters.isRead;

        if (filters?.dateFrom || filters?.dateTo) {
          query.createdAt = {};
          if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
          if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
        }

        const [notifications, total, unreadCount] = await Promise.all([
          Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit),
          Notification.countDocuments(query),
          Notification.countDocuments({ userId: user.userId, isRead: false })
        ]);

        const edges = notifications.map((notification, index) => ({
          node: notification,
          cursor: Buffer.from((offset + index).toString()).toString('base64')
        }));

        return {
          edges,
          pageInfo: {
            hasNextPage: offset + limit < total,
            hasPreviousPage: offset > 0,
            startCursor: edges[0]?.cursor,
            endCursor: edges[edges.length - 1]?.cursor
          },
          totalCount: total,
          unreadCount
        };
      } catch (error) {
        throw new Error(`Error fetching notifications: ${error.message}`);
      }
    },

    notificationPreferences: async (_, __, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const preferences = await notificationService.getUserPreferences(user.userId);
        return preferences;
      } catch (error) {
        throw new Error(`Error fetching notification preferences: ${error.message}`);
      }
    },

    unreadNotificationsCount: async (_, __, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        return await Notification.countDocuments({
          userId: user.userId,
          isRead: false
        });
      } catch (error) {
        throw new Error(`Error fetching unread count: ${error.message}`);
      }
    },

    cryptoPrices: async (_, { currencies }) => {
      try {
        if (!config.features?.crypto?.enabled) {
          throw new Error('Crypto functionality is currently disabled');
        }

        const cryptoService = new CryptoService();
        return await cryptoService.getPrices(currencies);
      } catch (error) {
        throw new Error(`Error fetching crypto prices: ${error.message}`);
      }
    },

    cryptoPortfolio: async (_, __, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        if (!config.features?.crypto?.enabled) {
          throw new Error('Crypto functionality is currently disabled');
        }

        const wallet = await Wallet.findOne({ userId: user.userId });
        return wallet?.cryptoBalances || [];
      } catch (error) {
        throw new Error(`Error fetching crypto portfolio: ${error.message}`);
      }
    },

    cryptoConfig: async () => {
      return {
        enabled: config.features?.crypto?.enabled || false,
        supportedCurrencies: config.features?.crypto?.supportedCurrencies || [],
        minimumBuyAmount: config.features?.crypto?.minimumBuyAmount || 10,
        maximumBuyAmount: config.features?.crypto?.maximumBuyAmount || 10000,
        transactionFeePercentage: config.features?.crypto?.transactionFeePercentage || 1
      };
    },

    // Enhanced wallet queries
    enhancedWallet: async (_, __, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        let wallet = await EnhancedWallet.findOne({ userId: user.userId });
        if (!wallet) {
          wallet = await EnhancedWallet.create({
            userId: user.userId,
            fiatCurrencies: [{
              code: 'EUR',
              name: 'Euro',
              balance: 0,
              isDefault: true,
              lastUpdated: new Date()
            }],
            cryptoCurrencies: [],
            paymentMethods: [],
            transactions: []
          });
        }

        return wallet;
      } catch (error) {
        throw new Error(`Error fetching enhanced wallet: ${error.message}`);
      }
    },

    convertCurrency: async (_, { fromCurrency, toCurrency, amount }) => {
      try {
        return await priceService.convertCurrency(fromCurrency, toCurrency, amount);
      } catch (error) {
        throw new Error(`Error converting currency: ${error.message}`);
      }
    },

    validateTransaction: async (_, { amount, currency, paymentMethod }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const wallet = await EnhancedWallet.findOne({ userId: user.userId });
        if (!wallet) throw new Error('Wallet not found');

        return await securityService.validateTransaction(
          user.userId,
          amount,
          currency,
          paymentMethod,
          wallet.transactions,
          wallet.security as any
        );
      } catch (error) {
        throw new Error(`Error validating transaction: ${error.message}`);
      }
    },

    // Mobile Money queries
    getMobileMoneyProviders: async (_, { countryCode }) => {
      try {
        if (countryCode) {
          return mobileMoneyService.getProvidersByCountry(countryCode);
        }
        return mobileMoneyService.getAllProviders();
      } catch (error) {
        throw new Error(`Error fetching mobile money providers: ${error.message}`);
      }
    },

    validatePhoneNumber: async (_, { phoneNumber, countryCode }) => {
      try {
        return mobileMoneyService.validatePhoneNumber(phoneNumber, countryCode);
      } catch (error) {
        throw new Error(`Error validating phone number: ${error.message}`);
      }
    },

    calculateMobileMoneyFees: async (_, { providerId, amount, type }) => {
      try {
        return mobileMoneyService.calculateFees(providerId, type, amount);
      } catch (error) {
        throw new Error(`Error calculating mobile money fees: ${error.message}`);
      }
    },

    getSupportedCountries: async () => {
      try {
        return mobileMoneyService.getSupportedCountries();
      } catch (error) {
        throw new Error(`Error fetching supported countries: ${error.message}`);
      }
    },

    getCountryInfo: async (_, { countryCode }) => {
      try {
        return mobileMoneyService.getCountryInfo(countryCode);
      } catch (error) {
        throw new Error(`Error fetching country info: ${error.message}`);
      }
    }
  },

  Mutation: {
    createTransaction: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const walletService = new WalletService();
        const transaction = await walletService.processPayment(user.userId, input);

        // Envoyer une notification
        await notificationService.sendTransactionNotification(
          user.userId,
          input.type,
          input.amount,
          input.currency || 'EUR',
          transaction._id.toString()
        );

        // Notification temps réel
        if (inAppService.isUserConnected(user.userId)) {
          await inAppService.sendStatusUpdate(user.userId, 'transaction_created', {
            transaction,
            wallet: await Wallet.findOne({ userId: user.userId })
          });
        }

        return transaction;
      } catch (error) {
        throw new Error(`Error creating transaction: ${error.message}`);
      }
    },

    // Enhanced unified payment processing
    processUnifiedPayment: async (_, { request }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const paymentRequest = {
          ...request,
          userId: user.userId
        };

        const unifiedPaymentService = UnifiedPaymentService.getInstance();
        const response = await unifiedPaymentService.processPayment(paymentRequest);

        // Send notification for successful payment
        if (response.success) {
          await notificationService.sendTransactionNotification(
            user.userId,
            request.type || 'payment',
            request.amount,
            request.currency || 'EUR',
            response.transactionId
          );
        }

        return response;
      } catch (error) {
        throw new Error(`Error processing unified payment: ${error.message}`);
      }
    },

    purchaseCryptoUnified: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const paymentRequest = {
          amount: input.amount,
          currency: input.currency,
          paymentMethodId: input.paymentMethod,
          userId: user.userId,
          type: 'purchase' as const,
          description: `Purchase ${input.amount} ${input.cryptoCurrency}`,
          cryptoData: {
            network: input.cryptoCurrency,
            toAddress: user.userId
          }
        };

        const unifiedPaymentService = UnifiedPaymentService.getInstance();
        return await unifiedPaymentService.processPayment(paymentRequest);
      } catch (error) {
        throw new Error(`Error purchasing crypto: ${error.message}`);
      }
    },

    transferMoney: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const walletService = new WalletService();
        const transaction = await walletService.transferMoney(user.userId, input);

        // Notifications pour l'expéditeur et le destinataire
        await Promise.all([
          notificationService.sendTransactionNotification(
            user.userId,
            'transfer',
            input.amount,
            input.currency || 'EUR',
            transaction._id.toString()
          ),
          notificationService.sendTransactionNotification(
            input.recipientId,
            'received',
            input.amount,
            input.currency || 'EUR',
            transaction._id.toString()
          )
        ]);

        // Notifications temps réel
        const [senderWallet, recipientWallet] = await Promise.all([
          Wallet.findOne({ userId: user.userId }),
          Wallet.findOne({ userId: input.recipientId })
        ]);

        if (inAppService.isUserConnected(user.userId)) {
          await inAppService.sendStatusUpdate(user.userId, 'transfer_sent', {
            transaction,
            wallet: senderWallet
          });
        }

        if (inAppService.isUserConnected(input.recipientId)) {
          await inAppService.sendStatusUpdate(input.recipientId, 'transfer_received', {
            transaction,
            wallet: recipientWallet
          });
        }

        return transaction;
      } catch (error) {
        throw new Error(`Error transferring money: ${error.message}`);
      }
    },

    addPaymentMethod: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const paymentMethodService = new PaymentMethodService();
        const paymentMethod = await paymentMethodService.createPaymentMethod(user.userId, input);

        // Notification de sécurité
        await notificationService.createNotification({
          userId: user.userId,
          type: 'security',
          category: 'alert',
          title: 'Nouvelle méthode de paiement ajoutée',
          message: `Une nouvelle méthode de paiement "${input.name}" a été ajoutée à votre compte`,
          priority: 'medium',
          metadata: {
            paymentMethodId: paymentMethod._id.toString(),
            actionUrl: '/wallet/payment-methods'
          }
        });

        return paymentMethod;
      } catch (error) {
        throw new Error(`Error adding payment method: ${error.message}`);
      }
    },

    updatePaymentMethod: async (_, { id, input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const paymentMethodService = new PaymentMethodService();
        const paymentMethod = await PaymentMethod.findOne({ _id: id, userId: user.userId });

        if (!paymentMethod) throw new Error('Payment method not found');

        Object.assign(paymentMethod, input);
        await paymentMethod.save();

        return paymentMethod;
      } catch (error) {
        throw new Error(`Error updating payment method: ${error.message}`);
      }
    },

    deletePaymentMethod: async (_, { id }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const paymentMethodService = new PaymentMethodService();
        await paymentMethodService.deletePaymentMethod(user.userId, id);

        // Notification de sécurité
        await notificationService.createNotification({
          userId: user.userId,
          type: 'security',
          category: 'alert',
          title: 'Méthode de paiement supprimée',
          message: 'Une méthode de paiement a été supprimée de votre compte',
          priority: 'medium',
          metadata: {
            actionUrl: '/wallet/payment-methods'
          }
        });

        return true;
      } catch (error) {
        throw new Error(`Error deleting payment method: ${error.message}`);
      }
    },

    setDefaultPaymentMethod: async (_, { id }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const paymentMethodService = new PaymentMethodService();
        await paymentMethodService.setDefaultPaymentMethod(user.userId, id);

        const paymentMethod = await PaymentMethod.findById(id);
        return paymentMethod;
      } catch (error) {
        throw new Error(`Error setting default payment method: ${error.message}`);
      }
    },

    buyCrypto: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        if (!config.features?.crypto?.enabled) {
          throw new Error('Crypto functionality is currently disabled');
        }

        // Vérifier que la devise est supportée
        if (!config.features?.crypto?.supportedCurrencies?.includes(input.currency)) {
          throw new Error(`Currency ${input.currency} is not supported`);
        }

        const cryptoService = new CryptoService();
        const walletService = new WalletService();

        // Obtenir le prix actuel
        const prices = await cryptoService.getPrices([input.currency]);
        const price = prices.find(p => p.currency === input.currency);
        if (!price) throw new Error('Crypto price not available');

        const totalCost = input.amount * price.priceEUR;

        // Vérifier les limites d'achat
        const minAmount = config.features?.crypto?.minimumBuyAmount || 10;
        const maxAmount = config.features?.crypto?.maximumBuyAmount || 10000;

        if (totalCost < minAmount) {
          throw new Error(`Minimum buy amount is ${minAmount} EUR`);
        }

        if (totalCost > maxAmount) {
          throw new Error(`Maximum buy amount is ${maxAmount} EUR`);
        }

        // Effectuer l'achat
        await cryptoService.buyCrypto(user.userId, input.currency, input.amount, totalCost);

        // Créer une transaction
        const transaction = await walletService.createTransaction(user.userId, {
          type: 'crypto',
          amount: totalCost,
          currency: 'EUR',
          description: `Achat de ${input.amount} ${input.currency}`,
          paymentMethodId: input.paymentMethodId,
          cryptoCurrency: input.currency
        });

        // Notification
        await notificationService.createNotification({
          userId: user.userId,
          type: 'wallet',
          category: 'transaction',
          title: `Achat de ${input.currency} effectué`,
          message: `Vous avez acheté ${input.amount} ${input.currency} pour ${totalCost} EUR`,
          metadata: {
            transactionId: transaction._id.toString(),
            amount: totalCost,
            currency: 'EUR',
            cryptoAmount: input.amount,
            cryptoCurrency: input.currency,
            actionUrl: `/wallet/transactions/${transaction._id}`
          }
        });

        return transaction;
      } catch (error) {
        throw new Error(`Error buying crypto: ${error.message}`);
      }
    },

    sellCrypto: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        if (!config.features?.crypto?.enabled) {
          throw new Error('Crypto functionality is currently disabled');
        }

        // Vérifier que la devise est supportée
        if (!config.features?.crypto?.supportedCurrencies?.includes(input.currency)) {
          throw new Error(`Currency ${input.currency} is not supported`);
        }

        const cryptoService = new CryptoService();
        const walletService = new WalletService();

        // Obtenir le prix actuel
        const prices = await cryptoService.getPrices([input.currency]);
        const price = prices.find(p => p.currency === input.currency);
        if (!price) throw new Error('Crypto price not available');

        const totalValue = input.amount * price.priceEUR;

        // Effectuer la vente
        await cryptoService.sellCrypto(user.userId, input.currency, input.amount, totalValue);

        // Créer une transaction
        const transaction = await walletService.createTransaction(user.userId, {
          type: 'crypto',
          amount: totalValue,
          currency: 'EUR',
          description: `Vente de ${input.amount} ${input.currency}`,
          paymentMethodId: input.paymentMethodId,
          cryptoCurrency: input.currency
        });

        // Notification
        await notificationService.createNotification({
          userId: user.userId,
          type: 'wallet',
          category: 'transaction',
          title: `Vente de ${input.currency} effectuée`,
          message: `Vous avez vendu ${input.amount} ${input.currency} pour ${totalValue} EUR`,
          metadata: {
            transactionId: transaction._id.toString(),
            amount: totalValue,
            currency: 'EUR',
            cryptoAmount: input.amount,
            cryptoCurrency: input.currency,
            actionUrl: `/wallet/transactions/${transaction._id}`
          }
        });

        return transaction;
      } catch (error) {
        throw new Error(`Error selling crypto: ${error.message}`);
      }
    },

    // Notification mutations
    createNotification: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        return await notificationService.createNotification({
          ...input,
          userId: user.userId
        });
      } catch (error) {
        throw new Error(`Error creating notification: ${error.message}`);
      }
    },

    markNotificationAsRead: async (_, { id }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        await notificationService.markAsRead(user.userId, id);
        return await Notification.findById(id);
      } catch (error) {
        throw new Error(`Error marking notification as read: ${error.message}`);
      }
    },

    markAllNotificationsAsRead: async (_, __, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        await notificationService.markAllAsRead(user.userId);
        return await Notification.countDocuments({ userId: user.userId, isRead: false });
      } catch (error) {
        throw new Error(`Error marking all notifications as read: ${error.message}`);
      }
    },

    deleteNotification: async (_, { id }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        await notificationService.deleteNotification(user.userId, id);
        return true;
      } catch (error) {
        throw new Error(`Error deleting notification: ${error.message}`);
      }
    },

    updateNotificationPreferences: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        await notificationService.updateUserPreferences(user.userId, input);
        return await notificationService.getUserPreferences(user.userId);
      } catch (error) {
        throw new Error(`Error updating notification preferences: ${error.message}`);
      }
    },

    registerPushToken: async (_, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        await notificationService.registerPushToken(
          user.userId,
          input.token,
          {
            platform: input.platform,
            deviceId: input.deviceId,
            appVersion: input.appVersion
          }
        );

        return true;
      } catch (error) {
        throw new Error(`Error registering push token: ${error.message}`);
      }
    },

    testPushNotification: async (_, __, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        await notificationService.createNotification({
          userId: user.userId,
          type: 'general',
          category: 'message',
          title: 'Test de notification',
          message: 'Ceci est un test de notification push',
          priority: 'low',
          forceChannels: {
            inApp: true,
            push: true,
            email: false
          }
        });

        return true;
      } catch (error) {
        throw new Error(`Error sending test notification: ${error.message}`);
      }
    }
  },

  // Resolvers pour les types
  Wallet: {
    user: async (wallet) => {
      return await User.findById(wallet.userId);
    },

    transactions: async (wallet, { type, limit }) => {
      const query: any = {
        $or: [{ userId: wallet.userId }, { recipientId: wallet.userId }]
      };

      if (type) query.type = type;

      return await Transaction.find(query)
        .sort({ createdAt: -1 })
        .limit(limit || 50);
    },

    paymentMethods: async (wallet) => {
      return await PaymentMethod.find({ userId: wallet.userId, isActive: true });
    },

    totalBalance: (wallet) => {
      return wallet.balance + wallet.pendingBalance;
    },

    formattedBalance: (wallet) => {
      return `${wallet.balance.toFixed(2)} ${wallet.currency}`;
    },

    recentTransactions: async (wallet, { limit }) => {
      return await Transaction.find({
        $or: [{ userId: wallet.userId }, { recipientId: wallet.userId }]
      })
        .sort({ createdAt: -1 })
        .limit(limit || 10);
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

    paymentMethod: async (transaction) => {
      if (!transaction.paymentMethodId) return null;
      return await PaymentMethod.findById(transaction.paymentMethodId);
    },

    relatedProperty: async (transaction) => {
      if (!transaction.metadata?.propertyId) return null;
      return await Property.findById(transaction.metadata.propertyId);
    },

    relatedService: async (transaction) => {
      if (!transaction.metadata?.serviceId) return null;
      return await Service.findById(transaction.metadata.serviceId);
    },

    formattedAmount: (transaction) => {
      return `${transaction.amount.toFixed(2)} ${transaction.currency}`;
    },

    isIncoming: (transaction, __, { user }) => {
      return transaction.recipientId === user?.userId;
    },

    statusColor: (transaction) => {
      const colors = {
        completed: '#28a745',
        pending: '#ffc107',
        failed: '#dc3545',
        cancelled: '#6c757d'
      };
      return colors[transaction.status] || '#6c757d';
    }
  },

  PaymentMethod: {
    user: async (paymentMethod) => {
      return await User.findById(paymentMethod.userId);
    },

    displayName: (paymentMethod) => {
      if (paymentMethod.type === 'card' && paymentMethod.details.last4) {
        return `**** ${paymentMethod.details.last4}`;
      }
      return paymentMethod.name;
    },

    maskedDetails: (paymentMethod) => {
      switch (paymentMethod.type) {
        case 'card':
          return paymentMethod.details.last4 ? `**** ${paymentMethod.details.last4}` : '';
        case 'bank':
          return paymentMethod.details.iban ? `****${paymentMethod.details.iban.slice(-4)}` : '';
        case 'paypal':
          return paymentMethod.details.email || '';
        default:
          return '';
      }
    }
  },

  Notification: {
    user: async (notification) => {
      return await User.findById(notification.userId);
    }
  },

  CryptoBalance: {
    formattedValue: (balance) => {
      return `${balance.value.toFixed(2)} EUR`;
    }
  },

  // Subscriptions pour les mises à jour temps réel
  Subscription: {
    walletUpdated: {
      subscribe: async function* (_, __, { user }) {
        if (!user) throw new Error('Authentication required');

        // Implémentation avec les événements
        yield {
          walletUpdated: await Wallet.findOne({ userId: user.userId })
        };
      }
    },

    transactionCreated: {
      subscribe: async function* (_, __, { user }) {
        if (!user) throw new Error('Authentication required');

        // À implémenter avec votre système de subscriptions
        yield {
          transactionCreated: null
        };
      }
    },

    notificationReceived: {
      subscribe: async function* (_, __, { user }) {
        if (!user) throw new Error('Authentication required');

        // À implémenter avec votre système de subscriptions
        yield {
          notificationReceived: null
        };
      }
    },

    balanceUpdated: {
      subscribe: async function* (_, __, { user }) {
        if (!user) throw new Error('Authentication required');

        yield {
          balanceUpdated: await Wallet.findOne({ userId: user.userId })
        };
      }
    }
  }
};