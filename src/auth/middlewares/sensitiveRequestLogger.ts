import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('AuthMiddleware');


/**
 * Middleware pour journaliser les requêtes sensibles avec plus de détails
 */
 const sensitiveRequestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Ne pas journaliser les mots de passe ou autres données sensibles
  const sensitiveFields = ['password', 'token', 'secret', 'credit_card', 'cardNumber'];
  
  // Copier le corps de la requête pour la journalisation
  const safeBody = { ...req.body };
  
  // Masquer les champs sensibles
  sensitiveFields.forEach(field => {
    if (field in safeBody) {
      safeBody[field] = '********';
    }
  });
  
  logger.info('Requête sensible reçue', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    body: safeBody,
    userId: req.user?.userId
  });
  
  next();
};

export default sensitiveRequestLogger