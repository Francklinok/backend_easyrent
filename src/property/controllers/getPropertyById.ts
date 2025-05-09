
import { Request, Response } from 'express';
import Property from '../model/propertyModel';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');


/**
 * Récupération d'une propriété par ID
 * @route GET /api/properties/:id
 * @access Public
 */
 const getPropertyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Utiliser findOne pour éviter les erreurs de cast automatiques
    const property = await Property.findOne({ _id: id })
      .populate('ownerId', 'name email phone')
      .lean();
    
    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Propriété non trouvée'
      });
      return;
    }
    
    logger.info(`Propriété récupérée: ${id}`);
    
    res.status(200).json({
      success: true,
      data: property
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération de la propriété ${req.params.id}:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la propriété',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
export default getPropertyById