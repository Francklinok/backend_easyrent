import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';



// Middleware de limitation pour les requêtes API générales
export const apiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requêtes par minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard'
  }
});



