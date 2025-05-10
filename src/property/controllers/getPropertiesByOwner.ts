
import { Request, Response } from 'express';
import Property from '../model/propertyModel';
import {  PropertyStatus } from '../types/propertyType';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');

/**
 * Récupération des propriétés d'un propriétaire
 * @route GET /api/properties/owner/:ownerId
 * @access Public
 */
 const getPropertiesByOwner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ownerId } = req.params;
    const { page = 1, limit = 10, status } = req.query as { page?: number; limit?: number; status?: PropertyStatus };
    
    // Construire les filtres
    const filters: Record<string, any> = { 
      ownerId,
      isActive: true
    };
    
    if (status) filters.status = status;
    
    // Calculer le nombre total de propriétés correspondant aux filtres
    const total = await Property.countDocuments(filters);
    
    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Exécuter la requête
    const properties = await Property.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();
    
    logger.info(`Propriétés du propriétaire ${ownerId}: ${properties.length} trouvées`);
    
    res.status(200).json({
      success: true,
      data: {
        properties,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des propriétés du propriétaire ${req.params.ownerId}:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des propriétés du propriétaire',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
export  default  getPropertiesByOwner