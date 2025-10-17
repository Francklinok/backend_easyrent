import { CryptoPayment, ICryptoPayment } from '../models/CryptoPayment';
import { Wallet } from '../../wallet/models/Wallet';
import { Transaction } from '../../wallet/models/Transaction';
import { UnifiedNotificationService } from '../../notification';
import { SmartContractService } from './SmartContractService';
import { PriceOracleService } from './PriceOracleService';

export interface CreateCryptoPaymentInput {
  userId: string;
  propertyId: string;
  paymentType: 'rent' | 'purchase' | 'deposit' | 'security_deposit' | 'service_fee';
  cryptocurrency: 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'MATIC' | 'BNB';
  network: 'bitcoin' | 'ethereum' | 'polygon' | 'bsc';
  amountFiat: number;
  fiatCurrency: string;
  fromAddress: string;
  toAddress: string;
  metadata: {
    propertyAddress: string;
    landlordId: string;
    leaseId?: string;
    paymentDescription: string;
    invoiceNumber?: string;
  };
  recurring?: {
    frequency: 'weekly' | 'monthly' | 'quarterly';
    endDate?: Date;
    totalPayments: number;
  };
  escrow?: {
    releaseConditions: string[];
    releaseDate?: Date;
  };
}

export class CryptoPaymentService {
  private notificationService: NotificationService;
  private contractService: SmartContractService;
  private priceOracle: PriceOracleService;

  constructor() {
    this.notificationService = new NotificationService();
    this.contractService = new SmartContractService();
    this.priceOracle = new PriceOracleService();
  }

  async createPayment(input: CreateCryptoPaymentInput): Promise<ICryptoPayment> {
    try {
      // Obtenir le taux de change actuel
      const exchangeRate = await this.priceOracle.getPrice(input.cryptocurrency, input.fiatCurrency);
      const cryptoAmount = input.amountFiat / exchangeRate;

      // Générer un ID unique pour le paiement
      const paymentId = this.generatePaymentId();

      // Déterminer le nombre de confirmations requises
      const confirmationsRequired = this.getRequiredConfirmations(input.network);

      const payment = new CryptoPayment({
        paymentId,
        userId: input.userId,
        propertyId: input.propertyId,
        paymentType: input.paymentType,
        cryptocurrency: input.cryptocurrency,
        network: input.network,
        amount: cryptoAmount,
        amountFiat: input.amountFiat,
        fiatCurrency: input.fiatCurrency,
        exchangeRate,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        confirmationsRequired,
        status: 'pending',
        transactionHash: '', // Sera mis à jour lors de la transaction
        confirmations: 0,
        metadata: input.metadata,
        recurring: input.recurring ? {
          isRecurring: true,
          frequency: input.recurring.frequency,
          nextPaymentDate: this.calculateNextPaymentDate(input.recurring.frequency),
          endDate: input.recurring.endDate,
          totalPayments: input.recurring.totalPayments,
          completedPayments: 0
        } : { isRecurring: false },
        escrow: input.escrow ? {
          isEscrow: true,
          escrowAddress: await this.contractService.createEscrowContract(input),
          releaseConditions: input.escrow.releaseConditions,
          releaseDate: input.escrow.releaseDate,
          isReleased: false,
          releasedTo: ''
        } : { isEscrow: false }
      });

      await payment.save();

      // Créer une transaction dans le wallet
      await this.createWalletTransaction(payment);

      // Envoyer notification
      await this.notificationService.createNotification({
        userId: input.userId,
        type: 'wallet',
        category: 'payment',
        title: `Paiement crypto initié`,
        message: `Paiement de ${cryptoAmount.toFixed(6)} ${input.cryptocurrency} (${input.amountFiat} ${input.fiatCurrency}) initié`,
        metadata: {
          paymentId: paymentId,
          amount: cryptoAmount,
          currency: input.cryptocurrency,
          amountFiat: input.amountFiat,
          fiatCurrency: input.fiatCurrency,
          actionUrl: `/crypto/payments/${paymentId}`
        }
      });

      return payment;
    } catch (error) {
      throw new Error(`Erreur lors de la création du paiement crypto: ${error.message}`);
    }
  }

  async processPayment(paymentId: string, transactionHash: string): Promise<ICryptoPayment> {
    try {
      const payment = await CryptoPayment.findOne({ paymentId });
      if (!payment) throw new Error('Paiement non trouvé');

      // Mettre à jour avec le hash de transaction
      payment.transactionHash = transactionHash;
      payment.status = 'confirming';
      await payment.save();

      // Démarrer le monitoring des confirmations
      this.startConfirmationMonitoring(payment);

      // Notification de confirmation
      await this.notificationService.createNotification({
        userId: payment.userId,
        type: 'wallet',
        category: 'transaction',
        title: `Transaction crypto en cours de confirmation`,
        message: `Votre paiement de ${payment.amount} ${payment.cryptocurrency} est en cours de confirmation sur la blockchain`,
        metadata: {
          paymentId: paymentId,
          transactionHash,
          confirmations: 0,
          confirmationsRequired: payment.confirmationsRequired,
          actionUrl: `/crypto/payments/${paymentId}`
        }
      });

      return payment;
    } catch (error) {
      throw new Error(`Erreur lors du traitement du paiement: ${error.message}`);
    }
  }

