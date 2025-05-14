import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import { createLogger } from '../../src/utils/logger/logger';

const logger = createLogger('AuthMiddleware');

const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next(); // ✔️ On retourne next pour que la fonction soit bien typée
    }

    logger.warn('Validation échouée', { 
      path: req.path,
      errors: errors.array(),
      body: req.body
    });

    res.status(400).json({ 
      success: false, 
      message: 'Données invalides',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });

    return; // ✔️ On termine la fonction avec return
  };
};

export default validate;
