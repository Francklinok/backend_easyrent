import { PropertyToken, IPropertyToken } from '../models/PropertyToken';
import { UtilityToken, IUtilityToken } from '../models/UtilityToken';
import { CryptoPayment } from '../models/CryptoPayment';
import { SmartContractService } from './SmartContractService';
import { UnifiedNotificationService } from '../../notification';
import { PriceOracleService } from './PriceOracleService';

export interface YieldFarmingPool {
  poolId: string;
  name: string;
  tokenA: string;
  tokenB: string;
  totalLiquidity: number;
  apy: number;
  totalStaked: number;
  rewardToken: string;
  rewardRate: number; // tokens per day
  participants: number;
  lockupPeriod: number; // en jours
  multiplier: number;
  isActive: boolean;
  createdAt: Date;
}

export interface LendingPool {
  poolId: string;
  asset: string;
  totalSupply: number;
  totalBorrow: number;
  supplyRate: number;
  borrowRate: number;
  collateralFactor: number;
  liquidationThreshold: number;
  utilizationRate: number;
  isActive: boolean;
}

export interface StakingInput {
  userId: string;
  poolId: string;
  amount: number;
  lockupPeriod?: number;
}

export interface LendingInput {
  userId: string;
  poolId: string;
  amount: number;
  action: 'supply' | 'borrow';
  collateralTokenId?: string;
  collateralAmount?: number;
}

export class DeFiService {
  private contractService: SmartContractService;
  private notificationService: NotificationService;
  private priceOracle: PriceOracleService;

  // En production, ces données seraient stockées en base de données
  private yieldFarmingPools: Map<string, YieldFarmingPool> = new Map();
  private lendingPools: Map<string, LendingPool> = new Map();
  private userPositions: Map<string, any[]> = new Map();

  constructor() {
    this.contractService = new SmartContractService();
    this.notificationService = new NotificationService();
    this.priceOracle = new PriceOracleService();
    this.initializeDeFiPools();
  }

  async createYieldFarmingPool(
    tokenA: string,
    tokenB: string,
    rewardToken: string,
    apy: number
  ): Promise<string> {
    try {
      const poolId = this.generatePoolId();

      const pool: YieldFarmingPool = {
        poolId,
        name: `${tokenA}/${tokenB} LP`,
        tokenA,
        tokenB,
        totalLiquidity: 0,
        apy,
        totalStaked: 0,
        rewardToken,
        rewardRate: 100, // 100 tokens par jour
        participants: 0,
        lockupPeriod: 30,
        multiplier: 1.0,
        isActive: true,
        createdAt: new Date()
      };

      this.yieldFarmingPools.set(poolId, pool);

      // Déployer le smart contract du pool
      const contractAddress = await this.deployYieldFarmingContract(pool);

      return poolId;
    } catch (error) {
      throw new Error(`Erreur lors de la création du pool: ${error.message}`);
    }
  }

  async stakeInYieldFarm(input: StakingInput): Promise<void> {
    try {
      const pool = this.yieldFarmingPools.get(input.poolId);
      if (!pool || !pool.isActive) throw new Error('Pool non trouvé ou inactif');

      // Vérifier que l'utilisateur possède les tokens LP
      const userLPTokens = await this.getUserLPTokens(input.userId, pool.tokenA, pool.tokenB);
      if (userLPTokens < input.amount) {
        throw new Error('Tokens LP insuffisants');
      }

      // Créer la position
      const position = {
        positionId: this.generatePositionId(),
        userId: input.userId,
        poolId: input.poolId,
        stakedAmount: input.amount,
        stakedAt: new Date(),
        lockupPeriod: input.lockupPeriod || pool.lockupPeriod,
        rewardsAccrued: 0,
        rewardsClaimed: 0,
        lastClaimDate: new Date(),
        isActive: true
      };

      // Mettre à jour les positions utilisateur
      const userPositions = this.userPositions.get(input.userId) || [];
      userPositions.push(position);
      this.userPositions.set(input.userId, userPositions);

      // Mettre à jour le pool
      pool.totalStaked += input.amount;
      pool.participants += 1;

      // Transférer les tokens au contrat de staking
      const stakingTxHash = await this.executeStaking(input.userId, input.poolId, input.amount);

      // Notification
      await this.notificationService.createNotification({
        userId: input.userId,
        type: 'defi',
        category: 'staking',
        title: 'Tokens stakés dans le yield farming',
        message: `${input.amount} LP tokens stakés dans ${pool.name} pour ${pool.apy}% APY`,
        metadata: {
          poolId: input.poolId,
          poolName: pool.name,
          stakedAmount: input.amount,
          expectedApy: pool.apy,
          lockupPeriod: position.lockupPeriod,
          stakingTxHash,
          actionUrl: `/defi/yield-farming/${input.poolId}`
        }
      });
    } catch (error) {
      throw new Error(`Erreur lors du staking: ${error.message}`);
    }
  }

