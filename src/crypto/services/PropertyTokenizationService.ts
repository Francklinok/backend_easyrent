import { PropertyToken, IPropertyToken } from '../models/PropertyToken';
import { SmartContractService, CreateSmartContractInput } from './SmartContractService';
import { UnifiedNotificationService } from '../../notification';
import { PriceOracleService } from './PriceOracleService';

export interface TokenizePropertyInput {
  propertyId: string;
  propertyAddress: string;
  propertyValue: number;
  currency: string;
  totalTokens: number;
  tokenSymbol: string;
  tokenName: string;
  blockchain: 'ethereum' | 'polygon' | 'bsc';
  ownerId: string;
  minimumInvestment: number;
  expectedAnnualReturn: number;
  propertyType: 'residential' | 'commercial' | 'industrial' | 'land';
  legalDocuments: {
    type: string;
    url: string;
    hash: string;
  }[];
}

export interface BuyTokensInput {
  propertyTokenId: string;
  buyerId: string;
  tokensAmount: number;
  paymentMethod: 'crypto' | 'fiat' | 'hybrid';
  walletAddress?: string;
}

export interface SellTokensInput {
  propertyTokenId: string;
  sellerId: string;
  tokensAmount: number;
  pricePerToken?: number;
  orderType: 'market' | 'limit';
}

export class PropertyTokenizationService {
  private contractService: SmartContractService;
  private notificationService: NotificationService;
  private priceOracle: PriceOracleService;

  constructor() {
    this.contractService = new SmartContractService();
    this.notificationService = new NotificationService();
    this.priceOracle = new PriceOracleService();
  }

  async tokenizeProperty(input: TokenizePropertyInput): Promise<IPropertyToken> {
    try {
      const tokenId = this.generateTokenId();
      const tokenPrice = input.propertyValue / input.totalTokens;

      const propertyToken = new PropertyToken({
        tokenId,
        propertyId: input.propertyId,
        propertyDetails: {
          address: input.propertyAddress,
          propertyType: input.propertyType,
          totalValue: input.propertyValue,
          currency: input.currency,
          lastValuation: new Date()
        },

        tokenomics: {
          tokenSymbol: input.tokenSymbol,
          tokenName: input.tokenName,
          totalSupply: input.totalTokens,
          circulatingSupply: 0,
          tokenPrice,
          priceHistory: [{
            date: new Date(),
            price: tokenPrice,
            volume: 0,
            marketCap: input.propertyValue
          }],
          minimumInvestment: input.minimumInvestment
        },

        blockchain: {
          network: input.blockchain,
          contractAddress: '',
          tokenStandard: 'ERC-20',
          deploymentCost: this.calculateDeploymentCost(input.blockchain),
          gasOptimization: true
        },

        ownership: {
          totalOwners: 1,
          ownershipDistribution: [{
            ownerId: input.ownerId,
            tokensOwned: input.totalTokens,
            ownershipPercentage: 100,
            acquisitionDate: new Date(),
            averagePurchasePrice: tokenPrice,
            investmentAmount: input.propertyValue,
            kycStatus: 'verified',
            accreditedInvestor: true
          }]
        },

        revenueSharing: {
          enabled: true,
          distributionFrequency: 'monthly',
          nextDistribution: this.calculateNextDistribution(),
          totalRevenueDistributed: 0,
          distributionHistory: [],
          reservePercentage: 10,
          managementFee: 5,
          expectedAnnualReturn: input.expectedAnnualReturn
        },

        trading: {
          isTradeEnabled: false,
          dexListings: [],
          tradingVolume24h: 0,
          totalTradingVolume: 0,
          priceDiscovery: 'oracle_based',
          liquidityPool: {
            totalLiquidity: 0,
            providers: [],
            rewardRate: 0
          },
          orderBook: {
            buyOrders: [],
            sellOrders: [],
            lastTrade: null
          }
        },

        governance: {
          enabled: false,
          votingRights: 'proportional',
          quorum: 51,
          proposals: [],
          votingHistory: []
        },

        compliance: {
          isCompliant: true,
          jurisdiction: 'US',
          regulations: ['SEC_REG_D', 'KYC_AML'],
          auditTrail: [{
            action: 'tokenization',
            performedBy: input.ownerId,
            timestamp: new Date(),
            details: 'Property tokenized and initial tokens minted'
          }],
          kycRequirement: true,
          accreditedInvestorOnly: true
        },

        legal: {
          propertyDeed: input.legalDocuments.find(doc => doc.type === 'deed')?.url || '',
          operatingAgreement: '',
          prospectus: '',
          legalDocuments: input.legalDocuments,
          custodian: '',
          propertyManager: input.ownerId
        },

        status: 'tokenized',
        valueMetrics: {
          currentValuation: input.propertyValue,
          occupancyRate: 0,
          netOperatingIncome: 0,
          capRate: 0,
          appreciationRate: 0,
          totalReturn: 0,
          cashFlow: {
            monthly: 0,
            quarterly: 0,
            annual: 0
          }
        }
      });

      await propertyToken.save();

      // Déployer le smart contract pour le token
      const contractAddress = await this.deployTokenContract(propertyToken);
      propertyToken.blockchain.contractAddress = contractAddress;
      propertyToken.status = 'deployed';

      await propertyToken.save();

      // Notification au propriétaire
      await this.notificationService.createNotification({
        userId: input.ownerId,
        type: 'property',
        category: 'tokenization',
        title: 'Propriété tokenisée avec succès',
        message: `Votre propriété a été tokenisée avec ${input.totalTokens} tokens au prix de ${tokenPrice.toFixed(4)} ${input.currency} par token`,
        priority: 'high',
        metadata: {
          propertyTokenId: tokenId,
          totalTokens: input.totalTokens,
          tokenPrice,
          contractAddress,
          actionUrl: `/crypto/property-tokens/${tokenId}`
        }
      });

      return propertyToken;
    } catch (error) {
      throw new Error(`Erreur lors de la tokenisation: ${error.message}`);
    }
  }

