

export interface Config {
  app: {
    name: string;
    port: number;
    env: string;
    frontendUrl: string;
    host:string,
  };
  auth: {
    jwtSecret: string;
    jwtRefreshSecret: string;
    jwtExpiresIn: string;
    jwtRefreshExpiresIn: string;
    passwordSaltRounds: number;
    mfaEnabled: boolean;
    tokenCleanupInterval:string;
    maxRefreshTokensPerUser: number;

  };
  database: {
    url: string;
    options?: {
      useNewUrlParser: boolean;
      useUnifiedTopology: boolean;
    };
  };
  redis?: {
    url?: string;
  };
  storage: {
    provider: 'local' | 's3' | 'azure';
    bucketName: string;
    options?: Record<string, any>;
  };
  email: {
    strategy: 'smtp-first' | 'sendgrid-first';
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    fromAddress?: string;
    timeout: number;
    pool: boolean;
    maxConnections: number;
    enabled:boolean,

  };
    sendgrid: {
    apiKey?: string;
    enabled: boolean;
    fromAddress: string;
  };
  security: {
    level: 'low' | 'medium' | 'high' | 'adaptive';
    rateLimit: {
      windowMs: number;
      max: number;
    };
  };
  logging: {
    level: string;
    format: string;
    file?: string;
  };
    cors: {
    origin:string,
    methods:string[]
  }; 
  rateLimit?: {
    max?: number;
  };
}

