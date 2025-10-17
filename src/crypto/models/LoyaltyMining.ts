import mongoose, { Schema, Document } from 'mongoose';

export interface ILoyaltyAction {
  actionType: 'payment_ontime' | 'contract_renewal' | 'referral' | 'review' | 'maintenance_report';
  points: number;
  multiplier: number;
  date: Date;
  verified: boolean;
  referenceId?: string;
}

export interface IReferralBonus {
  referredUserId: mongoose.Types.ObjectId;
  referralCode: string;
  bonusAmount: number;
  conversionDate: Date;
  isActive: boolean;
}

export interface ILoyaltyMining extends Document {
  userId: mongoose.Types.ObjectId;
  propertyId?: mongoose.Types.ObjectId;
  totalPoints: number;
  currentTier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  tierMultiplier: number;
  contractStartDate: Date;
  contractDuration: number; // en mois
  loyaltyActions: ILoyaltyAction[];
  referrals: IReferralBonus[];
  referralCode: string;
  tokens: {
    total: number;
    available: number;
    locked: number;
    vestingSchedule: Array<{
      amount: number;
      releaseDate: Date;
      released: boolean;
    }>;
  };
  achievements: Array<{
    achievementId: string;
    name: string;
    description: string;
    pointsReward: number;
    unlockedDate: Date;
  }>;
  monthlyBonus: {
    consecutiveMonths: number;
    lastPaymentDate: Date;
    bonusMultiplier: number;
  };
  isActive: boolean;

  // Methods
  generateReferralCode(): string;
  updateTier(): void;
  addLoyaltyAction(actionType: ILoyaltyAction['actionType'], basePoints: number, referenceId?: string): number;
  awardTokens(amount: number, vestingMonths?: number): void;
  processReferral(referredUserId: mongoose.Types.ObjectId): number;
  updateConsecutivePayments(paymentDate: Date): void;
  unlockAchievement(achievementId: string): boolean;
  releaseVestedTokens(): number;
}

const loyaltyActionSchema = new Schema<ILoyaltyAction>({
  actionType: {
    type: String,
    enum: ['payment_ontime', 'contract_renewal', 'referral', 'review', 'maintenance_report'],
    required: true
  },
  points: {
    type: Number,
    required: true,
    min: 0
  },
  multiplier: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  date: {
    type: Date,
    default: Date.now
  },
  verified: {
    type: Boolean,
    default: false
  },
  referenceId: {
    type: String
  }
}, { _id: false });