  async buyTokens(input: BuyTokensInput): Promise<any> {
    try {
      const propertyToken = await PropertyToken.findOne({ tokenId: input.propertyTokenId });
      if (!propertyToken) throw new Error('Token de propriété non trouvé');

      const availableTokens = propertyToken.tokenomics.totalSupply - propertyToken.tokenomics.circulatingSupply;
      if (input.tokensAmount > availableTokens) {
        throw new Error('Tokens insuffisants disponibles');
      }

      const totalCost = input.tokensAmount * propertyToken.tokenomics.tokenPrice;
      const minimumInvestment = propertyToken.tokenomics.minimumInvestment;

      if (totalCost < minimumInvestment) {
        throw new Error(`Investissement minimum: ${minimumInvestment} ${propertyToken.propertyDetails.currency}`);
      }

      // Vérifier si l'acheteur existe déjà
      let ownerIndex = propertyToken.ownership.ownershipDistribution.findIndex(
        owner => owner.ownerId === input.buyerId
      );

      if (ownerIndex === -1) {
        // Nouveau propriétaire
        propertyToken.ownership.ownershipDistribution.push({
          ownerId: input.buyerId,
          tokensOwned: input.tokensAmount,
          ownershipPercentage: (input.tokensAmount / propertyToken.tokenomics.totalSupply) * 100,
          acquisitionDate: new Date(),
          averagePurchasePrice: propertyToken.tokenomics.tokenPrice,
          investmentAmount: totalCost,
          kycStatus: 'pending',
          accreditedInvestor: false
        });
        propertyToken.ownership.totalOwners += 1;
      } else {
        // Propriétaire existant
        const existingOwner = propertyToken.ownership.ownershipDistribution[ownerIndex];
        const newTotalTokens = existingOwner.tokensOwned + input.tokensAmount;
        const newTotalInvestment = existingOwner.investmentAmount + totalCost;

        existingOwner.tokensOwned = newTotalTokens;
        existingOwner.ownershipPercentage = (newTotalTokens / propertyToken.tokenomics.totalSupply) * 100;
        existingOwner.averagePurchasePrice = newTotalInvestment / newTotalTokens;
        existingOwner.investmentAmount = newTotalInvestment;
      }

      // Mettre à jour les métriques
      propertyToken.tokenomics.circulatingSupply += input.tokensAmount;

      // Ajouter à l'historique des prix
      propertyToken.tokenomics.priceHistory.push({
        date: new Date(),
        price: propertyToken.tokenomics.tokenPrice,
        volume: input.tokensAmount,
        marketCap: propertyToken.tokenomics.circulatingSupply * propertyToken.tokenomics.tokenPrice
      });

      // Audit trail
      propertyToken.compliance.auditTrail.push({
        action: 'token_purchase',
        performedBy: input.buyerId,
        timestamp: new Date(),
        details: `Purchased ${input.tokensAmount} tokens for ${totalCost} ${propertyToken.propertyDetails.currency}`
      });

      await propertyToken.save();

      // Exécuter la transaction blockchain
      const transactionHash = await this.executeTokenTransfer(
        propertyToken.blockchain.contractAddress,
        input.buyerId,
        input.tokensAmount,
        input.walletAddress
      );

      // Notifications
      await Promise.all([
        this.notificationService.createNotification({
          userId: input.buyerId,
          type: 'wallet',
          category: 'purchase',
          title: 'Tokens de propriété achetés',
          message: `Vous avez acheté ${input.tokensAmount} tokens de ${propertyToken.tokenomics.tokenName}`,
          priority: 'high',
          metadata: {
            propertyTokenId: input.propertyTokenId,
            tokensAmount: input.tokensAmount,
            totalCost,
            transactionHash,
            actionUrl: `/crypto/property-tokens/${input.propertyTokenId}`
          }
        }),
        this.notificationService.createNotification({
          userId: propertyToken.ownership.ownershipDistribution[0].ownerId,
          type: 'property',
          category: 'investment',
          title: 'Nouvel investissement reçu',
          message: `${input.tokensAmount} tokens ont été achetés pour votre propriété`,
          metadata: {
            propertyTokenId: input.propertyTokenId,
            investorId: input.buyerId,
            tokensAmount: input.tokensAmount,
            actionUrl: `/crypto/property-tokens/${input.propertyTokenId}`
          }
        })
      ]);

      return {
        success: true,
        transactionHash,
        tokensOwned: propertyToken.ownership.ownershipDistribution.find(
          owner => owner.ownerId === input.buyerId
        )?.tokensOwned,
        totalCost,
        newOwnershipPercentage: (input.tokensAmount / propertyToken.tokenomics.totalSupply) * 100
      };
    } catch (error) {
      throw new Error(`Erreur lors de l'achat de tokens: ${error.message}`);
    }
  }

