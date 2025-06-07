// rateLimiterMiddleware.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisInstance from '../../users/services/redisInstance';

const redisClient = redisInstance.getRedisClient();

const apiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard',
  },
});

export default apiLimiter;
