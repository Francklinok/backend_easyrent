import { EnhancedWallet, IEnhancedWallet, IWalletTransaction } from '../models/EnhancedWallet';
import { CryptoPayment } from '../../crypto/models/CryptoPayment';
import { PriceService } from './PriceService';
import { SecurityService } from './SecurityService';
import { MobileMoneyService, MobileMoneyRequest } from './MobileMoneyService';
import { NotificationService } from '../../services/notificationServices';

export interface PaymentRequest {
  userId: string;
  amount: number;
  currency: string;
  description: string;
  type: 'rent' | 'purchase' | 'deposit_security' | 'service_fee';
  propertyId?: string;
  reservationId?: string;
  paymentMethodId?: string;
  // Données spécifiques selon la méthode
  cryptoData?: {
    network: string;
    toAddress: string;
    gasLimit?: number;
  };
  mobileMoneyData?: {
    phoneNumber: string;
    providerId: string; // orange_money_ci, mtn_money_ci, etc.
    countryCode: string;
    accountName?: string;
    confirmationCode?: string; // Pour confirmer le paiement
  };
  externalData?: {
    providerId: string;
    providerType: 'stripe' | 'paypal' | 'bank_transfer';
    metadata?: any;
  };
  scheduledFor?: Date;
  recurring?: {
    frequency: 'weekly' | 'monthly' | 'quarterly';
    endDate?: Date;
    totalPayments?: number;
  };
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedConfirmationTime?: number;
  externalPaymentUrl?: string; // Pour rediriger vers Stripe, PayPal, etc.
  qrCodeData?: string; // Pour les paiements crypto
  error?: string;
  fees?: {
    amount: number;
    currency: string;
    breakdown: {
      network?: number;
      service?: number;
      exchange?: number;
    };
  };
  confirmationRequired?: boolean;
  confirmationCode?: string;
  mobileMoneyData?: {
    provider: string;
    phoneNumber: string;
    reference: string;
  };
}

export interface TransferRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  description: string;
  fee?: number;
}

export interface ExchangeRequest {
  userId: string;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  slippage?: number; // Tolérance de glissement en %
}

export class UnifiedPaymentService {
  private static instance: UnifiedPaymentService;
  private priceService: PriceService;
  private securityService: SecurityService;
  private mobileMoneyService: MobileMoneyService;
  private notificationService: NotificationService;

  private constructor() {
    this.priceService = new PriceService();
    this.securityService = new SecurityService();
    this.mobileMoneyService = new MobileMoneyService();
    this.notificationService = new NotificationService();
  }

  static getInstance(): UnifiedPaymentService {
    if (!UnifiedPaymentService.instance) {
      UnifiedPaymentService.instance = new UnifiedPaymentService();
    }
    return UnifiedPaymentService.instance;
  }

