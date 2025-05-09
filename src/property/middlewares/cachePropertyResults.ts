import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('propertyMiddleware');



/**
 * Middleware pour mettre en cache les résultats des requêtes fréquentes
 * Nécessite une configuration Redis ou autre solution de cache
 */
export const cachePropertyResults = (duration: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Implémentation du cache ici
    // Exemple simple avec un cache en mémoire (pour la production, utilisez Redis)
    const cacheKey = `property:${req.originalUrl}`;
    
    // Pour l'exemple - remplacer par votre logique de cache réelle
    const cacheStore = (global as any).cacheStore || {};
    
    if (cacheStore[cacheKey]) {
      const { data, expiry } = cacheStore[cacheKey];
      
      if (expiry > Date.now()) {
        logger.debug(`Cache hit for ${cacheKey}`);
        return res.json(data);
      }
      
      // Cache expiré
      delete cacheStore[cacheKey];
    }
    
    // Intercepter la méthode res.json pour stocker le résultat en cache
    const originalJson = res.json;
    res.json = function(body) {
      if (res.statusCode === 200) {
        cacheStore[cacheKey] = {
          data: body,
          expiry: Date.now() + duration
        };
        (global as any).cacheStore = cacheStore;
      }
      
      return originalJson.call(this, body);
    };
    
    next();
  };
};
