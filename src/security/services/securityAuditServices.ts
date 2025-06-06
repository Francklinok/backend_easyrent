

import { ObjectId } from 'mongodb';
import { createLogger } from '../../utils/logger/logger';
import { SecurityAuditModel } from '../models/securityAuditModel';
import { SecurityAuditEvent,AuditEventData,SecurityEventType,SecuritySearchOptions,SuspiciousActivityResult } from '../type/auditType';
import { AuditEventSeverity,SecurityAuditDocumentPopulated, PopulatedUser} from '../type/auditType';
import { PipelineStage } from 'mongoose';

/**
 * Service responsable de l'audit de sécurité
 * Enregistre les événements liés à la sécurité pour suivi et analyse
 */
export class SecurityAuditService {
  private logger = createLogger('SecurityAuditService');
  private static instance: SecurityAuditService;
  
  // Seuils configurables pour la détection d'activités suspectes
  private suspiciousActivityThresholds = {
    failedLoginCount: 5,
    distinctIpAddressCount: 3,
    sensitiveEventCount: 2,
    timeWindow: 24 * 60 * 60 * 1000 // 24 heures en millisecondes
  };

  /**
   * Constructeur privé pour le pattern Singleton
   */
  public constructor() {}

  /**
   * Obtient l'instance unique du service (pattern Singleton)
   */
  public static getInstance(): SecurityAuditService {
    if (!SecurityAuditService.instance) {
      SecurityAuditService.instance = new SecurityAuditService();
    }
    return SecurityAuditService.instance;
  }

  /**
   * Configure les seuils de détection d'activité suspecte
   * @param thresholds Les nouveaux seuils à appliquer
   */
  public configureSuspiciousActivityThresholds(thresholds: Partial<typeof this.suspiciousActivityThresholds>): void {
    this.suspiciousActivityThresholds = {
      ...this.suspiciousActivityThresholds,
      ...thresholds
    };
    
    this.logger.info('Seuils de détection d\'activité suspecte mis à jour', { newThresholds: this.suspiciousActivityThresholds });
  }