  /**
   * Point d'entrée unique pour tous les paiements
   * Tous les paiements passent par le wallet, même les externes
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // 1. Validation de sécurité - skip for now
      // const securityCheck = await this.securityService.validateTransaction(...);
      // if (!securityCheck.passed) {
      //   throw new Error(`Security validation failed`);
      // }

      // 2. Récupérer ou créer le wallet
      let wallet = await EnhancedWallet.findOne({ userId: request.userId }) as any;
      if (!wallet) {
        wallet = await this.createWallet(request.userId) as any;
      }

      // 3. Déterminer la méthode de paiement
      const paymentMethod = request.paymentMethodId
        ? wallet.paymentMethods.find(pm => pm.id === request.paymentMethodId)
        : wallet.paymentMethods.find(pm => pm.isDefault);

      if (!paymentMethod) {
        throw new Error('No valid payment method found');
      }

      // 4. Calculer les frais
      const fees = await this.calculateFees(request, paymentMethod.type);

      // 5. Vérifier les limites
      await this.checkLimits(wallet, request.amount, request.currency);

      // 6. Créer la transaction dans le wallet
      const transactionId = await this.createWalletTransaction(wallet, request, fees);

      // 7. Traiter selon le type de méthode de paiement
      let paymentResult: PaymentResponse;

      switch (paymentMethod.type) {
        case 'internal':
          paymentResult = await this.processInternalPayment(wallet, request, transactionId);
          break;

        case 'crypto_wallet':
          paymentResult = await this.processCryptoPayment(wallet, request, transactionId);
          break;

        case 'bank_card':
        case 'stripe':
          paymentResult = await this.processStripePayment(wallet, request, transactionId);
          break;

        case 'mobile_money':
          paymentResult = await this.processMobileMoneyPayment(wallet, request, transactionId);
          break;

        case 'paypal':
          paymentResult = await this.processPayPalPayment(wallet, request, transactionId);
          break;

        case 'bank_transfer':
          paymentResult = await this.processBankTransfer(wallet, request, transactionId);
          break;

        default:
          throw new Error(`Unsupported payment method: ${paymentMethod.type}`);
      }

      // 8. Mettre à jour le statut de la transaction
      await this.updateTransactionStatus(wallet, transactionId, paymentResult.status);

      // 9. Envoyer les notifications
      await this.sendPaymentNotification(wallet, request, paymentResult);

      return {
        ...paymentResult,
        transactionId,
        fees
      };

    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown payment error'
      };
    }
  }

  /**
   * Paiement interne (solde du wallet)
   */
  private async processInternalPayment(
    wallet: IEnhancedWallet,
    request: PaymentRequest,
    transactionId: string
  ): Promise<PaymentResponse> {
    // Trouver la devise
    const currency = wallet.fiatCurrencies.find(c => c.symbol === request.currency);
    if (!currency) {
      throw new Error(`Currency ${request.currency} not available in wallet`);
    }

    // Vérifier le solde
    if (currency.balance < request.amount) {
      throw new Error('Insufficient balance');
    }

    // Débiter le montant
    currency.balance -= request.amount;
    currency.lockedBalance += request.amount; // Bloquer le montant le temps de la confirmation

    await wallet.save();

    // Simuler un traitement
    setTimeout(async () => {
      await this.completeInternalPayment(wallet, transactionId, request.amount, request.currency);
    }, 2000);

    return {
      success: true,
      status: 'processing',
      estimatedConfirmationTime: 2000
    };
  }

  /**
   * Paiement crypto
   */
  private async processCryptoPayment(
    wallet: IEnhancedWallet,
    request: PaymentRequest,
    transactionId: string
  ): Promise<PaymentResponse> {
    if (!request.cryptoData) {
      throw new Error('Crypto data required for crypto payment');
    }

    // Trouver la crypto
    const crypto = wallet.cryptoCurrencies.find(c => c.symbol === request.currency);
    if (!crypto) {
      throw new Error(`Cryptocurrency ${request.currency} not available in wallet`);
    }

    // Convertir le montant fiat en crypto
    const cryptoAmount = request.amount / crypto.metadata.currentPrice;

    // Vérifier le solde
    if (crypto.balance < cryptoAmount) {
      throw new Error('Insufficient crypto balance');
    }

    // Créer la transaction crypto
    const cryptoPayment = new CryptoPayment({
      paymentId: transactionId,
      userId: request.userId,
      propertyId: request.propertyId,
      paymentType: request.type,
      cryptocurrency: request.currency as any,
      network: request.cryptoData.network as any,
      amount: cryptoAmount,
      amountFiat: request.amount,
      fiatCurrency: 'EUR',
      exchangeRate: crypto.metadata.currentPrice,
      fromAddress: crypto.walletAddress,
      toAddress: request.cryptoData.toAddress,
      status: 'pending',
      confirmationsRequired: request.cryptoData.network === 'bitcoin' ? 6 : 12,
      metadata: {
        propertyAddress: 'Property Address', // À récupérer depuis propertyId
        landlordId: 'landlord_id', // À récupérer
        paymentDescription: request.description
      }
    });

    await cryptoPayment.save();

    // Bloquer les crypto dans le wallet
    crypto.balance -= cryptoAmount;
    crypto.lockedBalance += cryptoAmount;
    await wallet.save();

    // Générer QR code pour le paiement
    const qrCodeData = this.generateCryptoQRCode(request.cryptoData.toAddress, cryptoAmount, request.currency);

    return {
      success: true,
      status: 'pending',
      estimatedConfirmationTime: request.cryptoData.network === 'bitcoin' ? 3600000 : 300000, // 1h BTC, 5min ETH
      qrCodeData
    };
  }

