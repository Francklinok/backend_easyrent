
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../users/services/authService';
import { createLogger } from '../../utils/logger/logger';
import { UserService } from '../../users/services/userService';

const logger = createLogger('AuthMiddleware');
const authService = new AuthService();
const   userService  =  new UserService()
import 'express';



/**
 * Middleware pour l'authentification à deux facteurs
 */
 const requireTwoFactor = async (req: Request, res: Response, next: NextFunction):Promise<void> => {
  try {
    if (!req.user) {
       res.status(401).json({ 
        success: false, 
        message: 'Accès non autorisé: utilisateur non authentifié' 
        
      });
      return 
    }

    // Vérifier si l'utilisateur a activé 2FA et s'il a validé sa session
    const { userId } = req.user;
    const hasTwoFactorEnabled = await userService.hasTwoFactorEnabled(userId);
    
    if (hasTwoFactorEnabled) {
      const isTwoFactorAuthenticated = req.user.twoFactorAuthenticated === true;
      
      if (!isTwoFactorAuthenticated) {
         res.status(403).json({
          success: false,
          message: 'Authentification à deux facteurs requise',
          requireTwoFactor: true
        });
        return 
      }
    }

    next();
  } catch (error) {
    logger.error('Erreur lors de la vérification 2FA', { 
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      userId: req.user?.userId 
    });
     res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la vérification 2FA' 
    });
    return
  }
};

export  default requireTwoFactor;