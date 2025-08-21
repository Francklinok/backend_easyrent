import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisInstance from '../../services/redisInstance';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger("apilimiter");

const redisClient = redisInstance.getRedisClient();

const apiLimiter = rateLimit({
  store: redisClient
    ? new RedisStore({
        // Directly forward args, ensuring Promise<RedisReply> return type
        sendCommand: (...args: string[]) =>
          redisClient.sendCommand(args as any) as Promise<any>,
      })
    : undefined,
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard',
  },
});

export default apiLimiter;
