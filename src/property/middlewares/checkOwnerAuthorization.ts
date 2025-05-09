import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { createLogger } from '../../utils/logger/logger';

// Tu dois typer req.user — on utilise une interface pour étendre Request
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role?: string;
  };
}

const logger = createLogger('propertyMiddleware');

/**
 * Middleware pour vérifier l'autorisation du propriétaire
 */
const checkOwnerAuthorization = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const propertyId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({  
        success: false, 
        message: 'Authentification requise' 
      });
      return;
    }

    const Property = mongoose.model('Property'); // ou importe directement le modèle si tu préfères
    const property = await Property.findById(propertyId);

    if (!property) {
      res.status(404).json({ 
        success: false, 
        message: 'Propriété non trouvée' 
      });
      return;
    }

    if (property.ownerId.toString() !== userId && req.user?.role !== 'admin') {
      res.status(403).json({ 
        success: false, 
        message: 'Vous n\'êtes pas autorisé à effectuer cette action' 
      });
      return;
    }

    next(); // autorisé, passe au prochain middleware
  } catch (error) {
    logger.error('Erreur lors de la vérification de l\'autorisation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la vérification de l\'autorisation' 
    });
  }
};

export default checkOwnerAuthorization;
