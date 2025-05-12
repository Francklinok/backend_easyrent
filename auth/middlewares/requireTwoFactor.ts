
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../services/authService';
import createLogger from '../../utils/logger/logger';

const logger = createLogger('AuthMiddleware');
const authService = new AuthService();


/**
 * Middleware pour l'authentification à deux facteurs
 */
 const requireTwoFactor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès non autorisé: utilisateur non authentifié' 
      });
    }

    // Vérifier si l'utilisateur a activé 2FA et s'il a validé sa session
    const { userId } = req.user;
    const hasTwoFactorEnabled = await authService.hasTwoFactorEnabled(userId);
    
    if (hasTwoFactorEnabled) {
      const isTwoFactorAuthenticated = req.session?.twoFactorAuthenticated === true;
      
      if (!isTwoFactorAuthenticated) {
        return res.status(403).json({
          success: false,
          message: 'Authentification à deux facteurs requise',
          requireTwoFactor: true
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Erreur lors de la vérification 2FA', { 
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      userId: req.user?.userId 
    });
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la vérification 2FA' 
    });
  }
};

export  default requireTwoFactor;