import mongoose, { Schema, Document } from 'mongoose';

export interface IFractionalShare {
  tokenId: string;
  sharePercentage: number;
  purchasePrice: number;
  currentValue: number;
  purchaseDate: Date;
  isTransferrable: boolean;
  votingRights: boolean;
}

export interface IRevenueDistribution {
  month: number;
  year: number;
  totalRevenue: number;
  distributionPerShare: number;
  distributed: boolean;
  distributionDate?: Date;
}

export interface IFractionalOwnership extends Document {
  propertyId: mongoose.Types.ObjectId;
  totalShares: number;
  sharePrice: number;
  availableShares: number;
  totalValue: number;
  shareholders: Array<{
    userId: mongoose.Types.ObjectId;
    shares: IFractionalShare[];
    totalOwnership: number;
    isActive: boolean;
    joinDate: Date;
  }>;
  daoGovernance: {
    isEnabled: boolean;
    votingThreshold: number;
    proposalCount: number;
    activeProposals: Array<{
      proposalId: string;
      title: string;
      description: string;
      votes: Array<{
        userId: mongoose.Types.ObjectId;
        vote: 'for' | 'against' | 'abstain';
        votingPower: number;
      }>;
      status: 'active' | 'passed' | 'rejected';
      createdAt: Date;
      expiresAt: Date;
    }>;
  };
  revenueSharing: {
    enabled: boolean;
    distributionSchedule: 'monthly' | 'quarterly' | 'annual';
    lastDistribution: Date;
    totalDistributed: number;
    distributions: IRevenueDistribution[];
  };
  transitionPath: {
    enabled: boolean;
    tenantUserId?: mongoose.Types.ObjectId;
    accumulatedShares: number;
    monthlyAccumulation: number;
    targetOwnership: number;
  };
  liquidityPool: {
    available: boolean;
    poolSize: number;
    tradingEnabled: boolean;
    lastTradePrice: number;
    priceHistory: Array<{
      date: Date;
      price: number;
      volume: number;
    }>;
  };
  isActive: boolean;

  // Methods
  purchaseShares(userId: mongoose.Types.ObjectId, sharesToBuy: number): Promise<boolean>;
  enableTenantTransition(tenantUserId: mongoose.Types.ObjectId, monthlyAccumulation?: number): void;
  processMonthlyTransition(): any;
  distributeRevenue(totalRevenue: number, month: number, year: number): boolean;
}

