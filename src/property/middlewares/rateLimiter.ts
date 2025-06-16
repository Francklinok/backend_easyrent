// middlewares/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';

const rateLimiter = (windowMs: number, maxRequests: number) => {
  const requests: Record<string, { count: number; resetTime: number }> = {};

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const ip = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown') as string;

    // Nettoyer les IP expirées
    for (const key in requests) {
      if (now > requests[key].resetTime) {
        delete requests[key];
      }
    }

    if (!requests[ip]) {
      requests[ip] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    if (now > requests[ip].resetTime) {
      // Réinitialise la fenêtre
      requests[ip].count = 0;
      requests[ip].resetTime = now + windowMs;
    }

    if (requests[ip].count >= maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Trop de requêtes, veuillez réessayer plus tard',
      });
      return;
    }

    requests[ip].count += 1;

    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - requests[ip].count).toString(),
      'X-RateLimit-Reset': Math.ceil(requests[ip].resetTime / 1000).toString(),
    });

    next();
  };
};

export default rateLimiter;