  async claimYieldFarmingRewards(userId: string, poolId: string): Promise<number> {
    try {
      const userPositions = this.userPositions.get(userId) || [];
      const position = userPositions.find(p => p.poolId === poolId && p.isActive);

      if (!position) throw new Error('Position non trouvée');

      const pool = this.yieldFarmingPools.get(poolId);
      if (!pool) throw new Error('Pool non trouvé');

      // Calculer les rewards
      const rewards = this.calculateYieldFarmingRewards(position, pool);

      if (rewards > 0) {
        position.rewardsAccrued += rewards;
        position.rewardsClaimed += position.rewardsAccrued;
        position.rewardsAccrued = 0;
        position.lastClaimDate = new Date();

        // Exécuter le claim sur la blockchain
        const claimTxHash = await this.executeRewardClaim(userId, poolId, rewards);

        // Notification
        await this.notificationService.createNotification({
          userId,
          type: 'defi',
          category: 'reward',
          title: 'Récompenses réclamées',
          message: `${rewards.toFixed(4)} ${pool.rewardToken} réclamés du yield farming`,
          metadata: {
            poolId,
            rewardsAmount: rewards,
            rewardToken: pool.rewardToken,
            claimTxHash,
            actionUrl: `/defi/yield-farming/${poolId}`
          }
        });
      }

      return rewards;
    } catch (error) {
      throw new Error(`Erreur lors de la réclamation: ${error.message}`);
    }
  }

  async createLendingPool(
    asset: string,
    collateralFactor: number,
    liquidationThreshold: number
  ): Promise<string> {
    try {
      const poolId = this.generatePoolId();

      const pool: LendingPool = {
        poolId,
        asset,
        totalSupply: 0,
        totalBorrow: 0,
        supplyRate: 5.0, // 5% APY pour les dépôts
        borrowRate: 8.0, // 8% APY pour les emprunts
        collateralFactor,
        liquidationThreshold,
        utilizationRate: 0,
        isActive: true
      };

      this.lendingPools.set(poolId, pool);

      // Déployer le smart contract de lending
      const contractAddress = await this.deployLendingContract(pool);

      return poolId;
    } catch (error) {
      throw new Error(`Erreur lors de la création du pool de prêt: ${error.message}`);
    }
  }

  async supplyToLendingPool(input: LendingInput): Promise<void> {
    try {
      if (input.action !== 'supply') throw new Error('Action invalide');

      const pool = this.lendingPools.get(input.poolId);
      if (!pool || !pool.isActive) throw new Error('Pool non trouvé ou inactif');

      // Vérifier le solde utilisateur
      const userBalance = await this.getUserTokenBalance(input.userId, pool.asset);
      if (userBalance < input.amount) {
        throw new Error('Solde insuffisant');
      }

      // Créer la position de supply
      const position = {
        positionId: this.generatePositionId(),
        userId: input.userId,
        poolId: input.poolId,
        type: 'supply',
        amount: input.amount,
        asset: pool.asset,
        interestRate: pool.supplyRate,
        createdAt: new Date(),
        lastUpdate: new Date(),
        interestAccrued: 0,
        isActive: true
      };

      // Mettre à jour les positions utilisateur
      const userPositions = this.userPositions.get(input.userId) || [];
      userPositions.push(position);
      this.userPositions.set(input.userId, userPositions);

      // Mettre à jour le pool
      pool.totalSupply += input.amount;
      pool.utilizationRate = pool.totalSupply > 0 ? (pool.totalBorrow / pool.totalSupply) * 100 : 0;

      // Exécuter le dépôt
      const supplyTxHash = await this.executeSupply(input.userId, input.poolId, input.amount);

      // Notification
      await this.notificationService.createNotification({
        userId: input.userId,
        type: 'defi',
        category: 'lending',
        title: 'Dépôt effectué',
        message: `${input.amount} ${pool.asset} déposés avec ${pool.supplyRate}% APY`,
        metadata: {
          poolId: input.poolId,
          asset: pool.asset,
          amount: input.amount,
          supplyRate: pool.supplyRate,
          supplyTxHash,
          actionUrl: `/defi/lending/${input.poolId}`
        }
      });
    } catch (error) {
      throw new Error(`Erreur lors du dépôt: ${error.message}`);
    }
  }

