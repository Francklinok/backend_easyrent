import baseConfig from './base';
import { Config } from './type';
import devConfig from './env/developpment';
import prodConfig from './env/production';

/**
 * Sélection de la configuration selon l'environnement
 */
const env = process.env.NODE_ENV || 'development';

const envConfigs: Record<string, Partial<Config>> = {
  development: devConfig,
  production: prodConfig,
};

/**
 * Configuration finale qui combine la configuration de base avec celle spécifique à l'environnement
 */
const config = {
  ...baseConfig,
  ...(envConfigs[env] || {}),
} as Config;

export default config;


