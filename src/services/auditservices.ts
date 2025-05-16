import { ObjectId } from 'mongodb';
import createLogger from '../utils/logger/logger';
import { SecurityAuditModel } from '../models/SecurityAuditModel';
import { SecurityAuditEvent, AuditEventData, SecurityEventSearchCriteria, SuspiciousActivityResult, PaginatedSecurityEvents, SecurityEventType } from '../types/SecurityAuditEvent';

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
    criteria: SecurityEventSearchCriteria,
    limit = 100,
    skip = 0
  ): Promise<PaginatedSecurityEvents> {
    try {
      // Construire la requête
      const query: Record<string, any> = {};
      
      // Ajouter userId si présent
      if (criteria.userId) {
        query.userId = new ObjectId(criteria.userId);
      }
      
      // Ajouter eventType si présent
      if (criteria.eventType) {
        if (Array.isArray(criteria.eventType)) {
          query.eventType = { $in: criteria.eventType };
        } else {
          query.eventType = criteria.eventType;
        }
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
      
      // Ajouter recherche par mots-clés si présents
      if (criteria.keywords && criteria.keywords.length > 0) {
        const keywordConditions = criteria.keywords.map(keyword => ({
          $or: [
            { 'details.description': { $regex: keyword, $options: 'i' } },
            { eventType: { $regex: keyword, $options: 'i' } }
          ]
        }));
        
        query.$and = query.$and || [];
        query.$and.push({ $or: keywordConditions });
      }
      
      // Ajouter filtre de sévérité minimum si présent
      if (criteria.minSeverity) {
        const severityLevels = {
          'low': 0,
          'medium': 1,
          'high': 2,
          'critical': 3
        };
        
        const minSeverityValue = severityLevels[criteria.minSeverity];
        
        query.$or = [
          { 'details.severity': { $in: Object.keys(severityLevels).slice(minSeverityValue) } },
          { 'details.severity': { $exists: false } }  // Inclure les événements sans sévérité définie
        ];
      }

      // Calculer la pagination
      const page = Math.floor(skip / limit) + 1;
      
      // Exécuter la requête
      const [events, total] = await Promise.all([
        SecurityAuditModel.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit),
        SecurityAuditModel.countDocuments(query)
      ]);
      
      const totalPages = Math.ceil(total / limit);
      
      return { 
        events, 
        total, 
        page,
        limit,
        totalPages
      };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche d\'événements de sécurité', {
        error: error instanceof Error ? error.message : String(error),
        criteria
      });
      return { events: [], total: 0, page: 1, limit, totalPages: 0 };
    }
  }

  /**
   * Détecte les activités suspectes pour un utilisateur
   * @param userId ID de l'utilisateur
   * @returns Liste des activités suspectes détectées
   */
  async detectSuspiciousActivity(userId: string): Promise<SuspiciousActivityResult> {
    try {
      const suspiciousActivities: string[] = [];
      const recommendations: string[] = [];
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      
      const timeWindow = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 heures

      // Vérifier les échecs de connexion récents
      const failedLogins = await SecurityAuditModel.countDocuments({
        userId: new ObjectId(userId),
        eventType: SecurityEventType.FAILED_LOGIN,
        timestamp: { $gte: timeWindow }
      });

      if (failedLogins >= 5) {
        suspiciousActivities.push('multiple_failed_logins');
        recommendations.push('Considérez changer votre mot de passe immédiatement');
        riskLevel = 'high';
      } else if (failedLogins >= 3) {
        suspiciousActivities.push('several_failed_logins');
        recommendations.push('Surveillez attentivement les tentatives de connexion à votre compte');
        riskLevel = 'medium';
      }

      // Vérifier les connexions depuis différentes adresses IP
      const distinctIpAddresses = await SecurityAuditModel.distinct('ipAddress', {
        userId: new ObjectId(userId),
        eventType: SecurityEventType.SUCCESSFUL_LOGIN,
        timestamp: { $gte: timeWindow }
      });

      if (distinctIpAddresses.length >= 5) {
        suspiciousActivities.push('multiple_login_locations');
        recommendations.push('Vérifiez la liste des appareils connectés et déconnectez les sessions non reconnues');
        riskLevel = 'critical';
      } else if (distinctIpAddresses.length >= 3) {
        suspiciousActivities.push('multiple_ip_addresses');
        recommendations.push('Vérifiez si toutes les connexions proviennent d\'appareils que vous utilisez');
        riskLevel = Math.max(this.getRiskLevelValue(riskLevel), this.getRiskLevelValue('medium')) === this.getRiskLevelValue('medium') ? 'medium' : riskLevel;
      }

      // Vérifier les activités sensibles
      const sensitiveEvents = await SecurityAuditModel.find({
        userId: new ObjectId(userId),
        eventType: { 
          $in: [
            SecurityEventType.PASSWORD_CHANGED, 
            SecurityEventType.EMAIL_CHANGED, 
            SecurityEventType.TWO_FACTOR_DISABLED,
            SecurityEventType.PASSWORD_RESET_REQUESTED,
            SecurityEventType.SECURITY_SETTINGS_CHANGED
          ] 
        },
        timestamp: { $gte: timeWindow }
      });

      if (sensitiveEvents.length >= 3) {
        suspiciousActivities.push('multiple_sensitive_changes');
        recommendations.push('Vérifiez que toutes les modifications récentes de vos paramètres de sécurité sont légitimes');
        riskLevel = Math.max(this.getRiskLevelValue(riskLevel), this.getRiskLevelValue('high')) === this.getRiskLevelValue('high') ? 'high' : riskLevel;
      } else if (sensitiveEvents.length >= 2) {
        suspiciousActivities.push('several_security_changes');
        riskLevel = Math.max(this.getRiskLevelValue(riskLevel), this.getRiskLevelValue('medium')) === this.getRiskLevelValue('medium') ? 'medium' : riskLevel;
      }
      
      // Vérifier les connexions à des heures inhabituelles
      const nightTimeLogins = await SecurityAuditModel.countDocuments({
        userId: new ObjectId(userId),
        eventType: SecurityEventType.SUCCESSFUL_LOGIN,
        timestamp: { $gte: timeWindow },
        $expr: {
          $or: [
            { $lt: [{ $hour: "$timestamp" }, 5] },
            { $gt: [{ $hour: "$timestamp" }, 23] }
          ]
        }
      });
      
      if (nightTimeLogins >= 2) {
        suspiciousActivities.push('unusual_login_times');
        recommendations.push('Vérifiez si ces connexions à des heures inhabituelles sont légitimes');
        riskLevel = Math.max(this.getRiskLevelValue(riskLevel), this.getRiskLevelValue('medium')) === this.getRiskLevelValue('medium') ? 'medium' : riskLevel;
      }

      return {
        detected: suspiciousActivities.length > 0,
        activities: suspiciousActivities,
        riskLevel,
        recommendations: recommendations.length > 0 ? recommendations : undefined
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
   * Convertit le niveau de risque en valeur numérique pour comparaison
   * @param level Niveau de risque
   * @returns Valeur numérique correspondante
   */
  private getRiskLevelValue(level: 'low' | 'medium' | 'high' | 'critical'): number {
    const levels = {
      'low': 0,
      'medium': 1,
      'high': 2,
      'critical': 3
    };
    return levels[level];
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

