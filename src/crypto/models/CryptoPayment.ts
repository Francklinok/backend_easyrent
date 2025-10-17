import mongoose, { Schema, Document } from 'mongoose';

export interface ICryptoPayment extends Document {
  paymentId: string;
  userId: string;
  propertyId: string;
  paymentType: 'rent' | 'purchase' | 'deposit' | 'security_deposit' | 'service_fee';

  // Crypto details
  cryptocurrency: 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'MATIC' | 'BNB';
  network: 'bitcoin' | 'ethereum' | 'polygon' | 'bsc';
  amount: number; // Montant en crypto
  amountFiat: number; // Montant équivalent en fiat
  fiatCurrency: string;
  exchangeRate: number; // Taux de change au moment du paiement

  // Transaction details
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  blockHeight?: number;
  confirmations: number;
  gasUsed?: number;
  gasPrice?: number;

  // Payment status
  status: 'pending' | 'confirming' | 'confirmed' | 'failed' | 'refunded';
  confirmationsRequired: number;

  // Smart contract
  smartContractAddress?: string;
  smartContractFunction?: string;
  contractInteractionData?: any;

  // Escrow info (for deposits)
  escrow?: {
    isEscrow: boolean;
    escrowAddress: string;
    releaseConditions: string[];
    releaseDate?: Date;
    isReleased: boolean;
    releasedAt?: Date;
    releasedTo: string;
  };

  // Automatic payments (for rent)
  recurring?: {
    isRecurring: boolean;
    frequency: 'weekly' | 'monthly' | 'quarterly';
    nextPaymentDate: Date;
    endDate?: Date;
    totalPayments: number;
    completedPayments: number;
  };

  // Metadata
  metadata: {
    propertyAddress: string;
    landlordId: string;
    leaseId?: string;
    paymentDescription: string;
    invoiceNumber?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const CryptoPaymentSchema = new Schema<ICryptoPayment>({
  paymentId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  propertyId: { type: String, required: true, index: true },
  paymentType: {
    type: String,
    required: true,
    enum: ['rent', 'purchase', 'deposit', 'security_deposit', 'service_fee']
  },

  cryptocurrency: {
    type: String,
    required: true,
    enum: ['BTC', 'ETH', 'USDT', 'USDC', 'MATIC', 'BNB']
  },
  network: {
    type: String,
    required: true,
    enum: ['bitcoin', 'ethereum', 'polygon', 'bsc']
  },
  amount: { type: Number, required: true, min: 0 },
  amountFiat: { type: Number, required: true, min: 0 },
  fiatCurrency: { type: String, required: true, default: 'USD' },
  exchangeRate: { type: Number, required: true, min: 0 },

  transactionHash: { type: String, required: true, unique: true },
  fromAddress: { type: String, required: true },
  toAddress: { type: String, required: true },
  blockHeight: { type: Number },
  confirmations: { type: Number, default: 0, min: 0 },
  gasUsed: { type: Number, min: 0 },
  gasPrice: { type: Number, min: 0 },

  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'confirming', 'confirmed', 'failed', 'refunded']
  },
  confirmationsRequired: { type: Number, default: 6, min: 1 },

  smartContractAddress: { type: String },
  smartContractFunction: { type: String },
  contractInteractionData: { type: Schema.Types.Mixed },

  escrow: {
    isEscrow: { type: Boolean, default: false },
    escrowAddress: { type: String },
    releaseConditions: [{ type: String }],
    releaseDate: { type: Date },
    isReleased: { type: Boolean, default: false },
    releasedAt: { type: Date },
    releasedTo: { type: String }
  },

  recurring: {
    isRecurring: { type: Boolean, default: false },
    frequency: { type: String, enum: ['weekly', 'monthly', 'quarterly'] },
    nextPaymentDate: { type: Date },
    endDate: { type: Date },
    totalPayments: { type: Number, min: 1 },
    completedPayments: { type: Number, default: 0, min: 0 }
  },

  metadata: {
    propertyAddress: { type: String, required: true },
    landlordId: { type: String, required: true },
    leaseId: { type: String },
    paymentDescription: { type: String, required: true },
    invoiceNumber: { type: String }
  }
}, {
  timestamps: true
});

// Index pour les requêtes fréquentes
CryptoPaymentSchema.index({ userId: 1, status: 1 });
CryptoPaymentSchema.index({ propertyId: 1, paymentType: 1 });
CryptoPaymentSchema.index({ status: 1, createdAt: -1 });
CryptoPaymentSchema.index({ 'recurring.nextPaymentDate': 1 });

export const CryptoPayment = mongoose.model<ICryptoPayment>('CryptoPayment', CryptoPaymentSchema);