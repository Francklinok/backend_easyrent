import mongoose, { Schema, Document } from 'mongoose';

export interface IUtilityToken extends Document {
  tokenId: string;
  name: string;
  symbol: string;

  // Blockchain details
  contractAddress: string;
  blockchain: 'ethereum' | 'polygon' | 'bsc';
  decimals: number;
  totalSupply: number;
  circulatingSupply: number;

  // Tokenomics
  tokenomics: {
    initialPrice: number; // Prix initial en USD
    currentPrice: number;
    priceHistory: {
      date: Date;
      price: number;
      volume: number;
    }[];

    // Distribution
    distribution: {
      ecosystem: number; // Pourcentage pour l'écosystème
      team: number;      // Pourcentage pour l'équipe
      investors: number; // Pourcentage pour les investisseurs
      platform: number;  // Pourcentage pour la plateforme
      users: number;     // Pourcentage pour les utilisateurs
    };

    // Vesting schedules
    vestingSchedules: {
      category: 'team' | 'investors' | 'ecosystem';
      totalTokens: number;
      releasedTokens: number;
      vestingPeriod: number; // En mois
      cliffPeriod: number;   // En mois
      nextRelease: Date;
      releaseAmount: number;
    }[];
  };

  // Utility functions
  utilities: {
    // Réductions sur les frais
    feeDiscounts: {
      enabled: boolean;
      tiers: {
        minTokens: number;
        discountPercentage: number;
        description: string;
      }[];
    };

    // Accès prioritaire
    priorityAccess: {
      enabled: boolean;
      minTokensRequired: number;
      benefits: string[];
    };

    // Staking rewards
    staking: {
      enabled: boolean;
      apy: number; // Annual Percentage Yield
      minStakeAmount: number;
      lockupPeriods: {
        duration: number; // En jours
        multiplier: number; // Multiplicateur de rewards
      }[];
    };

    // Governance
    governance: {
      enabled: boolean;
      minTokensForProposal: number;
      votingPower: 'linear' | 'quadratic' | 'weighted';
      proposalDuration: number; // En jours
      quorum: number; // Pourcentage de participation minimum
      proposals?: {
        proposalId: string;
        title: string;
        description: string;
        proposalType: 'parameter_change' | 'feature_request' | 'treasury_allocation' | 'partnership';
        proposer: string;
        createdAt: Date;
        votingStart: Date;
        votingEnd: Date;
        status: 'active' | 'passed' | 'rejected' | 'executed';
        votes: {
          for: number;
          against: number;
          abstain: number;
        };
        voters: {
          userId: string;
          vote: 'for' | 'against' | 'abstain';
          votingPower: number;
          timestamp: Date;
        }[];
        quorumReached: boolean;
        executed: boolean;
      }[];
    };

    // Cashback/Rewards
    cashback: {
      enabled: boolean;
      rate: number; // Pourcentage de cashback
      maxCashbackPerTransaction: number;
      applicableServices: string[];
    };
  };

  // User balances and transactions
  userBalances: {
    userId: string;
    balance: number;
    stakedBalance: number;
    lockedBalance: number;
    lastUpdate: Date;

    // Staking info
    stakingInfo?: {
      amount: number;
      startDate: Date;
      lockupPeriod: number;
      rewardsAccrued: number;
      rewardsClaimed: number;
      lastClaimDate: Date;
    }[];
  }[];

  // Token transactions
  transactions: {
    transactionId: string;
    type: 'mint' | 'burn' | 'transfer' | 'stake' | 'unstake' | 'reward' | 'purchase' | 'redemption';
    from: string;
    to: string;
    amount: number;
    fee?: number;
    reason: string;
    metadata?: any;
    transactionHash: string;
    blockNumber: number;
    timestamp: Date;
  }[];

  // Platform integration
  platform: {
    // Services qui acceptent le token
    acceptedServices: {
      serviceType: 'rental' | 'purchase' | 'marketplace' | 'premium_features';
      discountRate: number;
      acceptanceRate: number; // Pourcentage du paiement accepté en tokens
    }[];

    // Métriques d'utilisation
    usage: {
      totalTransactions: number;
      totalVolume: number;
      activeUsers: number;
      averageHoldingTime: number; // En jours
      utilityUsage: {
        staking: number;
        feePayments: number;
        governance: number;
        cashback: number;
      };
    };
  };

