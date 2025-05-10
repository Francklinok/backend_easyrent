
import { Request, Response, NextFunction } from 'express';
import createLogger from '../../utils/logger/logger';

const logger = createLogger('AuthMiddleware');



/**
 * Middleware pour vérifier l'authentification par token JWT
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extraire le token du header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès non autorisé: token manquant' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Valider le token
    //  const decoded = authService.validateToken(token);
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès non autorisé: token invalide' 
      });
    }

    // Attacher les données de l'utilisateur à la requête
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Erreur d\'authentification', { 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    });
    return res.status(401).json({ 
      success: false, 
      message: 'Accès non autorisé' 
    });
  }
};