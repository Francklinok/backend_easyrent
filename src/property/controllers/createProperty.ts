// src/controllers/propertyController.ts

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Property from '../model/propertyModel';
import { PropertyCreateDTO } from '../types/propertyType';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');

/**
 * Création d'une nouvelle propriété
 * @route POST /api/properties
 * @access Privé (propriétaires, agents)
 */
 const createProperty = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const propertyData: PropertyCreateDTO = req.body;
    
    // Ajouter l'ID de l'utilisateur actuel comme propriétaire si non spécifié
    if (!propertyData.ownerId && req.user) {
      propertyData.ownerId = req.user.userId;
    }
    
    // Créer la propriété avec optimisation pour ne pas déclencher de validations inutiles
    const property = new Property(propertyData);
    await property.save({ session });
    
    // Mettre à jour les informations associées dans d'autres collections (si nécessaire)
    // Par exemple, mettre à jour le nombre de propriétés pour l'utilisateur
    await mongoose.model('User').findByIdAndUpdate(
      propertyData.ownerId,
      { $inc: { propertyCount: 1 } },
      { session }
    );
    
    await session.commitTransaction();
    session.endSession();
    
    logger.info(`Propriété créée avec succès: ${property._id}`);
    
    res.status(201).json({
      success: true,
      message: 'Propriété créée avec succès',
      data: property
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    logger.error('Erreur lors de la création de la propriété:', error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la propriété',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
export default createProperty