  // Economic model
  economics: {
    // Mécanismes de burn
    burnMechanisms: {
      transactionBurn: {
        enabled: boolean;
        burnRate: number; // Pourcentage brûlé par transaction
      };
      periodicBurn: {
        enabled: boolean;
        frequency: 'weekly' | 'monthly' | 'quarterly';
        burnAmount: number;
        nextBurn: Date;
      };
    };

    // Sources de revenus
    revenueStreams: {
      platformFees: number;
      premiumSubscriptions: number;
      transactionFees: number;
      stakingFees: number;
    };

    // Token buybacks
    buyback: {
      enabled: boolean;
      frequency: 'weekly' | 'monthly' | 'quarterly';
      percentage: number; // Pourcentage des revenus alloué au buyback
      lastBuyback: Date;
      nextBuyback: Date;
      totalBoughtBack: number;
    };
  };

  // Liquidity and trading
  liquidity: {
    dexListings: {
      exchange: string;
      pair: string;
      liquidity: number;
      volume24h: number;
      apr: number;
    }[];

    liquidityMining: {
      enabled: boolean;
      pools: {
        pair: string;
        rewardRate: number;
        totalLiquidity: number;
        participants: number;
      }[];
    };
  };

  status: 'development' | 'testnet' | 'mainnet' | 'paused';
  launchDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UtilityTokenSchema = new Schema<IUtilityToken>({
  tokenId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true, unique: true },

  contractAddress: { type: String, unique: true, sparse: true },
  blockchain: { type: String, required: true, enum: ['ethereum', 'polygon', 'bsc'] },
  decimals: { type: Number, required: true, default: 18 },
  totalSupply: { type: Number, required: true },
  circulatingSupply: { type: Number, default: 0 },

  tokenomics: {
    initialPrice: { type: Number, required: true, min: 0 },
    currentPrice: { type: Number, required: true, min: 0 },
    priceHistory: [{
      date: { type: Date, required: true },
      price: { type: Number, required: true, min: 0 },
      volume: { type: Number, default: 0, min: 0 }
    }],

    distribution: {
      ecosystem: { type: Number, required: true, min: 0, max: 100 },
      team: { type: Number, required: true, min: 0, max: 100 },
      investors: { type: Number, required: true, min: 0, max: 100 },
      platform: { type: Number, required: true, min: 0, max: 100 },
      users: { type: Number, required: true, min: 0, max: 100 }
    },

    vestingSchedules: [{
      category: { type: String, enum: ['team', 'investors', 'ecosystem'], required: true },
      totalTokens: { type: Number, required: true, min: 0 },
      releasedTokens: { type: Number, default: 0, min: 0 },
      vestingPeriod: { type: Number, required: true, min: 1 },
      cliffPeriod: { type: Number, default: 0, min: 0 },
      nextRelease: { type: Date },
      releaseAmount: { type: Number, min: 0 }
    }]
  },

  utilities: {
    feeDiscounts: {
      enabled: { type: Boolean, default: true },
      tiers: [{
        minTokens: { type: Number, required: true, min: 0 },
        discountPercentage: { type: Number, required: true, min: 0, max: 100 },
        description: { type: String, required: true }
      }]
    },

    priorityAccess: {
      enabled: { type: Boolean, default: false },
      minTokensRequired: { type: Number, min: 0 },
      benefits: [{ type: String }]
    },

    staking: {
      enabled: { type: Boolean, default: true },
      apy: { type: Number, min: 0, max: 1000 },
      minStakeAmount: { type: Number, min: 0 },
      lockupPeriods: [{
        duration: { type: Number, required: true, min: 1 },
        multiplier: { type: Number, required: true, min: 1 }
      }]
    },

    governance: {
      enabled: { type: Boolean, default: false },
      minTokensForProposal: { type: Number, min: 0 },
      votingPower: { type: String, enum: ['linear', 'quadratic', 'weighted'], default: 'linear' },
      proposalDuration: { type: Number, default: 7, min: 1 },
      quorum: { type: Number, default: 30, min: 1, max: 100 },
      proposals: [{
        proposalId: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        proposalType: {
          type: String,
          enum: ['parameter_change', 'feature_request', 'treasury_allocation', 'partnership'],
          required: true
        },
        proposer: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        votingStart: { type: Date, required: true },
        votingEnd: { type: Date, required: true },
        status: {
          type: String,
          enum: ['active', 'passed', 'rejected', 'executed'],
          default: 'active'
        },
        votes: {
          for: { type: Number, default: 0, min: 0 },
          against: { type: Number, default: 0, min: 0 },
          abstain: { type: Number, default: 0, min: 0 }
        },
        voters: [{
          userId: { type: String, required: true },
          vote: { type: String, enum: ['for', 'against', 'abstain'], required: true },
          votingPower: { type: Number, required: true, min: 0 },
          timestamp: { type: Date, default: Date.now }
        }],
        quorumReached: { type: Boolean, default: false },
        executed: { type: Boolean, default: false }
      }]
    },

    cashback: {
      enabled: { type: Boolean, default: true },
      rate: { type: Number, min: 0, max: 100 },
      maxCashbackPerTransaction: { type: Number, min: 0 },
      applicableServices: [{ type: String }]
    }
  },

  userBalances: [{
    userId: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
    stakedBalance: { type: Number, default: 0, min: 0 },
    lockedBalance: { type: Number, default: 0, min: 0 },
    lastUpdate: { type: Date, default: Date.now },

    stakingInfo: [{
      amount: { type: Number, required: true, min: 0 },
      startDate: { type: Date, required: true },
      lockupPeriod: { type: Number, required: true, min: 0 },
      rewardsAccrued: { type: Number, default: 0, min: 0 },
      rewardsClaimed: { type: Number, default: 0, min: 0 },
      lastClaimDate: { type: Date }
    }]
  }],

  transactions: [{
    transactionId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['mint', 'burn', 'transfer', 'stake', 'unstake', 'reward', 'purchase', 'redemption']
    },
    from: { type: String, required: true },
    to: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    fee: { type: Number, min: 0 },
    reason: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    transactionHash: { type: String, required: true },
    blockNumber: { type: Number, required: true },
    timestamp: { type: Date, required: true }
  }],

