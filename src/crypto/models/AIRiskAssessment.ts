import mongoose, { Schema, Document } from 'mongoose';

export interface IOnChainData {
  walletAddress: string;
  totalTransactions: number;
  averageTransactionValue: number;
  defiProtocolsUsed: string[];
  stakingHistory: Array<{
    protocol: string;
    amount: number;
    duration: number;
    returns: number;
  }>;
  liquidityProviding: Array<{
    pool: string;
    amount: number;
    duration: number;
    impermanentLoss: number;
  }>;
  creditScore: number;
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
}

export interface IRiskFactors {
  paymentHistory: {
    totalPayments: number;
    latePayments: number;
    averageDelayDays: number;
    consistency: number; // 0-100
  };
  financialStability: {
    incomeVolatility: number;
    debtToIncomeRatio: number;
    cryptoAssetVolatility: number;
    diversificationScore: number;
  };
  behaviouralMetrics: {
    platformEngagement: number;
    communityParticipation: number;
    maintenanceReporting: number;
    disputeHistory: number;
  };
  externalFactors: {
    marketConditions: number;
    regionEconomicHealth: number;
    propertyMarketTrend: number;
    seasonalFactors: number;
  };
}

export interface IPredictionModel {
  algorithm: 'random_forest' | 'neural_network' | 'gradient_boosting' | 'ensemble';
  accuracy: number;
  lastTraining: Date;
  features: string[];
  weights: Record<string, number>;
  predictions: Array<{
    predictionType: 'payment_default' | 'early_termination' | 'property_damage' | 'renewal_likelihood';
    probability: number;
    confidence: number;
    timeframe: number; // en jours
    createdAt: Date;
  }>;
}

export interface IAIRiskAssessment extends Document {
  userId: mongoose.Types.ObjectId;
  propertyId?: mongoose.Types.ObjectId;
  onChainData: IOnChainData;
  riskFactors: IRiskFactors;
  overallRiskScore: number;
  riskCategory: 'premium' | 'standard' | 'cautious' | 'high_risk';
  predictionModel: IPredictionModel;
  dynamicAdjustments: {
    conditionsAdjustment: number;
    depositMultiplier: number;
    interestRateAdjustment: number;
    insurancePremium: number;
  };
  monitoringAlerts: Array<{
    alertType: 'risk_increase' | 'unusual_activity' | 'payment_prediction' | 'market_volatility';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    actionRequired: boolean;
    createdAt: Date;
    resolved: boolean;
  }>;
  lastAssessment: Date;
  nextReview: Date;
  isActive: boolean;

  // Methods
  calculateRiskScore(): number;
  updateRiskCategory(): void;
  calculateDynamicAdjustments(): void;
  predictPaymentDefault(timeframeDays?: number): number;
  addMonitoringAlert(alertType: string, severity: string, message: string, actionRequired?: boolean): void;
  scheduleNextReview(): void;
}

const onChainDataSchema = new Schema<IOnChainData>({
  walletAddress: {
    type: String,
    required: true,
    index: true
  },
  totalTransactions: {
    type: Number,
    default: 0,
    min: 0
  },
  averageTransactionValue: {
    type: Number,
    default: 0,
    min: 0
  },
  defiProtocolsUsed: [{
    type: String
  }],
  stakingHistory: [{
    protocol: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    duration: {
      type: Number,
      required: true,
      min: 0
    },
    returns: {
      type: Number,
      required: true
    }
  }],
  liquidityProviding: [{
    pool: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    duration: {
      type: Number,
      required: true,
      min: 0
    },
    impermanentLoss: {
      type: Number,
      default: 0
    }
  }],
  creditScore: {
    type: Number,
    default: 500,
    min: 300,
    max: 850
  },
  riskLevel: {
    type: String,
    enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
    default: 'medium'
  }
}, { _id: false });

const riskFactorsSchema = new Schema<IRiskFactors>({
  paymentHistory: {
    totalPayments: {
      type: Number,
      default: 0,
      min: 0
    },
    latePayments: {
      type: Number,
      default: 0,
      min: 0
    },
    averageDelayDays: {
      type: Number,
      default: 0,
      min: 0
    },
    consistency: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    }
  },
  financialStability: {
    incomeVolatility: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    debtToIncomeRatio: {
      type: Number,
      default: 30,
      min: 0,
      max: 100
    },
    cryptoAssetVolatility: {
      type: Number,
      default: 60,
      min: 0,
      max: 100
    },
    diversificationScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    }
  },
  behaviouralMetrics: {
    platformEngagement: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    communityParticipation: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    maintenanceReporting: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    disputeHistory: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  externalFactors: {
    marketConditions: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    regionEconomicHealth: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    propertyMarketTrend: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    seasonalFactors: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    }
  }
}, { _id: false });

