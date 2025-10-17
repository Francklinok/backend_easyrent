import mongoose, { Schema, Document } from 'mongoose';

export interface ISmartContract extends Document {
  contractId: string;
  contractType: 'lease' | 'sale' | 'escrow' | 'revenue_sharing' | 'utility_token';
  propertyId: string;

  // Blockchain details
  blockchain: 'ethereum' | 'polygon' | 'bsc' | 'avalanche';
  contractAddress: string;
  abi: any[]; // Application Binary Interface
  bytecode?: string;

  // Parties involved
  parties: {
    role: 'landlord' | 'tenant' | 'buyer' | 'seller' | 'investor' | 'platform';
    userId: string;
    walletAddress: string;
    signature?: string;
    signedAt?: Date;
  }[];

  // Contract terms
  terms: {
    // For lease contracts
    monthlyRent?: number;
    currency: string;
    leaseDuration?: number; // en mois
    securityDeposit?: number;

    // For sale contracts
    salePrice?: number;

    // For escrow
    escrowAmount?: number;
    releaseConditions: string[];

    // General terms
    startDate: Date;
    endDate?: Date;
    automaticRenewal?: boolean;
    penaltyClause?: {
      description: string;
      amount: number;
      currency: string;
    }[];
  };

  // Payment automation
  paymentSchedule?: {
    frequency: 'weekly' | 'monthly' | 'quarterly';
    amount: number;
    currency: string;
    nextPaymentDate: Date;
    totalPayments: number;
    completedPayments: number;
    autoExecute: boolean;
  };

  // Contract functions
  functions: {
    name: string;
    description: string;
    parameters: {
      name: string;
      type: string;
      description: string;
    }[];
    access: 'public' | 'owner_only' | 'parties_only';
  }[];

  // Execution history
  executionHistory: {
    functionName: string;
    executedBy: string;
    executedAt: Date;
    transactionHash: string;
    gasUsed: number;
    success: boolean;
    parameters: any;
    result?: any;
    error?: string;
  }[];

  // Milestones et conditions
  milestones: {
    id: string;
    description: string;
    condition: string; // Code condition ou description
    status: 'pending' | 'met' | 'failed';
    completedAt?: Date;
    evidence?: {
      type: 'file' | 'transaction' | 'signature';
      data: string;
      uploadedBy: string;
      uploadedAt: Date;
    }[];
  }[];

  // Oracle integration
  oracles?: {
    priceOracle?: {
      provider: string;
      endpoint: string;
      frequency: number; // en minutes
      lastUpdate: Date;
      currentPrice: number;
    };
    propertyOracle?: {
      provider: string;
      endpoint: string;
      lastValuation: Date;
      currentValuation: number;
    };
  };

  // Security and compliance
  security: {
    isAudited: boolean;
    auditReport?: string;
    vulnerabilities: {
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      status: 'open' | 'resolved';
      reportedAt: Date;
    }[];
    pausedFunctions: string[];
  };

  status: 'draft' | 'deployed' | 'active' | 'paused' | 'completed' | 'terminated';
  deployedAt?: Date;
  terminatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SmartContractSchema = new Schema<ISmartContract>({
  contractId: { type: String, required: true, unique: true },
  contractType: {
    type: String,
    required: true,
    enum: ['lease', 'sale', 'escrow', 'revenue_sharing', 'utility_token']
  },
  propertyId: { type: String, required: true, index: true },

  blockchain: {
    type: String,
    required: true,
    enum: ['ethereum', 'polygon', 'bsc', 'avalanche']
  },
  contractAddress: { type: String, unique: true, sparse: true },
  abi: [{ type: Schema.Types.Mixed }],
  bytecode: { type: String },

  parties: [{
    role: {
      type: String,
      required: true,
      enum: ['landlord', 'tenant', 'buyer', 'seller', 'investor', 'platform']
    },
    userId: { type: String, required: true },
    walletAddress: { type: String, required: true },
    signature: { type: String },
    signedAt: { type: Date }
  }],

  terms: {
    monthlyRent: { type: Number, min: 0 },
    currency: { type: String, required: true, default: 'USD' },
    leaseDuration: { type: Number, min: 1 },
    securityDeposit: { type: Number, min: 0 },
    salePrice: { type: Number, min: 0 },
    escrowAmount: { type: Number, min: 0 },
    releaseConditions: [{ type: String }],
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    automaticRenewal: { type: Boolean, default: false },
    penaltyClause: [{
      description: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, required: true }
    }]
  },

  paymentSchedule: {
    frequency: { type: String, enum: ['weekly', 'monthly', 'quarterly'] },
    amount: { type: Number, min: 0 },
    currency: { type: String },
    nextPaymentDate: { type: Date },
    totalPayments: { type: Number, min: 1 },
    completedPayments: { type: Number, default: 0, min: 0 },
    autoExecute: { type: Boolean, default: false }
  },

  functions: [{
    name: { type: String, required: true },
    description: { type: String, required: true },
    parameters: [{
      name: { type: String, required: true },
      type: { type: String, required: true },
      description: { type: String, required: true }
    }],
    access: { type: String, enum: ['public', 'owner_only', 'parties_only'], default: 'parties_only' }
  }],

  executionHistory: [{
    functionName: { type: String, required: true },
    executedBy: { type: String, required: true },
    executedAt: { type: Date, required: true },
    transactionHash: { type: String, required: true },
    gasUsed: { type: Number, min: 0 },
    success: { type: Boolean, required: true },
    parameters: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed },
    error: { type: String }
  }],

  milestones: [{
    id: { type: String, required: true },
    description: { type: String, required: true },
    condition: { type: String, required: true },
    status: { type: String, enum: ['pending', 'met', 'failed'], default: 'pending' },
    completedAt: { type: Date },
    evidence: [{
      type: { type: String, enum: ['file', 'transaction', 'signature'], required: true },
      data: { type: String, required: true },
      uploadedBy: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now }
    }]
  }],

  oracles: {
    priceOracle: {
      provider: { type: String },
      endpoint: { type: String },
      frequency: { type: Number, min: 1 },
      lastUpdate: { type: Date },
      currentPrice: { type: Number, min: 0 }
    },
    propertyOracle: {
      provider: { type: String },
      endpoint: { type: String },
      lastValuation: { type: Date },
      currentValuation: { type: Number, min: 0 }
    }
  },

  security: {
    isAudited: { type: Boolean, default: false },
    auditReport: { type: String },
    vulnerabilities: [{
      severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
      description: { type: String, required: true },
      status: { type: String, enum: ['open', 'resolved'], default: 'open' },
      reportedAt: { type: Date, default: Date.now }
    }],
    pausedFunctions: [{ type: String }]
  },

  status: {
    type: String,
    default: 'draft',
    enum: ['draft', 'deployed', 'active', 'paused', 'completed', 'terminated']
  },
  deployedAt: { type: Date },
  terminatedAt: { type: Date }
}, {
  timestamps: true
});

// Index pour les requêtes fréquentes
SmartContractSchema.index({ contractAddress: 1 });
SmartContractSchema.index({ propertyId: 1, contractType: 1 });
SmartContractSchema.index({ 'parties.userId': 1 });
SmartContractSchema.index({ status: 1, blockchain: 1 });
SmartContractSchema.index({ 'paymentSchedule.nextPaymentDate': 1 });

export const SmartContract = mongoose.model<ISmartContract>('SmartContract', SmartContractSchema);