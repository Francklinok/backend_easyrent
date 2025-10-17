import { DynamicPricing, IDynamicPricing } from '../models/DynamicPricing';
import { MultiAssetStaking, IMultiAssetStaking } from '../models/MultiAssetStaking';
import { FractionalOwnership, IFractionalOwnership } from '../models/FractionalOwnership';
import { LoyaltyMining, ILoyaltyMining } from '../models/LoyaltyMining';
import { AIRiskAssessment, IAIRiskAssessment } from '../models/AIRiskAssessment';
import { InsuranceDAO, IInsuranceDAO } from '../models/InsuranceDAO';
import { WalletService } from '../../wallet/services/walletService';
import mongoose from 'mongoose';

export interface IRentPaymentResult {
  success: boolean;
  originalRent: number;
  adjustedRent: number;
  discountApplied: number;
  yieldGenerated: number;
  loyaltyPointsEarned: number;
  tokensAwarded: number;
  nextPaymentDue: Date;
}

export interface IStakingResult {
  success: boolean;
  totalStaked: number;
  expectedYield: number;
  riskScore: number;
  rebalanceRecommended: boolean;
  nextRebalanceDate: Date;
}

export interface IPropertyTokenizationResult {
  success: boolean;
  totalShares: number;
  sharePrice: number;
  availableShares: number;
  daoEnabled: boolean;
  revenueSharing: boolean;
}

export class DeFiRealEstateService {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  // ===========================================
  // DYNAMIC PRICING & RENT MANAGEMENT
  // ===========================================

  async setupDynamicPricing(
    propertyId: mongoose.Types.ObjectId,
    baseRent: number,
    initialYieldRate: number = 8
  ): Promise<IDynamicPricing> {
    const existingPricing = await DynamicPricing.findOne({ propertyId });

    if (existingPricing) {
      throw new Error('Dynamic pricing déjà configuré pour cette propriété');
    }

    const pricing = new DynamicPricing({
      propertyId,
      baseRent,
      currentYieldRate: initialYieldRate,
      adjustedRent: baseRent,
      pricingTier: initialYieldRate >= 15 ? 'high' : initialYieldRate >= 8 ? 'medium' : 'low',
      discountPercentage: this.calculateDiscount(initialYieldRate),
      smoothingFactor: 0.3,
      historicalYields: [{
        date: new Date(),
        yieldRate: initialYieldRate,
        discountApplied: this.calculateDiscount(initialYieldRate)
      }]
    });

    return await pricing.save();
  }

  async updateRentPricing(
    propertyId: mongoose.Types.ObjectId,
    newYieldRate: number
  ): Promise<IDynamicPricing> {
    const pricing = await DynamicPricing.findOne({ propertyId, isActive: true });

    if (!pricing) {
      throw new Error('Dynamic pricing non trouvé pour cette propriété');
    }

    pricing.updatePricing(newYieldRate);
    return await pricing.save();
  }