const fractionalShareSchema = new Schema<IFractionalShare>({
  tokenId: {
    type: String,
    required: true,
    unique: true
  },
  sharePercentage: {
    type: Number,
    required: true,
    min: 0.01,
    max: 100
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  currentValue: {
    type: Number,
    required: true,
    min: 0
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  isTransferrable: {
    type: Boolean,
    default: true
  },
  votingRights: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const fractionalOwnershipSchema = new Schema<IFractionalOwnership>({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    unique: true,
    index: true
  },
  totalShares: {
    type: Number,
    required: true,
    min: 100,
    default: 1000
  },
  sharePrice: {
    type: Number,
    required: true,
    min: 0
  },
  availableShares: {
    type: Number,
    required: true,
    min: 0
  },
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  shareholders: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    shares: [fractionalShareSchema],
    totalOwnership: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    isActive: {
      type: Boolean,
      default: true
    },
    joinDate: {
      type: Date,
      default: Date.now
    }
  }],
  daoGovernance: {
    isEnabled: {
      type: Boolean,
      default: true
    },
    votingThreshold: {
      type: Number,
      default: 51,
      min: 1,
      max: 100
    },
    proposalCount: {
      type: Number,
      default: 0
    },
    activeProposals: [{
      proposalId: {
        type: String,
        required: true
      },
      title: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      votes: [{
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        vote: {
          type: String,
          enum: ['for', 'against', 'abstain']
        },
        votingPower: {
          type: Number,
          min: 0
        }
      }],
      status: {
        type: String,
        enum: ['active', 'passed', 'rejected'],
        default: 'active'
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: {
        type: Date,
        required: true
      }
    }]
  },
  revenueSharing: {
    enabled: {
      type: Boolean,
      default: true
    },
    distributionSchedule: {
      type: String,
      enum: ['monthly', 'quarterly', 'annual'],
      default: 'monthly'
    },
    lastDistribution: {
      type: Date
    },
    totalDistributed: {
      type: Number,
      default: 0
    },
    distributions: [{
      month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
      },
      year: {
        type: Number,
        required: true
      },
      totalRevenue: {
        type: Number,
        required: true,
        min: 0
      },
      distributionPerShare: {
        type: Number,
        required: true,
        min: 0
      },
      distributed: {
        type: Boolean,
        default: false
      },
      distributionDate: {
        type: Date
      }
    }]
  },
  transitionPath: {
    enabled: {
      type: Boolean,
      default: false
    },
    tenantUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    accumulatedShares: {
      type: Number,
      default: 0,
      min: 0
    },
    monthlyAccumulation: {
      type: Number,
      default: 1,
      min: 0.1,
      max: 10
    },
    targetOwnership: {
      type: Number,
      default: 51,
      min: 1,
      max: 100
    }
  },
  liquidityPool: {
    available: {
      type: Boolean,
      default: false
    },
    poolSize: {
      type: Number,
      default: 0,
      min: 0
    },
    tradingEnabled: {
      type: Boolean,
      default: true
    },
    lastTradePrice: {
      type: Number,
      default: 0,
      min: 0
    },
    priceHistory: [{
      date: {
        type: Date,
        required: true
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      volume: {
        type: Number,
        required: true,
        min: 0
      }
    }]
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Indexes
fractionalOwnershipSchema.index({ 'shareholders.userId': 1 });
fractionalOwnershipSchema.index({ sharePrice: 1 });
fractionalOwnershipSchema.index({ availableShares: 1 });
fractionalOwnershipSchema.index({ 'transitionPath.tenantUserId': 1 });

// Virtual pour calculer la valeur totale possédée par un utilisateur
fractionalOwnershipSchema.virtual('totalShareholderValue').get(function(this: IFractionalOwnership) {
  return this.shareholders.reduce((total, shareholder) => {
    const shareholderValue = shareholder.shares.reduce((sum, share: any) => sum + share.currentValue, 0);
    return total + shareholderValue;
  }, 0);
});

// Méthodes
fractionalOwnershipSchema.methods.purchaseShares = function(
  userId: mongoose.Types.ObjectId,
  sharesToBuy: number
): Promise<boolean> {
  if (this.availableShares < sharesToBuy) {
    throw new Error('Nombre de parts insuffisant');
  }

  const totalCost = sharesToBuy * this.sharePrice;
  const sharePercentage = (sharesToBuy / this.totalShares) * 100;

  // Trouver ou créer l'actionnaire
  let shareholder = this.shareholders.find(s => s.userId.equals(userId));

  if (!shareholder) {
    shareholder = {
      userId,
      shares: [],
      totalOwnership: 0,
      isActive: true,
      joinDate: new Date()
    };
    this.shareholders.push(shareholder);
  }

  // Créer la nouvelle part
  const newShare: IFractionalShare = {
    tokenId: `${this.propertyId}_${Date.now()}`,
    sharePercentage,
    purchasePrice: totalCost,
    currentValue: totalCost,
    purchaseDate: new Date(),
    isTransferrable: true,
    votingRights: true
  };

  shareholder.shares.push(newShare);
  shareholder.totalOwnership += sharePercentage;
  this.availableShares -= sharesToBuy;

  return Promise.resolve(true);
};

fractionalOwnershipSchema.methods.enableTenantTransition = function(
  tenantUserId: mongoose.Types.ObjectId,
  monthlyAccumulation: number = 1
) {
  this.transitionPath.enabled = true;
  this.transitionPath.tenantUserId = tenantUserId;
  this.transitionPath.monthlyAccumulation = monthlyAccumulation;
  this.transitionPath.accumulatedShares = 0;
};

fractionalOwnershipSchema.methods.processMonthlyTransition = function() {
  if (!this.transitionPath.enabled || !this.transitionPath.tenantUserId) {
    return false;
  }

  const newShares = this.transitionPath.monthlyAccumulation;

  if (this.availableShares >= newShares) {
    // Ajouter les parts au locataire
    this.purchaseShares(this.transitionPath.tenantUserId, newShares);
    this.transitionPath.accumulatedShares += newShares;

    // Vérifier si l'objectif est atteint
    const currentOwnership = (this.transitionPath.accumulatedShares / this.totalShares) * 100;
    if (currentOwnership >= this.transitionPath.targetOwnership) {
      this.transitionPath.enabled = false;
      return { completed: true, finalOwnership: currentOwnership };
    }

    return { completed: false, currentOwnership, accumulatedShares: this.transitionPath.accumulatedShares };
  }

  return false;
};

fractionalOwnershipSchema.methods.distributeRevenue = function(
  totalRevenue: number,
  month: number,
  year: number
) {
  if (!this.revenueSharing.enabled) {
    return false;
  }

  const distributionPerShare = totalRevenue / (this.totalShares - this.availableShares);

  // Créer la distribution
  const distribution: IRevenueDistribution = {
    month,
    year,
    totalRevenue,
    distributionPerShare,
    distributed: false
  };

  this.revenueSharing.distributions.push(distribution);

  // Process la distribution pour chaque actionnaire
  this.shareholders.forEach(shareholder => {
    if (shareholder.isActive) {
      const shareholderRevenue = shareholder.shares.reduce((total, share: any) => {
        return total + (distributionPerShare * (share.sharePercentage / 100) * this.totalShares);
      }, 0);

      // Ici, vous pourriez déclencher un paiement via le wallet service
      // walletService.processPayment(shareholder.userId, shareholderRevenue);
    }
  });

  distribution.distributed = true;
  distribution.distributionDate = new Date();
  this.revenueSharing.lastDistribution = new Date();
  this.revenueSharing.totalDistributed += totalRevenue;

  return true;
};

export const FractionalOwnership = mongoose.model<IFractionalOwnership>('FractionalOwnership', fractionalOwnershipSchema);