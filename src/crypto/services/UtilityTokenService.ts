import { UtilityToken, IUtilityToken } from '../models/UtilityToken';
import { SmartContractService, CreateSmartContractInput } from './SmartContractService';
import { UnifiedNotificationService } from '../../notification';
import { PriceOracleService } from './PriceOracleService';

export interface CreateUtilityTokenInput {
  name: string;
  symbol: string;
  totalSupply: number;
  initialPrice: number;
  blockchain: 'ethereum' | 'polygon' | 'bsc';
  distribution: {
    ecosystem: number;
    team: number;
    investors: number;
    platform: number;
    users: number;
  };
}

export interface StakeTokensInput {
  userId: string;
  tokenId: string;
  amount: number;
  lockupPeriod: number; // en jours
}

export interface CreateProposalInput {
  proposerId: string;
  tokenId: string;
  title: string;
  description: string;
  proposalType: 'parameter_change' | 'feature_request' | 'treasury_allocation' | 'partnership';
  votingPeriod?: number; // en jours
  status?: 'active' | 'passed' | 'failed' | 'executed';
}

export class UtilityTokenService {
  private contractService: SmartContractService;
  private notificationService: NotificationService;
  private priceOracle: PriceOracleService;

  constructor() {
    this.contractService = new SmartContractService();
    this.notificationService = new NotificationService();
    this.priceOracle = new PriceOracleService();
  }

  async createUtilityToken(input: CreateUtilityTokenInput): Promise<IUtilityToken> {
    try {
      const tokenId = this.generateTokenId();

      // Valider que la distribution totalise 100%
      const totalDistribution = Object.values(input.distribution).reduce((sum, val) => sum + val, 0);
      if (totalDistribution !== 100) {
        throw new Error('La distribution doit totaliser 100%');
      }

      const utilityToken = new UtilityToken({
        tokenId,
        name: input.name,
        symbol: input.symbol,
        blockchain: input.blockchain,
        decimals: 18,
        totalSupply: input.totalSupply,
        circulatingSupply: 0,

        tokenomics: {
          initialPrice: input.initialPrice,
          currentPrice: input.initialPrice,
          priceHistory: [{
            date: new Date(),
            price: input.initialPrice,
            volume: 0
          }],
          distribution: input.distribution,
          vestingSchedules: this.generateVestingSchedules(input.totalSupply, input.distribution)
        },

        utilities: {
          feeDiscounts: {
            enabled: true,
            tiers: [
              { minTokens: 1000, discountPercentage: 5, description: 'Bronze: 5% de réduction' },
              { minTokens: 5000, discountPercentage: 10, description: 'Silver: 10% de réduction' },
              { minTokens: 10000, discountPercentage: 15, description: 'Gold: 15% de réduction' },
              { minTokens: 50000, discountPercentage: 25, description: 'Platinum: 25% de réduction' }
            ]
          },

          priorityAccess: {
            enabled: true,
            minTokensRequired: 2500,
            benefits: [
              'Accès prioritaire aux nouvelles propriétés',
              'Support client premium',
              'Invitations aux événements exclusifs'
            ]
          },

          staking: {
            enabled: true,
            apy: 12, // 12% APY
            minStakeAmount: 100,
            lockupPeriods: [
              { duration: 30, multiplier: 1.0 },
              { duration: 90, multiplier: 1.2 },
              { duration: 180, multiplier: 1.5 },
              { duration: 365, multiplier: 2.0 }
            ]
          },

          governance: {
            enabled: true,
            minTokensForProposal: 10000,
            votingPower: 'linear',
            proposalDuration: 7
          },

          cashback: {
            enabled: true,
            rate: 2, // 2% cashback
            maxCashbackPerTransaction: 100,
            applicableServices: ['rental_fees', 'transaction_fees', 'premium_services']
          }
        },

        userBalances: [],
        transactions: [],

        platform: {
          acceptedServices: [
            { serviceType: 'rental', discountRate: 15, acceptanceRate: 50 },
            { serviceType: 'purchase', discountRate: 10, acceptanceRate: 25 },
            { serviceType: 'marketplace', discountRate: 20, acceptanceRate: 100 },
            { serviceType: 'premium_features', discountRate: 30, acceptanceRate: 100 }
          ],
          usage: {
            totalTransactions: 0,
            totalVolume: 0,
            activeUsers: 0,
            averageHoldingTime: 0,
            utilityUsage: {
              staking: 0,
              feePayments: 0,
              governance: 0,
              cashback: 0
            }
          }
        },

        economics: {
          burnMechanisms: {
            transactionBurn: {
              enabled: true,
              burnRate: 0.5 // 0.5% de chaque transaction
            },
            periodicBurn: {
              enabled: true,
              frequency: 'quarterly',
              burnAmount: input.totalSupply * 0.01, // 1% du supply total
              nextBurn: this.calculateNextBurn('quarterly')
            }
          },
          revenueStreams: {
            platformFees: 0,
            premiumSubscriptions: 0,
            transactionFees: 0,
            stakingFees: 0
          },
          buyback: {
            enabled: true,
            frequency: 'monthly',
            percentage: 10, // 10% des revenus
            lastBuyback: new Date(),
            nextBuyback: this.calculateNextBuyback(),
            totalBoughtBack: 0
          }
        },

        liquidity: {
          dexListings: [],
          liquidityMining: {
            enabled: false,
            pools: []
          }
        },

        status: 'development',
        launchDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 jours
      });

      await utilityToken.save();

      // Déployer le smart contract
      const contractAddress = await this.deployUtilityTokenContract(utilityToken);
      utilityToken.contractAddress = contractAddress;
      utilityToken.status = 'testnet';

      await utilityToken.save();

      return utilityToken;
    } catch (error) {
      throw new Error(`Erreur lors de la création du utility token: ${error.message}`);
    }
  }

