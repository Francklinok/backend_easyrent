import { PropertyToken, IPropertyToken } from '../models/PropertyToken';
import { UtilityToken, IUtilityToken } from '../models/UtilityToken';
import { CryptoPayment, ICryptoPayment } from '../models/CryptoPayment';
import { SmartContractService } from './SmartContractService';
import { UnifiedNotificationService } from '../../notification';
import { PriceOracleService } from './PriceOracleService';

export interface ListTokenInput {
  sellerId: string;
  tokenType: 'property' | 'utility';
  tokenId: string;
  quantity: number;
  pricePerToken: number;
  currency: 'USD' | 'ETH' | 'BTC' | 'USDT';
  listingType: 'fixed_price' | 'auction' | 'dutch_auction';
  duration?: number; // en jours
  minimumBid?: number;
  reservePrice?: number;
}

export interface PlaceBidInput {
  bidderId: string;
  listingId: string;
  bidAmount: number;
  currency: string;
  walletAddress: string;
}

export interface CreateLiquidityPoolInput {
  tokenAId: string;
  tokenBId: string;
  tokenAAmount: number;
  tokenBAmount: number;
  providerId: string;
  feeRate: number; // en pourcentage (ex: 0.3 pour 0.3%)
}

export class CryptoMarketplaceService {
  private contractService: SmartContractService;
  private notificationService: NotificationService;
  private priceOracle: PriceOracleService;

  constructor() {
    this.contractService = new SmartContractService();
    this.notificationService = new NotificationService();
    this.priceOracle = new PriceOracleService();
  }

