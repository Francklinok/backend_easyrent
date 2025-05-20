import { Request, Response } from 'express';
import { 
  SecurityEventSearchCriteria, 
  SecuritySearchOptions, 
  AuditEventData,
  AuditEventSeverity,
  SecurityAuditEvent
} from '../type/auditType';
import { SecurityAuditService } from '../services/securityAuditServices';
/**
 * Contrôleur pour l'API d'audit de sécurité
 * Expose les fonctionnalités du SecurityAuditService via des endpoints REST
 */
export class SecurityAuditController {
  private auditService = SecurityAuditService.getInstance();

  /**
   * Enregistre un nouvel événement de sécurité
   * @route POST /api/security-audit/events
   */
  async logEvent(req: Request, res: Response): Promise<void> {
    try {
      const eventData: AuditEventData = req.body;
      
      // Validation de base
      if (!eventData.eventType) {
        res.status(400).json({ error: 'Le type d\'événement est requis' });
        return;
      }

      const result = await this.auditService.logEvent(eventData);
      res.status(201).json(result);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement d\'un événement:', error);
      res.status(500).json({ 
        error: 'Erreur d\'enregistrement d\'événement',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Récupère l'historique des événements de sécurité pour un utilisateur
   * @route GET /api/security-audit/events/user/:userId
   */
  async getUserHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = parseInt(req.query.skip as string) || 0;
      
      if (!userId) {
        res.status(400).json({ error: 'ID utilisateur requis' });
        return;
      }

      const events = await this.auditService.getUserSecurityHistory(userId, limit, skip);
      res.status(200).json(events);
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique utilisateur:', error);
      res.status(500).json({ 
        error: 'Erreur de récupération d\'historique',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Récupère les événements de sécurité pour une session spécifique
   * @route GET /api/security-audit/events/session/:sessionId
   */
  async getSessionEvents(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.params.sessionId;
      
      if (!sessionId) {
        res.status(400).json({ error: 'ID de session requis' });
        return;
      }

      const events = await this.auditService.getSessionSecurityEvents(sessionId);
      res.status(200).json(events);
    } catch (error) {
      console.error('Erreur lors de la récupération des événements de session:', error);
      res.status(500).json({ 
        error: 'Erreur de récupération des événements de session',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Détecte les activités suspectes pour un utilisateur
   * @route GET /api/security-audit/suspicious-activity/:userId
   */
  async detectSuspiciousActivity(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      
      if (!userId) {
        res.status(400).json({ error: 'ID utilisateur requis' });
        return;
      }

      const result = await this.auditService.detectSuspiciousActivity(userId);
      res.status(200).json(result);
    } catch (error) {
      console.error('Erreur lors de la détection d\'activités suspectes:', error);
      res.status(500).json({ 
        error: 'Erreur de détection d\'activité suspecte',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Recherche avancée d'événements de sécurité avec pagination
   * @route POST /api/security-audit/events/search
   */
  async searchEvents(req: Request, res: Response): Promise<void> {
    try {
      const searchOptions: SecuritySearchOptions = req.body;
      
      // Convertir les dates si elles sont fournies sous forme de chaînes
      if (typeof searchOptions.startDate === 'string') {
        searchOptions.startDate = new Date(searchOptions.startDate);
      }
      if (typeof searchOptions.endDate === 'string') {
        searchOptions.endDate = new Date(searchOptions.endDate);
      }

      const { events, total } = await this.auditService.searchSecurityEvents(searchOptions);
      
      res.status(200).json({ 
        events, 
        total,
        page: {
          limit: searchOptions.limit || 100,
          skip: searchOptions.skip || 0,
          total
        }
      });
    } catch (error) {
      console.error('Erreur lors de la recherche d\'événements:', error);
      res.status(500).json({ 
        error: 'Erreur de recherche d\'événements',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Génère des statistiques d'événements de sécurité
   * @route GET /api/security-audit/stats
   */
  async getSecurityStats(req: Request, res: Response): Promise<void> {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const groupBy = req.query.groupBy as string || 'eventType';
      const filter = req.query.filter ? JSON.parse(req.query.filter as string) : {};
      
      // Validation des dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({ error: 'Dates invalides' });
        return;
      }

      const stats = await this.auditService.getSecurityStats(startDate, endDate, groupBy, filter);
      res.status(200).json(stats);
    } catch (error) {
      console.error('Erreur lors de la génération des statistiques:', error);
      res.status(500).json({ 
        error: 'Erreur de génération de statistiques',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Génère des statistiques de sécurité par jour
   * @route GET /api/security-audit/stats/daily
   */
  async getDailySecurityStats(req: Request, res: Response): Promise<void> {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const eventType = req.query.eventType as string;
      
      // Validation des dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({ error: 'Dates invalides' });
        return;
      }

      const dailyStats = await this.auditService.getSecurityStatsByDay(startDate, endDate, eventType);
      res.status(200).json(dailyStats);
    } catch (error) {
      console.error('Erreur lors de la génération des statistiques journalières:', error);
      res.status(500).json({ 
        error: 'Erreur de génération de statistiques journalières',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Analyse les tendances de sécurité sur une période
   * @route GET /api/security-audit/trends
   */
  async analyzeSecurityTrends(req: Request, res: Response): Promise<void> {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      
      // Validation des dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({ error: 'Dates invalides' });
        return;
      }

      const trends = await this.auditService.analyzeSecurityTrends(startDate, endDate);
      res.status(200).json(trends);
    } catch (error) {
      console.error('Erreur lors de l\'analyse des tendances:', error);
      res.status(500).json({ 
        error: 'Erreur d\'analyse des tendances de sécurité',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Génère un résumé complet de sécurité pour une période
   * @route GET /api/security-audit/summary
   */
  async generateSecuritySummary(req: Request, res: Response): Promise<void> {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      
      // Validation des dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({ error: 'Dates invalides' });
        return;
      }

      const summary = await this.auditService.generateSecuritySummary(startDate, endDate);
      res.status(200).json(summary);
    } catch (error) {
      console.error('Erreur lors de la génération du résumé de sécurité:', error);
      res.status(500).json({ 
        error: 'Erreur de génération du résumé de sécurité',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Supprime les anciens événements d'audit
   * @route DELETE /api/security-audit/events/purge
   */
  async purgeOldAuditEvents(req: Request, res: Response): Promise<void> {
    try {
      const olderThan = new Date(req.body.olderThan);
      const options = {
        excludeEventTypes: req.body.excludeEventTypes || [],
        backupBeforeDelete: req.body.backupBeforeDelete || false,
        dryRun: req.body.dryRun || false
      };
      
      // Validation de la date
      if (isNaN(olderThan.getTime())) {
        res.status(400).json({ error: 'Date invalide' });
        return;
      }

      const deletedCount = await this.auditService.purgeOldAuditEvents(olderThan, options);
      
      if (options.dryRun) {
        res.status(200).json({ 
          message: 'Simulation de suppression effectuée', 
          eventsToDelete: deletedCount 
        });
      } else {
        res.status(200).json({ 
          message: 'Purge des anciens événements réussie', 
          deletedCount 
        });
      }
    } catch (error) {
      console.error('Erreur lors de la purge des anciens événements:', error);
      res.status(500).json({ 
        error: 'Erreur de purge des anciens événements',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Configure les seuils de détection d'activité suspecte
   * @route PUT /api/security-audit/thresholds
   */
  async configureSuspiciousActivityThresholds(req: Request, res: Response): Promise<void> {
    try {
      const thresholds = req.body;
      
      // Validation de base
      if (!thresholds || Object.keys(thresholds).length === 0) {
        res.status(400).json({ error: 'Paramètres de seuil requis' });
        return;
      }

      this.auditService.configureSuspiciousActivityThresholds(thresholds);
      
      res.status(200).json({ 
        message: 'Seuils de détection mis à jour avec succès',
        thresholds
      });
    } catch (error) {
      console.error('Erreur lors de la configuration des seuils:', error);
      res.status(500).json({ 
        error: 'Erreur de configuration des seuils',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}