import { Invoice, IInvoice } from '../models/Invoice';
import { PaymentIntent, IPaymentIntent } from '../models/PaymentIntent';
import { Wallet, IWallet } from '../models/Wallet';
import { Transaction, ITransaction } from '../models/Transaction';
import { InvoiceService } from '../services/InvoiceService';
import { CentralWalletService } from '../services/CentralWalletService';
import { PubSub, withFilter } from 'graphql-subscriptions';
import { ServiceSubscription } from '../../service-marketplace/models/ServiceSubscription';
import { Service } from '../../service-marketplace/models/Service';
import Activity from '../../activity/model/activitySchema';
import Property from '../../property/model/propertyModel';

const pubsub = new PubSub();
const invoiceService = InvoiceService.getInstance();
const centralWalletService = CentralWalletService.getInstance();

// Event names pour les subscriptions
const INVOICE_STATUS_CHANGED = 'INVOICE_STATUS_CHANGED';
const PAYMENT_INTENT_STATUS_CHANGED = 'PAYMENT_INTENT_STATUS_CHANGED';
const WALLET_BALANCE_UPDATED = 'WALLET_BALANCE_UPDATED';
const NEW_TRANSACTION_RECEIVED = 'NEW_TRANSACTION_RECEIVED';

export const invoiceResolvers = {
  Query: {
    // Invoice queries
    invoice: async (_: any, { id }: { id: string }, context: any) => {
      return await Invoice.findById(id);
    },

    invoiceByNumber: async (_: any, { invoiceNumber }: { invoiceNumber: string }) => {
      return await invoiceService.getInvoiceByNumber(invoiceNumber);
    },

    myInvoices: async (
      _: any,
      { filters, page = 1, limit = 20 }: { filters?: any; page?: number; limit?: number },
      context: any
    ) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      return await invoiceService.getClientInvoices(userId, filters, page, limit);
    },

    myReceivedInvoices: async (
      _: any,
      { filters, page = 1, limit = 20 }: { filters?: any; page?: number; limit?: number },
      context: any
    ) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      return await invoiceService.getOwnerInvoices(userId, filters, page, limit);
    },

    overdueInvoices: async (_: any, { daysOverdue = 0 }: { daysOverdue?: number }) => {
      return await invoiceService.getOverdueInvoices(daysOverdue);
    },

    invoiceStats: async (_: any, { isOwner = false }: { isOwner?: boolean }, context: any) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      return await invoiceService.getInvoiceStats(userId, isOwner);
    },

    // Payment Intent queries
    paymentIntent: async (_: any, { intentId }: { intentId: string }) => {
      return await PaymentIntent.findOne({ intentId });
    },

    myPaymentIntents: async (
      _: any,
      { status, limit = 20 }: { status?: string; limit?: number },
      context: any
    ) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      const query: any = { clientId: userId };
      if (status) query.status = status;

      return await PaymentIntent.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);
    },

    // Wallet V2 queries
    walletV2: async (_: any, __: any, context: any) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      const wallet = await centralWalletService.getOrCreateWallet(userId);

      // Ajouter le champ calculé availableBalance
      return {
        ...wallet.toObject(),
        availableBalance: (wallet as any).getAvailableBalance()
      };
    },

    transactionV2: async (_: any, { transactionId }: { transactionId: string }) => {
      return await Transaction.findOne({ transactionId });
    },

    transactionsV2: async (
      _: any,
      { filters, page = 1, limit = 20 }: { filters?: any; page?: number; limit?: number },
      context: any
    ) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      return await centralWalletService.getTransactionHistory(userId, filters, page, limit);
    },

    // Query pour récupérer toutes les activités en cours (services, réservations, loyers)
    ongoingActivities: async (
      _: any,
      { type }: { type?: 'service' | 'reservation' | 'rent' | 'all' },
      context: any
    ) => {
      const userId = context.user?.userId || context.user?.id;
      if (!userId) throw new Error('Authentication required');

      const activities: any[] = [];

      // Récupérer les abonnements aux services actifs
      if (!type || type === 'all' || type === 'service') {
        const subscriptions = await ServiceSubscription.find({
          userId: userId.toString(),
          status: { $in: ['active', 'paused'] }
        }).sort({ createdAt: -1 });

        for (const sub of subscriptions) {
          const service = await Service.findById(sub.serviceId);
          const invoice = sub.invoiceId ? await Invoice.findById(sub.invoiceId) : null;

          activities.push({
            id: sub._id,
            type: 'service',
            title: service?.title || 'Service',
            description: `Abonnement ${sub.pricing.billingPeriod}`,
            amount: sub.pricing.amount,
            currency: sub.pricing.currency,
            status: sub.status,
            paymentStatus: invoice?.status || 'unpaid',
            startDate: sub.startDate,
            endDate: sub.endDate,
            referenceId: sub._id,
            referenceType: 'subscription',
            invoiceId: sub.invoiceId,
            invoice: invoice,
            service: service,
            property: sub.propertyId ? await Property.findById(sub.propertyId) : null,
            createdAt: sub.createdAt,
            updatedAt: sub.updatedAt
          });
        }
      }

      // Récupérer les réservations actives
      if (!type || type === 'all' || type === 'reservation') {
        const reservations = await Activity.find({
          clientId: userId,
          isReservation: true,
          reservationStatus: { $in: ['PENDING', 'ACCEPTED'] }
        }).sort({ createdAt: -1 });

        for (const res of reservations) {
          const property = await Property.findById(res.propertyId);
          // Chercher la facture associée à cette réservation
          const invoice = await Invoice.findOne({
            referenceId: res._id.toString(),
            referenceType: 'reservation',
            clientId: userId.toString()
          });

          activities.push({
            id: res._id,
            type: 'reservation',
            title: property?.title || 'Réservation',
            description: `Réservation du ${res.reservationDate?.toLocaleDateString('fr-FR') || 'N/A'}`,
            amount: res.amount || 0,
            currency: 'XOF',
            status: res.reservationStatus?.toLowerCase() || 'pending',
            paymentStatus: invoice?.status || (res.payementStatus?.toLowerCase() || 'pending'),
            startDate: res.reservationDate,
            endDate: null,
            referenceId: res._id,
            referenceType: 'reservation',
            invoiceId: invoice?._id,
            invoice: invoice,
            service: null,
            property: property,
            createdAt: res.createdAt,
            updatedAt: res.updatedAt
          });
        }
      }

      // Récupérer les loyers à payer (factures de type rent)
      if (!type || type === 'all' || type === 'rent') {
        const rentInvoices = await Invoice.find({
          clientId: userId.toString(),
          type: 'rent',
          status: { $in: ['unpaid', 'pending', 'partially_paid'] }
        }).sort({ dueDate: 1 });

        for (const invoice of rentInvoices) {
          const property = invoice.propertyId ? await Property.findById(invoice.propertyId) : null;

          activities.push({
            id: invoice._id,
            type: 'rent',
            title: property?.title || 'Loyer',
            description: invoice.description || `Loyer mensuel`,
            amount: invoice.total,
            currency: invoice.currency,
            status: 'active',
            paymentStatus: invoice.status,
            startDate: invoice.issueDate,
            endDate: invoice.dueDate,
            referenceId: invoice.referenceId,
            referenceType: 'rental',
            invoiceId: invoice._id,
            invoice: invoice,
            service: null,
            property: property,
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt
          });
        }
      }

      // Trier par date de création (plus récent en premier)
      activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        activities,
        total: activities.length,
        byType: {
          services: activities.filter(a => a.type === 'service').length,
          reservations: activities.filter(a => a.type === 'reservation').length,
          rents: activities.filter(a => a.type === 'rent').length
        }
      };
    }
  },

  Mutation: {
    // Invoice mutations
    createInvoice: async (_: any, { input }: { input: any }, context: any) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      return await invoiceService.createInvoice({
        ...input,
        dueDate: new Date(input.dueDate)
      });
    },

    cancelInvoice: async (
      _: any,
      { invoiceId, reason }: { invoiceId: string; reason?: string }
    ) => {
      const invoice = await invoiceService.cancelInvoice(invoiceId, reason);
      if (invoice) {
        pubsub.publish(INVOICE_STATUS_CHANGED, { invoiceStatusChanged: invoice });
      }
      return invoice;
    },

    refundInvoice: async (
      _: any,
      { invoiceId, amount, reason }: { invoiceId: string; amount?: number; reason?: string }
    ) => {
      const invoice = await invoiceService.refundInvoice(invoiceId, amount, reason);
      if (invoice) {
        pubsub.publish(INVOICE_STATUS_CHANGED, { invoiceStatusChanged: invoice });
      }
      return invoice;
    },

    // Payment mutations
    initiatePayment: async (_: any, { input }: { input: any }, context: any) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      const result = await centralWalletService.initiatePayment(input);

      if (result.success && result.paymentIntentId) {
        const paymentIntent = await PaymentIntent.findOne({ intentId: result.paymentIntentId });
        if (paymentIntent) {
          pubsub.publish(PAYMENT_INTENT_STATUS_CHANGED, {
            paymentIntentStatusChanged: paymentIntent
          });
        }
      }

      return result;
    },

    confirmPayment: async (
      _: any,
      { paymentIntentId, providerReference, providerResponse }: any
    ) => {
      const result = await centralWalletService.confirmPayment(
        paymentIntentId,
        providerReference,
        providerResponse
      );

      if (result.success) {
        // Publier les mises à jour
        const paymentIntent = await PaymentIntent.findOne({ intentId: paymentIntentId });
        if (paymentIntent) {
          pubsub.publish(PAYMENT_INTENT_STATUS_CHANGED, {
            paymentIntentStatusChanged: paymentIntent
          });

          const invoice = await Invoice.findById(paymentIntent.invoiceId);
          if (invoice) {
            pubsub.publish(INVOICE_STATUS_CHANGED, { invoiceStatusChanged: invoice });
          }
        }
      }

      return result;
    },

    cancelPaymentIntent: async (
      _: any,
      { paymentIntentId, reason }: { paymentIntentId: string; reason?: string }
    ) => {
      const paymentIntent = await PaymentIntent.findOne({ intentId: paymentIntentId });
      if (!paymentIntent) {
        return { success: false, status: 'failed', error: 'PaymentIntent not found' };
      }

      (paymentIntent as any).updateStatus('cancelled', reason);
      await paymentIntent.save();

      pubsub.publish(PAYMENT_INTENT_STATUS_CHANGED, {
        paymentIntentStatusChanged: paymentIntent
      });

      return {
        success: true,
        paymentIntentId,
        status: 'cancelled'
      };
    },

    // Wallet V2 mutations
    addDisbursementPreference: async (
      _: any,
      { input }: { input: any },
      context: any
    ) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      const wallet = await Wallet.findOne({ userId });
      if (!wallet) throw new Error('Wallet not found');

      // Si c'est la première préférence ou si isDefault est true, la rendre par défaut
      if (input.isDefault || wallet.disbursementPreferences.length === 0) {
        // Retirer le statut par défaut des autres
        wallet.disbursementPreferences.forEach(pref => {
          pref.isDefault = false;
        });
        input.isDefault = true;
      }

      wallet.disbursementPreferences.push(input);
      await wallet.save();

      return {
        ...wallet.toObject(),
        availableBalance: (wallet as any).getAvailableBalance()
      };
    },

    removeDisbursementPreference: async (
      _: any,
      { method }: { method: string },
      context: any
    ) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      const wallet = await Wallet.findOne({ userId });
      if (!wallet) throw new Error('Wallet not found');

      wallet.disbursementPreferences = wallet.disbursementPreferences.filter(
        pref => pref.method !== method
      );
      await wallet.save();

      return {
        ...wallet.toObject(),
        availableBalance: (wallet as any).getAvailableBalance()
      };
    },

    setDefaultDisbursementPreference: async (
      _: any,
      { method }: { method: string },
      context: any
    ) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      const wallet = await Wallet.findOne({ userId });
      if (!wallet) throw new Error('Wallet not found');

      wallet.disbursementPreferences.forEach(pref => {
        pref.isDefault = pref.method === method;
      });
      await wallet.save();

      return {
        ...wallet.toObject(),
        availableBalance: (wallet as any).getAvailableBalance()
      };
    },

    // Disbursement
    requestDisbursement: async (
      _: any,
      { input }: { input: any },
      context: any
    ) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      return await centralWalletService.disburseFunds({
        ownerId: userId,
        ...input
      });
    },

    // Escrow
    lockFundsForEscrow: async (
      _: any,
      { invoiceId, amount }: { invoiceId: string; amount: number },
      context: any
    ) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      return await centralWalletService.lockFundsForEscrow(invoiceId, userId, amount);
    },

    releaseWalletEscrow: async (
      _: any,
      { invoiceId, ownerId, amount }: { invoiceId: string; ownerId: string; amount: number },
      context: any
    ) => {
      const userId = context.user?.id;
      if (!userId) throw new Error('Authentication required');

      return await centralWalletService.releaseEscrow(invoiceId, userId, ownerId, amount);
    },

    // Quick invoice helpers
    createReservationInvoice: async (
      _: any,
      {
        reservationId,
        propertyId,
        clientId,
        ownerId,
        amount,
        currency,
        checkIn,
        checkOut,
        deposit
      }: any
    ) => {
      return await invoiceService.createReservationInvoice(
        reservationId,
        propertyId,
        clientId,
        ownerId,
        amount,
        currency,
        { checkIn: new Date(checkIn), checkOut: new Date(checkOut) },
        deposit
      );
    },

    createRentInvoice: async (
      _: any,
      {
        rentalId,
        propertyId,
        clientId,
        ownerId,
        monthlyRent,
        currency,
        periodStart,
        periodEnd
      }: any
    ) => {
      return await invoiceService.createRentInvoice(
        rentalId,
        propertyId,
        clientId,
        ownerId,
        monthlyRent,
        currency,
        { startDate: new Date(periodStart), endDate: new Date(periodEnd) }
      );
    },

    createServiceInvoice: async (
      _: any,
      { subscriptionId, clientId, providerId, serviceName, amount, currency, description, serviceId, propertyId }: any
    ) => {
      return await invoiceService.createServiceInvoice(
        subscriptionId,
        clientId,
        providerId,
        serviceName,
        amount,
        currency,
        description,
        serviceId,
        propertyId
      );
    }
  },

  Subscription: {
    invoiceStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([INVOICE_STATUS_CHANGED]),
        (payload, variables) => {
          return payload.invoiceStatusChanged._id.toString() === variables.invoiceId;
        }
      )
    },

    paymentIntentStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([PAYMENT_INTENT_STATUS_CHANGED]),
        (payload, variables) => {
          return payload.paymentIntentStatusChanged.intentId === variables.intentId;
        }
      )
    },

    walletBalanceUpdated: {
      subscribe: () => pubsub.asyncIterableIterator([WALLET_BALANCE_UPDATED])
    },

    newTransactionReceived: {
      subscribe: () => pubsub.asyncIterableIterator([NEW_TRANSACTION_RECEIVED])
    }
  },

  // Field resolvers
  Invoice: {
    client: async (invoice: IInvoice) => {
      // TODO: Charger l'utilisateur depuis le service User
      return null;
    },

    owner: async (invoice: IInvoice) => {
      // TODO: Charger l'utilisateur depuis le service User
      return null;
    },

    property: async (invoice: IInvoice) => {
      // TODO: Charger la propriété depuis le service Property
      return null;
    },

    paymentIntent: async (invoice: IInvoice) => {
      if (!invoice.paymentIntentId) return null;
      return await PaymentIntent.findOne({ intentId: invoice.paymentIntentId });
    }
  },

  PaymentIntent: {
    invoice: async (paymentIntent: IPaymentIntent) => {
      return await Invoice.findById(paymentIntent.invoiceId);
    },

    client: async (paymentIntent: IPaymentIntent) => {
      // TODO: Charger l'utilisateur depuis le service User
      return null;
    },

    owner: async (paymentIntent: IPaymentIntent) => {
      // TODO: Charger l'utilisateur depuis le service User
      return null;
    }
  },

  WalletV2: {
    user: async (wallet: IWallet) => {
      // TODO: Charger l'utilisateur depuis le service User
      return null;
    },

    transactions: async (wallet: IWallet, { limit = 20 }: { limit?: number }) => {
      return await Transaction.find({ walletId: wallet._id.toString() })
        .sort({ createdAt: -1 })
        .limit(limit);
    },

    invoices: async (
      wallet: IWallet,
      { status, limit = 20 }: { status?: string; limit?: number }
    ) => {
      const query: any = {
        $or: [{ clientId: wallet.userId }, { ownerId: wallet.userId }]
      };
      if (status) query.status = status;

      return await Invoice.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);
    }
  },

  TransactionV2: {
    wallet: async (transaction: ITransaction) => {
      return await Wallet.findById(transaction.walletId);
    },

    user: async (transaction: ITransaction) => {
      // TODO: Charger l'utilisateur depuis le service User
      return null;
    },

    invoice: async (transaction: ITransaction) => {
      if (!transaction.invoiceId) return null;
      return await Invoice.findById(transaction.invoiceId);
    },

    counterparty: async (transaction: ITransaction) => {
      // TODO: Charger l'utilisateur depuis le service User
      return null;
    }
  }
};

// Export pubsub pour l'utiliser dans d'autres services
export { pubsub };
