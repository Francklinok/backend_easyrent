
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Property from '../../models/propertyModel/propertyModel';
import {  PropertyUpdateDTO} from '../../type/propertyType';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');


/**
 * Mise à jour d'une propriété
 * @route PUT /api/properties/:id
 * @access Privé (propriétaire, administrateur)
 */
export const updateProperty = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const updateData: PropertyUpdateDTO = req.body;
    
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
    
    // Appliquer les mises à jour avec optimisation
    // Utiliser findOneAndUpdate pour éviter de charger le document en mémoire
    const updatedProperty = await Property.findOneAndUpdate(
      { _id: id },
      { $set: updateData },
      { 
        new: true, // Retourner le document mis à jour
        runValidators: true, // Exécuter les validateurs
        session 
      }
    ).lean();
    
    await session.commitTransaction();
    session.endSession();
    
    logger.info(`Propriété mise à jour: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Propriété mise à jour avec succès',
      data: updatedProperty
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    logger.error(`Erreur lors de la mise à jour de la propriété ${req.params.id}:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la propriété',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