  async borrowFromLendingPool(input: LendingInput): Promise<void> {
    try {
      if (input.action !== 'borrow') throw new Error('Action invalide');
      if (!input.collateralTokenId || !input.collateralAmount) {
        throw new Error('Collatéral requis pour l\'emprunt');
      }

      const pool = this.lendingPools.get(input.poolId);
      if (!pool || !pool.isActive) throw new Error('Pool non trouvé ou inactif');

      // Vérifier la liquidité disponible
      const availableLiquidity = pool.totalSupply - pool.totalBorrow;
      if (availableLiquidity < input.amount) {
        throw new Error('Liquidité insuffisante dans le pool');
      }

      // Vérifier le collatéral
      const collateralValue = await this.getTokenValue(input.collateralTokenId, input.collateralAmount);
      const borrowValue = await this.getTokenValue(pool.asset, input.amount);
      const requiredCollateral = borrowValue / pool.collateralFactor;

      if (collateralValue < requiredCollateral) {
        throw new Error(`Collatéral insuffisant. Requis: ${requiredCollateral}`);
      }

      // Créer la position d'emprunt
      const position = {
        positionId: this.generatePositionId(),
        userId: input.userId,
        poolId: input.poolId,
        type: 'borrow',
        amount: input.amount,
        asset: pool.asset,
        collateralTokenId: input.collateralTokenId,
        collateralAmount: input.collateralAmount,
        collateralValue,
        interestRate: pool.borrowRate,
        liquidationPrice: collateralValue * pool.liquidationThreshold,
        createdAt: new Date(),
        lastUpdate: new Date(),
        interestAccrued: 0,
        isActive: true,
        healthFactor: this.calculateHealthFactor(collateralValue, borrowValue, pool.liquidationThreshold)
      };

      // Mettre à jour les positions utilisateur
      const userPositions = this.userPositions.get(input.userId) || [];
      userPositions.push(position);
      this.userPositions.set(input.userId, userPositions);

      // Mettre à jour le pool
      pool.totalBorrow += input.amount;
      pool.utilizationRate = pool.totalSupply > 0 ? (pool.totalBorrow / pool.totalSupply) * 100 : 0;

      // Exécuter l'emprunt
      const borrowTxHash = await this.executeBorrow(input.userId, input.poolId, input.amount, input.collateralAmount);

      // Notification
      await this.notificationService.createNotification({
        userId: input.userId,
        type: 'defi',
        category: 'lending',
        title: 'Emprunt effectué',
        message: `${input.amount} ${pool.asset} empruntés à ${pool.borrowRate}% APY`,
        priority: 'high',
        metadata: {
          poolId: input.poolId,
          asset: pool.asset,
          borrowAmount: input.amount,
          collateralAmount: input.collateralAmount,
          borrowRate: pool.borrowRate,
          healthFactor: position.healthFactor,
          borrowTxHash,
          actionUrl: `/defi/lending/${input.poolId}/position/${position.positionId}`
        }
      });

      // Programmer des alertes de health factor
      this.scheduleHealthFactorAlerts(input.userId, position);

    } catch (error) {
      throw new Error(`Erreur lors de l'emprunt: ${error.message}`);
    }
  }

