
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Property from '../model/propertyModel';
import {  PropertyStatus } from '../types/propertyType';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');

/**
 * Restauration d'une propriété (annulation de la suppression logique)
 * @route PUT /api/properties/:id/restore
 * @access Privé (propriétaire, administrateur)
 */
 const restoreProperty = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    
    // Vérifier si la propriété existe
    const property = await Property.findById(id);
    
    if (!property) {
      await session.abortTransaction();
      session.endSession();
      
      res.status(404).json({
        success: false,
        message: 'Propriété non trouvée'
      });
      return;
    }
    
    // Restaurer la propriété
    await Property.findByIdAndUpdate(
      id,
      { 
        isActive: true, 
        status: PropertyStatus.AVAILABLE 
      },
      { session }
    );
    
    // Mettre à jour les statistiques liées si nécessaire
    await mongoose.model('User').findByIdAndUpdate(
      property.ownerId,
      { $inc: { activePropertyCount: 1 } },
      { session }
    );
    
    await session.commitTransaction();
    session.endSession();
    
    logger.info(`Propriété restaurée: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Propriété restaurée avec succès'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    logger.error(`Erreur lors de la restauration de la propriété ${req.params.id}:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la restauration de la propriété',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
export default restoreProperty