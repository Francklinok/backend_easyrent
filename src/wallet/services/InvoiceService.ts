import { Invoice, IInvoice, InvoiceType, InvoiceStatus, IInvoiceItem } from '../models/Invoice';
import { Wallet } from '../models/Wallet';
import mongoose from 'mongoose';

/**
 * InvoiceService - Gestion des factures
 * Chaque paiement commence par une facture
 */

export interface CreateInvoiceRequest {
  type: InvoiceType;
  referenceId: string;
  referenceType: 'reservation' | 'rental' | 'service' | 'property' | 'subscription';
  propertyId?: string;

  clientId: string;
  clientName?: string;
  clientEmail?: string;

  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;

  items: IInvoiceItem[];
  currency?: 'XOF' | 'EUR' | 'USD' | 'GBP';
  taxRate?: number;
  commissionRate?: number;

  dueDate: Date;
  description?: string;
  notes?: string;
  metadata?: any;
}

export interface InvoiceFilters {
  clientId?: string;
  ownerId?: string;
  type?: InvoiceType;
  status?: InvoiceStatus;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export class InvoiceService {
  private static instance: InvoiceService;

  private constructor() {}

  static getInstance(): InvoiceService {
    if (!InvoiceService.instance) {
      InvoiceService.instance = new InvoiceService();
    }
    return InvoiceService.instance;
  }

  /**
   * Créer une nouvelle facture
   */
  async createInvoice(request: CreateInvoiceRequest): Promise<IInvoice> {
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        // Générer le numéro de facture
        const invoiceNumber = await (Invoice as any).generateInvoiceNumber();

        // Calculer les totaux
        const subtotal = request.items.reduce((sum, item) => sum + item.total, 0);
        const taxRate = request.taxRate || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const commissionRate = request.commissionRate || 10; // 10% par défaut
        const commission = subtotal * (commissionRate / 100);
        const total = subtotal + taxAmount;

        const invoice = new Invoice({
          invoiceNumber,
          type: request.type,
          referenceId: request.referenceId,
          referenceType: request.referenceType,
          propertyId: request.propertyId,

          clientId: request.clientId,
          clientName: request.clientName,
          clientEmail: request.clientEmail,

          ownerId: request.ownerId,
          ownerName: request.ownerName,
          ownerEmail: request.ownerEmail,

          subtotal,
          taxAmount,
          taxRate,
          commission,
          commissionRate,
          platformFee: commission, 
          total,
          currency: request.currency || 'XOF',

          items: request.items,
          description: request.description,
          notes: request.notes,

          amountPaid: 0,
          amountDue: total,

          issueDate: new Date(),
          dueDate: request.dueDate,

          status: 'unpaid',
          metadata: request.metadata
        });

        await invoice.save({ session });

        return invoice;
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Récupérer une facture par ID
   */
  async getInvoiceById(invoiceId: string): Promise<IInvoice | null> {
    return await Invoice.findById(invoiceId);
  }

  /**
   * Récupérer une facture par numéro
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<IInvoice | null> {
    return await Invoice.findOne({ invoiceNumber });
  }

  /**
   * Récupérer les factures d'un client
   */
  async getClientInvoices(
    clientId: string,
    filters?: Omit<InvoiceFilters, 'clientId'>,
    page: number = 1,
    limit: number = 20
  ): Promise<{ invoices: IInvoice[]; total: number; pages: number }> {
    const query: any = { clientId };

    if (filters?.type) query.type = filters.type;
    if (filters?.status) query.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }
    if (filters?.minAmount) query.total = { ...query.total, $gte: filters.minAmount };
    if (filters?.maxAmount) query.total = { ...query.total, $lte: filters.maxAmount };

    const total = await Invoice.countDocuments(query);
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return { invoices, total, pages };
  }

  /**
   * Récupérer les factures d'un propriétaire
   */
  async getOwnerInvoices(
    ownerId: string,
    filters?: Omit<InvoiceFilters, 'ownerId'>,
    page: number = 1,
    limit: number = 20
  ): Promise<{ invoices: IInvoice[]; total: number; pages: number }> {
    const query: any = { ownerId };

    if (filters?.type) query.type = filters.type;
    if (filters?.status) query.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const total = await Invoice.countDocuments(query);
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return { invoices, total, pages };
  }

  /**
   * Marquer une facture comme payée
   */
  async markAsPaid(
    invoiceId: string,
    amount: number,
    paymentIntentId?: string
  ): Promise<IInvoice | null> {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return null;

    (invoice as any).markAsPaid(amount, paymentIntentId);
    await invoice.save();

    return invoice;
  }

  /**
   * Annuler une facture
   */
  async cancelInvoice(invoiceId: string, reason?: string): Promise<IInvoice | null> {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return null;

    if (invoice.status === 'paid') {
      throw new Error('Cannot cancel a paid invoice. Use refund instead.');
    }

    invoice.status = 'cancelled';
    if (reason) {
      invoice.notes = `${invoice.notes || ''}\nCancelled: ${reason}`;
    }

    await invoice.save();
    return invoice;
  }

  /**
   * Rembourser une facture
   */
  async refundInvoice(
    invoiceId: string,
    amount?: number,
    reason?: string
  ): Promise<IInvoice | null> {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return null;

    if (invoice.status !== 'paid' && invoice.status !== 'partially_paid') {
      throw new Error('Can only refund paid or partially paid invoices.');
    }

    const refundAmount = amount || invoice.amountPaid;
    if (refundAmount > invoice.amountPaid) {
      throw new Error('Refund amount cannot exceed paid amount.');
    }

    invoice.amountPaid -= refundAmount;
    invoice.amountDue += refundAmount;

    if (invoice.amountPaid <= 0) {
      invoice.status = 'refunded';
    }

    if (reason) {
      invoice.notes = `${invoice.notes || ''}\nRefunded ${refundAmount} ${invoice.currency}: ${reason}`;
    }

    await invoice.save();
    return invoice;
  }

  /**
   * Créer une facture de loyer récurrente
   */
  async createRentInvoice(
    rentalId: string,
    propertyId: string,
    clientId: string,
    ownerId: string,
    monthlyRent: number,
    currency: 'XOF' | 'EUR' | 'USD' | 'GBP',
    period: { startDate: Date; endDate: Date },
    additionalCharges?: { description: string; amount: number }[]
  ): Promise<IInvoice> {
    const items: IInvoiceItem[] = [
      {
        description: `Loyer - ${period.startDate.toLocaleDateString('fr-FR')} au ${period.endDate.toLocaleDateString('fr-FR')}`,
        quantity: 1,
        unitPrice: monthlyRent,
        total: monthlyRent
      }
    ];

    // Ajouter les charges supplémentaires
    if (additionalCharges) {
      additionalCharges.forEach(charge => {
        items.push({
          description: charge.description,
          quantity: 1,
          unitPrice: charge.amount,
          total: charge.amount
        });
      });
    }

    return await this.createInvoice({
      type: 'rent',
      referenceId: rentalId,
      referenceType: 'rental',
      propertyId,
      clientId,
      ownerId,
      items,
      currency,
      dueDate: period.startDate, // Le loyer est dû au début du mois
      description: `Facture de loyer pour la période du ${period.startDate.toLocaleDateString('fr-FR')} au ${period.endDate.toLocaleDateString('fr-FR')}`,
      metadata: {
        rentPeriod: period
      }
    });
  }

  /**
   * Créer une facture de réservation
   */
  async createReservationInvoice(
    reservationId: string,
    propertyId: string,
    clientId: string,
    ownerId: string,
    amount: number,
    currency: 'XOF' | 'EUR' | 'USD' | 'GBP',
    dates: { checkIn: Date; checkOut: Date },
    deposit?: number
  ): Promise<IInvoice> {
    const nights = Math.ceil((dates.checkOut.getTime() - dates.checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const items: IInvoiceItem[] = [
      {
        description: `Réservation - ${nights} nuit(s)`,
        quantity: nights,
        unitPrice: amount / nights,
        total: amount
      }
    ];

    if (deposit) {
      items.push({
        description: 'Dépôt de garantie (remboursable)',
        quantity: 1,
        unitPrice: deposit,
        total: deposit
      });
    }

    return await this.createInvoice({
      type: 'reservation',
      referenceId: reservationId,
      referenceType: 'reservation',
      propertyId,
      clientId,
      ownerId,
      items,
      currency,
      dueDate: new Date(), // Paiement immédiat pour les réservations
      description: `Réservation du ${dates.checkIn.toLocaleDateString('fr-FR')} au ${dates.checkOut.toLocaleDateString('fr-FR')}`,
      metadata: {
        reservationDates: dates,
        nights
      }
    });
  }

  /**
   * Créer une facture de service
   */
  async createServiceInvoice(
    serviceId: string,
    clientId: string,
    providerId: string,
    serviceName: string,
    amount: number,
    currency: 'XOF' | 'EUR' | 'USD' | 'GBP',
    description?: string
  ): Promise<IInvoice> {
    const items: IInvoiceItem[] = [
      {
        description: serviceName,
        quantity: 1,
        unitPrice: amount,
        total: amount
      }
    ];

    return await this.createInvoice({
      type: 'service',
      referenceId: serviceId,
      referenceType: 'service',
      clientId,
      ownerId: providerId,
      items,
      currency,
      dueDate: new Date(), // Paiement immédiat pour les services
      description: description || `Service: ${serviceName}`
    });
  }

  /**
   * Créer une facture d'achat immobilier
   */
  async createPurchaseInvoice(
    purchaseId: string,
    propertyId: string,
    buyerId: string,
    sellerId: string,
    purchasePrice: number,
    currency: 'XOF' | 'EUR' | 'USD' | 'GBP',
    additionalFees?: { description: string; amount: number }[]
  ): Promise<IInvoice> {
    const items: IInvoiceItem[] = [
      {
        description: 'Prix d\'achat du bien',
        quantity: 1,
        unitPrice: purchasePrice,
        total: purchasePrice
      }
    ];

    if (additionalFees) {
      additionalFees.forEach(fee => {
        items.push({
          description: fee.description,
          quantity: 1,
          unitPrice: fee.amount,
          total: fee.amount
        });
      });
    }

    return await this.createInvoice({
      type: 'purchase',
      referenceId: purchaseId,
      referenceType: 'property',
      propertyId,
      clientId: buyerId,
      ownerId: sellerId,
      items,
      currency,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours pour les achats
      description: 'Facture d\'achat immobilier',
      commissionRate: 5 // Commission réduite pour les achats
    });
  }

  /**
   * Obtenir les statistiques des factures
   */
  async getInvoiceStats(userId: string, isOwner: boolean = false): Promise<{
    totalInvoices: number;
    totalPaid: number;
    totalPending: number;
    totalUnpaid: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
  }> {
    const matchField = isOwner ? 'ownerId' : 'clientId';

    const stats = await Invoice.aggregate([
      { $match: { [matchField]: userId } },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalPaid: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          totalPending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          totalUnpaid: {
            $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, 1, 0] }
          },
          totalAmount: { $sum: '$total' },
          paidAmount: { $sum: '$amountPaid' },
          pendingAmount: { $sum: '$amountDue' }
        }
      }
    ]);

    return stats[0] || {
      totalInvoices: 0,
      totalPaid: 0,
      totalPending: 0,
      totalUnpaid: 0,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0
    };
  }

  /**
   * Obtenir les factures en retard
   */
  async getOverdueInvoices(daysOverdue: number = 0): Promise<IInvoice[]> {
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - daysOverdue);

    return await Invoice.find({
      status: { $in: ['unpaid', 'partially_paid'] },
      dueDate: { $lt: overdueDate }
    }).sort({ dueDate: 1 });
  }
}

export default InvoiceService;
