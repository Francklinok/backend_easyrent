import jwt from 'jsonwebtoken';
import { Request } from 'express';
import config from '../../../config';
import { UserService } from './userService';
import { createLogger } from '../../utils/logger/logger';
import { UserPresenceService } from './userPresence';

// Création d'une instance du logger
const logger = createLogger("AuthService");

/**
 * Interface pour le payload des tokens JWT
 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Interface pour les tokens d'authentification
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Interface pour les détails de connexion
 */
interface LoginDetails {
  ipAddress: string;
  userAgent: string;
  successful: boolean;
}

/**
 * Service gérant l'authentification des utilisateurs
 */
export class AuthService {
  private userService: UserService;

  constructor(userService?: UserService) {
    this.userService = userService || new UserService();
  }

  /**
   * Authentifie un utilisateur et génère des jetons JWT
   */
  async authenticate(email: string, password: string, req: Request): Promise<AuthTokens | null> {
    try {
      if (!email || !password) {
        logger.warn('Authentication attempt with missing credentials');
        return null;
      }

      logger.info('Authenticating user', { email });

      const loginDetails = this.extractLoginDetails(req);
      const user = await this.userService.getUserByEmail(email);

      if (!user) {
        logger.warn('Authentication failed: user not found', { email });
        return null;
      }

      user.recordLoginAttempt({ ...loginDetails, successful: false });

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        logger.warn('Authentication failed: invalid password', { email });
        await user.save();
        return null;
      }

      if (!user.isActive) {
        logger.warn('Authentication failed: account is inactive', { email, userId: user._id });
        await user.save();
        return null;
      }

      user.updateLastLogin(loginDetails.ipAddress, loginDetails.userAgent);
      user.recordLoginAttempt({ ...loginDetails, successful: true });
      await user.save();

      const tokens = this.generateAuthTokens(user);
      logger.info('Authentication successful', { userId: user._id });

      return tokens;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during authentication', { error: errorMessage, email });
      throw new Error(`Authentication failed: ${errorMessage}`);
    }
  }

  /**
   * Génère un nouveau token d'accès à partir d'un token de rafraîchissement
   */
  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      if (!config.auth.jwtRefreshSecret) {
        logger.error('JWT refresh secret not configured');
        return null;
      }

      const decoded = jwt.verify(refreshToken, config.auth.jwtRefreshSecret) as TokenPayload;

      const user = await this.userService.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        logger.warn('Token refresh failed: user not found or inactive', { userId: decoded.userId });
        return null;
      }
      
      if (!config.auth.jwtSecret) {
        logger.error('JWT secret not configured');
        return null;
      }

      const accessToken = jwt.sign(
        user.id.toString(),
        config.auth.jwtSecret,
        // { expiresIn: config.auth.jwtExpiresIn }
      );

      logger.info('Access token refreshed successfully', { userId: user._id });
      return accessToken;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid refresh token', { error: error.message });
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during token refresh', { error: errorMessage });
      throw new Error(`Token refresh failed: ${errorMessage}`);
    }
  }

  /**
   * Déconnecte un utilisateur et met à jour sa présence
   */
  async logout(userId: string): Promise<void> {
    try {
      const presenceService = new UserPresenceService();
      await presenceService.setUserOffline(userId);

      logger.info('User logged out', { userId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during logout', { error: errorMessage, userId });
      throw new Error(`Logout failed: ${errorMessage}`);
    }
  }

  /**
   * Valide un token JWT
   */
  validateToken(token: string): TokenPayload | null {
    try {
      if (!config.auth.jwtSecret) {
        logger.error('JWT secret not configured');
        return null;
      }
      
      const decoded = jwt.verify(token, config.auth.jwtSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.warn('Invalid token', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  /**
   * Extrait les détails de connexion à partir de la requête
   */
  private extractLoginDetails(req: Request): LoginDetails {
    return {
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      successful: false,
    };
  }

  /**
   * Génère les tokens d'authentification pour un utilisateur
   */
  private generateAuthTokens(user: any): AuthTokens {
    const payload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    if (!config.auth.jwtSecret) {
      throw new Error('JWT secret not configured');
    }

    if (!config.auth.jwtRefreshSecret) {
      throw new Error('JWT refresh secret not configured');
    }

    const accessToken = jwt.sign(
      payload, 
      config.auth.jwtSecret,
      // { expiresIn: config.auth.jwtExpiresIn }
    );

    const refreshToken = jwt.sign(
      payload, 
      config.auth.jwtRefreshSecret,
      // { expiresIn: config.auth.jwtRefreshExpiresIn }
    );

    return { accessToken, refreshToken };
  }
}