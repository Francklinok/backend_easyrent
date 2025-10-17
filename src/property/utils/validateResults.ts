import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Middleware pour valider les résultats des validations express-validator
 * Si des erreurs de validation sont trouvées, renvoie une réponse 400 avec les erreurs
 */
export const validateResults = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      errors: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : undefined,
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }))
    });
    return;
  }

  next();
};
