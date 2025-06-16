import { Redis } from 'ioredis'; // Ajoute bien ce type ici
import { getRedisClient } from '../lib/redisClient';

class RateLimiter {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  /**
   * Vérifie si l'utilisateur a dépassé la limite d'appels
   * @param userId - ID de l'utilisateur
   * @param actionKey - Action (ex: "sendMessage")
   * @param windowInSeconds - Période de temps
   * @param maxRequests - Nombre max autorisé dans cette période
   */
  async checkLimit(
    userId: string,
    actionKey: string,
    windowInSeconds: number,
    maxRequests: number
  ) {
    const key = `rate:${actionKey}:${userId}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, windowInSeconds);
    }

    if (current > maxRequests) {
      throw {
        statusCode: 429,
        message: `Trop de requêtes. Limite de ${maxRequests} requêtes par ${windowInSeconds} secondes.`,
      };
    }
  }
}

export default RateLimiter;
