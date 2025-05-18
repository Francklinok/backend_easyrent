
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../src/utils/logger/logger';
import config from '../../config';

const logger = createLogger('ErrorHandler');

/**
 * Gestionnaire d'erreurs centralisé
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Journaliser l'erreur
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || 'Erreur interne du serveur';
  
  logger.error('Erreur serveur', {
    statusCode,
    message: errorMessage,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  // Préparer la réponse
  const response = {
    success: false,
    message: errorMessage,
    ...(config.app.env === 'development' && { stack: err.stack })

  };

  // Envoyer la réponse
  res.status(statusCode).json(response);
};