  async mintTokens(tokenId: string, recipient: string, amount: number, reason: string): Promise<void> {
    try {
      const token = await UtilityToken.findOne({ tokenId });
      if (!token) throw new Error('Token non trouvé');

      // Vérifier les limites de mint
      if (token.circulatingSupply + amount > token.totalSupply) {
        throw new Error('Dépassement du supply total');
      }

      // Mettre à jour le balance utilisateur
      let userBalance = token.userBalances.find(balance => balance.userId === recipient);
      if (!userBalance) {
        token.userBalances.push({
          userId: recipient,
          balance: amount,
          stakedBalance: 0,
          lockedBalance: 0,
          lastUpdate: new Date(),
          stakingInfo: []
        });
      } else {
        userBalance.balance += amount;
        userBalance.lastUpdate = new Date();
      }

      // Mettre à jour le supply
      token.circulatingSupply += amount;

      // Ajouter la transaction
      const transactionId = this.generateTransactionId();
      token.transactions.push({
        transactionId,
        type: 'mint',
        from: 'system',
        to: recipient,
        amount,
        reason,
        transactionHash: await this.generateTransactionHash(),
        blockNumber: Math.floor(Math.random() * 1000000),
        timestamp: new Date()
      });

      await token.save();

      // Notification
      await this.notificationService.createNotification({
        userId: recipient,
        type: 'wallet',
        category: 'reward',
        title: 'Tokens reçus',
        message: `Vous avez reçu ${amount} ${token.symbol} tokens`,
        metadata: {
          tokenId,
          amount,
          reason,
          transactionId,
          actionUrl: `/crypto/utility-tokens/${tokenId}`
        }
      });
    } catch (error) {
      throw new Error(`Erreur lors du mint de tokens: ${error.message}`);
    }
  }

