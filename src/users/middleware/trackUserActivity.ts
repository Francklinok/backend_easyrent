import { UserPresenceService } from "../services/userPresence";
import { PresenceStatus } from "../services/userPresence";


// Exemple d'intégration avec AuthService
// Pour mettre à jour AuthService.ts, ajoutez cette méthode:

/**
 * Middleware pour suivre l'activité des utilisateurs
 * À ajouter dans une classe middleware ou dans le authMiddleware.ts
 */
export const trackUserActivity = (presenceService: UserPresenceService) => {
  return async (req: Request, res: Response, next: Function) => {
    try {
      const userId = req.user?.userId;
      
      if (userId) {
        // Mettre à jour la présence de l'utilisateur
        await presenceService.updatePresence(userId, PresenceStatus.ONLINE, {
          ip: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          deviceId: req.headers['x-device-id'] as string || undefined
        });
      }
    } catch (error) {
      // Ne pas bloquer la requête en cas d'erreur de tracking
      console.error('Error tracking user activity:', error);
    }
    
    next();
  };
};
