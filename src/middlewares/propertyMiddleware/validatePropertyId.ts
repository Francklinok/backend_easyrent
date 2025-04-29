import { param,validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const logger = createLogger('propertyMiddleware');

/**
 * Middleware pour valider l'ID de propriété
 */
export const validatePropertyId = [
  param('id')
    .notEmpty()
    .withMessage('L\'ID de la propriété est requis')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('L\'ID de la propriété n\'est pas valide'),
validationResult
];