  async listTokens(input: ListTokenInput): Promise<string> {
    try {
      const listingId = this.generateListingId();

      // Vérifier la propriété des tokens
      if (input.tokenType === 'property') {
        const propertyToken = await PropertyToken.findOne({ tokenId: input.tokenId });
        if (!propertyToken) throw new Error('Property token non trouvé');

        const ownership = propertyToken.ownership.ownershipDistribution.find(
          owner => owner.ownerId === input.sellerId
        );
        if (!ownership || ownership.tokensOwned < input.quantity) {
          throw new Error('Tokens insuffisants pour la vente');
        }

        // Créer l'ordre de vente
        const listing = {
          listingId,
          sellerId: input.sellerId,
          tokenType: input.tokenType,
          tokenId: input.tokenId,
          quantity: input.quantity,
          pricePerToken: input.pricePerToken,
          currency: input.currency,
          listingType: input.listingType,
          status: 'active',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + (input.duration || 30) * 24 * 60 * 60 * 1000),
          minimumBid: input.minimumBid,
          reservePrice: input.reservePrice,
          bids: [],
          views: 0,
          favorites: 0
        };

        // Ajouter à l'orderbook du token
        if (!propertyToken.trading.orderBook.sellOrders) {
          propertyToken.trading.orderBook.sellOrders = [];
        }
        propertyToken.trading.orderBook.sellOrders.push(listing);

        // Activer le trading si ce n'est pas déjà fait
        if (!propertyToken.trading.isTradeEnabled) {
          propertyToken.trading.isTradeEnabled = true;
        }

        await propertyToken.save();

      } else if (input.tokenType === 'utility') {
        const utilityToken = await UtilityToken.findOne({ tokenId: input.tokenId });
        if (!utilityToken) throw new Error('Utility token non trouvé');

        const userBalance = utilityToken.userBalances.find(
          balance => balance.userId === input.sellerId
        );
        if (!userBalance || userBalance.balance < input.quantity) {
          throw new Error('Tokens insuffisants pour la vente');
        }

        // Créer l'ordre de vente (stocké séparément pour les utility tokens)
        // En production, cela serait dans une collection MongoDB séparée
      }

      // Notification
      await this.notificationService.createNotification({
        userId: input.sellerId,
        type: 'service',
        category: 'message',
        title: 'Tokens mis en vente',
        message: `${input.quantity} tokens listés à ${input.pricePerToken} ${input.currency} chacun`,
        metadata: {
          listingId,
          tokenType: input.tokenType,
          tokenId: input.tokenId,
          quantity: input.quantity,
          pricePerToken: input.pricePerToken,
          actionUrl: `/marketplace/listings/${listingId}`
        }
      });

      return listingId;
    } catch (error) {
      throw new Error(`Erreur lors de la mise en vente: ${error.message}`);
    }
  }

  async placeBid(input: PlaceBidInput): Promise<void> {
    try {
      // Trouver le listing dans les property tokens
      const propertyTokens = await PropertyToken.find({
        'trading.orderBook.sellOrders.listingId': input.listingId
      });

      let listing = null;
      let propertyToken = null;

      for (const token of propertyTokens) {
        const order = token.trading.orderBook.sellOrders.find(
          order => order.listingId === input.listingId
        );
        if (order) {
          listing = order;
          propertyToken = token;
          break;
        }
      }

      if (!listing || !propertyToken) {
        throw new Error('Listing non trouvé');
      }

      if (listing.status !== 'active') {
        throw new Error('Listing non actif');
      }

      if (new Date() > listing.expiresAt) {
        throw new Error('Listing expiré');
      }

      // Vérifications spécifiques au type d'enchère
      if (listing.listingType === 'auction') {
        const highestBid = listing.bids.length > 0
          ? Math.max(...listing.bids.map(bid => bid.amount))
          : listing.minimumBid || 0;

        if (input.bidAmount <= highestBid) {
          throw new Error(`Enchère trop faible. Enchère minimum: ${highestBid + 1}`);
        }
      }

      if (listing.listingType === 'fixed_price') {
        if (input.bidAmount !== listing.pricePerToken) {
          throw new Error('Le prix doit correspondre au prix fixé');
        }
      }

      // Ajouter l'enchère
      const bid = {
        bidId: this.generateBidId(),
        bidderId: input.bidderId,
        amount: input.bidAmount,
        currency: input.currency,
        walletAddress: input.walletAddress,
        timestamp: new Date(),
        status: 'active',
        escrowTxHash: await this.createBidEscrow(input)
      };

      listing.bids.push(bid);

      await propertyToken.save();

      // Notifications
      await Promise.all([
        // Notification au vendeur
        this.notificationService.createNotification({
          userId: listing.sellerId,
          type: 'service',
          category: 'transaction',
          title: 'Nouvelle enchère reçue',
          message: `Enchère de ${input.bidAmount} ${input.currency} reçue sur votre listing`,
          priority: 'high',
          metadata: {
            listingId: input.listingId,
            bidAmount: input.bidAmount,
            currency: input.currency,
            bidderId: input.bidderId,
            actionUrl: `/marketplace/listings/${input.listingId}`
          }
        }),
        // Notification à l'enchérisseur
        this.notificationService.createNotification({
          userId: input.bidderId,
          type: 'service',
          category: 'transaction',
          title: 'Enchère placée',
          message: `Votre enchère de ${input.bidAmount} ${input.currency} a été placée`,
          metadata: {
            listingId: input.listingId,
            bidAmount: input.bidAmount,
            actionUrl: `/marketplace/listings/${input.listingId}`
          }
        })
      ]);

      // Auto-accept pour fixed price
      if (listing.listingType === 'fixed_price') {
        await this.acceptBid(listing.sellerId, input.listingId, bid.bidId);
      }

    } catch (error) {
      throw new Error(`Erreur lors de l'enchère: ${error.message}`);
    }
  }

  async acceptBid(sellerId: string, listingId: string, bidId: string): Promise<void> {
    try {
      const propertyTokens = await PropertyToken.find({
        'trading.orderBook.sellOrders.listingId': listingId
      });

      let listing = null;
      let propertyToken = null;

      for (const token of propertyTokens) {
        const order = token.trading.orderBook.sellOrders.find(
          order => order.listingId === listingId && order.sellerId === sellerId
        );
        if (order) {
          listing = order;
          propertyToken = token;
          break;
        }
      }

      if (!listing || !propertyToken) {
        throw new Error('Listing non trouvé');
      }

      const bid = listing.bids.find(b => b.bidId === bidId);
      if (!bid) throw new Error('Enchère non trouvée');

      // Transférer la propriété des tokens
      const sellerOwnership = propertyToken.ownership.ownershipDistribution.find(
        owner => owner.ownerId === sellerId
      );
      if (!sellerOwnership) throw new Error('Vendeur non trouvé');

      // Réduire les tokens du vendeur
      sellerOwnership.tokensOwned -= listing.quantity;
      sellerOwnership.ownershipPercentage = (sellerOwnership.tokensOwned / propertyToken.tokenomics.totalSupply) * 100;

      // Ajouter ou mettre à jour l'acheteur
      let buyerOwnership = propertyToken.ownership.ownershipDistribution.find(
        owner => owner.ownerId === bid.bidderId
      );

      if (!buyerOwnership) {
        propertyToken.ownership.ownershipDistribution.push({
          ownerId: bid.bidderId,
          tokensOwned: listing.quantity,
          ownershipPercentage: (listing.quantity / propertyToken.tokenomics.totalSupply) * 100,
          acquisitionDate: new Date(),
          averagePurchasePrice: bid.amount,
          investmentAmount: bid.amount * listing.quantity,
          kycStatus: 'pending',
          accreditedInvestor: false
        });
        propertyToken.ownership.totalOwners += 1;
      } else {
        const newTotalTokens = buyerOwnership.tokensOwned + listing.quantity;
        const newTotalInvestment = buyerOwnership.investmentAmount + (bid.amount * listing.quantity);

        buyerOwnership.tokensOwned = newTotalTokens;
        buyerOwnership.ownershipPercentage = (newTotalTokens / propertyToken.tokenomics.totalSupply) * 100;
        buyerOwnership.averagePurchasePrice = newTotalInvestment / newTotalTokens;
        buyerOwnership.investmentAmount = newTotalInvestment;
      }

      // Mettre à jour les métriques de trading
      propertyToken.trading.tradingVolume24h += listing.quantity;
      propertyToken.trading.totalTradingVolume += listing.quantity;

      const lastTrade = {
        price: bid.amount,
        quantity: listing.quantity,
        timestamp: new Date(),
        buyer: bid.bidderId,
        seller: sellerId
      };
      propertyToken.trading.orderBook.lastTrade = lastTrade;

      // Marquer le listing comme vendu
      listing.status = 'sold';
      bid.status = 'accepted';

      // Audit trail
      propertyToken.compliance.auditTrail.push({
        action: 'marketplace_sale',
        performedBy: sellerId,
        timestamp: new Date(),
        details: `Sold ${listing.quantity} tokens to ${bid.bidderId} for ${bid.amount} ${bid.currency} each`
      });

      await propertyToken.save();

      // Exécuter le transfert blockchain
      const transferTxHash = await this.executeTokenTransfer(
        propertyToken.blockchain.contractAddress,
        sellerId,
        bid.bidderId,
        listing.quantity
      );

      // Libérer l'escrow
      await this.releaseBidEscrow(bid.escrowTxHash, sellerId);

      // Notifications
      await Promise.all([
        this.notificationService.createNotification({
          userId: sellerId,
          type: 'service',
          category: 'transaction',
          title: 'Tokens vendus',
          message: `${listing.quantity} tokens vendus pour ${bid.amount * listing.quantity} ${bid.currency}`,
          priority: 'high',
          metadata: {
            listingId,
            quantity: listing.quantity,
            totalAmount: bid.amount * listing.quantity,
            buyer: bid.bidderId,
            transferTxHash,
            actionUrl: `/marketplace/sales/${listingId}`
          }
        }),
        this.notificationService.createNotification({
          userId: bid.bidderId,
          type: 'service',
          category: 'transaction',
          title: 'Tokens achetés',
          message: `Vous avez acheté ${listing.quantity} tokens pour ${bid.amount * listing.quantity} ${bid.currency}`,
          priority: 'high',
          metadata: {
            listingId,
            quantity: listing.quantity,
            totalAmount: bid.amount * listing.quantity,
            seller: sellerId,
            transferTxHash,
            actionUrl: `/crypto/property-tokens/${propertyToken.tokenId}`
          }
        })
      ]);

    } catch (error) {
      throw new Error(`Erreur lors de l'acceptation de l'enchère: ${error.message}`);
    }
  }

  async createLiquidityPool(input: CreateLiquidityPoolInput): Promise<string> {
    try {
      const poolId = this.generatePoolId();

      // Vérifier les tokens
      const tokenA = await PropertyToken.findOne({ tokenId: input.tokenAId }) ||
                    await UtilityToken.findOne({ tokenId: input.tokenAId });
      const tokenB = await PropertyToken.findOne({ tokenId: input.tokenBId }) ||
                    await UtilityToken.findOne({ tokenId: input.tokenBId });

      if (!tokenA || !tokenB) {
        throw new Error('Un ou plusieurs tokens non trouvés');
      }

      // Créer le pool de liquidité
      const liquidityPool = {
        poolId,
        tokenA: {
          tokenId: input.tokenAId,
          amount: input.tokenAAmount,
          reserve: input.tokenAAmount
        },
        tokenB: {
          tokenId: input.tokenBId,
          amount: input.tokenBAmount,
          reserve: input.tokenBAmount
        },
        providers: [{
          providerId: input.providerId,
          tokenAProvided: input.tokenAAmount,
          tokenBProvided: input.tokenBAmount,
          liquidityTokens: Math.sqrt(input.tokenAAmount * input.tokenBAmount), // Formule AMM simple
          providedAt: new Date()
        }],
        totalLiquidity: Math.sqrt(input.tokenAAmount * input.tokenBAmount),
        feeRate: input.feeRate,
        volume24h: 0,
        fees24h: 0,
        apr: 0,
        createdAt: new Date(),
        isActive: true
      };

      // Déployer le smart contract du pool
      const poolContractAddress = await this.deployLiquidityPoolContract(liquidityPool);

      // Notification
      await this.notificationService.createNotification({
        userId: input.providerId,
        type: 'wallet',
        category: 'transaction',
        title: 'Pool de liquidité créé',
        message: `Pool créé avec ${input.tokenAAmount} tokenA et ${input.tokenBAmount} tokenB`,
        metadata: {
          poolId,
          tokenAId: input.tokenAId,
          tokenBId: input.tokenBId,
          liquidityTokens: liquidityPool.totalLiquidity,
          contractAddress: poolContractAddress,
          actionUrl: `/defi/pools/${poolId}`
        }
      });

      return poolId;
    } catch (error) {
      throw new Error(`Erreur lors de la création du pool: ${error.message}`);
    }
  }

  async getActiveListings(filters?: {
    tokenType?: 'property' | 'utility';
    priceRange?: { min: number; max: number };
    location?: string;
    propertyType?: string;
    sortBy?: 'price' | 'date' | 'popularity';
    limit?: number;
  }): Promise<any[]> {
    try {
      const query: any = {
        'trading.orderBook.sellOrders.status': 'active',
        'trading.orderBook.sellOrders.expiresAt': { $gt: new Date() }
      };

      if (filters?.tokenType === 'property') {
        if (filters.propertyType) {
          query['propertyDetails.propertyType'] = filters.propertyType;
        }
      }

      const propertyTokens = await PropertyToken.find(query)
        .limit(filters?.limit || 50);

      const listings = [];

      for (const token of propertyTokens) {
        for (const order of token.trading.orderBook.sellOrders || []) {
          if (order.status === 'active' && new Date(order.expiresAt) > new Date()) {
            if (filters?.priceRange) {
              if (order.pricePerToken < filters.priceRange.min ||
                  order.pricePerToken > filters.priceRange.max) {
                continue;
              }
            }

            listings.push({
              listingId: order.listingId,
              token: {
                tokenId: token.tokenId,
                name: token.tokenomics?.tokenName || token.propertyDetails?.address,
                symbol: token.tokenomics?.tokenSymbol,
                type: 'property',
                propertyType: token.propertyDetails?.propertyType,
                location: token.propertyDetails?.address
              },
              sellerId: order.sellerId,
              quantity: order.quantity,
              pricePerToken: order.pricePerToken,
              currency: order.currency,
              listingType: order.listingType,
              highestBid: order.bids?.length > 0
                ? Math.max(...order.bids.map(bid => bid.amount))
                : null,
              bidCount: order.bids?.length || 0,
              views: order.views || 0,
              favorites: order.favorites || 0,
              createdAt: order.createdAt,
              expiresAt: order.expiresAt
            });
          }
        }
      }

      // Tri
      if (filters?.sortBy === 'price') {
        listings.sort((a, b) => a.pricePerToken - b.pricePerToken);
      } else if (filters?.sortBy === 'popularity') {
        listings.sort((a, b) => (b.views + b.favorites) - (a.views + a.favorites));
      } else {
        listings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      return listings;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des listings: ${error.message}`);
    }
  }

  async getListing(listingId: string): Promise<any> {
    try {
      // Rechercher dans les property tokens
      const propertyTokens = await PropertyToken.find({
        'trading.orderBook.sellOrders.listingId': listingId
      });

      for (const token of propertyTokens) {
        const listing = token.trading.orderBook.sellOrders.find(
          order => order.listingId === listingId
        );

        if (listing) {
          return {
            listingId: listing.listingId,
            token: {
              tokenId: token.tokenId,
              name: token.tokenomics?.tokenName || token.propertyDetails?.address,
              symbol: token.tokenomics?.tokenSymbol,
              type: 'property',
              propertyType: token.propertyDetails?.propertyType,
              location: token.propertyDetails?.address
            },
            sellerId: listing.sellerId,
            quantity: listing.quantity,
            pricePerToken: listing.pricePerToken,
            currency: listing.currency,
            listingType: listing.listingType,
            status: listing.status,
            bids: listing.bids || [],
            views: listing.views || 0,
            favorites: listing.favorites || 0,
            createdAt: listing.createdAt,
            expiresAt: listing.expiresAt
          };
        }
      }

      throw new Error('Listing non trouvé');
    } catch (error) {
      throw new Error(`Erreur lors de la récupération du listing: ${error.message}`);
    }
  }

  async cancelListing(sellerId: string, listingId: string): Promise<void> {
    try {
      const propertyTokens = await PropertyToken.find({
        'trading.orderBook.sellOrders.listingId': listingId
      });

      let listing = null;
      let propertyToken = null;

      for (const token of propertyTokens) {
        const order = token.trading.orderBook.sellOrders.find(
          order => order.listingId === listingId && order.sellerId === sellerId
        );
        if (order) {
          listing = order;
          propertyToken = token;
          break;
        }
      }

      if (!listing || !propertyToken) {
        throw new Error('Listing non trouvé ou vous n\'êtes pas le propriétaire');
      }

      if (listing.status !== 'active') {
        throw new Error('Seuls les listings actifs peuvent être annulés');
      }

      // Marquer comme annulé
      listing.status = 'cancelled';

      // Rembourser tous les enchérisseurs si des enchères existent
      if (listing.bids && listing.bids.length > 0) {
        for (const bid of listing.bids) {
          if (bid.status === 'active') {
            bid.status = 'cancelled';
            // Libérer l'escrow de l'enchère
            await this.releaseBidEscrow(bid.escrowTxHash, bid.bidderId);

            // Notification à l'enchérisseur
            await this.notificationService.createNotification({
              userId: bid.bidderId,
              type: 'marketplace',
              category: 'listing',
              title: 'Listing annulé',
              message: `Le listing sur lequel vous avez enchéri a été annulé. Votre enchère a été remboursée`,
              metadata: {
                listingId,
                bidAmount: bid.amount,
                currency: bid.currency,
                actionUrl: `/marketplace/listings/${listingId}`
              }
            });
          }
        }
      }

      await propertyToken.save();

      // Notification au vendeur
      await this.notificationService.createNotification({
        userId: sellerId,
        type: 'marketplace',
        category: 'listing',
        title: 'Listing annulé',
        message: `Votre listing de ${listing.quantity} tokens a été annulé avec succès`,
        metadata: {
          listingId,
          quantity: listing.quantity,
          pricePerToken: listing.pricePerToken,
          actionUrl: `/marketplace/listings/${listingId}`
        }
      });

    } catch (error) {
      throw new Error(`Erreur lors de l'annulation du listing: ${error.message}`);
    }
  }

  async getUserTradingHistory(userId: string): Promise<any[]> {
    try {
      const trades = [];

      // Rechercher dans les property tokens
      const propertyTokens = await PropertyToken.find({
        $or: [
          { 'trading.orderBook.sellOrders.sellerId': userId },
          { 'trading.orderBook.sellOrders.bids.bidderId': userId }
        ]
      });

      for (const token of propertyTokens) {
        for (const order of token.trading.orderBook.sellOrders || []) {
          // Ventes de l'utilisateur
          if (order.sellerId === userId) {
            trades.push({
              type: 'sell',
              tokenId: token.tokenId,
              tokenName: token.tokenomics?.tokenName || token.propertyDetails?.address,
              quantity: order.quantity,
              pricePerToken: order.pricePerToken,
              totalAmount: order.quantity * order.pricePerToken,
              currency: order.currency,
              status: order.status,
              createdAt: order.createdAt,
              listingId: order.listingId
            });
          }

          // Achats de l'utilisateur
          const userBids = order.bids?.filter(bid => bid.bidderId === userId) || [];
          for (const bid of userBids) {
            trades.push({
              type: 'buy',
              tokenId: token.tokenId,
              tokenName: token.tokenomics?.tokenName || token.propertyDetails?.address,
              quantity: order.quantity,
              pricePerToken: bid.amount,
              totalAmount: order.quantity * bid.amount,
              currency: bid.currency,
              status: bid.status,
              createdAt: bid.timestamp,
              bidId: bid.bidId,
              listingId: order.listingId
            });
          }
        }
      }

      return trades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      throw new Error(`Erreur lors de la récupération de l'historique: ${error.message}`);
    }
  }

  private generateListingId(): string {
    return `LIST_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateBidId(): string {
    return `BID_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generatePoolId(): string {
    return `POOL_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private async createBidEscrow(input: PlaceBidInput): Promise<string> {
    // Simulation de création d'escrow pour l'enchère
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private async releaseBidEscrow(escrowTxHash: string, recipient: string): Promise<void> {
    // Simulation de libération d'escrow
    console.log(`Releasing escrow ${escrowTxHash} to ${recipient}`);
  }

  private async executeTokenTransfer(
    contractAddress: string,
    from: string,
    to: string,
    amount: number
  ): Promise<string> {
    // Simulation de transfert de tokens
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private async deployLiquidityPoolContract(poolData: any): Promise<string> {
    // Simulation de déploiement de contrat de pool de liquidité
    return `0x${Math.random().toString(16).substr(2, 40)}`;
  }
}