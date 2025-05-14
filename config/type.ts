

export interface Config {
  app: {
    name: string;
    port: number;
    env: string;
    frontendUrl: string;
  };
  auth: {
    jwtSecret: string;
    jwtRefreshSecret: string;
    jwtExpiresIn: string;
    jwtRefreshExpiresIn: string;
    passwordSaltRounds: number;
    mfaEnabled: boolean;
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
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    fromAddress?: string;
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
    methods:[string, string]
  }
}
