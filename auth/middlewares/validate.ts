import { Request, Response, NextFunction } from 'express';
import createLogger from '../../utils/logger/logger';
const logger = createLogger('AuthMiddleware');



/**
 * Middleware pour valider les entrées avec express-validator
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Exécuter toutes les validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Vérifier les erreurs
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Journaliser les erreurs de validation
    logger.warn('Validation échouée', { 
      path: req.path,
      errors: errors.array(),
      body: req.body
    });

    // Retourner les erreurs
    return res.status(400).json({ 
      success: false, 
      message: 'Données invalides',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  };
};
