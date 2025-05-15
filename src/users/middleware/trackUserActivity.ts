import { UserPresenceService } from "../services/userPresence";
import { PresenceStatus } from "../types/presenceType";
import { Request, Response, NextFunction } from 'express';


// Exemple d'intégration avec AuthService
// Pour mettre à jour AuthService.ts, ajoutez cette méthode:

/**
 * Middleware pour suivre l'activité des utilisateurs
 * À ajouter dans une classe middleware ou dans le authMiddleware.ts
 */
export const trackUserActivity = (presenceService: UserPresenceService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;

      if (userId) {
        await presenceService.updatePresence(userId, PresenceStatus.ONLINE, {
          ip: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          deviceId: req.headers['x-device-id'] as string || undefined,
        });
      }
    } catch (error) {
      console.error('Error tracking user activity:', error);
    }

    next(); // Bien typé ici
  };
};

