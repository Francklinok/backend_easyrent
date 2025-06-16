import Redis from 'ioredis';
import config from '../../config';


let redisClient: Redis;

export function getRedisClient(): Redis {
  if (!redisClient) {
     if (!config.redis?.url) {
      throw new Error('Redis URL non définie dans la configuration');
    }
    redisClient = new Redis(config.redis.url, {
      connectTimeout: 10000,
      enableOfflineQueue: false,
      retryStrategy: times => Math.min(times * 50, 2000),
    });
  }
  return redisClient;
}