  /**
   * Paiement Stripe
   */
  private async processStripePayment(
    wallet: IEnhancedWallet,
    request: PaymentRequest,
    transactionId: string
  ): Promise<PaymentResponse> {
    // Créer l'intention de paiement Stripe
    // Note: Ici on simule, dans la vraie implémentation utiliser l'API Stripe

    // Même pour Stripe, la transaction est enregistrée dans le wallet
    const stripePaymentIntent = {
      id: `pi_${Date.now()}`,
      client_secret: `pi_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
      status: 'requires_payment_method'
    };

    // Mettre à jour la transaction avec les données Stripe
    const transaction = wallet.transactions.find(t => t.id === transactionId);
    if (transaction) {
      transaction.externalTransactionId = stripePaymentIntent.id;
      transaction.status = 'processing';
    }

    await wallet.save();

    return {
      success: true,
      status: 'processing',
      externalPaymentUrl: `https://js.stripe.com/v3/#${stripePaymentIntent.client_secret}`,
      estimatedConfirmationTime: 30000 // 30 secondes
    };
  }

  /**
   * Paiement PayPal
   */
  private async processPayPalPayment(
    wallet: IEnhancedWallet,
    request: PaymentRequest,
    transactionId: string
  ): Promise<PaymentResponse> {
    // Simuler la création d'un ordre PayPal
    const paypalOrderId = `PAY-${Date.now()}`;

    const transaction = wallet.transactions.find(t => t.id === transactionId);
    if (transaction) {
      transaction.externalTransactionId = paypalOrderId;
      transaction.status = 'processing';
    }

    await wallet.save();

    return {
      success: true,
      status: 'processing',
      externalPaymentUrl: `https://www.paypal.com/checkoutnow?token=${paypalOrderId}`,
      estimatedConfirmationTime: 60000 // 1 minute
    };
  }

  /**
   * Virement bancaire
   */
  private async processBankTransfer(
    wallet: IEnhancedWallet,
    request: PaymentRequest,
    transactionId: string
  ): Promise<PaymentResponse> {
    // Pour les virements, générer les instructions
    const transaction = wallet.transactions.find(t => t.id === transactionId);
    if (transaction) {
      transaction.status = 'pending';
    }

    await wallet.save();

    return {
      success: true,
      status: 'pending',
      estimatedConfirmationTime: 86400000 // 24 heures
    };
  }