  async repayLoan(userId: string, positionId: string, amount: number): Promise<void> {
    try {
      // Trouver la position d'emprunt
      const userPositions = this.userPositions.get(userId) || [];
      const position = userPositions.find(p => p.positionId === positionId && p.type === 'borrow' && p.isActive);

      if (!position) {
        throw new Error('Position d\'emprunt non trouvée ou déjà remboursée');
      }

      const pool = this.lendingPools.get(position.poolId);
      if (!pool) throw new Error('Pool non trouvé');

      // Calculer le montant total à rembourser (capital + intérêts)
      const interestAccrued = this.calculateBorrowInterest(position, pool);
      position.interestAccrued = interestAccrued;
      const totalDebt = position.amount + interestAccrued;

      if (amount > totalDebt) {
        throw new Error(`Montant de remboursement trop élevé. Dette totale: ${totalDebt}`);
      }

      // Vérifier le solde utilisateur
      const userBalance = await this.getUserTokenBalance(userId, pool.asset);
      if (userBalance < amount) {
        throw new Error('Solde insuffisant pour le remboursement');
      }

      // Calculer le montant restant après remboursement
      const remainingDebt = totalDebt - amount;

      if (remainingDebt === 0) {
        // Remboursement complet - libérer le collatéral
        position.isActive = false;
        position.repaidAt = new Date();

        // Mettre à jour le pool
        pool.totalBorrow -= position.amount;
        pool.utilizationRate = pool.totalSupply > 0 ? (pool.totalBorrow / pool.totalSupply) * 100 : 0;

        // Exécuter le remboursement et la libération du collatéral
        const repayTxHash = await this.executeRepayment(userId, position.poolId, amount);
        const releaseCollateralTxHash = await this.releaseCollateral(
          userId,
          position.collateralTokenId,
          position.collateralAmount
        );

        // Notification de remboursement complet
        await this.notificationService.createNotification({
          userId,
          type: 'defi',
          category: 'lending',
          title: 'Prêt remboursé intégralement',
          message: `Votre prêt de ${position.amount} ${pool.asset} a été remboursé. Collatéral libéré.`,
          priority: 'high',
          metadata: {
            poolId: position.poolId,
            positionId,
            amountRepaid: amount,
            totalInterest: interestAccrued,
            collateralReleased: position.collateralAmount,
            repayTxHash,
            releaseCollateralTxHash,
            actionUrl: `/defi/lending/${position.poolId}`
          }
        });

      } else {
        // Remboursement partiel
        const principalRepaid = amount - interestAccrued;
        position.amount = Math.max(0, position.amount - principalRepaid);
        position.interestAccrued = Math.max(0, interestAccrued - (amount - principalRepaid));
        position.lastUpdate = new Date();

        // Recalculer le health factor
        const borrowValue = await this.getTokenValue(pool.asset, position.amount + position.interestAccrued);
        position.healthFactor = this.calculateHealthFactor(
          position.collateralValue,
          borrowValue,
          pool.liquidationThreshold
        );

        // Mettre à jour le pool
        pool.totalBorrow -= principalRepaid;
        pool.utilizationRate = pool.totalSupply > 0 ? (pool.totalBorrow / pool.totalSupply) * 100 : 0;

        // Exécuter le remboursement partiel
        const repayTxHash = await this.executeRepayment(userId, position.poolId, amount);

        // Notification de remboursement partiel
        await this.notificationService.createNotification({
          userId,
          type: 'defi',
          category: 'lending',
          title: 'Remboursement partiel effectué',
          message: `${amount} ${pool.asset} remboursés. Dette restante: ${remainingDebt.toFixed(4)} ${pool.asset}`,
          metadata: {
            poolId: position.poolId,
            positionId,
            amountRepaid: amount,
            remainingDebt,
            newHealthFactor: position.healthFactor,
            repayTxHash,
            actionUrl: `/defi/lending/${position.poolId}/position/${positionId}`
          }
        });
      }

    } catch (error) {
      throw new Error(`Erreur lors du remboursement: ${error.message}`);
    }
  }

