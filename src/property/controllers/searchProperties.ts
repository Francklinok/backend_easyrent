import { Request, Response } from 'express';
import Property from '../model/propertyModel';
import { createLogger } from '../../utils/logger/logger';
const logger = createLogger('propertyController');

/**
 * Recherche de propriétés avec requête texte
 * @route GET /api/properties/search
 * @access Public
 */
 const searchProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extraction des paramètres de requête avec types appropriés
    const q = req.query.q as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
   
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
    const skip = (page - 1) * limit;
   
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
      .limit(limit)
      .populate('ownerId', 'name email phone')
      .lean();
   
    logger.info(`Recherche "${q}": ${properties.length} résultats trouvés`);
   
    res.status(200).json({
      success: true,
      data: {
        properties,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
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

export default searchProperties