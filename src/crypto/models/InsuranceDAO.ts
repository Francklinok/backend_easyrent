import mongoose, { Schema, Document } from 'mongoose';

export interface IInsuranceClaim {
  claimId: string;
  claimType: 'defi_loss' | 'property_damage' | 'payment_default' | 'smart_contract_bug';
  amount: number;
  description: string;
  evidence: string[];
  status: 'pending' | 'investigating' | 'voting' | 'approved' | 'rejected' | 'paid';
  claimantId: mongoose.Types.ObjectId;
  propertyId?: mongoose.Types.ObjectId;
  createdAt: Date;
  resolvedAt?: Date;
  votes: Array<{
    voterId: mongoose.Types.ObjectId;
    vote: 'approve' | 'reject';
    votingPower: number;
    reason?: string;
    timestamp: Date;
  }>;
}

export interface IInsurancePool {
  poolType: 'defi_protection' | 'property_coverage' | 'general_fund';
  totalFunds: number;
  availableFunds: number;
  lockedFunds: number;
  contributors: Array<{
    userId: mongoose.Types.ObjectId;
    contribution: number;
    contributionDate: Date;
    votingPower: number;
    isActive: boolean;
  }>;
  coverageLimit: number;
  minimumStake: number;
  riskMultiplier: number;
}

export interface IInsuranceDAO extends Document {
  poolId: string;
  pools: IInsurancePool[];
  totalPoolValue: number;
  governance: {
    votingThreshold: number;
    votingPeriod: number; // en heures
    quorumRequired: number;
    proposals: Array<{
      proposalId: string;
      proposalType: 'coverage_adjustment' | 'pool_rebalancing' | 'fee_structure' | 'policy_update';
      title: string;
      description: string;
      parameters: Record<string, any>;
      votes: Array<{
        voterId: mongoose.Types.ObjectId;
        vote: 'for' | 'against' | 'abstain';
        votingPower: number;
        timestamp: Date;
      }>;
      status: 'active' | 'passed' | 'rejected' | 'executed';
      createdAt: Date;
      expiresAt: Date;
      executedAt?: Date;
    }>;
  };
  claims: IInsuranceClaim[];
  riskAssessment: {
    protocolRisks: Array<{
      protocol: string;
      riskLevel: number;
      coverageMultiplier: number;
      lastAssessment: Date;
    }>;
    propertyRisks: Array<{
      propertyId: mongoose.Types.ObjectId;
      riskLevel: number;
      premiumMultiplier: number;
      coverageAmount: number;
    }>;
  };
  feeStructure: {
    claimFee: number;
    administrationFee: number;
    reinsuranceFee: number;
    treasuryFee: number;
  };
  statistics: {
    totalClaims: number;
    approvedClaims: number;
    totalPaidOut: number;
    successRate: number;
    averageClaimAmount: number;
    averageProcessingTime: number;
  };
  isActive: boolean;

  // Methods
  addContributor(poolType: string, userId: mongoose.Types.ObjectId, amount: number): boolean;
  submitClaim(claimType: string, amount: number, description: string, claimantId: mongoose.Types.ObjectId, evidence: string[], propertyId?: mongoose.Types.ObjectId): string;
  voteOnClaim(claimId: string, voterId: mongoose.Types.ObjectId, vote: 'approve' | 'reject', reason?: string): boolean;
  calculateVotingPower(userId: mongoose.Types.ObjectId): number;
  checkVotingCompletion(claimId: string): void;
  progressClaimStatus(claimId: string, newStatus: 'investigating' | 'voting' | 'approved' | 'rejected' | 'paid'): boolean;
  processClaim(claimId: string): boolean;
  getPoolTypeForClaim(claimType: string): string;
  updateTotalPoolValue(): void;
  updateStatistics(): void;
  rebalancePools(): void;
}

