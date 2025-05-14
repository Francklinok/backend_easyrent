import { Config } from "../type";
import baseConfig from "../base";

/**
 * Configuration spécifique à l'environnement de production
 */
const prodConfig: Partial<Config> = {
  app: {
    ...baseConfig.app,
    frontendUrl: process.env.FRONTEND_URL!,
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  security: {
    level: 'high',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limite plus stricte en production
    },
  },
  logging: {
    level: 'warn',
    format: 'combined',
  },
};

export default prodConfig;