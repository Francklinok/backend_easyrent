import mongoose, { Schema, Document } from 'mongoose';

export interface ICryptoCurrency {
  symbol: string; // BTC, ETH, USDT, etc.
  name: string; // Bitcoin, Ethereum, Tether
  network: string; // bitcoin, ethereum, polygon, bsc
  balance: number; // Montant en crypto
  lockedBalance: number; // Montant bloqué (en cours de transaction)
  walletAddress: string; // Adresse du wallet pour cette crypto
  privateKey?: string; // Clé privée chiffrée
  isActive: boolean;
  lastSyncAt: Date;
  metadata: {
    contractAddress?: string; // Pour les tokens ERC-20/BEP-20
    decimals: number;
    logoUrl?: string;
    marketCap?: number;
    currentPrice: number; // Prix actuel en fiat
    priceChange24h: number; // % de variation 24h
    lastPriceUpdate: Date;
  };
}

export interface IFiatCurrency {
  symbol: string; // EUR, USD, GBP
  name: string; // Euro, US Dollar, British Pound
  balance: number; // Solde disponible
  lockedBalance: number; // Solde bloqué
  isBaseCurrency: boolean; // Devise principale de l'utilisateur
  exchangeRate: number; // Taux de change vers EUR
  lastExchangeUpdate: Date;
}

