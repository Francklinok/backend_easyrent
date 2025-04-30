import { Request, Response } from 'express';
import Property from '../../models/propertyModel/propertyModel';
import {PropertyStatus } from '../../type/propertyType';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');

/**
 * Obtenir des statistiques sur les propriétés
 * @route GET /api/properties/stats
 * @access Privé (administrateur)
 */
 const getPropertyStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // Statistiques générales
    const [
      totalProperties,
      availableProperties,
      rentedProperties,
      averageRent,
      averageSize,
      propertiesByArea,
      propertiesByStatus
    ] = await Promise.all([
      // Nombre total de propriétés actives
      Property.countDocuments({ isActive: true }),
      
      // Nombre de propriétés disponibles
      Property.countDocuments({ isActive: true, status: PropertyStatus.AVAILABLE }),
      
      // Nombre de propriétés louées
      Property.countDocuments({ isActive: true, status: PropertyStatus.RENTED }),
      
      // Loyer moyen
      Property.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, average: { $avg: '$monthlyRent' } } }
      ]),
      
      // Taille moyenne
      Property.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, average: { $avg: '$surface' } } }
      ]),
      
      // Propriétés par zone/quartier
      Property.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$area', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Propriétés par statut
      Property.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);
    
    logger.info('Statistiques des propriétés récupérées');
    
    res.status(200).json({
      success: true,
      data: {
        totalProperties,
        availableProperties,
        rentedProperties,
        averageRent: averageRent[0]?.average || 0,
        averageSize: averageSize[0]?.average || 0,
        propertiesByArea,
        propertiesByStatus
      }
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des statistiques des propriétés:', error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques des propriétés',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
export  default getPropertyStats