  async stakeTokens(input: StakeTokensInput): Promise<void> {
    try {
      const token = await UtilityToken.findOne({ tokenId: input.tokenId });
      if (!token) throw new Error('Token non trouvé');
      if (!token.utilities.staking.enabled) throw new Error('Staking non activé');

      const userBalance = token.userBalances.find(balance => balance.userId === input.userId);
      if (!userBalance || userBalance.balance < input.amount) {
        throw new Error('Solde insuffisant');
      }

      if (input.amount < token.utilities.staking.minStakeAmount) {
        throw new Error(`Montant minimum de staking: ${token.utilities.staking.minStakeAmount}`);
      }

      // Trouver le multiplicateur pour la période de lockup
      const lockupConfig = token.utilities.staking.lockupPeriods.find(
        period => period.duration === input.lockupPeriod
      );
      if (!lockupConfig) throw new Error('Période de lockup invalide');

      // Transférer des tokens disponibles vers staked
      userBalance.balance -= input.amount;
      userBalance.stakedBalance += input.amount;

      // Ajouter les informations de staking
      userBalance.stakingInfo = userBalance.stakingInfo || [];
      userBalance.stakingInfo.push({
        amount: input.amount,
        startDate: new Date(),
        lockupPeriod: input.lockupPeriod,
        rewardsAccrued: 0,
        rewardsClaimed: 0,
        lastClaimDate: new Date()
      });

      // Ajouter la transaction
      const transactionId = this.generateTransactionId();
      token.transactions.push({
        transactionId,
        type: 'stake',
        from: input.userId,
        to: 'staking_pool',
        amount: input.amount,
        reason: `Staking for ${input.lockupPeriod} days`,
        transactionHash: await this.generateTransactionHash(),
        blockNumber: Math.floor(Math.random() * 1000000),
        timestamp: new Date()
      });

      // Mettre à jour les métriques
      token.platform.usage.utilityUsage.staking += input.amount;

      await token.save();

      // Notification
      await this.notificationService.createNotification({
        userId: input.userId,
        type: 'wallet',
        category: 'staking',
        title: 'Tokens stakés',
        message: `${input.amount} ${token.symbol} stakés pour ${input.lockupPeriod} jours`,
        metadata: {
          tokenId: input.tokenId,
          stakedAmount: input.amount,
          lockupPeriod: input.lockupPeriod,
          expectedApy: token.utilities.staking.apy * lockupConfig.multiplier,
          actionUrl: `/crypto/utility-tokens/${input.tokenId}/staking`
        }
      });
    } catch (error) {
      throw new Error(`Erreur lors du staking: ${error.message}`);
    }
  }

  async claimStakingRewards(userId: string, tokenId: string): Promise<number> {
    try {
      const token = await UtilityToken.findOne({ tokenId });
      if (!token) throw new Error('Token non trouvé');

      const userBalance = token.userBalances.find(balance => balance.userId === userId);
      if (!userBalance || !userBalance.stakingInfo?.length) {
        throw new Error('Aucun staking trouvé');
      }

      let totalRewards = 0;

      for (const stakingInfo of userBalance.stakingInfo) {
        const rewards = this.calculateStakingRewards(token, stakingInfo);
        stakingInfo.rewardsAccrued += rewards;
        totalRewards += stakingInfo.rewardsAccrued;
        stakingInfo.rewardsClaimed += stakingInfo.rewardsAccrued;
        stakingInfo.rewardsAccrued = 0;
        stakingInfo.lastClaimDate = new Date();
      }

      if (totalRewards > 0) {
        // Ajouter les rewards au balance
        userBalance.balance += totalRewards;

        // Ajouter la transaction
        const transactionId = this.generateTransactionId();
        token.transactions.push({
          transactionId,
          type: 'reward',
          from: 'staking_pool',
          to: userId,
          amount: totalRewards,
          reason: 'Staking rewards',
          transactionHash: await this.generateTransactionHash(),
          blockNumber: Math.floor(Math.random() * 1000000),
          timestamp: new Date()
        });

        await token.save();

        // Notification
        await this.notificationService.createNotification({
          userId,
          type: 'wallet',
          category: 'reward',
          title: 'Récompenses de staking réclamées',
          message: `${totalRewards.toFixed(2)} ${token.symbol} de récompenses réclamées`,
          metadata: {
            tokenId,
            rewardsAmount: totalRewards,
            transactionId,
            actionUrl: `/crypto/utility-tokens/${tokenId}/staking`
          }
        });
      }

      return totalRewards;
    } catch (error) {
      throw new Error(`Erreur lors de la réclamation des rewards: ${error.message}`);
    }
  }