const insuranceClaimSchema = new Schema<IInsuranceClaim>({
  claimId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  claimType: {
    type: String,
    enum: ['defi_loss', 'property_damage', 'payment_default', 'smart_contract_bug'],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true,
    minlength: 50
  },
  evidence: [{
    type: String,
    required: true
  }],
  status: {
    type: String,
    enum: ['pending', 'investigating', 'voting', 'approved', 'rejected', 'paid'],
    default: 'pending',
    index: true
  },
  claimantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  resolvedAt: {
    type: Date,
    index: true
  },
  votes: [{
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    vote: {
      type: String,
      enum: ['approve', 'reject'],
      required: true
    },
    votingPower: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, { _id: false });

const insurancePoolSchema = new Schema<IInsurancePool>({
  poolType: {
    type: String,
    enum: ['defi_protection', 'property_coverage', 'general_fund'],
    required: true
  },
  totalFunds: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  availableFunds: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  lockedFunds: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  contributors: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    contribution: {
      type: Number,
      required: true,
      min: 0
    },
    contributionDate: {
      type: Date,
      default: Date.now
    },
    votingPower: {
      type: Number,
      required: true,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  coverageLimit: {
    type: Number,
    required: true,
    min: 0
  },
  minimumStake: {
    type: Number,
    required: true,
    min: 0,
    default: 1000
  },
  riskMultiplier: {
    type: Number,
    required: true,
    min: 0.1,
    max: 5,
    default: 1
  }
}, { _id: false });

const insuranceDAOSchema = new Schema<IInsuranceDAO>({
  poolId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  pools: {
    type: [insurancePoolSchema],
    validate: {
      validator: (v: IInsurancePool[]) => v.length > 0,
      message: 'Au moins un pool d\'assurance doit être configuré'
    }
  },
  totalPoolValue: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
    index: true
  },
  governance: {
    votingThreshold: {
      type: Number,
      required: true,
      min: 51,
      max: 100,
      default: 66
    },
    votingPeriod: {
      type: Number,
      required: true,
      min: 24,
      max: 168,
      default: 72
    },
    quorumRequired: {
      type: Number,
      required: true,
      min: 10,
      max: 100,
      default: 30
    },
    proposals: [{
      proposalId: {
        type: String,
        required: true,
        unique: true
      },
      proposalType: {
        type: String,
        enum: ['coverage_adjustment', 'pool_rebalancing', 'fee_structure', 'policy_update'],
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
      parameters: {
        type: Map,
        of: Schema.Types.Mixed
      },
      votes: [{
        voterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        vote: {
          type: String,
          enum: ['for', 'against', 'abstain'],
          required: true
        },
        votingPower: {
          type: Number,
          required: true,
          min: 0
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }],
      status: {
        type: String,
        enum: ['active', 'passed', 'rejected', 'executed'],
        default: 'active'
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: {
        type: Date,
        required: true
      },
      executedAt: {
        type: Date
      }
    }]
  },
  claims: {
    type: [insuranceClaimSchema],
    default: []
  },
  riskAssessment: {
    protocolRisks: [{
      protocol: {
        type: String,
        required: true
      },
      riskLevel: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      },
      coverageMultiplier: {
        type: Number,
        required: true,
        min: 0.1,
        max: 5
      },
      lastAssessment: {
        type: Date,
        default: Date.now
      }
    }],
    propertyRisks: [{
      propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
      },
      riskLevel: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      },
      premiumMultiplier: {
        type: Number,
        required: true,
        min: 0.5,
        max: 3
      },
      coverageAmount: {
        type: Number,
        required: true,
        min: 0
      }
    }]
  },
  feeStructure: {
    claimFee: {
      type: Number,
      default: 2,
      min: 0,
      max: 10
    },
    administrationFee: {
      type: Number,
      default: 1,
      min: 0,
      max: 5
    },
    reinsuranceFee: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 3
    },
    treasuryFee: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 2
    }
  },
  statistics: {
    totalClaims: {
      type: Number,
      default: 0,
      min: 0
    },
    approvedClaims: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPaidOut: {
      type: Number,
      default: 0,
      min: 0
    },
    successRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    averageClaimAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    averageProcessingTime: {
      type: Number,
      default: 0,
      min: 0
    }
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
insuranceDAOSchema.index({ 'claims.claimantId': 1 });
insuranceDAOSchema.index({ 'claims.status': 1, 'claims.createdAt': -1 });
insuranceDAOSchema.index({ 'governance.proposals.status': 1 });

// Virtual pour calculer le taux de couverture
insuranceDAOSchema.virtual('coverageRatio').get(function(this: IInsuranceDAO) {
  const totalCoverage = this.pools.reduce((sum, pool) => sum + pool.coverageLimit, 0);
  return totalCoverage > 0 ? (this.totalPoolValue / totalCoverage) * 100 : 0;
});

// Méthodes
insuranceDAOSchema.methods.addContributor = function(
  poolType: string,
  userId: mongoose.Types.ObjectId,
  amount: number
): boolean {
  const pool = this.pools.find(p => p.poolType === poolType);
  if (!pool || amount < pool.minimumStake) {
    throw new Error('Pool non trouvé ou montant insuffisant');
  }

  const existingContributor = pool.contributors.find(c => c.userId.equals(userId));

  if (existingContributor) {
    existingContributor.contribution += amount;
    existingContributor.contributionDate = new Date();
  } else {
    pool.contributors.push({
      userId,
      contribution: amount,
      contributionDate: new Date(),
      votingPower: amount,
      isActive: true
    });
  }

  pool.totalFunds += amount;
  pool.availableFunds += amount;
  this.updateTotalPoolValue();

  return true;
};

insuranceDAOSchema.methods.submitClaim = function(
  claimType: string,
  amount: number,
  description: string,
  claimantId: mongoose.Types.ObjectId,
  evidence: string[],
  propertyId?: mongoose.Types.ObjectId
): string {
  const claimId = `CLAIM_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const claim: IInsuranceClaim = {
    claimId,
    claimType: claimType as any,
    amount,
    description,
    evidence,
    status: 'pending',
    claimantId,
    propertyId,
    createdAt: new Date(),
    votes: []
  };

  this.claims.push(claim);
  this.statistics.totalClaims += 1;

  // Auto-progression vers investigation
  setTimeout(() => {
    this.progressClaimStatus(claimId, 'investigating');
  }, 0);

  return claimId;
};

insuranceDAOSchema.methods.voteOnClaim = function(
  claimId: string,
  voterId: mongoose.Types.ObjectId,
  vote: 'approve' | 'reject',
  reason?: string
): boolean {
  const claim = this.claims.find(c => c.claimId === claimId);
  if (!claim || claim.status !== 'voting') {
    return false;
  }

  // Calculer le pouvoir de vote basé sur la contribution
  const votingPower = this.calculateVotingPower(voterId);
  if (votingPower === 0) {
    return false;
  }

  // Vérifier si déjà voté
  const existingVote = claim.votes.find(v => v.voterId.equals(voterId));
  if (existingVote) {
    existingVote.vote = vote;
    existingVote.reason = reason;
    existingVote.timestamp = new Date();
  } else {
    claim.votes.push({
      voterId,
      vote,
      votingPower,
      reason,
      timestamp: new Date()
    });
  }

  // Vérifier si le vote est terminé
  this.checkVotingCompletion(claimId);

  return true;
};

insuranceDAOSchema.methods.calculateVotingPower = function(userId: mongoose.Types.ObjectId): number {
  let totalPower = 0;

  this.pools.forEach(pool => {
    const contributor = pool.contributors.find(c => c.userId.equals(userId) && c.isActive);
    if (contributor) {
      totalPower += contributor.votingPower;
    }
  });

  return totalPower;
};

insuranceDAOSchema.methods.checkVotingCompletion = function(claimId: string): void {
  const claim = this.claims.find(c => c.claimId === claimId);
  if (!claim || claim.status !== 'voting') return;

  const totalVotingPower = this.pools.reduce((total, pool) =>
    total + pool.contributors.reduce((sum, c) => c.isActive ? sum + c.votingPower : sum, 0), 0);

  const votedPower = claim.votes.reduce((sum, vote) => sum + vote.votingPower, 0);
  const approvalPower = claim.votes
    .filter(vote => vote.vote === 'approve')
    .reduce((sum, vote) => sum + vote.votingPower, 0);

  const quorum = (votedPower / totalVotingPower) * 100;
  const approvalPercentage = votedPower > 0 ? (approvalPower / votedPower) * 100 : 0;

  // Vérifier si le quorum et le seuil sont atteints
  if (quorum >= this.governance.quorumRequired) {
    if (approvalPercentage >= this.governance.votingThreshold) {
      this.progressClaimStatus(claimId, 'approved');
    } else {
      this.progressClaimStatus(claimId, 'rejected');
    }
  }
};

insuranceDAOSchema.methods.progressClaimStatus = function(
  claimId: string,
  newStatus: 'investigating' | 'voting' | 'approved' | 'rejected' | 'paid'
): boolean {
  const claim = this.claims.find(c => c.claimId === claimId);
  if (!claim) return false;

  claim.status = newStatus;

  if (newStatus === 'approved') {
    this.processClaim(claimId);
  } else if (newStatus === 'rejected' || newStatus === 'paid') {
    claim.resolvedAt = new Date();
    this.updateStatistics();
  }

  return true;
};

insuranceDAOSchema.methods.processClaim = function(claimId: string): boolean {
  const claim = this.claims.find(c => c.claimId === claimId);
  if (!claim || claim.status !== 'approved') return false;

  // Déterminer le pool approprié
  const poolType = this.getPoolTypeForClaim(claim.claimType);
  const pool = this.pools.find(p => p.poolType === poolType);

  if (!pool || pool.availableFunds < claim.amount) {
    throw new Error('Fonds insuffisants dans le pool');
  }

  // Déduire les fonds
  pool.availableFunds -= claim.amount;
  pool.lockedFunds += claim.amount;

  // Calculer les frais
  const fees = claim.amount * (this.feeStructure.claimFee / 100);
  const netPayout = claim.amount - fees;

  // Ici, vous intégreriez avec le wallet service pour effectuer le paiement
  // await walletService.processPayment(claim.claimantId, netPayout);

  claim.status = 'paid';
  claim.resolvedAt = new Date();

  this.statistics.approvedClaims += 1;
  this.statistics.totalPaidOut += netPayout;
  this.updateTotalPoolValue();
  this.updateStatistics();

  return true;
};

insuranceDAOSchema.methods.getPoolTypeForClaim = function(claimType: string): string {
  const mapping = {
    'defi_loss': 'defi_protection',
    'smart_contract_bug': 'defi_protection',
    'property_damage': 'property_coverage',
    'payment_default': 'general_fund'
  };

  return mapping[claimType as keyof typeof mapping] || 'general_fund';
};

insuranceDAOSchema.methods.updateTotalPoolValue = function(): void {
  this.totalPoolValue = this.pools.reduce((total, pool) => total + pool.totalFunds, 0);
};

insuranceDAOSchema.methods.updateStatistics = function(): void {
  const resolvedClaims = this.claims.filter(c => c.resolvedAt);
  const approvedClaims = this.claims.filter(c => c.status === 'approved' || c.status === 'paid');

  this.statistics.approvedClaims = approvedClaims.length;
  this.statistics.successRate = this.statistics.totalClaims > 0
    ? (this.statistics.approvedClaims / this.statistics.totalClaims) * 100
    : 0;

  if (approvedClaims.length > 0) {
    this.statistics.averageClaimAmount = this.statistics.totalPaidOut / approvedClaims.length;
  }

  if (resolvedClaims.length > 0) {
    const totalProcessingTime = resolvedClaims.reduce((sum, claim) => {
      if (claim.resolvedAt) {
        return sum + (claim.resolvedAt.getTime() - claim.createdAt.getTime());
      }
      return sum;
    }, 0);

    this.statistics.averageProcessingTime = totalProcessingTime / resolvedClaims.length / (1000 * 60 * 60 * 24); // en jours
  }
};

insuranceDAOSchema.methods.rebalancePools = function(): void {
  const totalFunds = this.totalPoolValue;
  const targetAllocations = {
    defi_protection: 0.50,
    property_coverage: 0.35,
    general_fund: 0.15
  };

  this.pools.forEach(pool => {
    const targetAmount = totalFunds * targetAllocations[pool.poolType as keyof typeof targetAllocations];
    const currentAmount = pool.totalFunds;
    const difference = targetAmount - currentAmount;

    if (Math.abs(difference) > totalFunds * 0.05) { // 5% de tolérance
      // Ici, vous implémenteriez la logique de rééquilibrage
      console.log(`Pool ${pool.poolType} needs rebalancing: ${difference}`);
    }
  });
};

export const InsuranceDAO = mongoose.model<IInsuranceDAO>('InsuranceDAO', insuranceDAOSchema);