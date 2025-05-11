import { createClient } from 'redis';
import { envConfig } from '../../config/env.config';
import createLogger from '../../utils/logger/logger';

const logger = createLogger('RateLimiter');


// Client Redis pour le rate limiting
const redisClient = createClient({
  url: envConfig.REDIS_URL || 'redis://localhost:6379'
});

// Initialiser la connexion Redis
(async () => {
  try {
    await redisClient.connect();
    logger.info('Connexion Redis pour le rate limiter établie');
  } catch (error) {
    logger.error('Erreur de connexion Redis pour le rate limiter', { 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    });
  }
})();


