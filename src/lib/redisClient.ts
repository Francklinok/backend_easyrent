import Redis from 'ioredis';
import config from '../../config';

export const redisForBullMQ = new Redis(config.redis?.url || '');

redisForBullMQ.on('error', (err) => {
  console.error('Redis error for BullMQ:', err);
});

export const getRedisClient = () => redisForBullMQ;
