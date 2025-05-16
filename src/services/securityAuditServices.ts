import { ObjectId } from 'mongodb';
import createLogger from '../utils/logger/logger';
import { SecurityAuditModel, SecurityAuditEvent } from '../models/SecurityAuditModel';

/**
 * Interface pour les événements de sécurité à auditer
 */
interface AuditEventData {
  eventType: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

/**
 * Service responsable de l'audit de sécurité
 * Enregistre les événements liés à la sécurité pour suivi et analyse
 */
export class SecurityAuditService {
  private logger = createLogger('SecurityAuditService');

  /**
   * Enregistre un événement de sécurité dans la base de données
   * @param eventData Les données de l'événement à enregistrer
   * @returns L'événement enregistré
   */
  async logEvent(eventData: AuditEventData): Promise<SecurityAuditEvent> {
    try {
      const { eventType, userId, ipAddress, userAgent, details } = eventData;

      // Construction de l'objet d'événement
      const eventObject: Partial<SecurityAuditEvent> = {
        eventType,
        timestamp: new Date(),
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        details: details || {}
      };

      // Ajouter l'ID utilisateur si disponible
      if (userId) {
        eventObject.userId = new ObjectId(userId);
      }

      // Enregistrer l'événement dans la base de données
      const auditEvent = await SecurityAuditModel.create(eventObject);

      this.logger.info(`Événement de sécurité enregistré: ${eventType}`, {
        eventId: auditEvent._id.toString(),
        userId,
        eventType
      });

      return auditEvent;
    } catch (error) {
      this.logger.error('Erreur lors de l\'enregistrement d\'un événement de sécurité', {
        error: error instanceof Error ? error.message : String(error),
        eventType: eventData.eventType,
        userId: eventData.userId
      });

      // Créer un événement minimal en cas d'erreur pour assurer la traçabilité
      return {
        _id: new ObjectId(),
        eventType: eventData.eventType,
        timestamp: new Date(),
        ipAddress: eventData.ipAddress || 'unknown',
        userAgent: eventData.userAgent || 'unknown',
        details: {
          error: 'Failed to save audit event',
          originalDetails: eventData.details
        }
      } as SecurityAuditEvent;
    }
  }

  /**
   * Récupère l'historique des événements de sécurité pour un utilisateur
   * @param userId ID de l'utilisateur
   * @param limit Nombre maximum d'événements à récupérer
   * @param skip Nombre d'événements à sauter (pour pagination)
   * @returns Liste des événements de sécurité
   */
  async getUserSecurityHistory(userId: string, limit = 50, skip = 0): Promise<SecurityAuditEvent[]> {
    try {
      const events = await SecurityAuditModel.find({ userId: new ObjectId(userId) })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);
      
      return events;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération de l\'historique de sécurité', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return [];
    }
  }

