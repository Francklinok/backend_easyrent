
import { Request, Response } from 'express';
import Property from '../model/propertyModel';
import {  PropertyQueryFilters, PaginationOptions} from '../types/propertyType';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');

/**
 * Récupération de toutes les propriétés avec filtrage et pagination
 * @route GET /api/properties
 * @access Public
 */
 const getProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      area,
      minRent,
      maxRent,
      minBedrooms,
      ownerId,
      status,
      isActive = true,
      availableFrom,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query as unknown as PropertyQueryFilters & PaginationOptions;
    
    // Construire les filtres
    const filters: Record<string, any> = { isActive };
    
    if (area) filters.area = area;
    if (minRent) filters.monthlyRent = { $gte: minRent };
    if (maxRent) filters.monthlyRent = { ...filters.monthlyRent, $lte: maxRent };
    if (minBedrooms) filters.bedrooms = { $gte: minBedrooms };
    if (ownerId) filters.ownerId = ownerId;
    if (status) filters.status = status;
    if (availableFrom) filters.availableFrom = { $lte: availableFrom };
    
    // Construire les options de tri
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1
    };
    
    // Calculer le nombre total de propriétés correspondant aux filtres
    const total = await Property.countDocuments(filters);
    
    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Exécuter la requête avec optimisation (projection, champs spécifiques)
    const properties = await Property.find(filters)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .populate('ownerId', 'name email phone') // Charger uniquement les champs nécessaires
      .lean(); // Convertir en objets JavaScript simples pour une meilleure performance
    
    logger.info(`Récupération de ${properties.length} propriétés`);
    
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
    logger.error('Erreur lors de la récupération des propriétés:', error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des propriétés',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
export default getProperties