export interface IMobileMoneyAccount {
  id: string;
  providerId: string; // orange_money_ci, mtn_money_ci, etc.
  providerName: string; // Orange Money, MTN Mobile Money, etc.
  phoneNumber: string; // Numéro de téléphone
  accountName: string; // Nom du compte
  countryCode: string; // CI, SN, KE, etc.
  currency: string; // XOF, KES, GHS, etc.
  isVerified: boolean; // Compte vérifié par SMS/OTP
  isDefault: boolean;
  balance?: number; // Solde si disponible via API
  lastSyncAt?: Date;
  limits: {
    dailyLimit: number;
    monthlyLimit: number;
    currentDailyUsage: number;
    currentMonthlyUsage: number;
  };
  fees: {
    deposit: number;
    withdrawal: number;
    transfer: number;
  };
  metadata: {
    lastTransactionAt?: Date;
    totalTransactions: number;
    totalVolume: number;
    averageTransactionAmount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentMethod {
  id: string;
  type: 'bank_card' | 'bank_transfer' | 'crypto_wallet' | 'paypal' | 'apple_pay' | 'google_pay' | 'stripe' | 'mobile_money' | 'internal';
  name: string; // Nom donné par l'utilisateur
  isDefault: boolean;
  isActive: boolean;
  // Données spécifiques selon le type
  cardDetails?: {
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
    holderName: string;
  };
  bankDetails?: {
    iban: string;
    bankName: string;
    accountHolderName: string;
  };
  cryptoDetails?: {
    walletAddress: string;
    network: string;
    currency: string;
  };
  mobileMoneyDetails?: {
    phoneNumber: string;
    providerId: string; // orange_money_ci, mtn_money_ci, etc.
    providerName: string; // Orange Money, MTN Mobile Money, etc.
    countryCode: string; // CI, SN, KE, etc.
    currency: string; // XOF, KES, GHS, etc.
    accountName: string;
    isVerified: boolean;
  };
  externalDetails?: {
    providerId: string; // ID chez le provider (Stripe, PayPal, etc.)
    providerData: any; // Données spécifiques au provider
  };
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface IWalletTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'payment' | 'received' | 'transfer' | 'exchange' | 'fee' | 'refund' | 'stake' | 'unstake';
  subType?: 'rent' | 'purchase' | 'deposit_security' | 'service_fee' | 'commission' | 'bonus' | 'cashback';

  // Montants
  amount: number;
  currency: string; // Devise de la transaction
  feeAmount?: number; // Frais de transaction
  feeCurrency?: string;

  // Conversion crypto/fiat
  cryptoAmount?: number;
  cryptoCurrency?: string;
  exchangeRate?: number;
  exchangeRateSource?: string;

  // Parties impliquées
  fromUserId?: string;
  toUserId?: string;
  fromAddress?: string; // Adresse crypto
  toAddress?: string; // Adresse crypto

  // Méthode de paiement utilisée
  paymentMethodId?: string;
  externalTransactionId?: string; // ID chez le provider externe

  // Statut et suivi
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  confirmations?: number; // Pour les cryptos
  requiredConfirmations?: number;

  // Blockchain data (si crypto)
  txHash?: string;
  blockHeight?: number;
  gasUsed?: number;
  gasPrice?: number;

  // Métadonnées business
  propertyId?: string;
  reservationId?: string;
  contractId?: string;
  description: string;
  internalNotes?: string;

  // Dates importantes
  scheduledFor?: Date; // Pour les paiements programmés
  completedAt?: Date;
  confirmedAt?: Date;

  // Données techniques
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface IWalletStats {
  totalBalance: number; // Valeur totale en devise de base
  totalCryptoValue: number; // Valeur crypto en devise de base
  totalFiatValue: number; // Valeur fiat en devise de base

  // Performance
  totalGains: number; // Gains totaux
  totalLosses: number; // Pertes totales
  portfolioPerformance: number; // Performance du portefeuille en %

  // Statistiques des transactions
  transactionCount: {
    total: number;
    thisMonth: number;
    thisWeek: number;
    thisYear: number;
  };

  transactionVolume: {
    total: number;
    thisMonth: number;
    thisWeek: number;
    thisYear: number;
  };

  // Répartition par devise
  currencyDistribution: {
    currency: string;
    percentage: number;
    value: number;
  }[];

  lastCalculatedAt: Date;
}

export interface IEnhancedWallet extends Document {
  userId: string;

  // Devises fiat
  fiatCurrencies: IFiatCurrency[];

  // Cryptomonnaies
  cryptoCurrencies: ICryptoCurrency[];

  // Méthodes de paiement
  paymentMethods: IPaymentMethod[];

  // Comptes Mobile Money
  mobileMoneyAccounts: IMobileMoneyAccount[];

  // Transactions
  transactions: IWalletTransaction[];

  // Paramètres du wallet
  settings: {
    baseCurrency: string; // Devise principale (EUR, USD, etc.)
    autoConvert: boolean; // Conversion automatique
    notificationsEnabled: boolean;
    twoFactorEnabled: boolean;
    maxDailyLimit: number; // Limite quotidienne
    maxTransactionLimit: number; // Limite par transaction
    allowedCountries: string[]; // Pays autorisés
    kycLevel: 'none' | 'basic' | 'intermediate' | 'advanced';
    isBlocked: boolean;
    blockedReason?: string;
    blockedAt?: Date;
  };

  // Statistiques et analytics
  stats: IWalletStats;

  // Sécurité
  security: {
    lastPasswordChange: Date;
    lastSecurityCheck: Date;
    failedLoginAttempts: number;
    lastFailedLogin?: Date;
    securityScore: number; // Score de sécurité 0-100
    riskLevel: 'low' | 'medium' | 'high';
    fraudAlerts: {
      alertId: string;
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      resolved: boolean;
      createdAt: Date;
      resolvedAt?: Date;
    }[];
  };

  // Données de conformité
  compliance: {
    kycStatus: 'pending' | 'approved' | 'rejected' | 'expired';
    kycDocuments: string[]; // IDs des documents
    amlChecks: {
      checkId: string;
      provider: string;
      status: 'passed' | 'failed' | 'pending';
      score: number;
      details: any;
      checkedAt: Date;
    }[];
    sanctionCheck: {
      isClean: boolean;
      lastChecked: Date;
      provider: string;
    };
  };

  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

const CryptoCurrencySchema = new Schema<ICryptoCurrency>({
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  network: { type: String, required: true },
  balance: { type: Number, default: 0, min: 0 },
  lockedBalance: { type: Number, default: 0, min: 0 },
  walletAddress: { type: String, required: true },
  privateKey: { type: String }, // Chiffré
  isActive: { type: Boolean, default: true },
  lastSyncAt: { type: Date, default: Date.now },
  metadata: {
    contractAddress: { type: String },
    decimals: { type: Number, default: 18 },
    logoUrl: { type: String },
    marketCap: { type: Number },
    currentPrice: { type: Number, default: 0 },
    priceChange24h: { type: Number, default: 0 },
    lastPriceUpdate: { type: Date, default: Date.now }
  }
}, { _id: false });

const FiatCurrencySchema = new Schema<IFiatCurrency>({
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  balance: { type: Number, default: 0, min: 0 },
  lockedBalance: { type: Number, default: 0, min: 0 },
  isBaseCurrency: { type: Boolean, default: false },
  exchangeRate: { type: Number, default: 1 },
  lastExchangeUpdate: { type: Date, default: Date.now }
}, { _id: false });

const MobileMoneyAccountSchema = new Schema<IMobileMoneyAccount>({
  id: { type: String, required: true },
  providerId: { type: String, required: true },
  providerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  accountName: { type: String, required: true },
  countryCode: { type: String, required: true, maxlength: 2 },
  currency: { type: String, required: true, maxlength: 3 },
  isVerified: { type: Boolean, default: false },
  isDefault: { type: Boolean, default: false },
  balance: { type: Number, min: 0 },
  lastSyncAt: { type: Date },
  limits: {
    dailyLimit: { type: Number, required: true },
    monthlyLimit: { type: Number, required: true },
    currentDailyUsage: { type: Number, default: 0 },
    currentMonthlyUsage: { type: Number, default: 0 }
  },
  fees: {
    deposit: { type: Number, required: true },
    withdrawal: { type: Number, required: true },
    transfer: { type: Number, required: true }
  },
  metadata: {
    lastTransactionAt: { type: Date },
    totalTransactions: { type: Number, default: 0 },
    totalVolume: { type: Number, default: 0 },
    averageTransactionAmount: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const PaymentMethodSchema = new Schema<IPaymentMethod>({
  id: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['bank_card', 'bank_transfer', 'crypto_wallet', 'paypal', 'apple_pay', 'google_pay', 'stripe', 'internal']
  },
  name: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  cardDetails: {
    last4: { type: String },
    brand: { type: String },
    expiryMonth: { type: Number },
    expiryYear: { type: Number },
    holderName: { type: String }
  },
  bankDetails: {
    iban: { type: String },
    bankName: { type: String },
    accountHolderName: { type: String }
  },
  cryptoDetails: {
    walletAddress: { type: String },
    network: { type: String },
    currency: { type: String }
  },
  externalDetails: {
    providerId: { type: String },
    providerData: { type: Schema.Types.Mixed }
  },
  lastUsedAt: { type: Date }
}, {
  _id: false,
  timestamps: true
});

const WalletTransactionSchema = new Schema<IWalletTransaction>({
  id: { type: String, required: true, unique: true },
  type: {
    type: String,
    required: true,
    enum: ['deposit', 'withdrawal', 'payment', 'received', 'transfer', 'exchange', 'fee', 'refund', 'stake', 'unstake']
  },
  subType: {
    type: String,
    enum: ['rent', 'purchase', 'deposit_security', 'service_fee', 'commission', 'bonus', 'cashback']
  },

  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  feeAmount: { type: Number },
  feeCurrency: { type: String },

  cryptoAmount: { type: Number },
  cryptoCurrency: { type: String },
  exchangeRate: { type: Number },
  exchangeRateSource: { type: String },

  fromUserId: { type: String },
  toUserId: { type: String },
  fromAddress: { type: String },
  toAddress: { type: String },

  paymentMethodId: { type: String },
  externalTransactionId: { type: String },

  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']
  },
  confirmations: { type: Number, default: 0 },
  requiredConfirmations: { type: Number },

  txHash: { type: String },
  blockHeight: { type: Number },
  gasUsed: { type: Number },
  gasPrice: { type: Number },

  propertyId: { type: String },
  reservationId: { type: String },
  contractId: { type: String },
  description: { type: String, required: true },
  internalNotes: { type: String },

  scheduledFor: { type: Date },
  completedAt: { type: Date },
  confirmedAt: { type: Date },

  ipAddress: { type: String },
  userAgent: { type: String },
  deviceFingerprint: { type: String }
}, {
  _id: false,
  timestamps: true
});

const EnhancedWalletSchema = new Schema<IEnhancedWallet>({
  userId: { type: String, required: true, unique: true },

  fiatCurrencies: [FiatCurrencySchema],
  cryptoCurrencies: [CryptoCurrencySchema],
  paymentMethods: [PaymentMethodSchema],
  mobileMoneyAccounts: [MobileMoneyAccountSchema],
  transactions: [WalletTransactionSchema],

  settings: {
    baseCurrency: { type: String, default: 'EUR' },
    autoConvert: { type: Boolean, default: false },
    notificationsEnabled: { type: Boolean, default: true },
    twoFactorEnabled: { type: Boolean, default: false },
    maxDailyLimit: { type: Number, default: 10000 },
    maxTransactionLimit: { type: Number, default: 5000 },
    allowedCountries: [{ type: String }],
    kycLevel: {
      type: String,
      default: 'none',
      enum: ['none', 'basic', 'intermediate', 'advanced']
    },
    isBlocked: { type: Boolean, default: false },
    blockedReason: { type: String },
    blockedAt: { type: Date }
  },

  stats: {
    totalBalance: { type: Number, default: 0 },
    totalCryptoValue: { type: Number, default: 0 },
    totalFiatValue: { type: Number, default: 0 },
    totalGains: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    portfolioPerformance: { type: Number, default: 0 },
    transactionCount: {
      total: { type: Number, default: 0 },
      thisMonth: { type: Number, default: 0 },
      thisWeek: { type: Number, default: 0 },
      thisYear: { type: Number, default: 0 }
    },
    transactionVolume: {
      total: { type: Number, default: 0 },
      thisMonth: { type: Number, default: 0 },
      thisWeek: { type: Number, default: 0 },
      thisYear: { type: Number, default: 0 }
    },
    currencyDistribution: [{
      currency: { type: String },
      percentage: { type: Number },
      value: { type: Number }
    }],
    lastCalculatedAt: { type: Date, default: Date.now }
  },

  security: {
    lastPasswordChange: { type: Date, default: Date.now },
    lastSecurityCheck: { type: Date, default: Date.now },
    failedLoginAttempts: { type: Number, default: 0 },
    lastFailedLogin: { type: Date },
    securityScore: { type: Number, default: 50 },
    riskLevel: {
      type: String,
      default: 'low',
      enum: ['low', 'medium', 'high']
    },
    fraudAlerts: [{
      alertId: { type: String, required: true },
      type: { type: String, required: true },
      description: { type: String, required: true },
      severity: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high', 'critical']
      },
      resolved: { type: Boolean, default: false },
      resolvedAt: { type: Date }
    }]
  },

  compliance: {
    kycStatus: {
      type: String,
      default: 'pending',
      enum: ['pending', 'approved', 'rejected', 'expired']
    },
    kycDocuments: [{ type: String }],
    amlChecks: [{
      checkId: { type: String, required: true },
      provider: { type: String, required: true },
      status: {
        type: String,
        required: true,
        enum: ['passed', 'failed', 'pending']
      },
      score: { type: Number, required: true },
      details: { type: Schema.Types.Mixed },
      checkedAt: { type: Date, default: Date.now }
    }],
    sanctionCheck: {
      isClean: { type: Boolean, default: true },
      lastChecked: { type: Date, default: Date.now },
      provider: { type: String, default: 'internal' }
    }
  },

  lastActivityAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index pour les performances
EnhancedWalletSchema.index({ userId: 1 });
EnhancedWalletSchema.index({ 'transactions.status': 1 });
EnhancedWalletSchema.index({ 'transactions.type': 1 });
EnhancedWalletSchema.index({ 'transactions.createdAt': -1 });
EnhancedWalletSchema.index({ 'cryptoCurrencies.symbol': 1 });
EnhancedWalletSchema.index({ 'fiatCurrencies.symbol': 1 });
EnhancedWalletSchema.index({ lastActivityAt: -1 });

// Méthodes virtuelles
EnhancedWalletSchema.virtual('totalPortfolioValue').get(function(this: IEnhancedWallet) {
  return this.stats.totalCryptoValue + this.stats.totalFiatValue;
});

// Méthodes d'instance
EnhancedWalletSchema.methods.getTotalBalance = function(currency: string = 'EUR') {
  // Calculer le solde total dans la devise demandée
  let total = 0;

  // Ajouter les soldes fiat
  this.fiatCurrencies.forEach((fiat: IFiatCurrency) => {
    if (fiat.symbol === currency) {
      total += fiat.balance;
    } else {
      total += fiat.balance * fiat.exchangeRate;
    }
  });

  // Ajouter les soldes crypto convertis
  this.cryptoCurrencies.forEach((crypto: ICryptoCurrency) => {
    total += crypto.balance * crypto.metadata.currentPrice;
  });

  return total;
};

EnhancedWalletSchema.methods.addTransaction = function(transaction: Partial<IWalletTransaction>) {
  const newTransaction = {
    ...transaction,
    id: transaction.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  this.transactions.push(newTransaction);
  this.lastActivityAt = new Date();

  return this.save();
};

EnhancedWalletSchema.methods.updateStats = async function() {
  // Recalculer les statistiques du wallet
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Calculer les montants totaux
  this.stats.totalFiatValue = this.fiatCurrencies.reduce((sum: number, fiat: IFiatCurrency) =>
    sum + fiat.balance, 0);

  this.stats.totalCryptoValue = this.cryptoCurrencies.reduce((sum: number, crypto: ICryptoCurrency) =>
    sum + (crypto.balance * crypto.metadata.currentPrice), 0);

  this.stats.totalBalance = this.stats.totalFiatValue + this.stats.totalCryptoValue;

  // Calculer les statistiques de transactions
  this.stats.transactionCount.total = this.transactions.length;
  this.stats.transactionCount.thisMonth = this.transactions.filter(
    (tx: IWalletTransaction) => tx.createdAt >= startOfMonth).length;
  this.stats.transactionCount.thisWeek = this.transactions.filter(
    (tx: IWalletTransaction) => tx.createdAt >= startOfWeek).length;
  this.stats.transactionCount.thisYear = this.transactions.filter(
    (tx: IWalletTransaction) => tx.createdAt >= startOfYear).length;

  this.stats.lastCalculatedAt = new Date();

  return this.save();
};

export const EnhancedWallet = mongoose.model<IEnhancedWallet>('EnhancedWallet', EnhancedWalletSchema);