  async liquidatePosition(liquidatorId: string, positionId: string): Promise<void> {
    try {
      // Trouver la position à liquider
      let targetPosition = null;
      let positionOwnerId = null;

      for (const [userId, positions] of this.userPositions.entries()) {
        const position = positions.find(p => p.positionId === positionId && p.type === 'borrow');
        if (position) {
          targetPosition = position;
          positionOwnerId = userId;
          break;
        }
      }

      if (!targetPosition || !positionOwnerId) {
        throw new Error('Position non trouvée');
      }

      // Vérifier si la position peut être liquidée
      const currentHealthFactor = await this.calculateCurrentHealthFactor(targetPosition);
      if (currentHealthFactor >= 1.0) {
        throw new Error('Position non liquidable (health factor >= 1.0)');
      }

      const pool = this.lendingPools.get(targetPosition.poolId);
      if (!pool) throw new Error('Pool non trouvé');

      // Calculer les montants de liquidation
      const liquidationBonus = 0.1; // 10% bonus pour le liquidateur
      const debtAmount = targetPosition.amount + targetPosition.interestAccrued;
      const collateralToSeize = debtAmount * (1 + liquidationBonus);

      // Exécuter la liquidation
      const liquidationTxHash = await this.executeLiquidation(
        liquidatorId,
        targetPosition.positionId,
        debtAmount,
        collateralToSeize
      );

      // Marquer la position comme liquidée
      targetPosition.isActive = false;
      targetPosition.liquidatedAt = new Date();
      targetPosition.liquidator = liquidatorId;

      // Mettre à jour le pool
      pool.totalBorrow -= targetPosition.amount;

      // Notifications
      await Promise.all([
        // Notification au propriétaire de la position liquidée
        this.notificationService.createNotification({
          userId: positionOwnerId,
          type: 'defi',
          category: 'liquidation',
          title: 'Position liquidée',
          message: `Votre position d'emprunt a été liquidée en raison d'un health factor insuffisant`,
          priority: 'critical',
          metadata: {
            positionId,
            liquidatedAmount: debtAmount,
            collateralSeized: collateralToSeize,
            liquidator: liquidatorId,
            liquidationTxHash,
            actionUrl: `/defi/lending/liquidations/${positionId}`
          }
        }),
        // Notification au liquidateur
        this.notificationService.createNotification({
          userId: liquidatorId,
          type: 'defi',
          category: 'liquidation',
          title: 'Liquidation réussie',
          message: `Position liquidée avec succès. Bonus: ${(collateralToSeize - debtAmount).toFixed(4)} tokens`,
          metadata: {
            positionId,
            liquidatedAmount: debtAmount,
            bonus: collateralToSeize - debtAmount,
            liquidationTxHash,
            actionUrl: `/defi/lending/liquidations/${positionId}`
          }
        })
      ]);

    } catch (error) {
      throw new Error(`Erreur lors de la liquidation: ${error.message}`);
    }
  }

  async getYieldFarmingPools(): Promise<YieldFarmingPool[]> {
    return Array.from(this.yieldFarmingPools.values())
      .filter(pool => pool.isActive)
      .sort((a, b) => b.apy - a.apy);
  }

  async getLendingPools(): Promise<LendingPool[]> {
    return Array.from(this.lendingPools.values())
      .filter(pool => pool.isActive)
      .sort((a, b) => b.supplyRate - a.supplyRate);
  }

  async getUserDeFiPositions(userId: string): Promise<any> {
    const positions = this.userPositions.get(userId) || [];

    const yieldFarming = positions.filter(p => this.yieldFarmingPools.has(p.poolId));
    const lending = positions.filter(p => this.lendingPools.has(p.poolId));

    let totalValue = 0;
    let totalRewards = 0;

    for (const position of positions) {
      if (position.type === 'supply' || position.type === 'borrow') {
        const tokenValue = await this.getTokenValue(position.asset, position.amount);
        totalValue += tokenValue;
      }
      if (position.rewardsAccrued) {
        totalRewards += position.rewardsAccrued;
      }
    }

    return {
      totalValue,
      totalRewards,
      positionsCount: positions.length,
      yieldFarming: yieldFarming.length,
      lending: lending.length,
      positions: positions.map(position => ({
        ...position,
        currentValue: this.calculatePositionValue(position)
      }))
    };
  }

