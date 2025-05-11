

import { Request, Response, NextFunction } from 'express';
import createLogger from '../../utils/logger/logger';

const logger = createLogger('RBACMiddleware');

/**
 * Interface pour les modèles de permissions
 */
interface PermissionModel {
  action: string;
  resource: string;
}

/**
 * Middleware de contrôle d'accès basé sur les rôles et les permissions
 */
export const checkPermission = (requiredPermission: PermissionModel) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Accès non autorisé: utilisateur non authentifié'
        });
      }

      const { userId } = req.user;
      
      // Vérifier les permissions de l'utilisateur
      const hasPermission = await checkUserPermission(
        userId, 
        requiredPermission.action, 
        requiredPermission.resource
      );

      if (!hasPermission) {
        logger.warn('Accès refusé: permission insuffisante', {
          userId,
          requiredPermission,
          path: req.path
        });
        
        return res.status(403).json({
          success: false,
          message: 'Accès interdit: permission insuffisante'
        });
      }

      next();
    } catch (error) {
      logger.error('Erreur lors de la vérification des permissions', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        userId: req.user?.userId
      });
      
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la vérification des permissions'
      });
    }
  };
};
