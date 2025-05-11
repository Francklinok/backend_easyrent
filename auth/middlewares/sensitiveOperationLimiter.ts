import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';


// Middleware de limitation spécifique pour les opérations sensibles
export const sensitiveOperationLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 requêtes par heure
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de tentatives pour cette opération sensible, veuillez réessayer plus tard'
  }
});