  private initializeDeFiPools(): void {
    // Initialiser quelques pools par défaut
    this.createYieldFarmingPool('EASYRENT', 'USDT', 'EASYRENT', 25.0);
    this.createYieldFarmingPool('ETH', 'USDC', 'EASYRENT', 15.0);

    this.createLendingPool('USDT', 0.8, 0.85);
    this.createLendingPool('ETH', 0.75, 0.8);
  }

  private generatePoolId(): string {
    return `POOL_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generatePositionId(): string {
    return `POS_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private calculateYieldFarmingRewards(position: any, pool: YieldFarmingPool): number {
    const now = new Date();
    const daysSinceLastClaim = (now.getTime() - position.lastClaimDate.getTime()) / (1000 * 60 * 60 * 24);
    const dailyReward = (position.stakedAmount / pool.totalStaked) * pool.rewardRate;
    return dailyReward * daysSinceLastClaim;
  }

  private calculateHealthFactor(collateralValue: number, borrowValue: number, liquidationThreshold: number): number {
    return (collateralValue * liquidationThreshold) / borrowValue;
  }

  private async calculateCurrentHealthFactor(position: any): Promise<number> {
    const currentCollateralValue = await this.getTokenValue(position.collateralTokenId, position.collateralAmount);
    const currentBorrowValue = await this.getTokenValue(position.asset, position.amount + position.interestAccrued);
    const pool = this.lendingPools.get(position.poolId);
    return this.calculateHealthFactor(currentCollateralValue, currentBorrowValue, pool?.liquidationThreshold || 0.8);
  }

  private calculatePositionValue(position: any): number {
    // Calcul simplifié de la valeur de position
    return position.amount * 100; // Simulation
  }

  private async getUserLPTokens(userId: string, tokenA: string, tokenB: string): Promise<number> {
    // Simulation - en production, cela interrogerait les contrats LP
    return 1000;
  }

  private async getUserTokenBalance(userId: string, asset: string): Promise<number> {
    // Simulation - en production, cela interrogerait les wallets/contrats
    return 10000;
  }

  private async getTokenValue(tokenId: string, amount: number): Promise<number> {
    // Simulation - en production, utiliserait les oracles de prix
    const price = await this.priceOracle.getPrice(tokenId);
    return amount * price;
  }

  private async scheduleHealthFactorAlerts(userId: string, position: any): Promise<void> {
    // Programmer des alertes périodiques pour surveiller le health factor
    // En production, cela serait un job cron ou un worker background
  }

  private async deployYieldFarmingContract(pool: YieldFarmingPool): Promise<string> {
    return `0x${Math.random().toString(16).substr(2, 40)}`;
  }

  private async deployLendingContract(pool: LendingPool): Promise<string> {
    return `0x${Math.random().toString(16).substr(2, 40)}`;
  }

  private async executeStaking(userId: string, poolId: string, amount: number): Promise<string> {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private async executeRewardClaim(userId: string, poolId: string, rewards: number): Promise<string> {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private async executeSupply(userId: string, poolId: string, amount: number): Promise<string> {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private async executeBorrow(userId: string, poolId: string, amount: number, collateralAmount: number): Promise<string> {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private async executeLiquidation(liquidatorId: string, positionId: string, debtAmount: number, collateralToSeize: number): Promise<string> {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private calculateBorrowInterest(position: any, pool: LendingPool): number {
    const now = new Date();
    const daysSinceBorrow = (now.getTime() - position.lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    const annualInterest = (position.amount * pool.borrowRate) / 100;
    const dailyInterest = annualInterest / 365;
    return dailyInterest * daysSinceBorrow;
  }

  private async executeRepayment(userId: string, poolId: string, amount: number): Promise<string> {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private async releaseCollateral(userId: string, collateralTokenId: string, collateralAmount: number): Promise<string> {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }
}