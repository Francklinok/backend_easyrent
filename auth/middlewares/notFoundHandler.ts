
import { Request, Response } from 'express';
import { createLogger } from '../../src/utils/logger/logger';

const logger = createLogger('AuthMiddleware');

/**
 * Middleware pour capturer les routes non trouvées
 */
 const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route non trouvée', { path: req.path, method: req.method });
  
  res.status(404).json({
    success: false,
    message: 'Ressource non trouvée'
  });
};
export  default  notFoundHandler