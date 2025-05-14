corrig e  moi  pour  avoir  un config  de  tres  haut   niveau"const  dev =  {
    database:{
        uri:"databse url",
    },
    logging:{
        level:'debug',
        format:'dev',
    }
}
export default devconst  prod = {
database:{
    uri:process.env.MONGO_URI,
},
logging:{
    level:'warn',
    format:'combined'
}
}
export default prodimport  dotenv from  'dotenv'
dotenv.config();
interface EnvConfig{
  PORT: number;
  NODE_ENV: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  DATABASE_URL: string;
  REDIS_URL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  PASSWORD_SALT_ROUNDS: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
  SECURITY_LEVEL: 'standard' | 'high' | 'adaptive';
  MFA_ENABLED: boolean;
}
*//validation  des variables d environnement  obligatoir*
const  requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DATABASE_URL'
];
for(const envVar of requiredEnvVars){
  if(!process.env[envVar]){
    throw new Error(`Environment variable ${envVar} is required`);
  }
}
const  base:EnvConfig =  {
  app: {
    name: 'easyrent',
    port: parseInt(process.env.PORT || '3000',10),
    env: process.env.NODE_ENV || 'development',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    passwordSaltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '10', 10),
    mfaEnabled: process.env.MFA_ENABLED === 'true',
  },
  databse:{
    url:process.env.DATABASE_URLL!,
  },
  redis:{
    url: process.env.REDIS_URL,
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    bucketName: process.env.STORAGE_BUCKET || 'easyrent-local',
  },
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
  security:{
    level:(process.env.SECURITY_LEVEL as 'low'|'medium'|'high'| 'adaptive') || 'adaptive',
    rateLimit:{
      windowMs:parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      max:parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
    }
  }
};
export default baseimport base from './base';
import  dev from './env/developpement'
import  prod from './env/production'
const env = process.env.NODE_ENV || 'development';
const envConfig = {
  development: dev,
  production: prod,
};
export default {
  ...base,
  ...(envConfig[env] || {}),
};