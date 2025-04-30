
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Property from '../../models/propertyModel/propertyModel';
import {  PropertyStatus } from '../../type/propertyType';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');


/**
 * Suppression d'une propriété (logique)
 * @route DELETE /api/properties/:id
 * @access Privé (propriétaire, administrateur)
 */
 const deleteProperty = async (req: Request, res: Response): Promise<void> => {
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
    
    // Suppression logique (marquer comme inactif)
    await Property.findByIdAndUpdate(
      id,
      { 
        isActive: false, 
        status: PropertyStatus.REMOVED 
      },
      { session }
    );
    
    // Mettre à jour les statistiques liées si nécessaire
    await mongoose.model('User').findByIdAndUpdate(
      property.ownerId,
      { $inc: { activePropertyCount: -1 } },
      { session }
    );
    
    await session.commitTransaction();
    session.endSession();
    
    logger.info(`Propriété supprimée (logique): ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Propriété supprimée avec succès'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    logger.error(`Erreur lors de la suppression de la propriété ${req.params.id}:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la propriété',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
export  default deleteProperty