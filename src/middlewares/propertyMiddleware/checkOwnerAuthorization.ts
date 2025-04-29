import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const logger = createLogger('propertyMiddleware');

/**
 * Middleware pour vérifier l'autorisation du propriétaire
 */
export const checkOwnerAuthorization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Vérifiez si l'utilisateur est le propriétaire de la propriété
    // Note: Cette fonction assume que req.user est défini par un middleware d'authentification préalable
    // et que req.params.id contient l'ID de la propriété
    const propertyId = req.params.id;
    const userId = req.user?.id; 
    
    if (!userId) {
      return res.status(401).json({  
        success: false, 
        message: 'Authentification requise' 
      });
    }
    
    const property = await mongoose.model('Property').findById(propertyId);
    
    if (!property) {
      return res.status(404).json({ 
        success: false, 
        message: 'Propriété non trouvée' 
      });
    }
    
    // Vérifiez si l'utilisateur est le propriétaire ou un administrateur
    if (property.ownerId.toString() !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Vous n\'êtes pas autorisé à effectuer cette action' 
      });
    }
    next();
    
  } catch (error) {
    logger.error('Erreur lors de la vérification de l\'autorisation:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la vérification de l\'autorisation' 
    });
  }
};