  /**
   * Transfert entre utilisateurs
   */
  async processTransfer(request: TransferRequest): Promise<PaymentResponse> {
    try {
      const [fromWallet, toWallet] = await Promise.all([
        EnhancedWallet.findOne({ userId: request.fromUserId }),
        EnhancedWallet.findOne({ userId: request.toUserId })
      ]);

      if (!fromWallet || !toWallet) {
        throw new Error('Wallet not found');
      }

      // Vérifier le solde
      const fromCurrency = fromWallet.fiatCurrencies.find(c => c.symbol === request.currency);
      if (!fromCurrency || fromCurrency.balance < request.amount) {
        throw new Error('Insufficient balance');
      }

      // Effectuer le transfert
      fromCurrency.balance -= request.amount;

      let toCurrency = toWallet.fiatCurrencies.find(c => c.symbol === request.currency);
      if (!toCurrency) {
        // Créer la devise si elle n'existe pas
        toCurrency = {
          symbol: request.currency,
          name: request.currency,
          balance: 0,
          lockedBalance: 0,
          isBaseCurrency: false,
          exchangeRate: 1,
          lastExchangeUpdate: new Date()
        };
        toWallet.fiatCurrencies.push(toCurrency);
      }

      toCurrency.balance += (request.amount - (request.fee || 0));

      // Créer les transactions
      const transferId = `transfer_${Date.now()}`;

      (fromWallet as any).addTransaction({
        id: `${transferId}_out`,
        type: 'transfer',
        amount: -request.amount,
        currency: request.currency,
        toUserId: request.toUserId,
        description: `Transfer to user ${request.toUserId}: ${request.description}`,
        status: 'completed'
      });

      (toWallet as any).addTransaction({
        id: `${transferId}_in`,
        type: 'received',
        amount: request.amount - (request.fee || 0),
        currency: request.currency,
        fromUserId: request.fromUserId,
        description: `Transfer from user ${request.fromUserId}: ${request.description}`,
        status: 'completed'
      });

      await Promise.all([fromWallet.save(), toWallet.save()]);

      return {
        success: true,
        transactionId: transferId,
        status: 'completed'
      };

    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Transfer failed'
      };
    }
  }

  /**
   * Échange de devises
   */
  async processExchange(request: ExchangeRequest): Promise<PaymentResponse> {
    try {
      const wallet = await EnhancedWallet.findOne({ userId: request.userId });
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Obtenir le taux de change
      const rates = await this.priceService.getExchangeRates();
      const exchangeRate = rates[request.toCurrency] / rates[request.fromCurrency] || 1;
      const toAmount = request.amount * exchangeRate * (1 - (request.slippage || 0.01));

      // Vérifier le solde source
      const fromCurrency = wallet.fiatCurrencies.find(c => c.symbol === request.fromCurrency) ||
                          wallet.cryptoCurrencies.find(c => c.symbol === request.fromCurrency);

      if (!fromCurrency || fromCurrency.balance < request.amount) {
        throw new Error('Insufficient balance for exchange');
      }

      // Effectuer l'échange
      fromCurrency.balance -= request.amount;

      let toCurrency = wallet.fiatCurrencies.find(c => c.symbol === request.toCurrency) ||
                      wallet.cryptoCurrencies.find(c => c.symbol === request.toCurrency);

      if (!toCurrency) {
        // Créer la devise de destination
        if (['BTC', 'ETH', 'USDT', 'USDC'].includes(request.toCurrency)) {
          // Ajouter crypto
          const newCrypto = {
            symbol: request.toCurrency,
            name: request.toCurrency,
            network: request.toCurrency === 'BTC' ? 'bitcoin' : 'ethereum',
            balance: 0,
            lockedBalance: 0,
            walletAddress: this.generateWalletAddress(request.toCurrency),
            isActive: true,
            lastSyncAt: new Date(),
            metadata: {
              decimals: 18,
              currentPrice: exchangeRate,
              priceChange24h: 0,
              lastPriceUpdate: new Date()
            }
          };
          wallet.cryptoCurrencies.push(newCrypto);
          toCurrency = newCrypto;
        } else {
          // Ajouter fiat
          const newFiat = {
            symbol: request.toCurrency,
            name: request.toCurrency,
            balance: 0,
            lockedBalance: 0,
            isBaseCurrency: false,
            exchangeRate: 1 / exchangeRate,
            lastExchangeUpdate: new Date()
          };
          wallet.fiatCurrencies.push(newFiat);
          toCurrency = newFiat;
        }
      }

      toCurrency.balance += toAmount;

      // Créer la transaction d'échange
      const exchangeId = `exchange_${Date.now()}`;
      (wallet as any).addTransaction({
        id: exchangeId,
        type: 'exchange',
        amount: request.amount,
        currency: request.fromCurrency,
        cryptoAmount: toAmount,
        cryptoCurrency: request.toCurrency,
        exchangeRate,
        description: `Exchange ${request.amount} ${request.fromCurrency} to ${toAmount} ${request.toCurrency}`,
        status: 'completed'
      });

      await wallet.save();

      return {
        success: true,
        transactionId: exchangeId,
        status: 'completed'
      };

    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Exchange failed'
      };
    }
  }

  // Méthodes utilitaires privées

  private async createWallet(userId: string): Promise<IEnhancedWallet> {
    const wallet = new EnhancedWallet({
      userId,
      fiatCurrencies: [{
        symbol: 'EUR',
        name: 'Euro',
        balance: 0,
        lockedBalance: 0,
        isBaseCurrency: true,
        exchangeRate: 1,
        lastExchangeUpdate: new Date()
      }],
      cryptoCurrencies: [],
      paymentMethods: [{
        id: 'internal_default',
        type: 'internal',
        name: 'Solde du wallet',
        isDefault: true,
        isActive: true,
        createdAt: new Date()
      }],
      transactions: []
    });

    return await wallet.save();
  }

  private async calculateFees(request: PaymentRequest, paymentType: string): Promise<any> {
    const baseFee = request.amount * 0.01; // 1% de base

    const fees = {
      network: 0,
      service: baseFee,
      exchange: 0
    };

    switch (paymentType) {
      case 'crypto_wallet':
        fees.network = 0.0001; // Frais de réseau
        break;
      case 'stripe':
      case 'bank_card':
        fees.service = request.amount * 0.029 + 0.30; // Frais Stripe
        break;
      case 'paypal':
        fees.service = request.amount * 0.034 + 0.35; // Frais PayPal
        break;
      case 'internal':
        fees.service = 0; // Pas de frais pour les paiements internes
        break;
    }

    return {
      amount: fees.network + fees.service + fees.exchange,
      currency: request.currency,
      breakdown: fees
    };
  }

  private async checkLimits(wallet: IEnhancedWallet, amount: number, currency: string): Promise<void> {
    if (amount > wallet.settings.maxTransactionLimit) {
      throw new Error(`Transaction amount exceeds limit of ${wallet.settings.maxTransactionLimit}`);
    }

    // Vérifier la limite quotidienne
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = wallet.transactions.filter(tx =>
      tx.createdAt >= today && tx.status === 'completed'
    );

    const todayVolume = todayTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    if (todayVolume + amount > wallet.settings.maxDailyLimit) {
      throw new Error(`Daily limit exceeded. Current: ${todayVolume}, Limit: ${wallet.settings.maxDailyLimit}`);
    }
  }

  private async createWalletTransaction(
    wallet: IEnhancedWallet,
    request: PaymentRequest,
    fees: any
  ): Promise<string> {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const transaction: Partial<IWalletTransaction> = {
      id: transactionId,
      type: 'payment',
      subType: request.type,
      amount: request.amount,
      currency: request.currency,
      feeAmount: fees.amount,
      feeCurrency: request.currency,
      description: request.description,
      propertyId: request.propertyId,
      reservationId: request.reservationId,
      paymentMethodId: request.paymentMethodId,
      status: 'pending',
      scheduledFor: request.scheduledFor
    };

    await (wallet as any).addTransaction(transaction);
    return transactionId;
  }

  private async updateTransactionStatus(
    wallet: IEnhancedWallet,
    transactionId: string,
    status: string
  ): Promise<void> {
    const transaction = wallet.transactions.find(t => t.id === transactionId);
    if (transaction) {
      transaction.status = status as any;
      if (status === 'completed') {
        transaction.completedAt = new Date();
      }
      await wallet.save();
    }
  }

  private async completeInternalPayment(
    wallet: IEnhancedWallet,
    transactionId: string,
    amount: number,
    currency: string
  ): Promise<void> {
    const currencyObj = wallet.fiatCurrencies.find(c => c.symbol === currency);
    if (currencyObj) {
      currencyObj.lockedBalance -= amount; // Débloquer le montant
    }

    await this.updateTransactionStatus(wallet, transactionId, 'completed');
  }

  private async processMobileMoneyPayment(
    wallet: IEnhancedWallet,
    request: PaymentRequest,
    transactionId: string
  ): Promise<PaymentResponse> {
    try {
      if (!request.mobileMoneyData) {
        throw new Error('Mobile money data is required');
      }

      const { phoneNumber, providerId, countryCode, accountName } = request.mobileMoneyData;

      // Valider le numéro de téléphone
      const validation = this.mobileMoneyService.validatePhoneNumber(phoneNumber, countryCode);
      if (!validation.isValid) {
        throw new Error(`Invalid phone number: ${validation.error}`);
      }

      // Vérifier les limites du provider
      const provider = this.mobileMoneyService.getProvider(providerId);
      if (!provider) {
        throw new Error(`Mobile money provider ${providerId} not found`);
      }

      // Récupérer l'utilisation actuelle de l'utilisateur pour ce provider
      const userDailyVolume = await this.getUserDailyVolume(wallet.userId, providerId);
      const userMonthlyVolume = await this.getUserMonthlyVolume(wallet.userId, providerId);

      const limitsCheck = this.mobileMoneyService.validateTransactionLimits(
        providerId,
        request.amount,
        userDailyVolume,
        userMonthlyVolume
      );

      if (!limitsCheck.isValid) {
        throw new Error(`Transaction limits exceeded: ${limitsCheck.error}`);
      }

      // Calculer les frais mobile money
      const fees = this.mobileMoneyService.calculateFees(providerId, 'deposit', request.amount);

      // Préparer la requête mobile money
      const mobileMoneyRequest: MobileMoneyRequest = {
        providerId,
        accountId: `${wallet.userId}_${providerId}`,
        type: 'deposit',
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        metadata: {
          transactionId,
          userId: wallet.userId,
          propertyId: request.propertyId,
          reservationId: request.reservationId
        }
      };

      // Traiter le paiement via mobile money
      const mobileMoneyResponse = await this.mobileMoneyService.processTransaction(mobileMoneyRequest);

      // Mettre à jour la transaction dans le wallet
      await this.updateTransactionWithMobileMoneyData(
        wallet,
        transactionId,
        mobileMoneyResponse
      );

      // Si le paiement nécessite une confirmation
      if (mobileMoneyResponse.confirmationRequired) {
        await this.updateTransactionStatus(wallet, transactionId, 'pending');

        return {
          success: true,
          transactionId,
          status: 'pending',
          estimatedConfirmationTime: 300, // 5 minutes
          fees: {
            amount: fees.feeAmount,
            currency: request.currency,
            breakdown: {
              service: fees.feeAmount
            }
          },
          confirmationRequired: true,
          confirmationCode: mobileMoneyResponse.confirmationCode,
          mobileMoneyData: {
            provider: provider.name,
            phoneNumber: validation.formattedNumber || phoneNumber,
            reference: mobileMoneyResponse.reference
          }
        };
      }

      // Si le paiement est immédiatement complété
      if (mobileMoneyResponse.success && mobileMoneyResponse.status === 'completed') {
        await this.updateTransactionStatus(wallet, transactionId, 'completed');
        // Update wallet balance
        const currency = wallet.fiatCurrencies.find((c: any) => c.symbol === request.currency);
        if (currency) {
          currency.balance += request.amount;
          await wallet.save();
        }

        return {
          success: true,
          transactionId,
          status: 'completed',
          fees: {
            amount: fees.feeAmount,
            currency: request.currency,
            breakdown: {
              service: fees.feeAmount
            }
          },
          mobileMoneyData: {
            provider: provider.name,
            phoneNumber: validation.formattedNumber || phoneNumber,
            reference: mobileMoneyResponse.reference
          }
        };
      }

      // Si le paiement a échoué
      await this.updateTransactionStatus(wallet, transactionId, 'failed');
      return {
        success: false,
        transactionId,
        status: 'failed',
        error: mobileMoneyResponse.error || 'Mobile money payment failed',
        fees: {
          amount: 0,
          currency: request.currency,
          breakdown: {}
        }
      };

    } catch (error) {
      console.error('Mobile money payment error:', error);
      await this.updateTransactionStatus(wallet, transactionId, 'failed');

      return {
        success: false,
        transactionId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Mobile money payment failed',
        fees: {
          amount: 0,
          currency: request.currency,
          breakdown: {}
        }
      };
    }
  }

  private async getUserDailyVolume(userId: string, providerId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const wallet = await EnhancedWallet.findOne({ userId });
    if (!wallet) return 0;

    return wallet.transactions
      .filter(tx =>
        (tx as any).metadata?.mobileMoneyProviderId === providerId &&
        new Date(tx.createdAt) >= today &&
        tx.status === 'completed'
      )
      .reduce((sum, tx) => sum + tx.amount, 0);
  }

  private async getUserMonthlyVolume(userId: string, providerId: string): Promise<number> {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const wallet = await EnhancedWallet.findOne({ userId });
    if (!wallet) return 0;

    return wallet.transactions
      .filter(tx =>
        (tx as any).metadata?.mobileMoneyProviderId === providerId &&
        new Date(tx.createdAt) >= firstOfMonth &&
        tx.status === 'completed'
      )
      .reduce((sum, tx) => sum + tx.amount, 0);
  }

  private async updateTransactionWithMobileMoneyData(
    wallet: IEnhancedWallet,
    transactionId: string,
    mobileMoneyResponse: any
  ): Promise<void> {
    const transaction = wallet.transactions.find(tx => tx.id === transactionId);
    if (transaction) {
      (transaction as any).metadata = {
        ...(transaction as any).metadata,
        mobileMoneyProviderId: mobileMoneyResponse.providerId,
        mobileMoneyReference: mobileMoneyResponse.reference,
        mobileMoneyStatus: mobileMoneyResponse.status,
        externalTransactionId: mobileMoneyResponse.transactionId
      };
      await wallet.save();
    }
  }

  private generateCryptoQRCode(address: string, amount: number, currency: string): string {
    return `${currency.toLowerCase()}:${address}?amount=${amount}`;
  }

  private generateWalletAddress(currency: string): string {
    // Générer une adresse de wallet (simulation)
    const prefix = currency === 'BTC' ? '1' : '0x';
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = prefix;
    for (let i = 0; i < (currency === 'BTC' ? 33 : 40); i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async sendPaymentNotification(
    wallet: IEnhancedWallet,
    request: PaymentRequest,
    result: PaymentResponse
  ): Promise<void> {
    // Envoyer notification de paiement - skip for now
    // await this.notificationService.sendNotification(...);
  }
}

export default UnifiedPaymentService;