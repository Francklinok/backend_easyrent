import Redis from 'ioredis';
import config from '../../config';

// Créer le client Redis avec une connexion lazy pour éviter les crashes
let redisForBullMQ: Redis | null = null;

try {
  if (config.redis?.url) {
    redisForBullMQ = new Redis(config.redis.url, {
      lazyConnect: true, // Ne pas se connecter immédiatement
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('Redis connection failed after 3 attempts, giving up');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some(target => err.message.includes(target));
      },
    });

    redisForBullMQ.on('error', (err) => {
      console.error('Redis error for BullMQ:', err.message);
      // Ne pas throw, juste logger
    });

    redisForBullMQ.on('connect', () => {
      console.log('✅ Redis for BullMQ connected successfully');
    });

    // Essayer de se connecter de manière asynchrone sans bloquer
    redisForBullMQ.connect().catch(err => {
      console.warn('⚠️ Redis for BullMQ initial connection failed, will retry:', err.message);
    });
  } else {
    console.warn('⚠️ Redis URL not configured, BullMQ features will be limited');
  }
} catch (error) {
  console.error('Error initializing Redis client:', error);
  redisForBullMQ = null;
}

export { redisForBullMQ };
export const getRedisClient = () => redisForBullMQ;
