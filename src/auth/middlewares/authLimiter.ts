import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisInstance from '../../services/redisInstance';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger("apilimiter");

const redisClient = redisInstance.getRedisClient();
if (!redisClient) {
  logger.error('Redis client not available');
  throw new Error('Redis client not initialized');
}

const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) =>
      redisClient.sendCommand(args as any) as Promise<any>,
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Trop de tentatives, veuillez réessayer plus tard',
  },
  keyGenerator: (req) => `auth:${req.ip}`,
});

export default authLimiter;