  platform: {
    acceptedServices: [{
      serviceType: { type: String, enum: ['rental', 'purchase', 'marketplace', 'premium_features'] },
      discountRate: { type: Number, min: 0, max: 100 },
      acceptanceRate: { type: Number, min: 0, max: 100 }
    }],

    usage: {
      totalTransactions: { type: Number, default: 0, min: 0 },
      totalVolume: { type: Number, default: 0, min: 0 },
      activeUsers: { type: Number, default: 0, min: 0 },
      averageHoldingTime: { type: Number, default: 0, min: 0 },
      utilityUsage: {
        staking: { type: Number, default: 0, min: 0 },
        feePayments: { type: Number, default: 0, min: 0 },
        governance: { type: Number, default: 0, min: 0 },
        cashback: { type: Number, default: 0, min: 0 }
      }
    }
  },

  economics: {
    burnMechanisms: {
      transactionBurn: {
        enabled: { type: Boolean, default: false },
        burnRate: { type: Number, min: 0, max: 100 }
      },
      periodicBurn: {
        enabled: { type: Boolean, default: false },
        frequency: { type: String, enum: ['weekly', 'monthly', 'quarterly'] },
        burnAmount: { type: Number, min: 0 },
        nextBurn: { type: Date }
      }
    },

    revenueStreams: {
      platformFees: { type: Number, default: 0, min: 0 },
      premiumSubscriptions: { type: Number, default: 0, min: 0 },
      transactionFees: { type: Number, default: 0, min: 0 },
      stakingFees: { type: Number, default: 0, min: 0 }
    },

    buyback: {
      enabled: { type: Boolean, default: false },
      frequency: { type: String, enum: ['weekly', 'monthly', 'quarterly'] },
      percentage: { type: Number, min: 0, max: 100 },
      lastBuyback: { type: Date },
      nextBuyback: { type: Date },
      totalBoughtBack: { type: Number, default: 0, min: 0 }
    }
  },

  liquidity: {
    dexListings: [{
      exchange: { type: String, required: true },
      pair: { type: String, required: true },
      liquidity: { type: Number, min: 0 },
      volume24h: { type: Number, min: 0 },
      apr: { type: Number, min: 0 }
    }],

    liquidityMining: {
      enabled: { type: Boolean, default: false },
      pools: [{
        pair: { type: String, required: true },
        rewardRate: { type: Number, min: 0 },
        totalLiquidity: { type: Number, min: 0 },
        participants: { type: Number, default: 0, min: 0 }
      }]
    }
  },

  status: {
    type: String,
    default: 'development',
    enum: ['development', 'testnet', 'mainnet', 'paused']
  },
  launchDate: { type: Date }
}, {
  timestamps: true
});

// Index pour les requêtes fréquentes
UtilityTokenSchema.index({ symbol: 1 });
UtilityTokenSchema.index({ contractAddress: 1 });
UtilityTokenSchema.index({ 'userBalances.userId': 1 });
UtilityTokenSchema.index({ blockchain: 1, status: 1 });

export const UtilityToken = mongoose.model<IUtilityToken>('UtilityToken', UtilityTokenSchema);