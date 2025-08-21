import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../users/types/userTypes';
/*
 * Middleware pour la vérification des rôles
 */
 const authorizeRoles = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès non autorisé: utilisateur non authentifié' 
      });
    }

    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès interdit: rôle insuffisant' 
      });
    }

    next();
  };
};
export  default authorizeRoles