const referralBonusSchema = new Schema<IReferralBonus>({
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referralCode: {
    type: String,
    required: true
  },
  bonusAmount: {
    type: Number,
    required: true,
    min: 0
  },
  conversionDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const loyaltyMiningSchema = new Schema<ILoyaltyMining>({
  userId: {
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
  totalPoints: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },
  currentTier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'bronze',
    index: true
  },
  tierMultiplier: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  contractStartDate: {
    type: Date,
    required: true
  },
  contractDuration: {
    type: Number,
    required: true,
    min: 1
  },
  loyaltyActions: [loyaltyActionSchema],
  referrals: [referralBonusSchema],
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  tokens: {
    total: {
      type: Number,
      default: 0,
      min: 0
    },
    available: {
      type: Number,
      default: 0,
      min: 0
    },
    locked: {
      type: Number,
      default: 0,
      min: 0
    },
    vestingSchedule: [{
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      releaseDate: {
        type: Date,
        required: true
      },
      released: {
        type: Boolean,
        default: false
      }
    }]
  },
  achievements: [{
    achievementId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    pointsReward: {
      type: Number,
      required: true,
      min: 0
    },
    unlockedDate: {
      type: Date,
      default: Date.now
    }
  }],
  monthlyBonus: {
    consecutiveMonths: {
      type: Number,
      default: 0,
      min: 0
    },
    lastPaymentDate: {
      type: Date
    },
    bonusMultiplier: {
      type: Number,
      default: 1,
      min: 1,
      max: 3
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
loyaltyMiningSchema.index({ userId: 1, propertyId: 1 });
loyaltyMiningSchema.index({ referralCode: 1 });
loyaltyMiningSchema.index({ 'tokens.available': -1 });

// Virtual pour calculer la loyalty score
loyaltyMiningSchema.virtual('loyaltyScore').get(function(this: ILoyaltyMining) {
  const monthsActive = this.monthlyBonus.consecutiveMonths;
  const referralCount = this.referrals.filter(r => r.isActive).length;
  const achievementCount = this.achievements.length;

  return (this.totalPoints * 0.6) + (monthsActive * 100) + (referralCount * 50) + (achievementCount * 25);
});

// Méthodes
loyaltyMiningSchema.methods.generateReferralCode = function(): string {
  const code = `REF${this.userId.toString().slice(-6).toUpperCase()}${Date.now().toString().slice(-4)}`;
  this.referralCode = code;
  return code;
};

loyaltyMiningSchema.methods.updateTier = function(): void {
  const tiers = {
    bronze: { min: 0, max: 999, multiplier: 1 },
    silver: { min: 1000, max: 4999, multiplier: 1.2 },
    gold: { min: 5000, max: 14999, multiplier: 1.5 },
    platinum: { min: 15000, max: 39999, multiplier: 2 },
    diamond: { min: 40000, max: Infinity, multiplier: 2.5 }
  };

  for (const [tier, config] of Object.entries(tiers)) {
    if (this.totalPoints >= config.min && this.totalPoints <= config.max) {
      this.currentTier = tier as any;
      this.tierMultiplier = config.multiplier;
      break;
    }
  }
};

loyaltyMiningSchema.methods.addLoyaltyAction = function(
  actionType: ILoyaltyAction['actionType'],
  basePoints: number,
  referenceId?: string
): number {
  const pointsConfig = {
    payment_ontime: 50,
    contract_renewal: 200,
    referral: 500,
    review: 25,
    maintenance_report: 30
  };

  const actualPoints = pointsConfig[actionType] || basePoints;
  const multiplier = this.tierMultiplier * this.monthlyBonus.bonusMultiplier;
  const finalPoints = Math.floor(actualPoints * multiplier);

  const action: ILoyaltyAction = {
    actionType,
    points: finalPoints,
    multiplier,
    date: new Date(),
    verified: true,
    referenceId
  };

  this.loyaltyActions.push(action);
  this.totalPoints += finalPoints;

  // Mise à jour du tier
  this.updateTier();

  // Génération de tokens (1 point = 0.1 IMMOCOIN)
  const tokensEarned = Math.floor(finalPoints * 0.1);
  this.awardTokens(tokensEarned);

  return finalPoints;
};

loyaltyMiningSchema.methods.awardTokens = function(amount: number, vestingMonths: number = 0): void {
  this.tokens.total += amount;

  if (vestingMonths > 0) {
    // Tokens avec vesting
    const vestingEntry = {
      amount,
      releaseDate: new Date(Date.now() + vestingMonths * 30 * 24 * 60 * 60 * 1000),
      released: false
    };
    this.tokens.vestingSchedule.push(vestingEntry);
    this.tokens.locked += amount;
  } else {
    // Tokens immédiatement disponibles
    this.tokens.available += amount;
  }
};

loyaltyMiningSchema.methods.processReferral = function(referredUserId: mongoose.Types.ObjectId): number {
  if (!this.referralCode) {
    this.generateReferralCode();
  }

  const bonusAmount = 1000; // Points bonus pour parrainage
  const tokensBonus = 100; // Tokens bonus

  const referral: IReferralBonus = {
    referredUserId,
    referralCode: this.referralCode,
    bonusAmount,
    conversionDate: new Date(),
    isActive: true
  };

  this.referrals.push(referral);
  this.addLoyaltyAction('referral', bonusAmount);
  this.awardTokens(tokensBonus);

  return bonusAmount;
};

loyaltyMiningSchema.methods.updateConsecutivePayments = function(paymentDate: Date): void {
  const lastPayment = this.monthlyBonus.lastPaymentDate;
  const currentMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);

  if (!lastPayment) {
    this.monthlyBonus.consecutiveMonths = 1;
  } else {
    const lastMonth = new Date(lastPayment.getFullYear(), lastPayment.getMonth(), 1);
    const monthDiff = (currentMonth.getTime() - lastMonth.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthDiff === 1) {
      // Mois consécutif
      this.monthlyBonus.consecutiveMonths += 1;
    } else if (monthDiff > 1) {
      // Interruption dans la série
      this.monthlyBonus.consecutiveMonths = 1;
    }
  }

  this.monthlyBonus.lastPaymentDate = paymentDate;

  // Calculer le bonus multiplier
  const consecutiveMonths = this.monthlyBonus.consecutiveMonths;
  if (consecutiveMonths >= 24) {
    this.monthlyBonus.bonusMultiplier = 2;
  } else if (consecutiveMonths >= 12) {
    this.monthlyBonus.bonusMultiplier = 1.5;
  } else if (consecutiveMonths >= 6) {
    this.monthlyBonus.bonusMultiplier = 1.2;
  } else {
    this.monthlyBonus.bonusMultiplier = 1;
  }
};

loyaltyMiningSchema.methods.unlockAchievement = function(achievementId: string): boolean {
  // Vérifier si l'achievement n'est pas déjà débloqué
  const existing = this.achievements.find(a => a.achievementId === achievementId);
  if (existing) return false;

  const achievements = {
    first_payment: { name: "Premier Paiement", description: "Premier loyer payé à temps", points: 100 },
    six_months: { name: "Locataire Fidèle", description: "6 mois de paiements consécutifs", points: 500 },
    one_year: { name: "Résident de l'Année", description: "12 mois de paiements consécutifs", points: 1000 },
    first_referral: { name: "Ambassadeur", description: "Premier parrainage réussi", points: 300 },
    maintenance_hero: { name: "Héros de la Maintenance", description: "10 rapports de maintenance", points: 200 },
    review_master: { name: "Critique Expert", description: "5 avis détaillés", points: 150 }
  };

  const achievement = achievements[achievementId as keyof typeof achievements];
  if (!achievement) return false;

  this.achievements.push({
    achievementId,
    name: achievement.name,
    description: achievement.description,
    pointsReward: achievement.points,
    unlockedDate: new Date()
  });

  this.totalPoints += achievement.points;
  this.updateTier();
  this.awardTokens(Math.floor(achievement.points * 0.2));

  return true;
};

loyaltyMiningSchema.methods.releaseVestedTokens = function(): number {
  let releasedAmount = 0;
  const now = new Date();

  this.tokens.vestingSchedule.forEach(vest => {
    if (!vest.released && vest.releaseDate <= now) {
      vest.released = true;
      this.tokens.locked -= vest.amount;
      this.tokens.available += vest.amount;
      releasedAmount += vest.amount;
    }
  });

  return releasedAmount;
};

export const LoyaltyMining = mongoose.model<ILoyaltyMining>('LoyaltyMining', loyaltyMiningSchema);