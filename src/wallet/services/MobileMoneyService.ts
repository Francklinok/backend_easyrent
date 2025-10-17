import axios from 'axios';
import { IWalletTransaction } from '../models/EnhancedWallet';
import { MOBILE_MONEY_PROVIDERS, PHONE_VALIDATION_RULES, SUPPORTED_COUNTRIES } from '../config/mobileMoneyProviders';

export interface MobileMoneyProvider {
  id: string;
  name: string;
  shortCode: string;
  country: string;
  countryCode: string;
  currency: string;
  logo?: string;
  isActive: boolean;
  supportedOperations: ('deposit' | 'withdrawal' | 'transfer')[];
  fees: {
    deposit: number; // percentage
    withdrawal: number; // percentage
    transfer: number; // percentage
    minimum: number; // minimum fee amount
    maximum: number; // maximum fee amount
  };
  limits: {
    minTransaction: number;
    maxTransaction: number;
    dailyLimit: number;
    monthlyLimit: number;
  };
  apiEndpoint?: string;
  apiKey?: string;
  webhookSecret?: string;
}

export interface MobileMoneyAccount {
  id: string;
  userId: string;
  providerId: string;
  phoneNumber: string;
  accountName: string;
  countryCode: string;
  isVerified: boolean;
  isDefault: boolean;
  balance?: number;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MobileMoneyTransaction {
  id: string;
  userId: string;
  providerId: string;
  accountId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
  amount: number;
  currency: string;
  fees: number;
  recipientNumber?: string;
  recipientName?: string;
  description?: string;
  reference: string;
  externalReference?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  failureReason?: string;
  metadata?: any;
  createdAt: Date;
  completedAt?: Date;
}

export interface MobileMoneyRequest {
  providerId: string;
  accountId: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
  amount: number;
  currency?: string;
  recipientNumber?: string;
  recipientName?: string;
  description?: string;
  metadata?: any;
}

export interface MobileMoneyResponse {
  success: boolean;
  transactionId?: string;
  reference: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  currency: string;
  fees: number;
  estimatedCompletion?: Date;
  confirmationRequired: boolean;
  confirmationCode?: string;
  error?: string;
  providerResponse?: any;
}

export class MobileMoneyService {
  private providers: Map<string, MobileMoneyProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    MOBILE_MONEY_PROVIDERS.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  /**
   * Récupère tous les providers disponibles
   */
  getAllProviders(): MobileMoneyProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Récupère les providers par pays
   */
  getProvidersByCountry(countryCode: string): MobileMoneyProvider[] {
    return Array.from(this.providers.values())
      .filter(provider => provider.countryCode === countryCode && provider.isActive);
  }

  /**
   * Récupère les informations d'un pays supporté
   */
  getCountryInfo(countryCode: string) {
    return SUPPORTED_COUNTRIES[countryCode as keyof typeof SUPPORTED_COUNTRIES];
  }

  /**
   * Récupère tous les pays supportés
   */
  getSupportedCountries() {
    return SUPPORTED_COUNTRIES;
  }

  /**
   * Récupère un provider par ID
   */
  getProvider(providerId: string): MobileMoneyProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Valide un numéro de téléphone pour un provider donné
   */
  validatePhoneNumber(phoneNumber: string, countryCode: string): {
    isValid: boolean;
    formattedNumber?: string;
    suggestedProvider?: string;
    error?: string;
  } {
    // Nettoyer le numéro
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    const rule = PHONE_VALIDATION_RULES[countryCode as keyof typeof PHONE_VALIDATION_RULES];
    if (!rule) {
      return {
        isValid: false,
        error: `Country code ${countryCode} not supported`
      };
    }

    // Vérifier la longueur
    if (!rule.length.includes(cleanNumber.length)) {
      return {
        isValid: false,
        error: `Invalid phone number length for ${countryCode}`
      };
    }

    // Détecter le provider suggéré
    let suggestedProvider: string | undefined;
    for (const [providerId, prefixes] of Object.entries(rule.prefixes)) {
      if (prefixes.some(prefix => cleanNumber.startsWith(prefix))) {
        suggestedProvider = providerId;
        break;
      }
    }

    return {
      isValid: true,
      formattedNumber: cleanNumber,
      suggestedProvider
    };
  }

  /**
   * Calcule les frais pour une transaction
   */
  calculateFees(providerId: string, type: string, amount: number): {
    feeAmount: number;
    feePercentage: number;
    totalAmount: number;
  } {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const feePercentage = provider.fees[type as keyof typeof provider.fees] as number || 0;
    let feeAmount = (amount * feePercentage) / 100;

    // Appliquer les limites de frais
    feeAmount = Math.max(feeAmount, provider.fees.minimum);
    feeAmount = Math.min(feeAmount, provider.fees.maximum);

    return {
      feeAmount,
      feePercentage,
      totalAmount: amount + feeAmount
    };
  }

  /**
   * Valide les limites de transaction
   */
  validateTransactionLimits(
    providerId: string,
    amount: number,
    userDailyVolume: number = 0,
    userMonthlyVolume: number = 0
  ): {
    isValid: boolean;
    error?: string;
    limits: any;
  } {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return {
        isValid: false,
        error: `Provider ${providerId} not found`,
        limits: null
      };
    }

    const { limits } = provider;

