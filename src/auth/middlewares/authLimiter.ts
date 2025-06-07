import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisInstance from '../../users/services/redisInstance';

const redisClient = redisInstance.getRedisClient();

const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives max
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
