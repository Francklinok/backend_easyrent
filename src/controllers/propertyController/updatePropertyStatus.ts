
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Property from '../../models/propertyModel/propertyModel';
import { PropertyCreateDTO, PropertyUpdateDTO, PropertyQueryFilters, PaginationOptions, PropertyStatus } from '../../type/propertyType';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyController');

/**
 * Mise à jour du statut d'une propriété
 * @route PATCH /api/properties/:id/status
 * @access Privé (propriétaire, administrateur)
 */
export const updatePropertyStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: PropertyStatus };
    
    if (!Object.values(PropertyStatus).includes(status)) {
      res.status(400).json({
        success: false,
        message: `Statut invalide. Les statuts valides sont: ${Object.values(PropertyStatus).join(', ')}`
      });
      return;
    }
    
    const property = await Property.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).lean();
    
    if (!property) {
      res.status(404).json({
        success: false,
        message: 'Propriété non trouvée'
      });
      return;
    }
    
    logger.info(`Statut de la propriété ${id} mis à jour: ${status}`);
    
    res.status(200).json({
      success: true,
      message: 'Statut de la propriété mis à jour avec succès',
      data: property
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour du statut de la propriété ${req.params.id}:`, error);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut de la propriété',
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
};
