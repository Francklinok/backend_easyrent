import { Request, Response, NextFunction, RequestHandler } from 'express';
import { param, validationResult } from 'express-validator';
import mongoose from 'mongoose';

const validations = [
  param('id')
    .notEmpty().withMessage('L\'ID de la propriété est requis')
    .bail()
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('L\'ID de la propriété n\'est pas valide'),
];

const validatePropertyId: RequestHandler = async (req, res, next) => {
  for (const validation of validations) {
    await validation.run(req);
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Ici on envoie la réponse ET on fait un return simple (sans retourner res)
    res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.msg,
        message: err.msg,
      })),
    });
    return; // STOP sans return de valeur
  }

  next();
};

export default validatePropertyId;
