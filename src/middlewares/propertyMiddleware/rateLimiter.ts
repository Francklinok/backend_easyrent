import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { PropertyStatus } from '../../type/propertyType';
import { createLogger } from '../utils/logger';

const logger = createLogger('propertyMiddleware');




/**
 * Middleware pour limiter le taux de requêtes
 */
export const rateLimiter = (windowMs: number, maxRequests: number) => {
  const requests: Record<string, { count: number, resetTime: number }> = {};
  
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Créer ou réinitialiser l'entrée si nécessaire
    if (!requests[ip] || now > requests[ip].resetTime) {
      requests[ip] = {
        count: 0,
        resetTime: now + windowMs
      };
    }
    
    // Vérifier la limite
    if (requests[ip].count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Trop de requêtes, veuillez réessayer plus tard'
      });
    }
    
    // Incrémenter le compteur
    requests[ip].count += 1;
    
    // Ajouter l'en-tête Rate-Limit
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - requests[ip].count).toString(),
      'X-RateLimit-Reset': Math.ceil(requests[ip].resetTime / 1000).toString()
    });
    
    next();
  };
};

