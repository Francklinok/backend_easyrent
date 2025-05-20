import express from 'express';
import { SecurityAuditController } from '../controllers/securityControllers';
/**
 * Routes pour l'API d'audit de sécurité
 * Expose toutes les fonctionnalités du SecurityAuditService via des endpoints RESTful
 */
const router = express.Router();
const auditController = new SecurityAuditController();

/**
 * Routes pour la gestion des événements d'audit
 */

// Enregistrer un nouvel événement d'audit de sécurité
router.post('/events', (req, res) => auditController.logEvent(req, res));

// Récupérer l'historique des événements pour un utilisateur
router.get('/events/user/:userId', (req, res) => auditController.getUserHistory(req, res));

// Récupérer les événements liés à une session spécifique
router.get('/events/session/:sessionId', (req, res) => auditController.getSessionEvents(req, res));

// Recherche avancée d'événements avec filtres et pagination
router.post('/events/search', (req, res) => auditController.searchEvents(req, res));

// Purger les anciens événements d'audit
router.delete('/events/purge', (req, res) => auditController.purgeOldAuditEvents(req, res));

/**
 * Routes pour l'analyse et les statistiques
 */

// Détecter les activités suspectes pour un utilisateur
router.get('/suspicious-activity/:userId', (req, res) => auditController.detectSuspiciousActivity(req, res));

// Configurer les seuils de détection d'activité suspecte
router.put('/thresholds', (req, res) => auditController.configureSuspiciousActivityThresholds(req, res));

// Obtenir des statistiques d'événements de sécurité
router.get('/stats', (req, res) => auditController.getSecurityStats(req, res));

// Obtenir des statistiques journalières
router.get('/stats/daily', (req, res) => auditController.getDailySecurityStats(req, res));

// Analyser les tendances de sécurité
router.get('/trends', (req, res) => auditController.analyzeSecurityTrends(req, res));

// Générer un résumé complet de sécurité
router.get('/summary', (req, res) => auditController.generateSecuritySummary(req, res));

export default router;