    if (amount < limits.minTransaction) {
      return {
        isValid: false,
        error: `Amount below minimum limit of ${limits.minTransaction} ${provider.currency}`,
        limits
      };
    }

    if (amount > limits.maxTransaction) {
      return {
        isValid: false,
        error: `Amount exceeds maximum limit of ${limits.maxTransaction} ${provider.currency}`,
        limits
      };
    }

    if (userDailyVolume + amount > limits.dailyLimit) {
      return {
        isValid: false,
        error: `Daily limit exceeded. Remaining: ${limits.dailyLimit - userDailyVolume} ${provider.currency}`,
        limits
      };
    }

    if (userMonthlyVolume + amount > limits.monthlyLimit) {
      return {
        isValid: false,
        error: `Monthly limit exceeded. Remaining: ${limits.monthlyLimit - userMonthlyVolume} ${provider.currency}`,
        limits
      };
    }

    return {
      isValid: true,
      limits
    };
  }

  /**
   * Traite une transaction mobile money
   */
  async processTransaction(request: MobileMoneyRequest): Promise<MobileMoneyResponse> {
    try {
      const provider = this.getProvider(request.providerId);
      if (!provider) {
        throw new Error(`Provider ${request.providerId} not found`);
      }

      // Calculer les frais
      const fees = this.calculateFees(request.providerId, request.type, request.amount);

      // Générer une référence unique
      const reference = this.generateReference(request.providerId, request.type);

      // Simuler l'appel API au provider (en production, faire l'appel réel)
      const providerResponse = await this.callProviderAPI(provider, request, reference);

      return {
        success: providerResponse.success,
        transactionId: providerResponse.transactionId,
        reference,
        status: providerResponse.status,
        amount: request.amount,
        currency: request.currency || provider.currency,
        fees: fees.feeAmount,
        estimatedCompletion: providerResponse.estimatedCompletion,
        confirmationRequired: providerResponse.confirmationRequired,
        confirmationCode: providerResponse.confirmationCode,
        error: providerResponse.error,
        providerResponse
      };
    } catch (error) {
      console.error('Error processing mobile money transaction:', error);
      return {
        success: false,
        reference: this.generateReference(request.providerId, request.type),
        status: 'failed',
        amount: request.amount,
        currency: request.currency || 'XOF',
        fees: 0,
        confirmationRequired: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Appel API simulé vers le provider
   */
  private async callProviderAPI(
    provider: MobileMoneyProvider,
    request: MobileMoneyRequest,
    reference: string
  ): Promise<any> {
    // En production, ici on ferait l'appel réel vers l'API du provider
    // Pour l'instant, on simule une réponse

    await new Promise(resolve => setTimeout(resolve, 1000)); // Simuler latence réseau

    // Simuler différents scénarios
    const scenarios = [
      { success: true, status: 'completed', confirmationRequired: false, probability: 0.7 },
      { success: true, status: 'pending', confirmationRequired: true, probability: 0.2 },
      { success: false, status: 'failed', confirmationRequired: false, probability: 0.1 }
    ];

    const random = Math.random();
    let cumulative = 0;
    let selectedScenario = scenarios[0];

    for (const scenario of scenarios) {
      cumulative += scenario.probability;
      if (random <= cumulative) {
        selectedScenario = scenario;
        break;
      }
    }

    if (selectedScenario.success) {
      return {
        success: true,
        transactionId: `${provider.shortCode}_${Date.now()}`,
        status: selectedScenario.status,
        confirmationRequired: selectedScenario.confirmationRequired,
        confirmationCode: selectedScenario.confirmationRequired ?
          Math.random().toString(36).substring(2, 8).toUpperCase() : undefined,
        estimatedCompletion: selectedScenario.status === 'pending' ?
          new Date(Date.now() + 5 * 60 * 1000) : undefined // 5 minutes
      };
    } else {
      return {
        success: false,
        status: 'failed',
        error: 'Transaction declined by provider',
        confirmationRequired: false
      };
    }
  }

  /**
   * Génère une référence unique pour la transaction
   */
  private generateReference(providerId: string, type: string): string {
    const provider = this.getProvider(providerId);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${provider?.shortCode || 'MM'}_${type.toUpperCase()}_${timestamp}_${random}`;
  }

  /**
   * Vérifie le statut d'une transaction
   */
  async checkTransactionStatus(providerId: string, reference: string): Promise<{
    status: string;
    details?: any;
    error?: string;
  }> {
    try {
      const provider = this.getProvider(providerId);
      if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
      }

      // En production, faire l'appel réel vers l'API du provider
      // Pour l'instant, simulation
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        status: 'completed',
        details: {
          reference,
          completedAt: new Date(),
          confirmationCode: Math.random().toString(36).substring(2, 8).toUpperCase()
        }
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Récupère le solde d'un compte mobile money (si supporté par l'API)
   */
  async getAccountBalance(providerId: string, accountId: string): Promise<{
    balance?: number;
    currency?: string;
    lastUpdated?: Date;
    error?: string;
  }> {
    try {
      const provider = this.getProvider(providerId);
      if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
      }

      // En production, faire l'appel réel vers l'API du provider
      // Pour l'instant, simulation
      await new Promise(resolve => setTimeout(resolve, 800));

      // Simuler un solde aléatoire
      const balance = Math.floor(Math.random() * 100000) + 1000;

      return {
        balance,
        currency: provider.currency,
        lastUpdated: new Date()
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}