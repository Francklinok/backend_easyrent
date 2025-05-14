import dotenv from 'dotenv';
import { Config } from './type';
// Chargement des variables d'environnement
dotenv.config();

/**
 * Interface principale de configuration
 */

/**
 * Validation des variables d'environnement obligatoires
 */
const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DATABASE_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Environment variable ${envVar} is required`);
  }
}

/**
 * Configuration de base commune à tous les environnements
 */
const baseConfig: Config = {
  app: {
    name: 'easyrent',
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    passwordSaltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10),
    mfaEnabled: process.env.MFA_ENABLED === 'true',
  },
  database: {
    url: process.env.DATABASE_URL!,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  storage: {
    provider: (process.env.STORAGE_PROVIDER as 'local' | 's3' | 'azure') || 'local',
    bucketName: process.env.STORAGE_BUCKET || 'easyrent-local',
  },
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    fromAddress: process.env.SMTP_FROM || 'noreply@easyrent.com',
  },
  security: {
    level: (process.env.SECURITY_LEVEL as 'low' | 'medium' | 'high' | 'adaptive') || 'adaptive',
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'], // Tu peux le rendre configurable aussi si besoin
  }
};

// Exportation de la configuration de base
export default baseConfig;