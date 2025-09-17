import Activity from '../model/activitySchema';
import { Types } from 'mongoose';

/**
 * Classe d'optimisation pour les requêtes d'activité
 */
export class ActivityOptimization {

  /**
   * Crée les index recommandés pour optimiser les performances
   */
  static async createIndexes(): Promise<void> {
    try {
      // Index pour rechercher les activités par client
      await Activity.collection.createIndex({ clientId: 1, createdAt: -1 });

      // Index pour rechercher les activités par propriété
      await Activity.collection.createIndex({ propertyId: 1, createdAt: -1 });

      // Index composé pour les visites en attente
      await Activity.collection.createIndex({
        propertyId: 1,
        clientId: 1,
        isVisitAccepted: 1
      });

      // Index pour les réservations
      await Activity.collection.createIndex({
        isReservation: 1,
        isReservationAccepted: 1,
        createdAt: -1
      });

      // Index pour les paiements
      await Activity.collection.createIndex({
        isPayment: 1,
        paymentDate: -1
      });

      // Index pour les conversations
      await Activity.collection.createIndex({ conversationId: 1 });

      // Index TTL pour les activités anciennes (optionnel - garde les données 2 ans)
      await Activity.collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 } // 2 ans
      );

      console.log('Activity indexes created successfully');
    } catch (error) {
      console.error('Error creating activity indexes:', error);
      throw error;
    }
  }

  /**
   * Pipeline d'agrégation optimisé pour obtenir les statistiques d'un utilisateur
   */
  static getUserActivityStatsPipeline(userId: string) {
    return [
      {
        $match: { clientId: new Types.ObjectId(userId) }
      },
      {
        $group: {
          _id: null,
          totalActivities: { $sum: 1 },
          totalVisits: {
            $sum: {
              $cond: [{ $ne: ["$visitDate", null] }, 1, 0]
            }
          },
          acceptedVisits: {
            $sum: {
              $cond: [{ $eq: ["$isVisitAccepted", true] }, 1, 0]
            }
          },
          totalReservations: {
            $sum: {
              $cond: [{ $eq: ["$isReservation", true] }, 1, 0]
            }
          },
          acceptedReservations: {
            $sum: {
              $cond: [{ $eq: ["$isReservationAccepted", true] }, 1, 0]
            }
          },
          totalPayments: {
            $sum: {
              $cond: [{ $eq: ["$isPayment", true] }, 1, 0]
            }
          },
          totalAmountPaid: {
            $sum: {
              $cond: [{ $eq: ["$isPayment", true] }, "$amount", 0]
            }
          }
        }
      }
    ];
  }

  /**
   * Pipeline d'agrégation pour obtenir les statistiques d'un propriétaire
   */
  static getOwnerActivityStatsPipeline(ownerId: string) {
    return [
      {
        $lookup: {
          from: 'properties',
          localField: 'propertyId',
          foreignField: '_id',
          as: 'property'
        }
      },
      {
        $unwind: '$property'
      },
      {
        $match: { 'property.ownerId': new Types.ObjectId(ownerId) }
      },
      {
        $group: {
          _id: null,
          totalActivities: { $sum: 1 },
          totalVisitRequests: {
            $sum: {
              $cond: [{ $ne: ["$visitDate", null] }, 1, 0]
            }
          },
          pendingVisits: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$visitDate", null] },
                    { $eq: ["$isVisitAccepted", null] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalReservationRequests: {
            $sum: {
              $cond: [{ $eq: ["$isReservation", true] }, 1, 0]
            }
          },
          pendingReservations: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isReservation", true] },
                    { $eq: ["$isReservationAccepted", null] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ["$isPayment", true] }, "$amount", 0]
            }
          }
        }
      }
    ];
  }

  /**
   * Requête optimisée pour obtenir les activités avec pagination et filtres
   */
  static buildOptimizedQuery(filters: {
    userId?: string;
    ownerId?: string;
    propertyId?: string;
    status?: 'pending' | 'accepted' | 'rejected' | 'completed';
    type?: 'visit' | 'reservation' | 'payment';
    dateRange?: { start: Date; end: Date };
  }) {
    const pipeline: any[] = [];

    // Match stage
    const matchStage: any = {};

    if (filters.userId) {
      matchStage.clientId = new Types.ObjectId(filters.userId);
    }

    if (filters.propertyId) {
      matchStage.propertyId = new Types.ObjectId(filters.propertyId);
    }

    if (filters.dateRange) {
      matchStage.createdAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    // Filtres par type
    if (filters.type) {
      switch (filters.type) {
        case 'visit':
          matchStage.visitDate = { $ne: null };
          break;
        case 'reservation':
          matchStage.isReservation = true;
          break;
        case 'payment':
          matchStage.isPayment = true;
          break;
      }
    }

    // Filtres par statut
    if (filters.status) {
      switch (filters.status) {
        case 'pending':
          matchStage.$or = [
            { isVisitAccepted: null },
            { isReservationAccepted: null }
          ];
          break;
        case 'accepted':
          matchStage.$or = [
            { isVisitAccepted: true },
            { isReservationAccepted: true }
          ];
          break;
        case 'rejected':
          matchStage.$or = [
            { isVisitAccepted: false },
            { isReservationAccepted: false }
          ];
          break;
        case 'completed':
          matchStage.isPayment = true;
          break;
      }
    }

    pipeline.push({ $match: matchStage });

    // Lookup pour les propriétés si nécessaire
    if (filters.ownerId) {
      pipeline.push(
        {
          $lookup: {
            from: 'properties',
            localField: 'propertyId',
            foreignField: '_id',
            as: 'property'
          }
        },
        {
          $unwind: '$property'
        },
        {
          $match: { 'property.ownerId': new Types.ObjectId(filters.ownerId) }
        }
      );
    }

    return pipeline;
  }

  /**
   * Cache des requêtes fréquentes
   */
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  /**
   * Met en cache le résultat d'une requête
   */
  static setCacheResult(key: string, data: any, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    });
  }

  /**
   * Récupère un résultat du cache
   */
  static getCacheResult(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Vide le cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Génère une clé de cache pour les statistiques utilisateur
   */
  static getUserStatsCacheKey(userId: string): string {
    return `user_stats_${userId}`;
  }

  /**
   * Génère une clé de cache pour les statistiques propriétaire
   */
  static getOwnerStatsCacheKey(ownerId: string): string {
    return `owner_stats_${ownerId}`;
  }

  /**
   * Nettoie périodiquement le cache
   */
  static startCacheCleanup(intervalMinutes: number = 15): NodeJS.Timeout {
    return setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > value.ttl) {
          this.cache.delete(key);
        }
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Batch processing pour les mises à jour
   */
  static async batchUpdateActivities(
    updates: Array<{ filter: any; update: any }>
  ): Promise<void> {
    const bulkOps = updates.map(({ filter, update }) => ({
      updateOne: {
        filter,
        update,
        upsert: false
      }
    }));

    if (bulkOps.length > 0) {
      await Activity.bulkWrite(bulkOps);
    }
  }

  /**
   * Pagination efficace avec cursor
   */
  static async getCursorPaginatedActivities(
    filter: any,
    lastId?: string,
    limit: number = 20
  ) {
    const query: any = { ...filter };

    if (lastId) {
      query._id = { $gt: new Types.ObjectId(lastId) };
    }

    const activities = await Activity.find(query)
      .sort({ _id: 1 })
      .limit(limit + 1);

    const hasNext = activities.length > limit;
    if (hasNext) {
      activities.pop();
    }

    return {
      activities,
      hasNext,
      nextCursor: hasNext ? activities[activities.length - 1]._id.toString() : null
    };
  }
}