  async confirmPayment(paymentId: string, confirmations: number, blockHeight?: number): Promise<ICryptoPayment> {
    try {
      const payment = await CryptoPayment.findOne({ paymentId });
      if (!payment) throw new Error('Paiement non trouvé');

      payment.confirmations = confirmations;
      if (blockHeight) payment.blockHeight = blockHeight;

      // Si suffisamment de confirmations
      if (confirmations >= payment.confirmationsRequired) {
        payment.status = 'confirmed';

        // Si c'est un escrow, transférer vers le contrat
        if (payment.escrow?.isEscrow) {
          await this.transferToEscrow(payment);
        }

        // Si c'est un paiement récurrent, programmer le suivant
        if (payment.recurring?.isRecurring) {
          await this.scheduleNextPayment(payment);
        }

        // Notification de confirmation finale
        await this.notificationService.createNotification({
          userId: payment.userId,
          type: 'wallet',
          category: 'transaction',
          title: `Paiement crypto confirmé`,
          message: `Votre paiement de ${payment.amount} ${payment.cryptocurrency} a été confirmé avec succès`,
          priority: 'high',
          metadata: {
            paymentId: paymentId,
            transactionHash: payment.transactionHash,
            confirmations,
            actionUrl: `/crypto/payments/${paymentId}`
          }
        });

        // Notifier le propriétaire
        await this.notificationService.createNotification({
          userId: payment.metadata.landlordId,
          type: 'wallet',
          category: 'payment',
          title: `Paiement crypto reçu`,
          message: `Vous avez reçu un paiement de ${payment.amountFiat} ${payment.fiatCurrency} en ${payment.cryptocurrency}`,
          priority: 'high',
          metadata: {
            paymentId: paymentId,
            tenantId: payment.userId,
            amount: payment.amount,
            currency: payment.cryptocurrency,
            actionUrl: `/crypto/payments/${paymentId}`
          }
        });
      }

      await payment.save();
      return payment;
    } catch (error) {
      throw new Error(`Erreur lors de la confirmation du paiement: ${error.message}`);
    }
  }