  async createGovernanceProposal(input: CreateProposalInput): Promise<string> {
    try {
      const token = await UtilityToken.findOne({ tokenId: input.tokenId });
      if (!token) throw new Error('Token non trouvé');
      if (!token.utilities.governance.enabled) throw new Error('Gouvernance non activée');

      const proposerBalance = token.userBalances.find(balance => balance.userId === input.proposerId);
      if (!proposerBalance || proposerBalance.balance < token.utilities.governance.minTokensForProposal) {
        throw new Error(`Tokens insuffisants pour créer une proposition (minimum: ${token.utilities.governance.minTokensForProposal})`);
      }

      const proposalId = this.generateProposalId();
      const votingPeriod = input.votingPeriod || token.utilities.governance.proposalDuration;

      const proposal = {
        proposalId,
        title: input.title,
        description: input.description,
        proposalType: input.proposalType,
        proposer: input.proposerId,
        createdAt: new Date(),
        votingStart: new Date(),
        votingEnd: new Date(Date.now() + votingPeriod * 24 * 60 * 60 * 1000),
        status: 'active' as 'active' | 'passed' | 'executed' | 'rejected',
        votes: {
          for: 0,
          against: 0,
          abstain: 0
        },
        voters: [],
        quorumReached: false,
        executed: false
      };

      token.utilities.governance.proposals = token.utilities.governance.proposals || [];
      token.utilities.governance.proposals.push(proposal);

      await token.save();

      // Notifier tous les holders
      const holders = token.userBalances.filter(balance => balance.balance > 0);
      for (const holder of holders) {
        await this.notificationService.createNotification({
          userId: holder.userId,
          type: 'governance',
          category: 'proposal',
          title: 'Nouvelle proposition de gouvernance',
          message: `"${input.title}" - Votez jusqu'au ${proposal.votingEnd.toLocaleDateString()}`,
          metadata: {
            tokenId: input.tokenId,
            proposalId,
            proposalType: input.proposalType,
            votingEnd: proposal.votingEnd.toISOString(),
            actionUrl: `/crypto/utility-tokens/${input.tokenId}/governance/${proposalId}`
          }
        });
      }

      return proposalId;
    } catch (error) {
      throw new Error(`Erreur lors de la création de la proposition: ${error.message}`);
    }
  }

  async voteOnProposal(
    userId: string,
    tokenId: string,
    proposalId: string,
    vote: 'for' | 'against' | 'abstain'
  ): Promise<void> {
    try {
      const token = await UtilityToken.findOne({ tokenId });
      if (!token) throw new Error('Token non trouvé');

      const proposal = token.utilities.governance.proposals?.find(p => p.proposalId === proposalId);
      if (!proposal) throw new Error('Proposition non trouvée');

      if (proposal.status !== 'active') throw new Error('Vote non actif');
      if (new Date() > proposal.votingEnd) throw new Error('Période de vote terminée');

      const userBalance = token.userBalances.find(balance => balance.userId === userId);
      if (!userBalance || userBalance.balance === 0) {
        throw new Error('Aucun token pour voter');
      }

      // Vérifier si l'utilisateur a déjà voté
      const existingVote = proposal.voters.find(voter => voter.userId === userId);
      if (existingVote) throw new Error('Vous avez déjà voté');

      // Calculer le pouvoir de vote
      let votingPower = userBalance.balance;
      if (token.utilities.governance.votingPower === 'quadratic') {
        votingPower = Math.sqrt(userBalance.balance);
      }

      // Enregistrer le vote
      proposal.voters.push({
        userId,
        vote,
        votingPower,
        timestamp: new Date()
      });

      // Mettre à jour les totaux
      proposal.votes[vote] += votingPower;

      // Vérifier le quorum
      const totalVotingPower = proposal.votes.for + proposal.votes.against + proposal.votes.abstain;
      const totalSupply = token.circulatingSupply;
      const quorumPercentage = (totalVotingPower / totalSupply) * 100;

      if (quorumPercentage >= token.utilities.governance.quorum) {
        proposal.quorumReached = true;
      }

      // Mettre à jour les métriques
      token.platform.usage.utilityUsage.governance += votingPower;

      await token.save();

      // Notification
      await this.notificationService.createNotification({
        userId,
        type: 'governance',
        category: 'vote',
        title: 'Vote enregistré',
        message: `Votre vote "${vote}" a été enregistré pour "${proposal.title}"`,
        metadata: {
          tokenId,
          proposalId,
          vote,
          votingPower,
          actionUrl: `/crypto/utility-tokens/${tokenId}/governance/${proposalId}`
        }
      });
    } catch (error) {
      throw new Error(`Erreur lors du vote: ${error.message}`);
    }
  }