  async sellTokens(input: SellTokensInput): Promise<any> {
    try {
      const propertyToken = await PropertyToken.findOne({ tokenId: input.propertyTokenId });
      if (!propertyToken) throw new Error('Token de propriété non trouvé');

      const sellerOwnership = propertyToken.ownership.ownershipDistribution.find(
        owner => owner.ownerId === input.sellerId
      );

      if (!sellerOwnership) throw new Error('Vous ne possédez pas de tokens de cette propriété');
      if (sellerOwnership.tokensOwned < input.tokensAmount) {
        throw new Error('Tokens insuffisants pour la vente');
      }

      const salePrice = input.pricePerToken || propertyToken.tokenomics.tokenPrice;
      const totalValue = input.tokensAmount * salePrice;

      // Créer l'ordre de vente
      const sellOrder = {
        orderId: this.generateOrderId(),
        sellerId: input.sellerId,
        tokensAmount: input.tokensAmount,
        pricePerToken: salePrice,
        totalValue,
        orderType: input.orderType,
        status: 'open',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
      };

      propertyToken.trading.orderBook.sellOrders.push(sellOrder);

      // Si c'est un ordre market, essayer de le matcher immédiatement
      if (input.orderType === 'market') {
        const matchResult = await this.matchMarketOrder(propertyToken, sellOrder);
        if (matchResult.matched) {
          return matchResult;
        }
      }

      await propertyToken.save();

      // Notification
      await this.notificationService.createNotification({
        userId: input.sellerId,
        type: 'wallet',
        category: 'transaction',
        title: 'Ordre de vente créé',
        message: `Ordre de vente créé pour ${input.tokensAmount} tokens à ${salePrice} par token`,
        metadata: {
          propertyTokenId: input.propertyTokenId,
          orderId: sellOrder.orderId,
          tokensAmount: input.tokensAmount,
          pricePerToken: salePrice,
          actionUrl: `/crypto/property-tokens/${input.propertyTokenId}`
        }
      });

      return {
        success: true,
        orderId: sellOrder.orderId,
        orderType: input.orderType,
        status: 'open'
      };
    } catch (error) {
      throw new Error(`Erreur lors de la vente de tokens: ${error.message}`);
    }
  }

