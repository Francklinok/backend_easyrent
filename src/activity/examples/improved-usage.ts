/**
 * Exemples d'utilisation du service ActivityServices amélioré
 */

import ActivityServices from '../service/ActivityServices';
import { ActivityOptimization } from '../utils/optimization';
import { Server as IOServer } from 'socket.io';

// Configuration du service
const io = new IOServer();
const activityService = new ActivityServices(io);

/**
 * Exemples d'utilisation avec gestion d'erreurs améliorée
 */
export class ActivityUsageExamples {

  /**
   * Exemple : Créer une demande de visite avec validation complète
   */
  static async createVisitExample() {
    try {
      const visitData = {
        propertyId: '64f123456789abcdef123456' as any,
        clientId: '64f123456789abcdef123457' as any,
        message: 'Je suis intéressé par cette propriété et souhaiterais la visiter',
        visitDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Demain
      };

      const result = await activityService.createVisite(visitData);

      console.log('✅ Visite créée avec succès:', {
        activityId: result.data._id,
        conversationId: result.conversationId,
        propertyTitle: result.propertyDetails.title
      });

      return result;

    } catch (error: any) {
      console.error('❌ Erreur lors de la création de visite:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  /**
   * Exemple : Récupérer les activités avec pagination avancée et cache
   */
  static async getUserActivitiesAdvanced() {
    try {
      const userId = '64f123456789abcdef123457';

      // Avec pagination classique et filtres
      const classicResult = await activityService.getUserActivities(userId, {
        page: 1,
        limit: 10,
        status: 'pending',
        type: 'visit',
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 jours
          end: new Date()
        },
        useCache: true
      });

      console.log('📊 Activités avec pagination classique:', {
        total: classicResult.pagination.total,
        pages: classicResult.pagination.pages,
        activities: classicResult.activities.length
      });

      // Avec pagination par cursor (plus efficace pour grandes données)
      const cursorResult = await activityService.getUserActivities(userId, {
        limit: 20,
        cursor: '64f123456789abcdef123456', // ID du dernier élément
        useCache: true
      });

      console.log('🚀 Activités avec pagination cursor:', {
        hasNext: cursorResult.hasNext,
        nextCursor: cursorResult.nextCursor,
        activities: cursorResult.activities.length
      });

      return { classicResult, cursorResult };

    } catch (error: any) {
      console.error('❌ Erreur récupération activités:', error.message);
      throw error;
    }
  }

  /**
   * Exemple : Utilisation des statistiques optimisées
   */
  static async getActivityStats() {
    try {
      const userId = '64f123456789abcdef123457';

      // Vérifier le cache d'abord
      const cacheKey = ActivityOptimization.getUserStatsCacheKey(userId);
      let stats = ActivityOptimization.getCacheResult(cacheKey);

      if (!stats) {
        // Générer les statistiques avec pipeline optimisé
        const pipeline = ActivityOptimization.getUserActivityStatsPipeline(userId);
        const result = await ActivityServices.prototype.getUserActivities;

        stats = {
          userId,
          totalActivities: 15,
          totalVisits: 8,
          acceptedVisits: 6,
          totalReservations: 4,
          acceptedReservations: 3,
          totalPayments: 2,
          totalAmountPaid: 4500,
          lastUpdate: new Date()
        };

        // Mettre en cache pour 1 heure
        ActivityOptimization.setCacheResult(cacheKey, stats, 3600);
      }

      console.log('📈 Statistiques utilisateur:', stats);
      return stats;

    } catch (error: any) {
      console.error('❌ Erreur statistiques:', error.message);
      throw error;
    }
  }

  /**
   * Exemple : Traitement par batch pour optimiser les performances
   */
  static async batchUpdateExample() {
    try {
      // Marquer plusieurs visites comme acceptées en une seule opération
      const updates = [
        {
          filter: { _id: '64f123456789abcdef123456' },
          update: {
            $set: {
              isVisitAccepted: true,
              acceptDate: new Date()
            }
          }
        },
        {
          filter: { _id: '64f123456789abcdef123457' },
          update: {
            $set: {
              isVisitAccepted: true,
              acceptDate: new Date()
            }
          }
        }
      ];

      await ActivityOptimization.batchUpdateActivities(updates);
      console.log('✅ Mise à jour par batch effectuée');

    } catch (error: any) {
      console.error('❌ Erreur mise à jour batch:', error.message);
      throw error;
    }
  }

  /**
   * Exemple : Initialisation des index pour optimiser les performances
   */
  static async initializeOptimizations() {
    try {
      console.log('🔧 Création des index d\'optimisation...');
      await ActivityOptimization.createIndexes();
      console.log('✅ Index créés avec succès');

      console.log('🧹 Démarrage du nettoyage de cache...');
      const cleanupInterval = ActivityOptimization.startCacheCleanup(15); // Toutes les 15 minutes
      console.log('✅ Nettoyage de cache configuré');

      return cleanupInterval;

    } catch (error: any) {
      console.error('❌ Erreur initialisation:', error.message);
      throw error;
    }
  }

  /**
   * Exemple : Gestion d'erreurs spécifiques
   */
  static async errorHandlingExample() {
    try {
      // Tentative de création de visite avec données invalides
      const invalidVisitData = {
        propertyId: 'invalid_id' as any,
        clientId: '64f123456789abcdef123457' as any,
        message: '', // Message vide (invalide)
        visitDate: new Date('invalid_date') // Date invalide
      };

      await activityService.createVisite(invalidVisitData);

    } catch (error: any) {
      // Gestion spécifique selon le type d'erreur
      switch (error.code) {
        case 'INVALID_PROPERTY_ID':
          console.log('🔍 ID de propriété invalide détecté');
          break;
        case 'INVALID_MESSAGE':
          console.log('💬 Message invalide détecté');
          break;
        case 'PROPERTY_NOT_FOUND':
          console.log('🏠 Propriété non trouvée');
          break;
        case 'PROPERTY_NOT_AVAILABLE':
          console.log('🚫 Propriété non disponible');
          break;
        default:
          console.log('❌ Erreur non gérée:', error.message);
      }

      // Log détaillé pour le monitoring
      console.log('📊 Détails de l\'erreur:', {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Exemple : Surveillance des performances
   */
  static async performanceMonitoring() {
    const startTime = Date.now();

    try {
      // Opération à surveiller
      const result = await activityService.getUserActivities('64f123456789abcdef123457', {
        page: 1,
        limit: 50,
        useCache: false // Force le rechargement pour tester
      });

      const duration = Date.now() - startTime;

      console.log('⏱️ Métriques de performance:', {
        operation: 'getUserActivities',
        duration: `${duration}ms`,
        resultCount: result.activities.length,
        cacheUsed: false,
        timestamp: new Date().toISOString()
      });

      // Alerte si la performance est dégradée
      if (duration > 1000) {
        console.warn('⚠️ Performance dégradée détectée (> 1s)');
      }

      return { result, metrics: { duration, resultCount: result.activities.length } };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('❌ Erreur avec métriques:', {
        operation: 'getUserActivities',
        duration: `${duration}ms`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
}

/**
 * Configuration recommandée pour la production
 */
export const ProductionConfig = {
  // Index à créer au démarrage
  async setupIndexes() {
    await ActivityOptimization.createIndexes();
  },

  // Configuration du cache
  cacheConfig: {
    defaultTTL: 300, // 5 minutes
    maxSize: 1000,   // Maximum 1000 entrées
    cleanupInterval: 15 // Nettoyage toutes les 15 minutes
  },

  // Configuration des performances
  performanceConfig: {
    maxQueryDuration: 1000, // Alerte si > 1s
    defaultPageSize: 20,
    maxPageSize: 100,
    enableCache: true
  },

  // Configuration du monitoring
  monitoringConfig: {
    logLevel: 'info',
    enableMetrics: true,
    alertThresholds: {
      responseTime: 1000,
      errorRate: 0.05 // 5%
    }
  }
};

// Export par défaut
export default ActivityUsageExamples;