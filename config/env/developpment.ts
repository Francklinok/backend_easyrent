import { Config } from "../type";
import baseConfig from "../base";

/**
 * Configuration spécifique à l'environnement de développement
 */
const devConfig: Partial<Config> = {
  app: {
    ...baseConfig.app,
    frontendUrl: 'http://localhost:3000',
  },
  database: {
    url: 'mongodb://localhost:27017/easyrent-dev',
  },
  security: {
    level: 'low',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limite plus permissive en développement
    },
  },
  logging: {
    level: 'debug',
    format: 'dev',
  },
};

export default devConfig;