import { param } from 'express-validator';
import mongoose from 'mongoose';
import { validateResults } from '../utils/validateResults';

/**
 * Middleware pour valider l'ID de propriété
 */
 const validatePropertyId = [
  param('id')
    .notEmpty()
    .withMessage('L\'ID de la propriété est requis')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('L\'ID de la propriété n\'est pas valide'),
validateResults
];
export  default validatePropertyId;