  async getPayment(paymentId: string): Promise<ICryptoPayment | null> {
    try {
      const payment = await CryptoPayment.findOne({ paymentId });
      if (!payment) throw new Error('Paiement non trouvé');
      return payment;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération du paiement: ${error.message}`);
    }
  }

  async getUserPayments(
    userId: string,
    filters?: {
      paymentType?: string;
      cryptocurrency?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ payments: ICryptoPayment[]; total: number }> {
    try {
      const query: any = { userId };

      if (filters?.paymentType) query.paymentType = filters.paymentType;
      if (filters?.cryptocurrency) query.cryptocurrency = filters.cryptocurrency;
      if (filters?.status) query.status = filters.status;

      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const [payments, total] = await Promise.all([
        CryptoPayment.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(offset),
        CryptoPayment.countDocuments(query)
      ]);

      return { payments, total };
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des paiements: ${error.message}`);
    }
  }

  async getPropertyPayments(propertyId: string): Promise<ICryptoPayment[]> {
    try {
      return await CryptoPayment.find({ propertyId })
        .sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des paiements de la propriété: ${error.message}`);
    }
  }

  async releaseEscrow(paymentId: string, releasedBy: string): Promise<ICryptoPayment> {
    try {
      const payment = await CryptoPayment.findOne({ paymentId });
      if (!payment) throw new Error('Paiement non trouvé');
      if (!payment.escrow?.isEscrow) throw new Error('Ce paiement n\'est pas en escrow');
      if (payment.escrow.isReleased) throw new Error('L\'escrow a déjà été libéré');

      // Exécuter la libération via smart contract
      const releaseResult = await this.contractService.releaseEscrow(
        payment.escrow.escrowAddress,
        payment.metadata.landlordId
      );

      payment.escrow.isReleased = true;
      payment.escrow.releasedAt = new Date();
      payment.escrow.releasedTo = payment.metadata.landlordId;
      await payment.save();

      // Notifications
      await Promise.all([
        this.notificationService.createNotification({
          userId: payment.userId,
          type: 'wallet',
          category: 'transaction',
          title: `Escrow libéré`,
          message: `L'escrow de ${payment.amount} ${payment.cryptocurrency} a été libéré`,
          metadata: {
            paymentId: paymentId,
            releasedBy,
            actionUrl: `/crypto/payments/${paymentId}`
          }
        }),
        this.notificationService.createNotification({
          userId: payment.metadata.landlordId,
          type: 'wallet',
          category: 'payment',
          title: `Fonds reçus de l'escrow`,
          message: `Vous avez reçu ${payment.amount} ${payment.cryptocurrency} de l'escrow`,
          metadata: {
            paymentId: paymentId,
            actionUrl: `/crypto/payments/${paymentId}`
          }
        })
      ]);

      return payment;
    } catch (error) {
      throw new Error(`Erreur lors de la libération de l'escrow: ${error.message}`);
    }
  }

  async refundPayment(paymentId: string, reason: string): Promise<ICryptoPayment> {
    try {
      const payment = await CryptoPayment.findOne({ paymentId });
      if (!payment) throw new Error('Paiement non trouvé');
      if (payment.status === 'refunded') throw new Error('Paiement déjà remboursé');

      payment.status = 'refunded';
      await payment.save();

      // Créer une transaction de remboursement
      await this.createRefundTransaction(payment, reason);

      // Notification
      await this.notificationService.createNotification({
        userId: payment.userId,
        type: 'wallet',
        category: 'transaction',
        title: `Paiement crypto remboursé`,
        message: `Votre paiement de ${payment.amount} ${payment.cryptocurrency} a été remboursé. Raison: ${reason}`,
        metadata: {
          paymentId: paymentId,
          reason,
          actionUrl: `/crypto/payments/${paymentId}`
        }
      });

      return payment;
    } catch (error) {
      throw new Error(`Erreur lors du remboursement: ${error.message}`);
    }
  }

  private async createWalletTransaction(payment: ICryptoPayment): Promise<void> {
    const transaction = new Transaction({
      userId: payment.userId,
      type: 'crypto',
      amount: payment.amountFiat,
      currency: payment.fiatCurrency,
      description: `Paiement crypto ${payment.paymentType} - ${payment.cryptocurrency}`,
      status: 'pending',
      cryptoCurrency: payment.cryptocurrency,
      metadata: {
        paymentId: payment.paymentId,
        propertyId: payment.propertyId,
        cryptoAmount: payment.amount,
        network: payment.network,
        transactionHash: payment.transactionHash
      }
    });

    await transaction.save();
  }

  private async createRefundTransaction(payment: ICryptoPayment, reason: string): Promise<void> {
    const transaction = new Transaction({
      userId: payment.userId,
      type: 'received',
      amount: payment.amountFiat,
      currency: payment.fiatCurrency,
      description: `Remboursement crypto - ${reason}`,
      status: 'completed',
      cryptoCurrency: payment.cryptocurrency,
      metadata: {
        originalPaymentId: payment.paymentId,
        refundReason: reason,
        cryptoAmount: payment.amount
      }
    });

    await transaction.save();
  }

  private generatePaymentId(): string {
    return `CP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRequiredConfirmations(network: string): number {
    const confirmations = {
      'bitcoin': 6,
      'ethereum': 12,
      'polygon': 20,
      'bsc': 15
    };
    return confirmations[network] || 6;
  }

  private calculateNextPaymentDate(frequency: string): Date {
    const now = new Date();
    switch (frequency) {
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      case 'quarterly':
        const nextQuarter = new Date(now);
        nextQuarter.setMonth(nextQuarter.getMonth() + 3);
        return nextQuarter;
      default:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  private async transferToEscrow(payment: ICryptoPayment): Promise<void> {
    // Implémentation du transfert vers le contrat d'escrow
    // Cette méthode interagirait avec le smart contract d'escrow
    console.log(`Transferring ${payment.amount} ${payment.cryptocurrency} to escrow ${payment.escrow?.escrowAddress}`);
  }

  private async scheduleNextPayment(payment: ICryptoPayment): Promise<void> {
    if (!payment.recurring?.isRecurring) return;

    const nextDate = this.calculateNextPaymentDate(payment.recurring.frequency);
    payment.recurring.nextPaymentDate = nextDate;
    payment.recurring.completedPayments += 1;

    await payment.save();

    // Programmer une notification de rappel
    await this.notificationService.createNotification({
      userId: payment.userId,
      type: 'reminder',
      category: 'payment',
      title: `Prochain paiement crypto programmé`,
      message: `Votre prochain paiement de ${payment.amount} ${payment.cryptocurrency} est programmé pour le ${nextDate.toLocaleDateString()}`,
      scheduledFor: new Date(nextDate.getTime() - 24 * 60 * 60 * 1000), // 24h avant
      metadata: {
        paymentId: payment.paymentId,
        nextPaymentDate: nextDate.toISOString(),
        actionUrl: `/crypto/payments/${payment.paymentId}`
      }
    });
  }

  private startConfirmationMonitoring(payment: ICryptoPayment): void {
    // Cette méthode démarrerait un processus de monitoring des confirmations
    // En production, cela pourrait être un job en arrière-plan ou une intégration avec un service de blockchain
    console.log(`Starting confirmation monitoring for payment ${payment.paymentId} on ${payment.network}`);
  }
}