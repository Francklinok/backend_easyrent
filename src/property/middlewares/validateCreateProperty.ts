import { body } from 'express-validator';
import mongoose from 'mongoose';
import { PropertyStatus } from '../types/propertyType';
import { validateResults } from '../utils/validateResults';

const validateCreateProperty = [
    body('title')
        .notEmpty()
        .withMessage('the title  is required')
        .isString()
        .withMesage('The title must  be a  string')
        .islength({max:50})
        .widthMessage('title  will  not  have  more  than 50 chararcter')
        .trim(),
    
    body('description')
        .notEmpty()
        .withMessage('La description est requise')
        .isString()
        .withMessage('La description doit être une chaîne de caractères')
        .isLength({ min: 80 })
        .withMessage('La description doit contenir au moins 80 caractères')
        .trim(),
      
    body('address')
        .notEmpty()
        .withMessage('L\'adresse est requise')
        .isString()
        .withMessage('L\'adresse doit être une chaîne de caractères')
        .isLength({ min: 10 })
        .withMessage('L\'adresse doit contenir au moins 10 caractères')
        .trim(),
      
    body('monthlyRent')
        .notEmpty()
        .withMessage('Le loyer mensuel est requis')
        .isNumeric()
        .withMessage('Le loyer mensuel doit être un nombre')
        .custom((value) => value >= 0)
        .withMessage('Le loyer mensuel doit être un nombre positif'),

    body('depositAmount')
      .optional()
      .isNumeric()
      .withMessage('Le montant de la caution doit être un nombre')
      .custom((value) =>value >= 0)
      .withMessage('Le montant de la caution doit être un nombre positif'),
    
    
    body('maxOccupants')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Le nombre maximum d\'occupants doit être un entier positif'),
    
    body('bedrooms')
        .notEmpty()
        .withMessage('Le nombre de chambres est requis')
        .isInt({ min: 0 })
        .withMessage('Le nombre de chambres doit être un entier positif ou nul'),
    
    body('bathrooms')
        .notEmpty()
        .withMessage('Le nombre de salles de bain est requis')
        .isInt({ min: 0 })
        .withMessage('Le nombre de salles de bain doit être un entier positif ou nul'),
    
    body('area')
        .notEmpty()
        .withMessage('La zone/quartier est requise')
        .isString()
        .withMessage('La zone/quartier doit être une chaîne de caractères')
        .trim(),
    
    body('ownerId')
        .notEmpty()
        .withMessage('L\'identifiant du propriétaire est requis')
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage('L\'identifiant du propriétaire n\'est pas valide'),
    
    body('images')
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
        .notEmpty()
        .withMessage('La surface est requise')
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
    
    // Validation personnalisée pour vérifier que le nombre de chambres et de salles de bain ne dépasse pas le nombre de pièces
    body().custom((value) => {
        const { bedrooms, bathrooms, rooms } = value;
        
        if (rooms !== undefined && (bedrooms + bathrooms > rooms)) {
        throw new Error('Le nombre total de chambres et salles de bain ne peut pas dépasser le nombre de pièces');
        }
        
        return true;
    }),
    
    validateResults
]

export default validateCreateProperty;