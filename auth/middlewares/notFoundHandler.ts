
import { Request, Response } from 'express';
import createLogger from '../../utils/logger/logger';

const logger = createLogger('AuthMiddleware');

/**
 * Middleware pour capturer les routes non trouvées
 */
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route non trouvée', { path: req.path, method: req.method });
  
  res.status(404).json({
    success: false,
    message: 'Ressource non trouvée'
  });
};