  async distributeRevenue(propertyTokenId: string, totalRevenue: number, period: string): Promise<void> {
    try {
      const propertyToken = await PropertyToken.findOne({ tokenId: propertyTokenId });
      if (!propertyToken) throw new Error('Token de propriété non trouvé');

      const managementFee = (totalRevenue * propertyToken.revenueSharing.managementFee) / 100;
      const reserveAmount = (totalRevenue * propertyToken.revenueSharing.reservePercentage) / 100;
      const distributableRevenue = totalRevenue - managementFee - reserveAmount;

      const distributions = [];

      for (const owner of propertyToken.ownership.ownershipDistribution) {
        const ownerShare = (owner.ownershipPercentage / 100) * distributableRevenue;

        distributions.push({
          ownerId: owner.ownerId,
          amount: ownerShare,
          tokensOwned: owner.tokensOwned,
          ownershipPercentage: owner.ownershipPercentage,
          distributionDate: new Date(),
          period,
          transactionHash: await this.executeRevenuePayment(owner.ownerId, ownerShare)
        });

        // Notification à chaque propriétaire
        await this.notificationService.createNotification({
          userId: owner.ownerId,
          type: 'wallet',
          category: 'payment',
          title: 'Revenus distribués',
          message: `Vous avez reçu ${ownerShare.toFixed(2)} ${propertyToken.propertyDetails.currency} de revenus`,
          priority: 'high',
          metadata: {
            propertyTokenId,
            amount: ownerShare,
            period,
            ownershipPercentage: owner.ownershipPercentage,
            actionUrl: `/crypto/property-tokens/${propertyTokenId}`
          }
        });
      }

      // Mettre à jour l'historique
      propertyToken.revenueSharing.distributionHistory.push({
        period,
        totalRevenue,
        distributableAmount: distributableRevenue,
        managementFee,
        reserveAmount,
        distributionDate: new Date(),
        distributions
      });

      propertyToken.revenueSharing.totalRevenueDistributed += distributableRevenue;
      propertyToken.revenueSharing.nextDistribution = this.calculateNextDistribution();

      await propertyToken.save();
    } catch (error) {
      throw new Error(`Erreur lors de la distribution des revenus: ${error.message}`);
    }
  }

