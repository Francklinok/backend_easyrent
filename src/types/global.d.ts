import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        id: string;
        email: string;
        role: string;
        isAdmin?: boolean;
        isLandlord?: boolean;
        twoFactorAuthenticated?: boolean;
      };
      sessionId?: string;
    }
  }
}

export {};
