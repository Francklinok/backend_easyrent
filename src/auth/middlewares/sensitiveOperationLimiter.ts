import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisInstance from '../../services/redisInstance';

const redisClient = redisInstance.getRedisClient();

if (!redisClient) throw new Error('Redis client not available');

const sensitiveOperationLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) =>
      redisClient.sendCommand(args as any) as Promise<any>,
  }),
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Trop de tentatives pour cette opération sensible, veuillez réessayer plus tard',
  },
});

export default sensitiveOperationLimiter;
