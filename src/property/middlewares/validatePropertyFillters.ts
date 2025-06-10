import { query,  validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { PropertyStatus } from '../types/propertyType';

/**
 * Middleware pour valider les filtres de recherche de propriétés
 */
export const validatePropertyFilters = [
  query('area').optional().isString().withMessage('La zone doit être une chaîne de caractères'),
  query('minRent').optional().isNumeric().withMessage('Le loyer minimum doit être un nombre'),
  query('maxRent').optional().isNumeric().withMessage('Le loyer maximum doit être un nombre'),
  query('minBedrooms').optional().isInt().withMessage('Le nombre minimum de chambres doit être un entier'),
  query('ownerId')
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('L\'identifiant du propriétaire n\'est pas valide'),
  query('status')
    .optional()
    .isIn(Object.values(PropertyStatus))
    .withMessage(`Le statut doit être l'un des suivants: ${Object.values(PropertyStatus).join(', ')}`),
  query('isActive').optional().isBoolean().withMessage('isActive doit être un booléen'),
  query('availableFrom')
    .optional()
    .isISO8601()
    .withMessage('La date de disponibilité doit être une date ISO 8601 valide'),
  query('page').optional().isInt({ min: 1 }).withMessage('La page doit être un entier positif'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('La limite doit être un entier entre 1 et 100'),
  query('sortBy').optional().isString().withMessage('Le champ de tri doit être une chaîne de caractères'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('L\'ordre de tri doit être "asc" ou "desc"'),
  validationResult
];
