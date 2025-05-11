
import { Request, Response, NextFunction } from 'express';

/**
 * Sanitize le corps de la requête pour éviter les injections NoSQL
 */
export const sanitizeMongoose = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    // Supprimer les opérateurs MongoDB du corps de la requête
    const sanitize = (obj: any): any => {
      if (obj instanceof Object) {
        for (const key in obj) {
          if (key.startsWith('$')) {
            delete obj[key];
          } else if (obj[key] instanceof Object) {
            obj[key] = sanitize(obj[key]);
          }
        }
      }
      return obj;
    };

    req.body = sanitize(req.body);
  }
  next();
};