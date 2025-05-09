
import { Request, Response } from 'express';
import Property from '../model/propertyModel';
import {  PropertyStatus } from '../../type/propertyType';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');

/**
 * Récupération des propriétés similaires
 * @route GET /api/properties/:id/similar
 * @access Public
 */
 const getSimilarProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query as { limit?: number };
    
    // Récupérer la propriété de référence
    const property = await Property.findById(id).lean();
    
    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Propriété non trouvée'
      });
      return;
    }
    
    // Construire une requête pour trouver des propriétés similaires
    const similarProperties = await Property.find({
      _id: { $ne: id }, // Exclure la propriété actuelle
      isActive: true,
      status: PropertyStatus.AVAILABLE,
      area: property.area, // Même quartier
      $or: [
        { bedrooms: property.bedrooms }, // Même nombre de chambres
        { monthlyRent: { $gte: property.monthlyRent * 0.8, $lte: property.monthlyRent * 1.2 } } // Prix similaire (±20%)
      ]
    })
      .limit(Number(limit))
      .lean();
    
    logger.info(`Propriétés similaires à ${id}: ${similarProperties.length} trouvées`);
    
    res.status(200).json({
      success: true,
      data: similarProperties
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des propriétés similaires à ${req.params.id}:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des propriétés similaires',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};

export default getSimilarProperties