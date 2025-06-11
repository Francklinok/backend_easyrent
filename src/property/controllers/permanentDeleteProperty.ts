
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Property from '../model/propertyModel';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');

/**
 * Suppression définitive d'une propriété (physique)
 * @route DELETE /api/properties/:id/permanent
 * @access Privé (administrateur uniquement)
 */
 const permanentDeleteProperty = async (req: Request, res: Response): Promise<void> => {
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
    
    // Suppression physique
    await Property.findByIdAndDelete(id, { session });
    
    // Mettre à jour les statistiques liées si nécessaire
    await mongoose.model('User').findByIdAndUpdate(
      property.ownerId,
      { $inc: { propertyCount: -1 } },
      { session }
    );
    
    // Supprimer des documents liés si nécessaire
    // Par exemple, supprimer les avis liés à cette propriété
    await mongoose.model('Property').deleteMany({ propertyId: id }, { session });
    
    await session.commitTransaction();
    session.endSession();
    
    logger.info(`Propriété supprimée définitivement: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Propriété supprimée définitivement'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    logger.error(`Erreur lors de la suppression définitive de la propriété ${req.params.id}:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression définitive de la propriété',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
export default  permanentDeleteProperty