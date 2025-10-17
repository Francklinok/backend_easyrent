import mongoose, { Schema, Document } from 'mongoose';

export interface IPropertyToken extends Document {
  tokenId: string;
  propertyId: string;
  tokenSymbol: string;
  tokenName: string;
  contractAddress: string;
  blockchaintype: 'ethereum' | 'polygon' | 'bsc' | 'avalanche';
  totalSupply: number;
  circulatingSupply: number;
  tokenType: 'ERC20' | 'ERC721' | 'ERC1155';

  // Tokenomics
  tokenomics: {
    tokenSymbol: string;
    tokenName: string;
    pricePerToken: number; // En USD
    tokenPrice: number;
    currency: string;
    minimumPurchase: number;
    maximumPurchase?: number;
    minimumInvestment?:number;
    vestingPeriod?: number; // En jours
    lockupPeriod?: number; // En jours
    totalSupply: number;
    circulatingSupply: number;
    priceHistory: {
      date: Date;
      price: number;
      volume: number;
      marketCap: number;
    }[];
  };

  // Ownership distribution
  ownership: {
    totalOwners: number;
    ownershipDistribution: {
      ownerId: string;
      tokensOwned: number;
      ownershipPercentage: number;
      acquisitionDate: Date;
      averagePurchasePrice: number;
      investmentAmount: number;
      kycStatus: string;
      accreditedInvestor: boolean;
    }[];
  };

  // Property details
  propertyDetails: {
    address: string;
    propertyType: string;
    totalValue: number;
    valuation: number;
    currency: string;
    valuationDate: Date;
    lastValuation: Date;
    rentalYield: number; // Pourcentage annuel
    appreciationRate: number; // Pourcentage annuel estimé
    location: string;
  };

  // Revenue distribution
  revenueDistribution: {
    frequency: 'monthly' | 'quarterly' | 'yearly';
    lastDistribution: Date;
    nextDistribution: Date;
    totalDistributed: number;
    currency: string;
    distributionHistory: {
      date: Date;
      amountPerToken: number;
      totalAmount: number;
      participatingTokens: number;
    }[];
  };

  // Legal and compliance
  legal: {
    propertyDeed: string;
    operatingAgreement: string;
    prospectus: string;
    legalDocuments: {
      type: string;
      url: string;
      hash: string;
    }[];
    custodian: string;
    propertyManager: string;
    jurisdiction: string;
    regulatoryCompliance: string[];
    prospectusUrl?: string;
  };

  // Trading
  trading: {
    isTradeEnabled: boolean;
    isListed: boolean;
    exchanges: string[];
    currentPrice: number;
    priceHistory: {
      date: Date;
      price: number;
      volume: number;
    }[];
    marketCap: number;
    volume24h: number;
    tradingVolume24h: number;
    totalTradingVolume: number;
    priceDiscovery: string;
    dexListings: any[];
    liquidityPool: {
      totalLiquidity: number;
      providers: any[];
      rewardRate: number;
    };
    orderBook: {
      buyOrders: any[];
      sellOrders: {
        listingId?: string;
        orderId?: string;
        sellerId?: string;
        tokensAmount?: number;
        quantity?: number;
        pricePerToken?: number;
        totalValue?: number;
        orderType?: string;
        status?: string;
        createdAt?: Date;
        expiresAt?: Date;
        currency?: string;
        listingType?: string;
        minimumBid?: number;
        reservePrice?: number;
        bids?: {
          bidId: string;
          bidderId: string;
          amount: number;
          currency: string;
          walletAddress: string;
          timestamp: Date;
          status: string;
          escrowTxHash: string;
        }[];
        views?: number;
        favorites?: number;
      }[];
      lastTrade: {
        price: number;
        quantity: number;
        timestamp: Date;
        buyer: string;
        seller: string;
      } | null;
    };
  };

  blockchain: {
    network: string;
    contractAddress: string;
    tokenStandard: string;
    deploymentCost: number;
    gasOptimization: boolean;
  };