  async getUtilityToken(tokenId: string): Promise<IUtilityToken | null> {
    try {
      const token = await UtilityToken.findOne({ tokenId });
      if (!token) throw new Error('Utility token non trouvé');
      return token;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération du utility token: ${error.message}`);
    }
  }

  async getTokenProposals(tokenId: string): Promise<any[]> {
    try {
      const token = await UtilityToken.findOne({ tokenId });
      if (!token) throw new Error('Token non trouvé');

      if (!token.utilities.governance.enabled) {
        throw new Error('Gouvernance non activée pour ce token');
      }

      return token.utilities.governance.proposals || [];
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des propositions: ${error.message}`);
    }
  }

  async getUserTokens(userId: string): Promise<any[]> {
    try {
      const tokens = await UtilityToken.find({
        'userBalances.userId': userId
      });

      return tokens.map(token => {
        const userBalance = token.userBalances.find(balance => balance.userId === userId);
        const stakingRewards = this.calculateTotalStakingRewards(token, userBalance?.stakingInfo || []);

        return {
          token: {
            tokenId: token.tokenId,
            name: token.name,
            symbol: token.symbol,
            currentPrice: token.tokenomics.currentPrice
          },
          balance: userBalance?.balance || 0,
          stakedBalance: userBalance?.stakedBalance || 0,
          pendingRewards: stakingRewards,
          totalValue: ((userBalance?.balance || 0) + (userBalance?.stakedBalance || 0)) * token.tokenomics.currentPrice
        };
      });
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des tokens: ${error.message}`);
    }
  }

  private generateTokenId(): string {
    return `UT_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateTransactionId(): string {
    return `TX_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateProposalId(): string {
    return `PROP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private async generateTransactionHash(): Promise<string> {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private generateVestingSchedules(totalSupply: number, distribution: any): any[] {
    return [
      {
        category: 'team',
        totalTokens: totalSupply * (distribution.team / 100),
        releasedTokens: 0,
        vestingPeriod: 48, // 4 ans
        cliffPeriod: 12, // 1 an
        nextRelease: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000),
        releaseAmount: totalSupply * (distribution.team / 100) / 48
      },
      {
        category: 'investors',
        totalTokens: totalSupply * (distribution.investors / 100),
        releasedTokens: 0,
        vestingPeriod: 24, // 2 ans
        cliffPeriod: 6, // 6 mois
        nextRelease: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000),
        releaseAmount: totalSupply * (distribution.investors / 100) / 24
      }
    ];
  }

  private calculateNextBurn(frequency: string): Date {
    const now = new Date();
    switch (frequency) {
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      case 'quarterly':
        const nextQuarter = Math.ceil((now.getMonth() + 1) / 3) * 3;
        return new Date(now.getFullYear(), nextQuarter, 1);
      default:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  private calculateNextBuyback(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  private async deployUtilityTokenContract(token: IUtilityToken): Promise<string> {
    // Simulation du déploiement de contrat
    const contractInput: CreateSmartContractInput = {
      contractType: 'utility_token',
      propertyId: 'utility',
      blockchain: token.blockchain as 'ethereum' | 'polygon' | 'bsc' | 'avalanche',
      parties: [{
        role: 'platform',
        userId: 'system',
        walletAddress: '0x0000000000000000000000000000000000000000'
      }],
      terms: {
        totalSupply: token.totalSupply,
        tokenSymbol: token.symbol,
        tokenName: token.name
      }
    };

    const contract = await this.contractService.createContract(contractInput);
    const deployed = await this.contractService.deployContract({ contractId: contract.contractId });

    return deployed.contractAddress!;
  }

  private calculateStakingRewards(token: IUtilityToken, stakingInfo: any): number {
    const now = new Date();
    const stakingDuration = (now.getTime() - stakingInfo.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const annualRewards = (stakingInfo.amount * token.utilities.staking.apy) / 100;
    const dailyRewards = annualRewards / 365;

    // Trouver le multiplicateur
    const lockupConfig = token.utilities.staking.lockupPeriods.find(
      period => period.duration === stakingInfo.lockupPeriod
    );
    const multiplier = lockupConfig?.multiplier || 1;

    return stakingDuration * dailyRewards * multiplier;
  }

  private calculateTotalStakingRewards(token: IUtilityToken, stakingInfos: any[]): number {
    return stakingInfos.reduce((total, stakingInfo) => {
      return total + this.calculateStakingRewards(token, stakingInfo);
    }, 0);
  }
}