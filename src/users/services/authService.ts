import jwt from 'jsonwebtoken';
import { envConfig } from '../config/env.config';
import { Request } from 'express';
import createLogger from  "../../utils/logger/logger"
import { UserService } from './userService';

const logger = createLogger

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Authentifie un utilisateur et génère des jetons JWT
   */
  async authenticate(email: string, password: string, req: Request): Promise<AuthTokens | null> {
    try {
      logger.info('Authenticating user', { email });
      const user = await this.userService.getUserByEmail(email);

      // Enregistrer la tentative de connexion
      if (user) {
        user.recordLoginAttempt({
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          successful: false
        });
        await user.save();
      }

      // Vérifier l'existence de l'utilisateur et la validité du mot de passe
      if (!user || !(await user.comparePassword(password))) {
        logger.warn('Authentication failed: invalid credentials', { email });
        return null;
      }

      // Vérifier si le compte est actif
      if (!user.isActive) {
        logger.warn('Authentication failed: account is inactive', { email });
        return null;
      }

      // Mettre à jour les informations de dernière connexion
      user.updateLastLogin(req.ip || 'unknown', req.headers['user-agent'] || 'unknown');

      // Marquer la tentative comme réussie
      user.recordLoginAttempt({
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        successful: true
      });

      await user.save();

      const payload: TokenPayload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      };

      const accessToken = jwt.sign(payload, envConfig.JWT_SECRET, {
        expiresIn: envConfig.JWT_ACCESS_EXPIRES_IN || '15m'
      });

      const refreshToken = jwt.sign(payload, envConfig.JWT_REFRESH_SECRET, {
        expiresIn: envConfig.JWT_REFRESH_EXPIRES_IN || '7d'
      });

      return {
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error('Error during authentication', { error });
      throw new Error('Authentication failed');
    }
  }
}