  async getPropertyTokens(filters?: any): Promise<IPropertyToken[]> {
    try {
      const query: any = {};

      if (filters?.propertyType) query['propertyDetails.propertyType'] = filters.propertyType;
      if (filters?.blockchain) query['blockchain.network'] = filters.blockchain;
      if (filters?.status) query.status = filters.status;
      if (filters?.minPrice && filters?.maxPrice) {
        query['tokenomics.tokenPrice'] = {
          $gte: filters.minPrice,
          $lte: filters.maxPrice
        };
      }

      return await PropertyToken.find(query)
        .sort({ createdAt: -1 })
        .limit(filters?.limit || 50);
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des tokens: ${error.message}`);
    }
  }

  async getUserTokens(userId: string): Promise<any[]> {
    try {
      const userTokens = await PropertyToken.find({
        'ownership.ownershipDistribution.ownerId': userId
      });

      return userTokens.map(token => {
        const ownership = token.ownership.ownershipDistribution.find(
          owner => owner.ownerId === userId
        );

        return {
          propertyToken: token,
          tokensOwned: ownership?.tokensOwned || 0,
          ownershipPercentage: ownership?.ownershipPercentage || 0,
          investmentAmount: ownership?.investmentAmount || 0,
          currentValue: (ownership?.tokensOwned || 0) * token.tokenomics.tokenPrice,
          unrealizedGains: ((ownership?.tokensOwned || 0) * token.tokenomics.tokenPrice) - (ownership?.investmentAmount || 0)
        };
      });
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des tokens utilisateur: ${error.message}`);
    }
  }

  private generateTokenId(): string {
    return `PT_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateOrderId(): string {
    return `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private calculateDeploymentCost(blockchain: string): number {
    const costs = {
      'ethereum': 0.1,
      'polygon': 0.01,
      'bsc': 0.005
    };
    return costs[blockchain] || 0.05;
  }

  private calculateNextDistribution(): Date {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    return nextMonth;
  }

  private async deployTokenContract(propertyToken: IPropertyToken): Promise<string> {
    // Simulation du déploiement de contrat - en production, utiliserait Web3
    const contractInput: CreateSmartContractInput = {
      contractType: 'utility_token',
      propertyId: propertyToken.propertyId,
      blockchain: propertyToken.blockchain.network as 'ethereum' | 'polygon' | 'bsc' | 'avalanche',
      parties: [{
        role: 'platform',
        userId: 'system',
        walletAddress: '0x0000000000000000000000000000000000000000'
      }],
      terms: {
        totalSupply: propertyToken.tokenomics.totalSupply,
        tokenSymbol: propertyToken.tokenomics.tokenSymbol,
        tokenName: propertyToken.tokenomics.tokenName
      }
    };

    const contract = await this.contractService.createContract(contractInput);
    const deployed = await this.contractService.deployContract({ contractId: contract.contractId });

    return deployed.contractAddress!;
  }

  private async executeTokenTransfer(contractAddress: string, buyerId: string, amount: number, walletAddress?: string): Promise<string> {
    // Simulation de transfert de tokens - en production, utiliserait Web3
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private async executeRevenuePayment(ownerId: string, amount: number): Promise<string> {
    // Simulation de paiement de revenus - en production, utiliserait Web3
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private async matchMarketOrder(propertyToken: IPropertyToken, sellOrder: any): Promise<any> {
    // Logique de matching d'ordres - simplifié pour la démo
    const buyOrders = propertyToken.trading.orderBook.buyOrders
      .filter(order => order.status === 'open' && order.pricePerToken >= sellOrder.pricePerToken)
      .sort((a, b) => b.pricePerToken - a.pricePerToken);

    if (buyOrders.length > 0) {
      // Match trouvé - en production, cela exécuterait la transaction complète
      sellOrder.status = 'filled';
      return {
        matched: true,
        matchedWith: buyOrders[0].orderId,
        executionPrice: buyOrders[0].pricePerToken,
        transactionHash: await this.executeTokenTransfer(
          propertyToken.blockchain.contractAddress,
          buyOrders[0].buyerId,
          sellOrder.tokensAmount
        )
      };
    }

    return { matched: false };
  }
}