  /**
   * Enregistre un événement de sécurité dans la base de données
   * @param eventData Les données de l'événement à enregistrer
   * @returns L'événement enregistré
   */
  async logEvent(eventData: AuditEventData): Promise<SecurityAuditEvent> {
    try {
      const { 
        eventType, 
        userId, 
        ipAddress, 
        userAgent, 
        details,
        severity = AuditEventSeverity.INFO,
        targetResource,
        targetUserId,
        sessionId
      } = eventData;

      // Construction de l'objet d'événement
      const eventObject: Partial<SecurityAuditEvent> = {
        eventType,
        timestamp: new Date(),
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        details: details || {},
        severity,
        targetResource,
        sessionId
      };

      // Ajouter les IDs si disponibles
      if (userId) {
        eventObject.userId = new ObjectId(userId);
      }
      
      if (targetUserId) {
        eventObject.targetUserId = new ObjectId(targetUserId);
      }

      // Enregistrer l'événement dans la base de données
      const auditEvent = await SecurityAuditModel.create(eventObject);

      this.logger.info(`Événement de sécurité enregistré: ${eventType}`, {
        eventId: auditEvent._id.toString(),
        userId,
        eventType,
        severity
      });

      // Pour les événements critiques, déclencher une alerte immédiate
      if (severity === AuditEventSeverity.CRITICAL) {
        await this.triggerSecurityAlert(auditEvent);
      }

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
        severity: eventData.severity || AuditEventSeverity.INFO,
        details: {
          error: 'Failed to save audit event',
          originalDetails: eventData.details
        }
      } as unknown as  SecurityAuditEvent;
    }
  }

  /**
   * Déclenche une alerte de sécurité pour les événements critiques
   * @param event L'événement critique qui déclenche l'alerte
   */
  private async triggerSecurityAlert(event: SecurityAuditEvent): Promise<void> {
    try {
      // Ici, vous pourriez implémenter une logique pour envoyer des alertes par 
      // email, SMS, webhook vers une solution de monitoring, etc.
      this.logger.warn('ALERTE DE SÉCURITÉ CRITIQUE DÉTECTÉE', {
        eventId: event._id.toString(),
        eventType: event.eventType,
        userId: event.userId?.toString(),
        timestamp: event.timestamp
      });

      // Exemple d'implémentation à personnaliser selon vos besoins
      // await notificationService.sendSecurityAlert(event);
      
    } catch (error) {
      this.logger.error('Erreur lors du déclenchement d\'une alerte de sécurité', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event._id.toString()
      });
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
      if (!userId) {
        throw new Error('userId is required');
      }
      
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
   * Récupère les événements de sécurité associés à une session spécifique
   * @param sessionId ID de la session
   * @returns Liste des événements de sécurité pour cette session
   */
  async getSessionSecurityEvents(sessionId: string): Promise<SecurityAuditEvent[]> {
    try {
      if (!sessionId) {
        throw new Error('sessionId is required');
      }
      
      const events = await SecurityAuditModel.find({ sessionId })
        .sort({ timestamp: 1 }); // Ordre chronologique pour suivre le déroulement de la session
      
      return events;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des événements de session', {
        error: error instanceof Error ? error.message : String(error),
        sessionId
      });
      return [];
    }
  }

  /**
   * Recherche avancée des événements de sécurité avec options flexibles
   * @param options Options de recherche
   * @returns Résultats de la recherche avec pagination
   */
  async searchSecurityEvents(
    options: SecuritySearchOptions = {}
  ): Promise<{ events: SecurityAuditEvent[], total: number }> {
    try {
      const { 
        userId, 
        eventType, 
        startDate, 
        endDate, 
        ipAddress,
        severity,
        targetResource,
        targetUserId,
        sessionId,
        sort = { field: 'timestamp', order: 'desc' },
        limit = 100,
        skip = 0
      } = options;

      // Construire la requête
      const query: Record<string, any> = {};
      
      // Ajouter userId si présent
      if (userId) {
        query.userId = new ObjectId(userId);
      }
      
      // Ajouter targetUserId si présent
      if (targetUserId) {
        query.targetUserId = new ObjectId(targetUserId);
      }
      
      // Ajouter eventType si présent (peut être une chaîne ou un tableau)
      if (eventType) {
        if (Array.isArray(eventType)) {
          query.eventType = { $in: eventType };
        } else {
          query.eventType = eventType;
        }
      }
      
      // Ajouter filtres de date si présents
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) {
          query.timestamp.$gte = new Date(startDate);
        }
        if (endDate) {
          query.timestamp.$lte = new Date(endDate);
        }
      }
      
      // Ajouter filtre d'adresse IP si présent
      if (ipAddress) {
        query.ipAddress = ipAddress;
      }
      
      // Ajouter filtre de sévérité si présent
      if (severity) {
        query.severity = severity;
      }
      
      // Ajouter filtre de ressource cible si présent
      if (targetResource) {
        query.targetResource = targetResource;
      }
      
      // Ajouter filtre de session si présent
      if (sessionId) {
        query.sessionId = sessionId;
      }

      // Déterminer le tri
      const sortOption: Record<string, 1 | -1> = {};
      sortOption[sort.field] = sort.order === 'asc' ? 1 : -1;

      // Exécuter la requête
      const [events, total] = await Promise.all([
        SecurityAuditModel.find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(limit),
        SecurityAuditModel.countDocuments(query)
      ]);
      
      return { events, total };
    } catch (error) {
      this.logger.error('Erreur lors de la recherche d\'événements de sécurité', {
        error: error instanceof Error ? error.message : String(error),
        options
      });
      return { events: [], total: 0 };
    }
  }

  /**
   * Détecte les activités suspectes pour un utilisateur avec analyse de risque améliorée
   * @param userId ID de l'utilisateur
   * @returns Résultat détaillé de l'analyse d'activité suspecte
   */
  async detectSuspiciousActivity(userId: string): Promise<SuspiciousActivityResult> {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }

      const suspiciousActivities: string[] = [];
      const recommendations: string[] = [];
      const timeWindow = new Date(Date.now() - this.suspiciousActivityThresholds.timeWindow);

      // Vérifier les échecs de connexion récents
      const failedLogins = await SecurityAuditModel.countDocuments({
        userId: new ObjectId(userId),
        eventType: SecurityEventType.FAILED_LOGIN,
        timestamp: { $gte: timeWindow }
      });

      if (failedLogins >= this.suspiciousActivityThresholds.failedLoginCount) {
        suspiciousActivities.push('multiple_failed_logins');
        recommendations.push('Vérifier les tentatives d\'accès non autorisées et envisager de renforcer le mot de passe');
      }

      // Vérifier les connexions depuis différentes adresses IP
      const distinctIpAddresses = await SecurityAuditModel.distinct('ipAddress', {
        userId: new ObjectId(userId),
        eventType: SecurityEventType.SUCCESSFUL_LOGIN,
        timestamp: { $gte: timeWindow }
      });

      if (distinctIpAddresses.length >= this.suspiciousActivityThresholds.distinctIpAddressCount) {
        suspiciousActivities.push('multiple_ip_addresses');
        recommendations.push('Activer l\'authentification à deux facteurs et vérifier les appareils connectés');
      }

      // Vérifier les activités sensibles
      const sensitiveEventTypes = [
        SecurityEventType.PASSWORD_CHANGED,
        SecurityEventType.EMAIL_CHANGED,
        SecurityEventType.TWO_FACTOR_DISABLED,
        SecurityEventType.PASSWORD_RESET_REQUESTED,
        SecurityEventType.SECURITY_SETTINGS_CHANGED
      ];
      
      const sensitiveEvents = await SecurityAuditModel.find({
        userId: new ObjectId(userId),
        eventType: { $in: sensitiveEventTypes },
        timestamp: { $gte: timeWindow }
      });

      if (sensitiveEvents.length >= this.suspiciousActivityThresholds.sensitiveEventCount) {
        suspiciousActivities.push('multiple_sensitive_changes');
        recommendations.push('Vérifier les changements récents aux paramètres de sécurité du compte');
      }
      
      // Vérifier les actions administratives
      const adminActionEvents = await SecurityAuditModel.countDocuments({
        userId: new ObjectId(userId),
        eventType: SecurityEventType.ADMIN_ACTION,
        timestamp: { $gte: timeWindow }
      });
      
      if (adminActionEvents > 0) {
        // Vérifier si l'utilisateur devrait avoir des privilèges administratifs
        // Cette logique dépendrait de votre système d'autorisations
        suspiciousActivities.push('unexpected_admin_actions');
        recommendations.push('Vérifier les privilèges administratifs de l\'utilisateur');
      }

      // Déterminer le niveau de risque
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      
      if (suspiciousActivities.length >= 3) {
        riskLevel = 'high';
      } else if (suspiciousActivities.length >= 1) {
        riskLevel = 'medium';
      }
      
      // Si le risque est élevé, ajouter une recommandation de blocage temporaire
      if (riskLevel === 'high') {
        recommendations.push('Envisager de bloquer temporairement le compte pour enquête de sécurité');
        
        // Enregistrer un événement d'alerte de sécurité
        await this.logEvent({
          eventType: 'SECURITY_ALERT',
          userId,
          severity: AuditEventSeverity.WARNING,
          details: {
            reason: 'High risk suspicious activity detected',
            activities: suspiciousActivities
          }
        });
      }

      return {
        detected: suspiciousActivities.length > 0,
        activities: suspiciousActivities,
        riskLevel,
        recommendations
      };
    } catch (error) {
      this.logger.error('Erreur lors de la détection d\'activités suspectes', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return { 
        detected: false, 
        activities: [],
        riskLevel: 'low',
        recommendations: ['Erreur lors de l\'analyse, vérification manuelle recommandée'] 
      };
    }
  }

  /**
   * Récupère les statistiques d'événements de sécurité avec options avancées
   * @param startDate Date de début de la période
   * @param endDate Date de fin de la période
   * @param groupBy Champ par lequel grouper les statistiques (eventType par défaut)
   * @param filter Filtres additionnels pour les statistiques
   * @returns Statistiques des événements de sécurité
   */
  async getSecurityStats(
    startDate: Date, 
    endDate: Date,
    groupBy: string = 'eventType',
    filter: Record<string, any> = {}
  ): Promise<Record<string, number>> {
    try {
      // Construire le filtre de base avec la période
      const baseMatch = {
        timestamp: {
          $gte: startDate,
          $lte: endDate
        },
        ...filter
      };

  const pipeline: PipelineStage[] = [
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
      _id: "$eventType",
      count: { $sum: 1 }
    }
  },
  {
    $sort: {
      count: -1
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
        endDate,
        groupBy,
        filter
      });
      return {};
    }
  }

  /**
   * Récupère les statistiques de sécurité par jour sur une période
   * @param startDate Date de début de la période
   * @param endDate Date de fin de la période
   * @param eventType Type d'événement à analyser (optionnel)
   * @returns Statistiques journalières
   */
  async getSecurityStatsByDay(
    startDate: Date,
    endDate: Date,
    eventType?: string
  ): Promise<Array<{ date: string; count: number }>> {
    try {
      // Construire le filtre
      const match: Record<string, any> = {
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      };
      
      // Ajouter le type d'événement si spécifié
      if (eventType) {
        match.eventType = eventType;
      }

      // Pipeline d'agrégation

const pipeline: PipelineStage[] = [
  {
    $match: match
  },
  {
    $group: {
      _id: {
        year: { $year: "$timestamp" },
        month: { $month: "$timestamp" },
        day: { $dayOfMonth: "$timestamp" }
      },
      count: { $sum: 1 }
    }
  },
  {
    $sort: {
      "_id.year": 1 as 1,
      "_id.month": 1 as 1,
      "_id.day": 1 as 1
    }
  }
];



const stats = await SecurityAuditModel.aggregate(pipeline);
      
      // Formater les résultats
      return stats.map(item => {
        const { year, month, day } = item._id;
        return {
          date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
          count: item.count
        };
      });
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des statistiques journalières', {
        error: error instanceof Error ? error.message : String(error),
        startDate,
        endDate,
        eventType
      });
      return [];
    }
  }

  /**
   * Supprime les événements d'audit plus anciens qu'une certaine date
   * Utile pour la conformité RGPD et la gestion de l'espace de stockage
   * @param olderThan Date avant laquelle supprimer les événements
   * @param options Options avancées pour la purge
   * @returns Nombre d'événements supprimés
   */
  async purgeOldAuditEvents(
    olderThan: Date, 
    options: { 
      excludeEventTypes?: string[];
      backupBeforeDelete?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<number> {
    try {
      const { excludeEventTypes = [], backupBeforeDelete = false, dryRun = false } = options;
      
      // Construire la requête de suppression
      const deleteQuery: Record<string, any> = {
        timestamp: { $lt: olderThan }
      };
      
      // Exclure certains types d'événements si nécessaire
      if (excludeEventTypes.length > 0) {
        deleteQuery.eventType = { $nin: excludeEventTypes };
      }
      
      // Effectuer une sauvegarde avant suppression si demandé
      if (backupBeforeDelete) {
        await this.backupEventsBeforeDelete(deleteQuery);
      }
      
      // Mode simulation - juste compter sans supprimer
      if (dryRun) {
        const count = await SecurityAuditModel.countDocuments(deleteQuery);
        this.logger.info(`Simulation de suppression d'événements d'audit anciens`, {
          count,
          olderThan,
          excludeEventTypes
        });
        return count;
      }
      
      // Effectuer la suppression réelle
      const result = await SecurityAuditModel.deleteMany(deleteQuery);

      this.logger.info(`Événements d'audit anciens supprimés`, {
        count: result.deletedCount,
        olderThan,
        excludeEventTypes
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

  /**
   * Sauvegarde les événements avant leur suppression
   * @param query La requête identifiant les événements à sauvegarder
   */
  private async backupEventsBeforeDelete(query: Record<string, any>): Promise<void> {
    try {
      // Cette méthode pourrait être implémentée pour exporter les événements
      // vers un stockage d'archives, un fichier JSON, etc.
      this.logger.info('Sauvegarde des événements avant suppression', { query });
      
      // Exemple d'implémentation à personnaliser selon vos besoins
      // const eventsToBackup = await SecurityAuditModel.find(query);
      // await archiveService.storeAuditEvents(eventsToBackup);
    } catch (error) {
      this.logger.error('Erreur lors de la sauvegarde des événements avant suppression', {
        error: error instanceof Error ? error.message : String(error),
        query
      });
    }
  }

  /**
   * Analyse les tendances de sécurité sur une période donnée
   * @param startDate Date de début de l'analyse
   * @param endDate Date de fin de l'analyse
   * @returns Analyse des tendances de sécurité
   */
  async analyzeSecurityTrends(
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, any>> {
    try {
      // Obtenir les statistiques de base
      const stats = await this.getSecurityStats(startDate, endDate);
      
      // Calculer les statistiques par jour pour voir l'évolution
      const dailyStats = await this.getSecurityStatsByDay(startDate, endDate);
      
      // Identifier les adresses IP les plus actives
      const topIpAddresses = await SecurityAuditModel.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: "$ipAddress",
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10
        }
      ]);
      
      // Calculer le ratio d'échecs de connexion
      const loginAttempts = stats[SecurityEventType.SUCCESSFUL_LOGIN] || 0;
      const loginFailures = stats[SecurityEventType.FAILED_LOGIN] || 0;
      const totalLoginAttempts = loginAttempts + loginFailures;
      const failureRatio = totalLoginAttempts > 0 ? loginFailures / totalLoginAttempts : 0;
      
      return {
        period: { startDate, endDate },
        totalEvents: Object.values(stats).reduce((sum, val) => sum + val, 0),
        eventTypeDistribution: stats,
        dailyActivity: dailyStats,
        topIpAddresses: topIpAddresses.map(ip => ({ 
          address: ip._id, 
          eventCount: ip.count 
        })),
        loginStats: {
          successCount: loginAttempts,
          failureCount: loginFailures,
          failureRatio: parseFloat(failureRatio.toFixed(4))
        },
        securityIncidents: await this.countSecurityIncidents(startDate, endDate)
      };
    } catch (error) {
      this.logger.error('Erreur lors de l\'analyse des tendances de sécurité', {
        error: error instanceof Error ? error.message : String(error),
        startDate,
        endDate
      });
      return { error: 'Failed to analyze security trends' };
    }
  }

  /**
   * Compte les incidents de sécurité sur une période donnée
   * @param startDate Date de début
   * @param endDate Date de fin
   * @returns Décompte des incidents par type
   */
  private async countSecurityIncidents(
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, number>> {
    // Récupérer les statistiques des événements de sévérité élevée
    const securityIncidents = await SecurityAuditModel.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
          severity: { $in: [AuditEventSeverity.ERROR, AuditEventSeverity.CRITICAL] }
        }
      },
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Formater les résultats
    const incidents: Record<string, number> = {};
    securityIncidents.forEach(incident => {
      incidents[incident._id] = incident.count;
    });
    
    return incidents;
  }

  /**
   * Génère un résumé de sécurité pour un intervalle de temps
   * @param startDate Date de début
   * @param endDate Date de fin
   * @returns Résumé des événements de sécurité
   */

  // First, create proper types for populated documents


// Then use this in your method
async generateSecuritySummary(
  startDate: Date,
  endDate: Date
): Promise<Record<string, any>> {
  try {
    // Période en jours
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Récupérer les statistiques et tendances
    const [stats, trends] = await Promise.all([
      this.getSecurityStats(startDate, endDate),
      this.analyzeSecurityTrends(startDate, endDate)
    ]);
    
    // Récupérer les incidents critiques avec population des utilisateurs
    const criticalIncidents = await SecurityAuditModel.find({
      timestamp: { $gte: startDate, $lte: endDate },
      severity: AuditEventSeverity.CRITICAL
    })
    .populate<{ userId?: PopulatedUser }>('userId', 'email name')
    .populate<{ targetUserId?: PopulatedUser }>('targetUserId', 'email name')
    .sort({ timestamp: -1 }) as SecurityAuditDocumentPopulated[];
    
    // Résumé final
    const summary = {
      period: {
        start: startDate,
        end: endDate,
        days: periodDays
      },
      stats,
      trends,
      criticalIncidents: criticalIncidents.map(incident => ({
        id: incident._id,
        eventType: incident.eventType,
        timestamp: incident.timestamp,
        severity: incident.severity,
        ipAddress: incident.ipAddress,
        userAgent: incident.userAgent,
        
        // User information (now properly typed)
        user: incident.userId ? {
          id: incident.userId._id,
          email: incident.userId.email,
          name: incident.userId.name
        } : null,
        
        // Target user if applicable
        targetUser: incident.targetUserId ? {
          id: incident.targetUserId._id,
          email: incident.targetUserId.email,
          name: incident.targetUserId.name
        } : null,
        
        // Description from details
        description: incident.details?.description || `Critical ${incident.eventType} event`,
        
        // Status and additional info
        status: incident.details?.status,
        failureReason: incident.details?.failureReason,
        targetResource: incident.targetResource || incident.details?.targetResource,
        
        // Admin action info if applicable
        adminAction: incident.details?.actionTaken,
        adminId: incident.details?.adminId,
        
        // Geolocation and device info
        location: incident.details?.geolocation,
        device: incident.details?.deviceInfo,
        
        // Session information
        sessionId: incident.sessionId
      })),
      totalCritical: criticalIncidents.length,
      
      // Add summary statistics
      summaryStats: {
        avgIncidentsPerDay: Math.round(criticalIncidents.length / periodDays * 100) / 100,
        mostCommonEventType: this.getMostCommonEventType(criticalIncidents),
        topRiskyIPs: this.getTopRiskyIPs(criticalIncidents),
        affectedUsersCount: this.getUniqueUsersCount(criticalIncidents)
      }
    };
    
    return summary;
  } catch (error) {
    console.error('Erreur lors de la génération du résumé de sécurité:', error);
    throw new Error('Impossible de générer le résumé de sécurité.');
  }
}

/**
 * Récupère les journaux d'activité d'un utilisateur avec pagination et filtres
 * @param userId ID de l'utilisateur
 * @param options Options de pagination et filtres
 * @returns Journaux d'activité avec métadonnées de pagination
 */
async getUserActivityLogs(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    severity?: AuditEventSeverity;
  } = {}
): Promise<{
  data: SecurityAuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}> {
  try {
    if (!userId) {
      throw new Error('userId is required');
    }

    const {
      page = 1,
      limit = 50,
      eventType,
      startDate,
      endDate,
      severity
    } = options;

    // Calculer le skip pour la pagination
    const skip = (page - 1) * limit;

    // Construire la requête de base
    const query: Record<string, any> = {
      userId: new ObjectId(userId)
    };

    // Ajouter les filtres optionnels
    if (eventType) {
      query.eventType = eventType;
    }

    if (severity) {
      query.severity = severity;
    }

    // Ajouter les filtres de date
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = startDate;
      }
      if (endDate) {
        query.timestamp.$lte = endDate;
      }
    }

    // Exécuter la requête avec pagination
    const [logs, totalItems] = await Promise.all([
      SecurityAuditModel.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      SecurityAuditModel.countDocuments(query)
    ]);

    // Calculer les métadonnées de pagination
    const totalPages = Math.ceil(totalItems / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    const result = {
      data: logs,
      total: totalItems,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrevious
    };

    this.logger.info(`Récupération des journaux d'activité utilisateur`, {
      userId,
      page,
      limit,
      totalItems,
      eventType,
      severity
    });

    return result;

  } catch (error) {
    this.logger.error('Erreur lors de la récupération des journaux d\'activité utilisateur', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      options
    });

    // Retourner une structure vide en cas d'erreur
    return {
      data: [],
      total: 0,
      page: options.page || 1,
      limit: options.limit || 50,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false
    };
  }
}

// Helper methods with proper typing
private getMostCommonEventType(incidents: SecurityAuditDocumentPopulated[]): string | null {
  if (incidents.length === 0) return null;
  
  const eventCounts = incidents.reduce((acc, incident) => {
    acc[incident.eventType] = (acc[incident.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.keys(eventCounts).reduce((a, b) => 
    eventCounts[a] > eventCounts[b] ? a : b
  );
}

private getTopRiskyIPs(incidents: SecurityAuditDocumentPopulated[], limit = 5): string[] {
  const ipCounts = incidents.reduce((acc, incident) => {
    acc[incident.ipAddress] = (acc[incident.ipAddress] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(ipCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, limit)
    .map(([ip]) => ip);
}

private getUniqueUsersCount(incidents: SecurityAuditDocumentPopulated[]): number {
  const uniqueUsers = new Set<string>();
  incidents.forEach(incident => {
    if (incident.userId) uniqueUsers.add(incident.userId._id.toString());
    if (incident.targetUserId) uniqueUsers.add(incident.targetUserId._id.toString());
  });
  return uniqueUsers.size;
}
}
