
import { Request, Response } from 'express';
import Property from '../../models/propertyModel/propertyModel';
import {  PaginationOptions } from '../../type/propertyType';
import { createLogger } from '../utils/logger';

const logger = createLogger('propertyController');


/**
 * Recherche de propriétés avec requête texte
 * @route GET /api/properties/search
 * @access Public
 */
export const searchProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, page = 1, limit = 10 } = req.query as { q: string } & PaginationOptions;
    
    if (!q || q.trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Le paramètre de recherche est requis'
      });
      return;
    }
    
    // Calculer le nombre total de propriétés correspondant à la recherche
    const total = await Property.countDocuments({
      $text: { $search: q },
      isActive: true
    });
    
    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Exécuter la recherche en utilisant l'index de texte
    const properties = await Property.find(
      {
        $text: { $search: q },
        isActive: true
      },
      { score: { $meta: 'textScore' } } // Ajouter le score de pertinence
    )
      .sort({ score: { $meta: 'textScore' } }) // Trier par pertinence
      .skip(skip)
      .limit(Number(limit))
      .populate('ownerId', 'name email phone')
      .lean();
    
    logger.info(`Recherche "${q}": ${properties.length} résultats trouvés`);
    
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
    logger.error('Erreur lors de la recherche de propriétés:', error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de propriétés',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