const predictionModelSchema = new Schema<IPredictionModel>({
  algorithm: {
    type: String,
    enum: ['random_forest', 'neural_network', 'gradient_boosting', 'ensemble'],
    default: 'ensemble'
  },
  accuracy: {
    type: Number,
    default: 0.85,
    min: 0,
    max: 1
  },
  lastTraining: {
    type: Date,
    default: Date.now
  },
  features: [{
    type: String
  }],
  weights: {
    type: Map,
    of: Number,
    default: new Map()
  },
  predictions: [{
    predictionType: {
      type: String,
      enum: ['payment_default', 'early_termination', 'property_damage', 'renewal_likelihood'],
      required: true
    },
    probability: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    timeframe: {
      type: Number,
      required: true,
      min: 1
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { _id: false });

const aiRiskAssessmentSchema = new Schema<IAIRiskAssessment>({
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
  onChainData: {
    type: onChainDataSchema,
    required: true
  },
  riskFactors: {
    type: riskFactorsSchema,
    required: true
  },
  overallRiskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    index: true
  },
  riskCategory: {
    type: String,
    enum: ['premium', 'standard', 'cautious', 'high_risk'],
    required: true,
    index: true
  },
  predictionModel: {
    type: predictionModelSchema,
    required: true
  },
  dynamicAdjustments: {
    conditionsAdjustment: {
      type: Number,
      default: 0,
      min: -50,
      max: 50
    },
    depositMultiplier: {
      type: Number,
      default: 1,
      min: 0.5,
      max: 3
    },
    interestRateAdjustment: {
      type: Number,
      default: 0,
      min: -5,
      max: 10
    },
    insurancePremium: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    }
  },
  monitoringAlerts: [{
    alertType: {
      type: String,
      enum: ['risk_increase', 'unusual_activity', 'payment_prediction', 'market_volatility'],
      required: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    actionRequired: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }],
  lastAssessment: {
    type: Date,
    default: Date.now,
    index: true
  },
  nextReview: {
    type: Date,
    required: true,
    index: true
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

// Indexes pour performance
aiRiskAssessmentSchema.index({ userId: 1, propertyId: 1 });
aiRiskAssessmentSchema.index({ overallRiskScore: -1, riskCategory: 1 });
aiRiskAssessmentSchema.index({ nextReview: 1, isActive: 1 });
aiRiskAssessmentSchema.index({ 'onChainData.creditScore': -1 });

// Virtual pour le score de confiance
aiRiskAssessmentSchema.virtual('confidenceScore').get(function(this: IAIRiskAssessment) {
  const predictions = this.predictionModel.predictions;
  if (predictions.length === 0) return 0;

  const avgConfidence = predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length;
  return Math.round(avgConfidence);
});

// Méthodes
aiRiskAssessmentSchema.methods.calculateRiskScore = function(): number {
  const weights = {
    paymentHistory: 0.3,
    financialStability: 0.25,
    behaviouralMetrics: 0.2,
    externalFactors: 0.15,
    onChainData: 0.1
  };

  // Score historique de paiement
  const paymentScore = this.riskFactors.paymentHistory.consistency;

  // Score stabilité financière
  const stabilityScore = 100 - (
    (this.riskFactors.financialStability.incomeVolatility * 0.3) +
    (this.riskFactors.financialStability.debtToIncomeRatio * 0.3) +
    (this.riskFactors.financialStability.cryptoAssetVolatility * 0.2) +
    (100 - this.riskFactors.financialStability.diversificationScore) * 0.2
  );

  // Score comportemental
  const behavioralScore = (
    this.riskFactors.behaviouralMetrics.platformEngagement +
    this.riskFactors.behaviouralMetrics.communityParticipation +
    this.riskFactors.behaviouralMetrics.maintenanceReporting +
    (100 - this.riskFactors.behaviouralMetrics.disputeHistory)
  ) / 4;

  // Score facteurs externes
  const externalScore = (
    this.riskFactors.externalFactors.marketConditions +
    this.riskFactors.externalFactors.regionEconomicHealth +
    this.riskFactors.externalFactors.propertyMarketTrend +
    this.riskFactors.externalFactors.seasonalFactors
  ) / 4;

  // Score on-chain (conversion credit score 300-850 vers 0-100)
  const onChainScore = ((this.onChainData.creditScore - 300) / 550) * 100;

  const totalScore = (
    paymentScore * weights.paymentHistory +
    stabilityScore * weights.financialStability +
    behavioralScore * weights.behaviouralMetrics +
    externalScore * weights.externalFactors +
    onChainScore * weights.onChainData
  );

  this.overallRiskScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  this.updateRiskCategory();

  return this.overallRiskScore;
};

aiRiskAssessmentSchema.methods.updateRiskCategory = function(): void {
  if (this.overallRiskScore >= 80) {
    this.riskCategory = 'premium';
  } else if (this.overallRiskScore >= 60) {
    this.riskCategory = 'standard';
  } else if (this.overallRiskScore >= 40) {
    this.riskCategory = 'cautious';
  } else {
    this.riskCategory = 'high_risk';
  }
};

aiRiskAssessmentSchema.methods.calculateDynamicAdjustments = function(): void {
  const riskScore = this.overallRiskScore;

  // Ajustement des conditions basé sur le risque
  if (riskScore >= 80) {
    // Premium: conditions favorables
    this.dynamicAdjustments.conditionsAdjustment = -10;
    this.dynamicAdjustments.depositMultiplier = 0.8;
    this.dynamicAdjustments.interestRateAdjustment = -1;
    this.dynamicAdjustments.insurancePremium = 1;
  } else if (riskScore >= 60) {
    // Standard: conditions normales
    this.dynamicAdjustments.conditionsAdjustment = 0;
    this.dynamicAdjustments.depositMultiplier = 1;
    this.dynamicAdjustments.interestRateAdjustment = 0;
    this.dynamicAdjustments.insurancePremium = 2;
  } else if (riskScore >= 40) {
    // Cautious: conditions prudentes
    this.dynamicAdjustments.conditionsAdjustment = 15;
    this.dynamicAdjustments.depositMultiplier = 1.5;
    this.dynamicAdjustments.interestRateAdjustment = 2;
    this.dynamicAdjustments.insurancePremium = 4;
  } else {
    // High risk: conditions strictes
    this.dynamicAdjustments.conditionsAdjustment = 30;
    this.dynamicAdjustments.depositMultiplier = 2.5;
    this.dynamicAdjustments.interestRateAdjustment = 5;
    this.dynamicAdjustments.insurancePremium = 7;
  }
};

aiRiskAssessmentSchema.methods.predictPaymentDefault = function(timeframeDays: number = 30): number {
  const features = {
    paymentConsistency: this.riskFactors.paymentHistory.consistency,
    avgDelayDays: this.riskFactors.paymentHistory.averageDelayDays,
    incomeVolatility: this.riskFactors.financialStability.incomeVolatility,
    debtRatio: this.riskFactors.financialStability.debtToIncomeRatio,
    cryptoVolatility: this.riskFactors.financialStability.cryptoAssetVolatility,
    creditScore: this.onChainData.creditScore,
    marketConditions: this.riskFactors.externalFactors.marketConditions
  };

  // Algorithme simplifié (en production, utiliser un vrai ML model)
  let riskProbability = 0;

  // Facteurs de risque
  riskProbability += Math.max(0, (100 - features.paymentConsistency) * 0.4);
  riskProbability += Math.min(features.avgDelayDays * 2, 20);
  riskProbability += features.incomeVolatility * 0.2;
  riskProbability += features.debtRatio * 0.3;
  riskProbability += features.cryptoVolatility * 0.15;
  riskProbability += Math.max(0, (550 - features.creditScore) / 550 * 30);
  riskProbability += Math.max(0, (50 - features.marketConditions) * 0.2);

  // Ajustement temporel
  const timeAdjustment = Math.log(timeframeDays / 30 + 1);
  riskProbability *= timeAdjustment;

  const finalProbability = Math.max(0, Math.min(100, riskProbability));
  const confidence = this.predictionModel.accuracy * 100;

  // Stocker la prédiction
  this.predictionModel.predictions.push({
    predictionType: 'payment_default',
    probability: finalProbability,
    confidence,
    timeframe: timeframeDays,
    createdAt: new Date()
  });

  return finalProbability;
};

aiRiskAssessmentSchema.methods.addMonitoringAlert = function(
  alertType: string,
  severity: string,
  message: string,
  actionRequired: boolean = false
): void {
  this.monitoringAlerts.push({
    alertType: alertType as any,
    severity: severity as any,
    message,
    actionRequired,
    createdAt: new Date(),
    resolved: false
  });

  // Garder seulement les 50 dernières alertes
  if (this.monitoringAlerts.length > 50) {
    this.monitoringAlerts = this.monitoringAlerts.slice(-50);
  }
};

aiRiskAssessmentSchema.methods.scheduleNextReview = function(): void {
  const daysBetweenReviews: Record<string, number> = {
    premium: 90,
    standard: 60,
    cautious: 30,
    high_risk: 14
  };

  const daysToAdd = daysBetweenReviews[this.riskCategory] || 60;
  this.nextReview = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);
};

export const AIRiskAssessment = mongoose.model<IAIRiskAssessment>('AIRiskAssessment', aiRiskAssessmentSchema);