  async processRentPayment(
    tenantId: mongoose.Types.ObjectId,
    propertyId: mongoose.Types.ObjectId,
    paymentAmount: number
  ): Promise<IRentPaymentResult> {
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        // 1. Récupérer le pricing dynamique
        const pricing = await DynamicPricing.findOne({ propertyId, isActive: true });
        if (!pricing) {
          throw new Error('Pricing dynamique non configuré');
        }

        // 2. Calculer le montant ajusté
        const adjustedRent = pricing.adjustedRent;
        const discountApplied = pricing.discountPercentage;
        const stakingAmount = pricing.baseRent - adjustedRent;

        // 3. Traiter le paiement du loyer
        await this.walletService.processPayment(tenantId.toString(), {
          type: 'payment',
          amount: adjustedRent,
          description: `Loyer ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
          currency: 'EUR'
        });

        // 4. Gérer le staking
        let yieldGenerated = 0;
        if (stakingAmount > 0) {
          const stakingResult = await this.processStaking(propertyId, stakingAmount);
          yieldGenerated = stakingResult.expectedYield;
        }

        // 5. Gérer la loyalty
        const loyalty = await this.updateLoyalty(tenantId, propertyId, 'payment_ontime');

        // 6. Calculer la prochaine échéance
        const nextPaymentDue = new Date();
        nextPaymentDue.setMonth(nextPaymentDue.getMonth() + 1);

        return {
          success: true,
          originalRent: pricing.baseRent,
          adjustedRent,
          discountApplied,
          yieldGenerated,
          loyaltyPointsEarned: loyalty.pointsEarned,
          tokensAwarded: loyalty.tokensAwarded,
          nextPaymentDue
        };
      });
    } finally {
      await session.endSession();
    }
  }

  // ===========================================
  // MULTI-ASSET STAKING
  // ===========================================

  async setupMultiAssetStaking(
    propertyId: mongoose.Types.ObjectId,
    ownerId: mongoose.Types.ObjectId,
    totalAmount: number
  ): Promise<IMultiAssetStaking> {
    const optimalAllocation = this.calculateOptimalAllocation(totalAmount);

    const staking = new MultiAssetStaking({
      propertyId,
      ownerId,
      totalStakedAmount: totalAmount,
      assets: [
        {
          assetType: 'ETH',
          protocol: 'Ethereum 2.0 Staking',
          amount: optimalAllocation.ETH,
          expectedYield: 5.5,
          currentYield: 5.5,
          riskLevel: 'low',
          insuranceCovered: true,
          lastRebalance: new Date()
        },
        {
          assetType: 'DeFi',
          protocol: 'Compound/Aave',
          amount: optimalAllocation.DeFi,
          expectedYield: 10,
          currentYield: 10,
          riskLevel: 'medium',
          insuranceCovered: true,
          lastRebalance: new Date()
        },
        {
          assetType: 'RWA',
          protocol: 'Real World Assets',
          amount: optimalAllocation.RWA,
          expectedYield: 7,
          currentYield: 7,
          riskLevel: 'low',
          insuranceCovered: false,
          lastRebalance: new Date()
        }
      ],
      rebalanceThreshold: 5,
      autoRebalanceEnabled: true,
      insuranceProvider: 'Nexus Mutual',
      insuranceCoverage: 20
    });

    staking.calculateTotalYield();
    staking.calculateRiskScore();

    return await staking.save();
  }

  async processStaking(
    propertyId: mongoose.Types.ObjectId,
    amount: number
  ): Promise<IStakingResult> {
    const staking = await MultiAssetStaking.findOne({ propertyId, isActive: true });

    if (!staking) {
      throw new Error('Multi-asset staking non configuré');
    }

    // Ajouter aux assets existants proportionnellement
    const allocation = staking.getOptimalAllocation();
    const ethAmount = amount * 0.50;
    const defiAmount = amount * 0.35;
    const rwaAmount = amount * 0.15;

    // Mettre à jour les montants
    staking.assets.forEach(asset => {
      switch (asset.assetType) {
        case 'ETH':
          asset.amount += ethAmount;
          break;
        case 'DeFi':
          asset.amount += defiAmount;
          break;
        case 'RWA':
          asset.amount += rwaAmount;
          break;
      }
      asset.lastRebalance = new Date();
    });

    staking.totalStakedAmount += amount;
    const totalYield = staking.calculateTotalYield();
    const riskScore = staking.calculateRiskScore();
    const needsRebalancing = staking.needsRebalancing();

    await staking.save();

    // Planifier le prochain rebalance
    const nextRebalanceDate = new Date();
    nextRebalanceDate.setDate(nextRebalanceDate.getDate() + 30);

    return {
      success: true,
      totalStaked: staking.totalStakedAmount,
      expectedYield: totalYield,
      riskScore,
      rebalanceRecommended: needsRebalancing,
      nextRebalanceDate
    };
  }

  async rebalancePortfolio(propertyId: mongoose.Types.ObjectId): Promise<boolean> {
    const staking = await MultiAssetStaking.findOne({ propertyId, isActive: true });

    if (!staking || !staking.needsRebalancing()) {
      return false;
    }

    const optimalAllocation = staking.getOptimalAllocation();

    // Réallouer les assets
    staking.assets.forEach(asset => {
      asset.amount = optimalAllocation[asset.assetType];
      asset.lastRebalance = new Date();
    });

    staking.lastRebalanceDate = new Date();
    staking.calculateTotalYield();
    staking.calculateRiskScore();

    await staking.save();
    return true;
  }

  // ===========================================
  // FRACTIONAL OWNERSHIP
  // ===========================================

  async tokenizeProperty(
    propertyId: mongoose.Types.ObjectId,
    totalValue: number,
    totalShares: number = 1000
  ): Promise<IPropertyTokenizationResult> {
    const existingOwnership = await FractionalOwnership.findOne({ propertyId });

    if (existingOwnership) {
      throw new Error('Propriété déjà tokenisée');
    }

    const sharePrice = totalValue / totalShares;

    const ownership = new FractionalOwnership({
      propertyId,
      totalShares,
      sharePrice,
      availableShares: totalShares,
      totalValue,
      shareholders: [],
      daoGovernance: {
        isEnabled: true,
        votingThreshold: 51,
        proposalCount: 0,
        activeProposals: []
      },
      revenueSharing: {
        enabled: true,
        distributionSchedule: 'monthly',
        totalDistributed: 0,
        distributions: []
      }
    });

    await ownership.save();

    return {
      success: true,
      totalShares,
      sharePrice,
      availableShares: totalShares,
      daoEnabled: true,
      revenueSharing: true
    };
  }

  async purchasePropertyShares(
    propertyId: mongoose.Types.ObjectId,
    buyerId: mongoose.Types.ObjectId,
    sharesToBuy: number
  ): Promise<boolean> {
    const ownership = await FractionalOwnership.findOne({ propertyId, isActive: true });

    if (!ownership) {
      throw new Error('Propriété non tokenisée');
    }

    const totalCost = sharesToBuy * ownership.sharePrice;

    // Vérifier le solde de l'acheteur
    const wallet = await this.walletService.getWallet(buyerId.toString());
    if (!wallet || wallet.balance < totalCost) {
      throw new Error('Solde insuffisant');
    }

    // Traiter l'achat
    await ownership.purchaseShares(buyerId, sharesToBuy);

    // Débiter le compte
    await this.walletService.processPayment(buyerId.toString(), {
      type: 'payment',
      amount: totalCost,
      description: `Achat de ${sharesToBuy} parts de propriété`,
      currency: 'EUR'
    });

    await ownership.save();
    return true;
  }

  async enableTenantToOwnerTransition(
    propertyId: mongoose.Types.ObjectId,
    tenantId: mongoose.Types.ObjectId,
    monthlyAccumulation: number = 1
  ): Promise<boolean> {
    const ownership = await FractionalOwnership.findOne({ propertyId, isActive: true });

    if (!ownership) {
      throw new Error('Propriété non tokenisée');
    }

    ownership.enableTenantTransition(tenantId, monthlyAccumulation);
    await ownership.save();

    return true;
  }

  // ===========================================
  // LOYALTY MINING
  // ===========================================

  async initializeLoyalty(
    userId: mongoose.Types.ObjectId,
    propertyId: mongoose.Types.ObjectId,
    contractDuration: number
  ): Promise<ILoyaltyMining> {
    const existingLoyalty = await LoyaltyMining.findOne({ userId, propertyId });

    if (existingLoyalty) {
      return existingLoyalty;
    }

    const loyalty = new LoyaltyMining({
      userId,
      propertyId,
      contractStartDate: new Date(),
      contractDuration,
      referralCode: '',
      monthlyBonus: {
        consecutiveMonths: 0,
        bonusMultiplier: 1
      }
    });

    loyalty.generateReferralCode();
    await loyalty.save();

    return loyalty;
  }

  async updateLoyalty(
    userId: mongoose.Types.ObjectId,
    propertyId: mongoose.Types.ObjectId,
    actionType: 'payment_ontime' | 'contract_renewal' | 'referral' | 'review' | 'maintenance_report',
    referenceId?: string
  ): Promise<{ pointsEarned: number; tokensAwarded: number }> {
    const loyalty = await LoyaltyMining.findOne({ userId, propertyId, isActive: true });

    if (!loyalty) {
      throw new Error('Programme de fidélité non initialisé');
    }

    // Mettre à jour les paiements consécutifs si c'est un paiement
    if (actionType === 'payment_ontime') {
      loyalty.updateConsecutivePayments(new Date());
    }

    // Ajouter l'action de fidélité
    const pointsEarned = loyalty.addLoyaltyAction(actionType, 0, referenceId);

    // Débloquer des achievements si applicable
    this.checkAndUnlockAchievements(loyalty);

    // Libérer les tokens en vesting
    const releasedTokens = loyalty.releaseVestedTokens();

    await loyalty.save();

    return {
      pointsEarned,
      tokensAwarded: releasedTokens
    };
  }

  async processReferral(
    referralCode: string,
    newUserId: mongoose.Types.ObjectId
  ): Promise<{ success: boolean; bonusPoints: number }> {
    const referrer = await LoyaltyMining.findOne({ referralCode, isActive: true });

    if (!referrer) {
      return { success: false, bonusPoints: 0 };
    }

    const bonusPoints = referrer.processReferral(newUserId);
    await referrer.save();

    return { success: true, bonusPoints };
  }

  // ===========================================
  // AI RISK ASSESSMENT
  // ===========================================

  async createRiskAssessment(
    userId: mongoose.Types.ObjectId,
    propertyId: mongoose.Types.ObjectId,
    walletAddress: string
  ): Promise<IAIRiskAssessment> {
    // Analyser les données on-chain
    const onChainData = await this.analyzeOnChainData(walletAddress);

    const assessment = new AIRiskAssessment({
      userId,
      propertyId,
      onChainData,
      riskFactors: {
        paymentHistory: {
          totalPayments: 0,
          latePayments: 0,
          averageDelayDays: 0,
          consistency: 100
        },
        financialStability: {
          incomeVolatility: 30,
          debtToIncomeRatio: 25,
          cryptoAssetVolatility: 40,
          diversificationScore: 60
        },
        behaviouralMetrics: {
          platformEngagement: 50,
          communityParticipation: 50,
          maintenanceReporting: 50,
          disputeHistory: 0
        },
        externalFactors: {
          marketConditions: 65,
          regionEconomicHealth: 70,
          propertyMarketTrend: 60,
          seasonalFactors: 50
        }
      },
      overallRiskScore: 0,
      riskCategory: 'standard',
      predictionModel: {
        algorithm: 'ensemble',
        accuracy: 0.85,
        lastTraining: new Date(),
        features: ['payment_history', 'on_chain_score', 'market_conditions'],
        weights: new Map([
          ['payment_history', 0.4],
          ['financial_stability', 0.3],
          ['behavioral', 0.2],
          ['external', 0.1]
        ]),
        predictions: []
      },
      dynamicAdjustments: {
        conditionsAdjustment: 0,
        depositMultiplier: 1,
        interestRateAdjustment: 0,
        insurancePremium: 2
      },
      monitoringAlerts: [],
      nextReview: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 jours
    });

    // Calculer le score de risque
    assessment.calculateRiskScore();
    assessment.calculateDynamicAdjustments();
    assessment.scheduleNextReview();

    return await assessment.save();
  }

  async updateRiskAssessment(
    userId: mongoose.Types.ObjectId,
    propertyId: mongoose.Types.ObjectId
  ): Promise<IAIRiskAssessment> {
    const assessment = await AIRiskAssessment.findOne({ userId, propertyId, isActive: true });

    if (!assessment) {
      throw new Error('Évaluation de risque non trouvée');
    }

    // Mettre à jour les données on-chain
    assessment.onChainData = await this.analyzeOnChainData(assessment.onChainData.walletAddress);

    // Recalculer les scores
    assessment.calculateRiskScore();
    assessment.calculateDynamicAdjustments();
    assessment.scheduleNextReview();

    assessment.lastAssessment = new Date();

    return await assessment.save();
  }

  // ===========================================
  // INSURANCE DAO
  // ===========================================

  async submitInsuranceClaim(
    claimantId: mongoose.Types.ObjectId,
    claimType: 'defi_loss' | 'property_damage' | 'payment_default' | 'smart_contract_bug',
    amount: number,
    description: string,
    evidence: string[],
    propertyId?: mongoose.Types.ObjectId
  ): Promise<string> {
    const dao = await InsuranceDAO.findOne({ isActive: true });

    if (!dao) {
      throw new Error('DAO d\'assurance non configuré');
    }

    const claimId = dao.submitClaim(claimType, amount, description, claimantId, evidence, propertyId);
    await dao.save();

    return claimId;
  }

  async voteOnInsuranceClaim(
    claimId: string,
    voterId: mongoose.Types.ObjectId,
    vote: 'approve' | 'reject',
    reason?: string
  ): Promise<boolean> {
    const dao = await InsuranceDAO.findOne({ isActive: true });

    if (!dao) {
      throw new Error('DAO d\'assurance non configuré');
    }

    const result = dao.voteOnClaim(claimId, voterId, vote, reason);
    await dao.save();

    return result;
  }

  // ===========================================
  // HELPER METHODS
  // ===========================================

  private calculateDiscount(yieldRate: number): number {
    if (yieldRate < 8) return 5;
    if (yieldRate >= 8 && yieldRate <= 15) return 10;
    if (yieldRate > 15) return 15;
    return 0;
  }

  private calculateOptimalAllocation(totalAmount: number) {
    return {
      ETH: totalAmount * 0.50,
      DeFi: totalAmount * 0.35,
      RWA: totalAmount * 0.15
    };
  }

  private async analyzeOnChainData(walletAddress: string) {
    // En production, ceci ferait appel à des APIs blockchain
    return {
      walletAddress,
      totalTransactions: Math.floor(Math.random() * 1000) + 100,
      averageTransactionValue: Math.floor(Math.random() * 5000) + 500,
      defiProtocolsUsed: ['Uniswap', 'Compound', 'Aave'],
      stakingHistory: [],
      liquidityProviding: [],
      creditScore: Math.floor(Math.random() * 300) + 550,
      riskLevel: 'medium' as const
    };
  }

  private checkAndUnlockAchievements(loyalty: ILoyaltyMining): void {
    // Premier paiement
    if (loyalty.loyaltyActions.filter(a => a.actionType === 'payment_ontime').length === 1) {
      loyalty.unlockAchievement('first_payment');
    }

    // 6 mois de paiements consécutifs
    if (loyalty.monthlyBonus.consecutiveMonths === 6) {
      loyalty.unlockAchievement('six_months');
    }

    // 12 mois de paiements consécutifs
    if (loyalty.monthlyBonus.consecutiveMonths === 12) {
      loyalty.unlockAchievement('one_year');
    }

    // Premier parrainage
    if (loyalty.referrals.length === 1) {
      loyalty.unlockAchievement('first_referral');
    }

    // 10 rapports de maintenance
    if (loyalty.loyaltyActions.filter(a => a.actionType === 'maintenance_report').length === 10) {
      loyalty.unlockAchievement('maintenance_hero');
    }

    // 5 avis
    if (loyalty.loyaltyActions.filter(a => a.actionType === 'review').length === 5) {
      loyalty.unlockAchievement('review_master');
    }
  }
}

export default DeFiRealEstateService;