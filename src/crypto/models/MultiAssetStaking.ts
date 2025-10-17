import mongoose, { Schema, Document } from 'mongoose';

export interface IStakingAsset {
  assetType: 'ETH' | 'DeFi' | 'RWA';
  protocol: string;
  amount: number;
  expectedYield: number;
  currentYield: number;
  riskLevel: 'low' | 'medium' | 'high';
  insuranceCovered: boolean;
  lastRebalance: Date;
}

export interface IMultiAssetStaking extends Document {
  propertyId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  totalStakedAmount: number;
  assets: IStakingAsset[];
  rebalanceThreshold: number;
  autoRebalanceEnabled: boolean;
  insuranceProvider: string;
  insuranceCoverage: number;
  totalYield: number;
  monthlyYield: number;
  riskScore: number;
  lastRebalanceDate: Date;
  performanceHistory: Array<{
    date: Date;
    totalYield: number;
    assetPerformance: Array<{
      assetType: string;
      yield: number;
      allocation: number;
    }>;
  }>;
  isActive: boolean;

  // Methods
  calculateTotalYield(): number;
  calculateRiskScore(): number;
  needsRebalancing(): boolean;
  getOptimalAllocation(): { ETH: number; DeFi: number; RWA: number };
}

const stakingAssetSchema = new Schema<IStakingAsset>({
  assetType: {
    type: String,
    enum: ['ETH', 'DeFi', 'RWA'],
    required: true
  },
  protocol: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  expectedYield: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  currentYield: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true
  },
  insuranceCovered: {
    type: Boolean,
    default: false
  },
  lastRebalance: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const multiAssetStakingSchema = new Schema<IMultiAssetStaking>({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  totalStakedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  assets: {
    type: [stakingAssetSchema],
    validate: {
      validator: (v: IStakingAsset[]) => v.length > 0,
      message: 'Au moins un asset doit être configuré'
    }
  },
  rebalanceThreshold: {
    type: Number,
    default: 5,
    min: 1,
    max: 20
  },
  autoRebalanceEnabled: {
    type: Boolean,
    default: true
  },
  insuranceProvider: {
    type: String,
    default: 'Nexus Mutual'
  },
  insuranceCoverage: {
    type: Number,
    default: 20,
    min: 0,
    max: 100
  },
  totalYield: {
    type: Number,
    default: 0,
    min: 0
  },
  monthlyYield: {
    type: Number,
    default: 0,
    min: 0
  },
  riskScore: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  lastRebalanceDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  performanceHistory: [{
    date: {
      type: Date,
      required: true
    },
    totalYield: {
      type: Number,
      required: true
    },
    assetPerformance: [{
      assetType: String,
      yield: Number,
      allocation: Number
    }]
  }],
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
multiAssetStakingSchema.index({ propertyId: 1, ownerId: 1 });
multiAssetStakingSchema.index({ totalYield: -1 });
multiAssetStakingSchema.index({ riskScore: 1 });

// Virtual pour calculer la diversification
multiAssetStakingSchema.virtual('diversificationScore').get(function(this: IMultiAssetStaking) {
  const assetTypes = new Set(this.assets.map(asset => asset.assetType));
  return (assetTypes.size / 3) * 100; // 3 types maximum (ETH, DeFi, RWA)
});

// Méthodes
multiAssetStakingSchema.methods.calculateTotalYield = function() {
  let totalYield = 0;
  let totalAmount = 0;

  this.assets.forEach((asset: IStakingAsset) => {
    totalYield += (asset.amount * asset.currentYield / 100);
    totalAmount += asset.amount;
  });

  this.totalYield = totalAmount > 0 ? (totalYield / totalAmount) * 100 : 0;
  this.monthlyYield = this.totalYield / 12;
  return this.totalYield;
};

multiAssetStakingSchema.methods.calculateRiskScore = function() {
  let weightedRisk = 0;
  let totalAmount = 0;

  const riskValues = { low: 25, medium: 50, high: 75 };

  this.assets.forEach((asset: IStakingAsset) => {
    weightedRisk += asset.amount * riskValues[asset.riskLevel];
    totalAmount += asset.amount;
  });

  this.riskScore = totalAmount > 0 ? weightedRisk / totalAmount : 50;
  return this.riskScore;
};

multiAssetStakingSchema.methods.needsRebalancing = function(): boolean {
  const targetAllocations = {
    ETH: 50, // 50% ETH staking (sécurisé)
    DeFi: 35, // 35% DeFi protocols (rendement moyen)
    RWA: 15  // 15% Real World Assets (diversification)
  };

  return this.assets.some((asset: IStakingAsset) => {
    const currentAllocation = (asset.amount / this.totalStakedAmount) * 100;
    const targetAllocation = targetAllocations[asset.assetType];
    return Math.abs(currentAllocation - targetAllocation) > this.rebalanceThreshold;
  });
};

multiAssetStakingSchema.methods.getOptimalAllocation = function() {
  return {
    ETH: this.totalStakedAmount * 0.50,
    DeFi: this.totalStakedAmount * 0.35,
    RWA: this.totalStakedAmount * 0.15
  };
};

export const MultiAssetStaking = mongoose.model<IMultiAssetStaking>('MultiAssetStaking', multiAssetStakingSchema);