
import dotenv from 'dotenv';
import { Config } from './type';

// Chargement des variables d'environnement
dotenv.config();

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
 * Fonction helper pour valider et récupérer une variable d'environnement string
 */
function getRequiredEnvString(key: string): string {
  const value = process.env[key];
  if (!value || typeof value !== 'string') {
    throw new Error(`Environment variable ${key} is required and must be a string`);
  }
  return value;
}

function getEmailStrategy(): 'smtp-first' | 'sendgrid-first' {
  const val = process.env.EMAIL_STRATEGY;
  if (val !== 'smtp-first' && val !== 'sendgrid-first') {
    throw new Error(`EMAIL_STRATEGY must be either 'smtp-first' or 'sendgrid-first'`);
  }
  return val;
}
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim(); // supprime les espaces involontaires
}

export const getTokenExpirationInSeconds = (duration: string): number => {
  const timeUnits: Record<string, number> = {
    's': 1,
    'm': 60,
    'h': 3600,
    'd': 86400,
    'w': 604800
  };
  
  const match = duration.match(/^(\d+)([smhdw])$/);
  if (!match) return 900; // Default 15 minutes
  
  const [, value, unit] = match;
  return parseInt(value) * (timeUnits[unit] || 60);
};
/**
 * Configuration de base commune à tous les environnements
 */
const baseConfig: Config = {
  app: {
    name: 'easyrent',
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    host: process.env.HOST || "localhost",
  },
  auth: {
    jwtSecret: getRequiredEnvString('JWT_SECRET'),
    jwtRefreshSecret: getRequiredEnvString('JWT_REFRESH_SECRET'),
     jwtExpiresIn: process.env.NODE_ENV === 'development' 
    ? (process.env.JWT_EXPIRES_IN || '2h')  // Plus long en dev pour les tests
    : (process.env.JWT_EXPIRES_IN || '15m'), // Court en production
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    passwordSaltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10),
    mfaEnabled: process.env.MFA_ENABLED === 'true',
    tokenCleanupInterval: process.env.TOKEN_CLEANUP_INTERVAL || '1h',
    maxRefreshTokensPerUser: parseInt(process.env.MAX_REFRESH_TOKENS_PER_USER || '5', 10),
  },
  database: {
    url: getRequiredEnvString('DATABASE_URL'),
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
   redis: {
    url: requireEnv('REDIS_URL'),
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '10', 10),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
  },
  storage: {
    provider: (process.env.STORAGE_PROVIDER as 'local' | 's3' | 'azure') || 'local',
    bucketName: process.env.STORAGE_BUCKET || 'easyrent-local',
  },
  // ✅ Configuration email corrigée
  email: {
    strategy: getEmailStrategy(),
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    fromAddress: process.env.SMTP_FROM || 'noreply@easyrent.com',
    timeout: parseInt(process.env.SMTP_TIMEOUT || '15000', 10),
    pool: process.env.SMTP_POOL === 'true',
    maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS || '5', 10),
    enabled: process.env.SMTP_ENABLED !== 'false' &&
      !!(
            process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS &&
            process.env.SMTP_PORT
          ),
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    enabled: process.env.SENDGRID_ENABLED === 'true',
    fromAddress:process.env.SENDGRID_FROM_EMAIL || 'noreply@easyrent.com'
  },
  webpush: {
    enabled: process.env.WEBPUSH_ENABLED === 'true',
    vapidSubject: process.env.VAPID_SUBJECT,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY!,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY!
  },

  firebase: {
    enabled: process.env.FIREBASE_ENABLED === 'true',
    projectId: process.env.FIREBASE_PROJECT_ID!,
    serviceAccount: {
      type: process.env.FIREBASE_TYPE!,
      project_id: process.env.FIREBASE_PROJECT_ID!,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID!,
      private_key: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL!,
      client_id: process.env.FIREBASE_CLIENT_ID!,
      auth_uri: process.env.FIREBASE_AUTH_URI!,
      token_uri: process.env.FIREBASE_TOKEN_URI!,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL!,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL!
    },},
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
    methods: ['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE'],
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100')
  },
  messageMaxLength: parseInt(process.env.CHAT_MESSAGE_MAX_LENGTH || '10000', 10),
  typingTimeout: parseInt(process.env.TYPING_TIMEOUT || '10000', 10),
    cacheTTL: {
      conversation: 3600,
      userConversations: 300,
      searchIndex: 3600 * 24 * 7,
      patterns: 3600 * 12,
      reactions: 3600 * 24 * 30,
    },
    pagination: {
      defaultLimit: 20,
      maxLimit: 100,
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      ivLength: 16,
      secretKey: Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex')
    },
    imageVariants: {
      thumbnail: { width: 150, height: 150, quality: 60 },
      medium: { width: 800, height: 600, quality: 80 },
      large: { width: 1920, height: 1080, quality: 90 },
    },
   
   
  
  };



export default baseConfig;