  revenueSharing: {
    enabled: boolean;
    distributionFrequency: string;
    nextDistribution: Date;
    totalRevenueDistributed: number;
    distributionHistory: any[];
    reservePercentage: number;
    managementFee: number;
    expectedAnnualReturn: number;
  };

  governance: {
    enabled: boolean;
    votingRights: string;
    quorum: number;
    proposals: any[];
    votingHistory: any[];
  };

  compliance: {
    isCompliant: boolean;
    jurisdiction: string;
    regulations: string[];
    auditTrail: {
      action: string;
      performedBy: string;
      timestamp: Date;
      details: string;
    }[];
    kycRequirement: boolean;
    accreditedInvestorOnly: boolean;
  };

  valueMetrics: {
    currentValuation: number;
    occupancyRate: number;
    netOperatingIncome: number;
    capRate: number;
    appreciationRate: number;
    totalReturn: number;
    cashFlow: {
      monthly: number;
      quarterly: number;
      annual: number;
    };
  };

  status: 'draft' | 'pending_approval' | 'active' | 'paused' | 'completed' | 'tokenized' | 'deployed';
  createdAt: Date;
  updatedAt: Date;
}

const PropertyTokenSchema = new Schema<IPropertyToken>({
  tokenId: { type: String, required: true, unique: true },
  propertyId: { type: String, required: true, unique: true },
  tokenSymbol: { type: String, required: true, unique: true, maxlength: 10 },
  tokenName: { type: String, required: true, maxlength: 100 },
  contractAddress: { type: String, unique: true, sparse: true },
  blockchaintype: {
    type: String,
    required: true,
    enum: ['ethereum', 'polygon', 'bsc', 'avalanche'],
    default: 'polygon'
  },
  totalSupply: { type: Number, required: true, min: 1 },
  circulatingSupply: { type: Number, default: 0, min: 0 },
  tokenType: {
    type: String,
    required: true,
    enum: ['ERC20', 'ERC721', 'ERC1155'],
    default: 'ERC20'
  },

  tokenomics: {
    tokenSymbol: { type: String },
    tokenName: { type: String },
    pricePerToken: { type: Number, default: 0 },
    tokenPrice: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    minimumPurchase: { type: Number, default: 1 },
    maximumPurchase: { type: Number },
    minimumInvestment: { type: Number, default: 10 },
    vestingPeriod: { type: Number },
    lockupPeriod: { type: Number },
    totalSupply: { type: Number, default: 0 },
    circulatingSupply: { type: Number, default: 0 },
    priceHistory: [{
      date: Date,
      price: Number,
      volume: Number,
      marketCap: Number
    }]
  },

  ownership: {
    totalOwners: { type: Number, default: 0 },
    ownershipDistribution: [{
      ownerId: String,
      tokensOwned: Number,
      ownershipPercentage: Number,
      acquisitionDate: Date,
      averagePurchasePrice: Number,
      investmentAmount: Number,
      kycStatus: String,
      accreditedInvestor: Boolean
    }]
  },

  propertyDetails: {
    address: { type: String, default: '' },
    propertyType: { type: String, default: '' },
    totalValue: { type: Number, default: 0 },
    valuation: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    valuationDate: { type: Date },
    lastValuation: { type: Date },
    rentalYield: { type: Number, default: 0 },
    appreciationRate: { type: Number, default: 0 },
    location: { type: String, default: '' }
  },

  revenueDistribution: {
    frequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },
    lastDistribution: Date,
    nextDistribution: Date,
    totalDistributed: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    distributionHistory: [{
      date: Date,
      amountPerToken: Number,
      totalAmount: Number,
      participatingTokens: Number
    }]
  },

  legal: {
    propertyDeed: { type: String, default: '' },
    operatingAgreement: { type: String, default: '' },
    prospectus: { type: String, default: '' },
    legalDocuments: [{
      type: String,
      url: String,
      hash: String
    }],
    custodian: { type: String, default: '' },
    propertyManager: { type: String, default: '' },
    jurisdiction: { type: String, default: '' },
    regulatoryCompliance: [String],
    prospectusUrl: String
  },

  trading: {
    isTradeEnabled: { type: Boolean, default: false },
    isListed: { type: Boolean, default: false },
    exchanges: [String],
    currentPrice: { type: Number, default: 0 },
    priceHistory: [{
      date: Date,
      price: Number,
      volume: Number
    }],
    marketCap: { type: Number, default: 0 },
    volume24h: { type: Number, default: 0 },
    tradingVolume24h: { type: Number, default: 0 },
    totalTradingVolume: { type: Number, default: 0 },
    priceDiscovery: { type: String, default: '' },
    dexListings: [Schema.Types.Mixed],
    liquidityPool: {
      totalLiquidity: { type: Number, default: 0 },
      providers: [Schema.Types.Mixed],
      rewardRate: { type: Number, default: 0 }
    },
    orderBook: {
      buyOrders: [Schema.Types.Mixed],
      sellOrders: [Schema.Types.Mixed],
      lastTrade: Schema.Types.Mixed
    }
  },

  blockchain: {
    network: String,
    contractAddress: String,
    tokenStandard: String,
    deploymentCost: Number,
    gasOptimization: Boolean
  },

  revenueSharing: {
    enabled: { type: Boolean, default: false },
    distributionFrequency: String,
    nextDistribution: Date,
    totalRevenueDistributed: { type: Number, default: 0 },
    distributionHistory: [Schema.Types.Mixed],
    reservePercentage: Number,
    managementFee: Number,
    expectedAnnualReturn: Number
  },

  governance: {
    enabled: { type: Boolean, default: false },
    votingRights: String,
    quorum: Number,
    proposals: [Schema.Types.Mixed],
    votingHistory: [Schema.Types.Mixed]
  },

  compliance: {
    isCompliant: { type: Boolean, default: false },
    jurisdiction: String,
    regulations: [String],
    auditTrail: [{
      action: String,
      performedBy: String,
      timestamp: Date,
      details: String
    }],
    kycRequirement: Boolean,
    accreditedInvestorOnly: Boolean
  },

  valueMetrics: {
    currentValuation: { type: Number, default: 0 },
    occupancyRate: { type: Number, default: 0 },
    netOperatingIncome: { type: Number, default: 0 },
    capRate: { type: Number, default: 0 },
    appreciationRate: { type: Number, default: 0 },
    totalReturn: { type: Number, default: 0 },
    cashFlow: {
      monthly: { type: Number, default: 0 },
      quarterly: { type: Number, default: 0 },
      annual: { type: Number, default: 0 }
    }
  },

  status: {
    type: String,
    default: 'draft',
    enum: ['draft', 'pending_approval', 'active', 'paused', 'completed', 'tokenized', 'deployed']
  }
}, {
  timestamps: true
});

// Index pour les requêtes fréquentes
PropertyTokenSchema.index({ tokenId: 1 });
PropertyTokenSchema.index({ propertyId: 1 });
PropertyTokenSchema.index({ tokenSymbol: 1 });
PropertyTokenSchema.index({ blockchain: 1, status: 1 });
PropertyTokenSchema.index({ 'trading.isListed': 1 });
PropertyTokenSchema.index({ 'trading.isTradeEnabled': 1 });
PropertyTokenSchema.index({ 'ownership.ownershipDistribution.ownerId': 1 });

// Méthodes du modèle
PropertyTokenSchema.methods.calculateMarketCap = function() {
  return this.circulatingSupply * this.trading.currentPrice;
};

PropertyTokenSchema.methods.getOwnershipPercentage = function(userId: string) {
  const ownership = this.ownership.ownershipDistribution.find((o: any) => o.ownerId === userId);
  return ownership ? ownership.ownershipPercentage : 0;
};

PropertyTokenSchema.methods.canTrade = function() {
  return this.status === 'active' && this.trading.isListed && this.trading.isTradeEnabled;
};

export const PropertyToken = mongoose.model<IPropertyToken>('PropertyToken', PropertyTokenSchema);
