// ✅ Version corrigée de rateLimiter.ts
import { Request, Response, NextFunction } from 'express';

const rateLimiter = (windowMs: number, maxRequests: number) => {
  const requests: Record<string, { count: number; resetTime: number }> = {};

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    if (!requests[ip] || now > requests[ip].resetTime) {
      requests[ip] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    if (requests[ip].count >= maxRequests) {
      res.status(429).json({
        success: false,
        message: 'Trop de requêtes, veuillez réessayer plus tard',
      });
      return; // ✅ CORRECTION ICI : return void
    }

    requests[ip].count += 1;

    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - requests[ip].count).toString(),
      'X-RateLimit-Reset': Math.ceil(requests[ip].resetTime / 1000).toString(),
    });

    next(); // continue la chaîne
  };
};

export default rateLimiter;
