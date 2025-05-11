

import { Request, Response, NextFunction } from 'express';
import createLogger from '../../utils/logger/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('RequestLogger');

/**
 * Middleware pour attribuer un ID unique à chaque requête et journaliser
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Attribuer un ID unique à la requête pour le suivi
  const requestId = uuidv4();
  req.requestId = requestId;
  
  // Enregistrer les informations de base de la requête
  const startTime = Date.now();
  const logData = {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.userId
  };
  
  logger.info('Requête reçue', logData);
  
  // Capturer la fin de la requête pour enregistrer la durée et le code de statut
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Requête terminée', {
      ...logData,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
};