  /**
   * Recherche des événements de sécurité en fonction de critères
   * @param criteria Critères de recherche
   * @param limit Nombre maximum d'événements à récupérer
   * @param skip Nombre d'événements à sauter (pour pagination)
   * @returns Liste des événements correspondant aux critères
   */
  async searchSecurityEvents(
    criteria: Record<string, any>,
    limit = 100,
    skip = 0
  ): Promise<{ events: SecurityAuditEvent[], total: number }> {
    try {
      // Construire la requête
      const query: Record<string, any> = {};
      
      // Ajouter userId si présent
      if (criteria.userId) {
        query.userId = new ObjectId(criteria.userId);
      }
      
      // Ajouter eventType si présent
      if (criteria.eventType) {
        query.eventType = criteria.eventType;
      }
      
      // Ajouter filtres de date si présents
      if (criteria.startDate || criteria.endDate) {
        query.timestamp = {};
        if (criteria.startDate) {
          query.timestamp.$gte = new Date(criteria.startDate);
        }
        if (criteria.endDate) {
          query.timestamp.$lte = new Date(criteria.endDate);
        }
      }
      
      // Ajouter filtre d'adresse IP si présent
      if (criteria.ipAddress) {
        query.ipAddress = criteria.ipAddress;
      }

      // Exécuter la requête
      const [events, total] = await Promise.all([
        SecurityAuditModel.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit),
        SecurityAuditModel.countDocuments(query)
      ]);
      
      return { events, total };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche d\'événements de sécurité', {
        error: error instanceof Error ? error.message : String(error),
        criteria
      });
      return { events: [], total: 0 };
    }
  }

  /**
   * Détecte les activités suspectes pour un utilisateur
   * @param userId ID de l'utilisateur
   * @returns Liste des activités suspectes détectées
   */
  async detectSuspiciousActivity(userId: string): Promise<{ detected: boolean; activities: string[] }> {
    try {
      const suspiciousActivities: string[] = [];
      const timeWindow = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 heures

      // Vérifier les échecs de connexion récents
      const failedLogins = await SecurityAuditModel.countDocuments({
        userId: new ObjectId(userId),
        eventType: 'FAILED_LOGIN',
        timestamp: { $gte: timeWindow }
      });

      if (failedLogins >= 5) {
        suspiciousActivities.push('multiple_failed_logins');
      }

      // Vérifier les connexions depuis différentes adresses IP
      const distinctIpAddresses = await SecurityAuditModel.distinct('ipAddress', {
        userId: new ObjectId(userId),
        eventType: 'SUCCESSFUL_LOGIN',
        timestamp: { $gte: timeWindow }
      });

      if (distinctIpAddresses.length >= 3) {
        suspiciousActivities.push('multiple_ip_addresses');
      }

      // Vérifier les activités sensibles
      const sensitiveEvents = await SecurityAuditModel.find({
        userId: new ObjectId(userId),
        eventType: { 
          $in: [
            'PASSWORD_CHANGED', 
            'EMAIL_CHANGED', 
            'TWO_FACTOR_DISABLED',
            'PASSWORD_RESET_REQUESTED',
            'SECURITY_SETTINGS_CHANGED'
          ] 
        },
        timestamp: { $gte: timeWindow }
      });

      if (sensitiveEvents.length >= 2) {
        suspiciousActivities.push('multiple_sensitive_changes');
      }

      return {
        detected: suspiciousActivities.length > 0,
        activities: suspiciousActivities
      };
    } catch (error) {
      this.logger.error('Erreur lors de la détection d\'activités suspectes', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return { detected: false, activities: [] };
    }
  }

  /**
   * Récupère les statistiques d'événements de sécurité
   * @param startDate Date de début de la période
   * @param endDate Date de fin de la période
   * @returns Statistiques des événements de sécurité
   */
  async getSecurityStats(
    startDate: Date, 
    endDate: Date
  ): Promise<Record<string, number>> {
    try {
      const pipeline = [
        {
          $match: {
            timestamp: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 }
          }
        }
      ];

      const stats = await SecurityAuditModel.aggregate(pipeline);
      
      // Transformer les résultats en objet pour faciliter l'utilisation
      const formattedStats: Record<string, number> = {};
      stats.forEach((item) => {
        formattedStats[item._id] = item.count;
      });

      return formattedStats;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des statistiques de sécurité', {
        error: error instanceof Error ? error.message : String(error),
        startDate,
        endDate
      });
      return {};
    }
  }

  /**
   * Supprime les événements d'audit plus anciens qu'une certaine date
   * Utile pour la conformité RGPD et la gestion de l'espace de stockage
   * @param olderThan Date avant laquelle supprimer les événements
   * @returns Nombre d'événements supprimés
   */
  async purgeOldAuditEvents(olderThan: Date): Promise<number> {
    try {
      const result = await SecurityAuditModel.deleteMany({
        timestamp: { $lt: olderThan }
      });

      this.logger.info(`Événements d'audit anciens supprimés`, {
        count: result.deletedCount,
        olderThan
      });

      return result.deletedCount || 0;
    } catch (error) {
      this.logger.error('Erreur lors de la suppression d\'anciens événements d\'audit', {
        error: error instanceof Error ? error.message : String(error),
        olderThan
      });
      return 0;
    }
  }
}