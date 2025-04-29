
import {  validationResult } from 'express-validator';

/**
 * Fonction utilitaire pour valider les résultats des validations
 */
export  function validateResults(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  
  next();
}
