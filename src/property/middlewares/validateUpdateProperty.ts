import { body, param } from 'express-validator';
import mongoose from 'mongoose';
import { PropertyStatus } from '../../type/propertyType';
import { validateResults } from '../utils/validateResults';

/**
 * Middleware pour valider la mise à jour d'une propriété
 */
 const validateUpdateProperty = [
  param('id')
    .notEmpty()
    .withMessage('L\'ID de la propriété est requis')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('L\'ID de la propriété n\'est pas valide'),
  
  body('title')
    .optional()
    .isString()
    .withMessage('Le titre doit être une chaîne de caractères')
    .isLength({ max: 50 })
    .withMessage('Le titre ne peut pas dépasser 50 caractères')
    .trim(),
  
  body('description')
    .optional()
    .isString()
    .withMessage('La description doit être une chaîne de caractères')
    .isLength({ min: 80 })
    .withMessage('La description doit contenir au moins 80 caractères')
    .trim(),
  
  body('address')
    .optional()
    .isString()
    .withMessage('L\'adresse doit être une chaîne de caractères')
    .isLength({ min: 10 })
    .withMessage('L\'adresse doit contenir au moins 10 caractères')
    .trim(),
  
  body('monthlyRent')
    .optional()
    .isNumeric()
    .withMessage('Le loyer mensuel doit être un nombre')
    .custom((value) => value >= 0)
    .withMessage('Le loyer mensuel doit être un nombre positif'),
  
  body('depositAmount')
    .optional()
    .isNumeric()
    .withMessage('Le montant de la caution doit être un nombre')
    .custom((value) => value >= 0)
    .withMessage('Le montant de la caution doit être un nombre positif'),
  
  body('maxOccupants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le nombre maximum d\'occupants doit être un entier positif'),
  
  body('bedrooms')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le nombre de chambres doit être un entier positif ou nul'),
  
  body('bathrooms')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le nombre de salles de bain doit être un entier positif ou nul'),
  
  body('area')
    .optional()
    .isString()
    .withMessage('La zone/quartier doit être une chaîne de caractères')
    .trim(),
  
  body('images')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Au moins une image est requise')
    .custom((value) => {
      if (!Array.isArray(value)) return false;
      return value.every((item) => typeof item === 'string' && item.trim().length > 0);
    })
    .withMessage('Toutes les images doivent être des URLs valides'),
  
  body('amenities')
    .optional()
    .isArray()
    .withMessage('Les commodités doivent être un tableau')
    .custom((value) => {
      if (!Array.isArray(value)) return true;
      return value.every((item) => typeof item === 'string' && item.trim().length > 0);
    })
    .withMessage('Toutes les commodités doivent être des chaînes de caractères non vides'),
  
  body('availableFrom')
    .optional()
    .isISO8601()
    .withMessage('La date de disponibilité doit être une date ISO 8601 valide')
    .toDate(),
  
  body('surface')
    .optional()
    .isNumeric()
    .withMessage('La surface doit être un nombre')
    .custom((value) => value >= 1)
    .withMessage('La surface doit être un nombre positif'),
  
  body('rooms')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le nombre de pièces doit être un entier positif'),
  
  body('status')
    .optional()
    .isIn(Object.values(PropertyStatus))
    .withMessage(`Le statut doit être l'un des suivants: ${Object.values(PropertyStatus).join(', ')}`),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive doit être un booléen'),
  
  // Validation personnalisée pour vérifier que le nombre de chambres et de salles de bain ne dépasse pas le nombre de pièces
  body().custom((value) => {
    const { bedrooms, bathrooms, rooms } = value;
    
    if (rooms !== undefined && bedrooms !== undefined && bathrooms !== undefined && 
        (bedrooms + bathrooms > rooms)) {
      throw new Error('Le nombre total de chambres et salles de bain ne peut pas dépasser le nombre de pièces');
    }
    
    return true;
  }),
  
  validateResults
];
export  default validateUpdateProperty;