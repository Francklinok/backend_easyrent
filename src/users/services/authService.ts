
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import config from '../../../config';
import { UserService } from './userService';
import { createLogger } from '../../utils/logger/logger';
import { UserPresenceService } from './userPresence';
import { AuthOptions,TwoFactorSetup ,SecurityInfo,ActiveSession,TokenPayload,AuthTokens,LoginDetails,UserInfo,TwoFactorValidationResult, IUser} from '../types/userTypes';
import  bcrypt from  "bcrypt"
// Création d'une instance du logger
const logger = createLogger("AuthService");

/**
 * Service gérant l'authentification des utilisateurs
 */
export class AuthService {
  private userService: UserService;
  private presenceService: UserPresenceService;

  constructor(userService?: UserService) {
    this.userService = userService || new UserService();
    this.presenceService = new UserPresenceService();
  }

  /**
   * Authentifie un utilisateur avec des options supplémentaires
   */

//   async authenticate(email: string, password: string, req: Request, options?: AuthOptions): Promise<AuthTokens | null> {
//   try {
//     if (!email || !password) {
//       logger.warn('Authentication attempt with missing credentials');
//       return null;
//     }
 
//     const user = await this.userService.getUserByEmail(email) as IUser;
//     if (!user) {
//       logger.warn('Authentication failed: user not found', { email });
//       return null;
//     }
//     // if (!user.emailVerified) {
//     //   logger.warn('Authentication denied: email not verified', { email });
//     //   return null;
//     // }
//     // Vérification sécurisée des méthodes
//     logger.info(`l utilisateur  est : '${user}'`)
//     if (typeof user.comparePassword !== 'function') {
//       logger.error('comparePassword method not available on user object');
//       throw new Error('User authentication method not available');
//     }
//     logger.info(`[AuthController] Mot de passe reçu: '${password}'`);


//     const isPasswordValid = await user.comparePassword(password);
//     if (!isPasswordValid) {
//       logger.warn('Authentication failed: invalid password', { email });
//       return null;
//     }

//     // Mise à jour sécurisée
//     if (typeof user.updateLastLogin === 'function') {
//       const loginDetails = this.extractLoginDetails(req);
//       user.updateLastLogin(loginDetails.ipAddress, loginDetails.userAgent);
//     }

//     if (typeof user.save === 'function') {
//       await user.save();
//     }

//     // Génération des tokens
//     const tokens = this.generateAuthTokens(user, options);
//     return tokens;

//   } catch (error) {
//     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//     logger.error('Error during authentication', { error: errorMessage, email });
//     throw new Error(`Authentication failed: ${errorMessage}`);
//   }
// }



async authenticate(email: string, password: string, req: Request, options?: AuthOptions): Promise<AuthTokens | null> {
  try {
    if (!email || !password) {
      logger.warn('Authentication attempt with missing credentials');
      return null;
    }
     this.testPasswordComparison(email, password)
    const user = await this.userService.getUserByEmail(email) as IUser;
    logger.info(`[Auth] user  is : ${user}`);
    await  this.userService.debugUser(email)


    if (!user) {
      logger.warn('Authentication failed: user not found', { email });
      return null;
    }
        await this.userService.reactivateUser(user.id)


    // Check if user is active
    if (!user.isActive) {
      logger.warn('Authentication failed: user account is inactive', { email });
      return null;
    }

    
    // Log user info (without sensitive data)
    logger.info(`User found: ${user.email}, isActive: ${user.isActive}, hasPassword: ${!!user.password}`);
    
    if (typeof user.comparePassword !== 'function') {
      logger.error('comparePassword method not available on user object');
      throw new Error('User authentication method not available');
    }
    
    logger.info(`[AuthController] Attempting password verification for user: ${email}`);
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      logger.warn('Authentication failed: invalid password', { email });
      
      // Record failed login attempt
      if (typeof user.recordLoginAttempt === 'function') {
        const loginDetails = this.extractLoginDetails(req);
        user.recordLoginAttempt({
          ipAddress: loginDetails.ipAddress,
          userAgent: loginDetails.userAgent,
          successful: false
        });
        await user.save();
      }
      
      return null;
    }
    
    // Successful authentication
    logger.info('Authentication successful', { email });
    
    // Update last login info
    if (typeof user.updateLastLogin === 'function') {
      const loginDetails = this.extractLoginDetails(req);
      user.updateLastLogin(loginDetails.ipAddress, loginDetails.userAgent);
    }
    
    // Record successful login attempt
    if (typeof user.recordLoginAttempt === 'function') {
      const loginDetails = this.extractLoginDetails(req);
      user.recordLoginAttempt({
        ipAddress: loginDetails.ipAddress,
        userAgent: loginDetails.userAgent,
        successful: true
      });
    }
    
    if (typeof user.save === 'function') {
      await user.save();
    }
    
    // Generate tokens
    const tokens = this.generateAuthTokens(user, options);
    return tokens;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error during authentication', { error: errorMessage, email });
    throw new Error(`Authentication failed: ${errorMessage}`);
  }
}

// Add this method to your AuthService for debugging
async testPasswordComparison(email: string, password: string): Promise<void> {
  try {
    const user = await this.userService.getUserByEmail(email);
    if (!user) {
      logger.error('User not found for password test');
      return;
    }
    
    logger.info('=== PASSWORD COMPARISON TEST ===');
    logger.info('Input password:', password);
    logger.info('Input password length:', password.length);
    logger.info('User password hash:', user.password);
    logger.info('User password hash length:', user.password?.length);
    
    // Direct bcrypt comparison
    const directResult = await bcrypt.compare(password, user.password);
    logger.info('Direct bcrypt comparison result:', directResult);
    
    // Method comparison
    if (typeof user.comparePassword === 'function') {
      const methodResult = await user.comparePassword(password);
      logger.info('Method comparison result:', methodResult);
    } else {
      logger.error('comparePassword method not available');
    }
    
    logger.info('=== END PASSWORD TEST ===');
  } catch (error) {
    logger.error('Error in password test:', error);
  }
}

// 4. Check your User Schema method binding
// Make sure your schema methods are properly bound:

  
  
// Fixed refreshAccessToken method
async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const jwtRefreshSecret = config.auth?.jwtRefreshSecret;
      const jwtSecret = config.auth?.jwtSecret;

      if (!jwtRefreshSecret || typeof jwtRefreshSecret !== 'string') {
        logger.error('JWT refresh secret not configured or invalid');
        return null;
      }

      if (!jwtSecret || typeof jwtSecret !== 'string') {
        logger.error('JWT secret not configured or invalid');
        return null;
      }

      const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as TokenPayload;
      const user = await this.userService.getUserById(decoded.userId)
      
      if (!user || !user.isActive) {
        logger.warn('Token refresh failed: user not found or inactive', { userId: decoded.userId });
        return null;
      }

      const payload: TokenPayload = {
        userId: this.getUserId(user),
        email: user.email,
        role: user.role,
        sessionId: decoded.sessionId,
        deviceId: decoded.deviceId
      };
      const expiresIn = typeof config.auth?.jwtExpiresIn === 'string' ? config.auth.jwtExpiresIn : '15m';

      const accessToken = jwt.sign(
        payload,
        jwtSecret,
        { expiresIn } as jwt.SignOptions
      );   
    
      const userId = this.getUserId(user);
      logger.info('Access token refreshed successfully', { userId });
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
  async logout(userId: string, sessionId?: string): Promise<void> {
  try {
    if (sessionId) {
      try {
        // Appeler directement la méthode de révocation sans passer par logout
        const success = await this.userService.revokeSession?.(userId, sessionId);
        if (!success) {
          logger.warn('Session not found or already revoked', { userId, sessionId });
        }
      } catch (error) {
        logger.warn('Session revocation failed', { userId, sessionId, error });
      }
    }

    await this.presenceService.setUserOffline(userId);
    logger.info('User logged out', { userId, sessionId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error during logout', { error: errorMessage, userId });
    throw new Error(`Logout failed: ${errorMessage}`);
  }
}
  
  /**
   * Déconnecte l'utilisateur de tous les appareils
   */
  async logoutAllDevices(userId: string, sessionId:string): Promise<void> {
    try {
      await this.invalidateAllUserTokens(userId,sessionId);
      await this.presenceService.setUserOffline(userId);
      
      logger.info('User logged out from all devices', { userId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during logout all devices', { error: errorMessage, userId });
      throw new Error(`Logout all devices failed: ${errorMessage}`);
    }
  }

  /**
   * Valide un token JWT
   */
  validateToken(token: string): TokenPayload | null {
    try {
      if (!config.auth?.jwtSecret) {
        logger.error('JWT secret not configured');
        return null;
      }
      
      const decoded = jwt.verify(token, config.auth.jwtSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.warn('Token expired', { error: error.message });
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid token', { error: error.message });
      } else {
        logger.error('Token validation error', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
      return null;
    }
  }

  /**
   * Valide un token temporaire (pour 2FA)
   */
  async validateTemporaryToken(token: string): Promise<{ userId: string; deviceId?: string } | null> {
    try {
      if (!config.auth?.jwtSecret) {
        logger.error('JWT secret not configured');
        return null;
      }

      const decoded = jwt.verify(token, config.auth.jwtSecret) as TokenPayload & { temp: boolean };
      
      if (!decoded.temp) {
        logger.warn('Not a temporary token');
        return null;
      }

      const user = await this.userService.getUserById(decoded.userId) as UserInfo | null;
      if (!user || !user.isActive) {
        return null;
      }

      return { 
        userId: decoded.userId,
        deviceId: decoded.deviceId
      };
    } catch (error) {
      logger.warn('Invalid temporary token', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

async generateTwoFactorSecret(userId: string) {
  try {
    logger.info('[2FA] Step 1 - Getting user', { userId });

    const user = await this.userService.getUserById(userId);
    if (!user) {
      logger.warn('[2FA] User not found', { userId });
      return null;
    }

    logger.info('[2FA] Step 2 - Generating secret');
    
    if (!user.email) {
      logger.error('[2FA] User is missing email', { userId });
      throw new Error('User is missing email');
    }

    const secret = speakeasy.generateSecret({
      name: user.email,
      issuer: config?.app?.name || 'MyApp',
      length: 32
    });

    if (!secret.otpauth_url) {
      logger.error('[2FA] Missing OTP Auth URL', { userId });
      throw new Error('OTP Auth URL could not be generated');
    }

    logger.debug('[2FA] OTP Auth URL:', secret.otpauth_url);

    logger.info('[2FA] Step 3 - Generating QR code');

    let qrCodeUrl: string;

    // try {
    //   qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
    // } catch (err: any) {
    //   logger.error('[2FA] QR code generation failed', {
    //     userId,
    //     error: err.message,
    //     stack: err.stack
    //   });
    //   throw new Error('QR code generation failed');
    // }

    logger.info('[2FA] Step 4 - Generating backup codes');
    const backupCodes = this.generateBackupCodes();

    logger.info('[2FA] Step 5 - Updating user with temporary secret');

    try {
      await this.userService.updateUser(userId, {
        secret: secret.base32
      });
    } catch (error: any) {
      logger.warn('[2FA] Could not store temporary 2FA secret in DB', {
        userId,
        error: error.message
      });
      // Ce n’est pas bloquant, on continue quand même
    }

    logger.info('[2FA] Step 6 - 2FA setup completed', { userId });

    return {
      tempTwoFactorSecret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      // qrCodeUrl,
      backupCodes,
      // tempTwoFactorSecret: secret.base32

    };
  } catch (error: any) {
    logger.error('[2FA] Error generating 2FA secret', {
      error: error.message,
      stack: error.stack,
      userId
    });
    throw new Error(`2FA setup failed: ${error.message}`);
  }
 }


  /**
   * Vérifie un code 2FA
   */
  async verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
    try {
      const user = await this.userService.getUserById(userId) as UserInfo | null;
      if (!user || !user.twoFactorSecret) {
        return false;
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2
      });
      
      if (isValid) {
        logger.info('2FA code verified successfully', { userId });
      } else {
        logger.warn('Invalid 2FA code', { userId });
      }

      return isValid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error verifying 2FA code', { error: errorMessage, userId });
      return false;
    }
  }

  /**
   * Génère des tokens après une 2FA réussie
   */
  async generateTokensAfter2FA(userId: string, deviceId?: string): Promise<AuthTokens> {
    try {
      const user = await this.userService.getUserById(userId) 
      if (!user) {
        throw new Error('User not found');
      }

      const options: AuthOptions | undefined = deviceId ? { 
        deviceInfo: { 
          deviceId, 
          deviceName: '', 
          platform: '', 
          version: '' 
        } 
      } : undefined;

      const tokens = this.generateAuthTokens(user, options);
      logger.info('Tokens generated after successful 2FA', { userId });
      return tokens;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error generating tokens after 2FA', { error: errorMessage, userId });
      throw new Error(`Token generation failed: ${errorMessage}`);
    }
  }

  /**
   * Vérifie et active définitivement la 2FA
   */
  async verifyAndEnableTwoFactor(userId: string, code: string): Promise<boolean> {
    try {
      const user = await this.userService.getUserById(userId) as UserInfo | null;
      if (!user || !user.tempTwoFactorSecret) {
        return false;
      }

      const isValid = speakeasy.totp.verify({
        secret: user.tempTwoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2
      });
      
      if (isValid) {
        // Use the correct method name based on the error message
        await this.userService.enableTwoFactorAuth(userId);
        logger.info('2FA enabled successfully', { userId });
        return true;
      }

      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error enabling 2FA', { error: errorMessage, userId });
      return false;
    }
  }

  /**
   * Désactive l'authentification à deux facteurs
   */

  async disableTwoFactor(userId: string, password: string): Promise<boolean> {
    try {
      const user = await this.userService.getUserById(userId) as UserInfo | null;
      if (!user) {
        logger.warn('User not found for 2FA disable', { userId });
        return false;
      }

      // Vérifier le mot de passe avant de désactiver la 2FA
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        logger.warn('Invalid password for 2FA disable', { userId });
        return false;
      }

      try {
        await this.userService.disableTwoFactor(userId);
        logger.info('2FA disabled successfully', { userId });
        return true;
      } catch (error) {
        logger.warn('disableTwoFactor method not available', { userId });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error disabling 2FA', { error: errorMessage, userId });
      return false;
    }
  }

  /**
   * Génère de nouveaux codes de secours
   */
  async generateNewBackupCodes(userId: string): Promise<string[]> {
    try {
      const backupCodes = this.generateBackupCodes();
      // Try to use the method if it exists
      try {
        await this.userService.updateBackupCodes(userId, backupCodes);
      } catch (error) {
        // If method doesn't exist, handle gracefully
        logger.warn('updateBackupCodes method not available', { userId });
        // You might need to implement this differently
        throw new Error('Backup codes update method not implemented');
      }
      logger.info('New backup codes generated', { userId });
      return backupCodes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error generating backup codes', { error: errorMessage, userId });
      throw new Error(`Backup codes generation failed: ${errorMessage}`);
    }
  }

  /**
   * Vérifie un code de secours
   */
  async verifyBackupCode(userId: string, backupCode: string): Promise<boolean> {
    try {
      // Try to use the method if it exists
      try {
        const isValid = await this.userService.verifyAndConsumeBackupCode(userId, backupCode);
        
        if (isValid) {
          logger.info('Backup code verified successfully', { userId });
        } else {
          logger.warn('Invalid or used backup code', { userId });
        }

        return isValid;
      } catch (error) {
        // If method doesn't exist, handle gracefully
        logger.warn('verifyAndConsumeBackupCode method not available', { userId });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error verifying backup code', { error: errorMessage, userId });
      return false;
    }
  }

  /**
   * Récupère les sessions actives d'un utilisateur
   */
  async getActiveSessions(userId: string, includeExpired = false): Promise<ActiveSession[]> {
    try {
      // Try to use the method if it exists
      try {
        const sessions = await this.userService.getActiveSessions(userId);
        logger.info('Active sessions retrieved', { userId, count: sessions.length });
        return sessions;
      } catch (error) {
        // If method doesn't exist, return empty array
        logger.warn('getActiveSessions method not available', { userId });
        return [];
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error retrieving active sessions', { error: errorMessage, userId });
      throw new Error(`Active sessions retrieval failed: ${errorMessage}`);
    }
  }

  /**
   * Révoque une session spécifique
   */
  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      // Try to use the method if it exists
      try {
        const success = await this.userService.revokeSession(userId, sessionId);
        
        if (success) {
          logger.info('Session revoked successfully', { userId, sessionId });
        } else {
          logger.warn('Session not found or already revoked', { userId, sessionId });
        }

        return success;
      } catch (error) {
        // If method doesn't exist, return false
        logger.warn('revokeUserSession method not available', { userId, sessionId });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error revoking session', { error: errorMessage, userId, sessionId });
      throw new Error(`Session revocation failed: ${errorMessage}`);
    }
  }

  /**
   * Révoque toutes les sessions sauf la courante
   */
  async revokeAllSessionsExceptCurrent(userId: string, currentSessionId: string): Promise<number> {
    try {
      // Try to use the method if it exists
      try {
        const revokedCount = await this.userService.revokeAllSessionsExceptCurrent(userId, currentSessionId);
        logger.info('All sessions except current revoked', { userId, revokedCount });
        return revokedCount;
        
      } catch (error) {
        // If method doesn't exist, return 0
        logger.warn('revokeAllSessionsExceptCurrent method not available', { userId });
        return 0;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error revoking all sessions', { error: errorMessage, userId });
      throw new Error(`Mass session revocation failed: ${errorMessage}`);
    }
  }

  /**
   * Génère un token de vérification d'email
  //  */
  // async generateVerificationToken(userId: string): Promise<string> {
  //   try {
  //     // Générer un token aléatoire sécurisé
  //     const token = crypto.randomBytes(32).toString('hex');
  //      logger.info('🔍 DEBUG - Generated token:', {
  //       userId,
  //       token: token.substring(0, 10) + '...',
  //       tokenLength: token.length
  //     });
  //     // Stocker le token dans la base de données avec une expiration
  //     await this.userService.updateVerificationToken(userId);
      
  //     logger.info('Verification token generated', { userId });
  //     return token;
  //   } catch (error) {
  //     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  //     logger.error('Error generating verification token', { error: errorMessage, userId });
  //     throw new Error(`Verification token generation failed: ${errorMessage}`);
  //   }
  // }
async generateVerificationToken(userId: string): Promise<string> {
  try {
    // Générer un token aléatoire sécurisé
    const token = crypto.randomBytes(32).toString('hex');
    
    logger.info('🔍 DEBUG - Generated token:', {
      userId,
      token: token.substring(0, 10) + '...',
      tokenLength: token.length
    });
    
    // ✅ FIX: Stocker le token généré dans la base de données
    const tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
    
    await this.userService.updateUser(userId, {
      emailVerificationToken: token,
      emailVerificationTokenExpires: tokenExpiration
    });
    
    logger.info('Verification token generated and saved', { userId });
    return token; // ✅ Retourner le token généré
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error generating verification token', { error: errorMessage, userId });
    throw new Error(`Verification token generation failed: ${errorMessage}`);
  }
}

  /**
   * Valide un token de vérification d'email
   */
  async validateVerificationToken(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      const user = await this.userService.getUserByVerificationToken(token) 
      
      if (!user) {
        logger.warn('Invalid verification token', { token: token.substring(0, 8) + '...' });
        return null;
      }
      
      const userId = this.getUserId(user);
      logger.info('Verification token validated', { userId });
      return {
        userId,
        email: user.email
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error validating verification token', { error: errorMessage });
      return null;
    }
  }

  /**
   * Invalide toutes les autres sessions sauf la courante
   * (Alias pour revokeAllSessionsExceptCurrent)
   */
  async invalidateOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    try {
      const revokedCount = await this.revokeAllSessionsExceptCurrent(userId, currentSessionId);
      logger.info('Other sessions invalidated', { userId, revokedCount });
      return revokedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error invalidating other sessions', { error: errorMessage, userId });
      throw new Error(`Other sessions invalidation failed: ${errorMessage}`);
    }
  }

  /**
   * Invalide toutes les sessions d'un utilisateur
   * (Alias pour logoutAllDevices)
   */
  async invalidateAllSessions(userId: string, sessionId:string): Promise<void> {
    try {
      await this.logoutAllDevices(userId,sessionId);
      logger.info('All sessions invalidated', { userId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error invalidating all sessions', { error: errorMessage, userId });
      throw new Error(`All sessions invalidation failed: ${errorMessage}`);
    }
  }

  /**
   * Invalide tous les tokens d'un utilisateur
   */
  private async invalidateAllUserTokens(userId: string, sessionId:string): Promise<void> {
    try {
      // Try to revoke all sessions if the method exists
      try {
        await this.userService.revokeSession(userId,sessionId);
      } catch (error) {
        logger.warn('revokeAllSessions method not available', { userId });
        // Alternative: you might want to implement token blacklisting here
      }
      logger.info('All user tokens invalidated', { userId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error invalidating all user tokens', { error: errorMessage, userId });
      throw new Error(`Token invalidation failed: ${errorMessage}`);
    }
  }

    /**
   * Complète l'authentification 2FA après vérification du code
   */
  async validateTwoFactorLogin(
    tempToken: string, 
    code: string, 
    options?: AuthOptions
  ): Promise<TwoFactorValidationResult> {
    try {
      const tempTokenData = await this.validateTemporaryToken(tempToken);
      if (!tempTokenData) {
        logger.warn('Invalid temporary token for 2FA validation');
        return {
          success: false,
          message: 'Token temporaire invalide ou expiré'
        };
      }

      const user = await this.userService.getUserById(tempTokenData.userId)
      if (!user || !user.isActive) {
        logger.warn('User not found or inactive for 2FA validation', { userId: tempTokenData.userId });
        return {
          success: false,
          message: 'Utilisateur introuvable ou inactif'
        };
      }

      // Vérifier le code 2FA
      const isCodeValid = await this.verifyTwoFactorCode(tempTokenData.userId, code);
      if (!isCodeValid) {
        logger.warn('Invalid 2FA code during login', { userId: tempTokenData.userId });
        return {
          success: false,
          message: 'Code 2FA invalide'
        };
      }

      // Générer les tokens finaux
      const tokens = this.generateAuthTokens(user, options);
      const userId = this.getUserId(user);
      
      logger.info('2FA authentication completed successfully', { userId });
      return {
        success: true,
        userId,
        tokens,
        message: 'Authentification 2FA réussie'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during 2FA validation', { error: errorMessage });
      return {
        success: false,
        message: `Erreur lors de la validation 2FA: ${errorMessage}`
      };
    }
  }

  /**
   * Vérifie et active la 2FA avec un token temporaire
   */
  async verifyTwoFactorToken(userId: string, code: string): Promise<boolean> {
    try {
      const user = await this.userService.getUserById(userId) as UserInfo | null;
      if (!user) {
        logger.warn('User not found for 2FA token verification', { userId });
        return false;
      }

      // Vérifier le code avec le secret temporaire
      const tempSecret = user.tempTwoFactorSecret;
      if (!tempSecret) {
        logger.warn('No temporary 2FA secret found', { userId });
        return false;
      }

      const isValid = speakeasy.totp.verify({
        secret: tempSecret,
        encoding: 'base32',
        token: code,
        window: 2
      });

      if (isValid) {
        // Activer la 2FA en déplaçant le secret temporaire vers le permanent
        try {
          await this.userService.enableTwoFactor(userId);
          logger.info('2FA enabled successfully', { userId });
        } catch (error) {
          logger.warn('enableTwoFactor method not available, handling manually', { userId });
          // Alternative handling if the method doesn't exist
          // You might need to implement this based on your UserService structure
        }
        return true;
      } else {
        logger.warn('Invalid 2FA token during setup', { userId });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error verifying 2FA token', { error: errorMessage, userId });
      return false;
    }
   }


  /**
   * Récupère les informations de sécurité d'un utilisateur
   */
  async getSecurityInfo(userId: string): Promise<SecurityInfo> {
    try {
      const user = await this.userService.getUserById(userId) as UserInfo | null;
      if (!user) {
        throw new Error('User not found');
      }

      // Try to get active sessions count
      let activeSessions = 0;
      try {
        activeSessions = await this.userService.getActiveSessionsCount(userId);
      } catch (error) {
        logger.warn('getActiveSessionsCount method not available', { userId });
      }

      // Try to get recent login attempts count
      let recentLoginAttempts = 0;
      try {
        recentLoginAttempts = await this.userService.getRecentLoginAttemptsCount(userId);
      } catch (error) {
        logger.warn('getRecentLoginAttemptsCount method not available', { userId });
      }

      // Handle different password change field names
      const lastPasswordChange = user.lastPasswordChange || user.passwordChangedAt || user.createdAt;

      // Handle different account lockout structures
      const accountLockout = this.getAccountLockoutInfo(user);

      const securityInfo: SecurityInfo = {
        twoFactorEnabled: user.preferences?.twoFactorEnabled || false,
        lastPasswordChange,
        activeSessions,
        recentLoginAttempts,
        accountLockout
      };

      logger.info('Security info retrieved', { userId });
      return securityInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error retrieving security info', { error: errorMessage, userId });
      throw new Error(`Security info retrieval failed: ${errorMessage}`);
    }
  }

  // Méthodes utilitaires privées

  /**
   * Extrait l'ID utilisateur en gérant les différents formats
   */
  private getUserId(user: IUser): string {
    if (typeof user._id === 'string') {
      return user._id;
    } else if (user._id && typeof user._id.toString === 'function') {
      return user._id.toString();
    }
    return user.id;
  }

  /**
   * Vérifie si le compte utilisateur est verrouillé
   */
  private isUserAccountLocked(user: UserInfo): boolean {
    // Handle nested accountLockout structure
    if (user.accountLockout?.isLocked && user.accountLockout.lockUntil && user.accountLockout.lockUntil > new Date()) {
      return true;
    }
    
    // Handle flat structure
    if (user.isLocked && user.lockUntil && user.lockUntil > new Date()) {
      return true;
    }
    
    return false;
  }

  /**
   * Récupère les informations de verrouillage du compte
   */
  private getAccountLockoutInfo(user: UserInfo): { isLocked: boolean; lockUntil?: Date } {
    // Handle nested structure
    if (user.accountLockout) {
      return {
        isLocked: user.accountLockout.isLocked || false,
        lockUntil: user.accountLockout.lockUntil
      };
    }
    
    // Handle flat structure
    return {
      isLocked: user.isLocked || false,
      lockUntil: user.lockUntil
    };
  }

  /**
   * Extrait les détails de connexion à partir de la requête
   */
  private extractLoginDetails(req: Request): LoginDetails {
    return {
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      successful: false,
      timestamp: new Date()
    };
  }

  /**
   * Génère un token temporaire pour la 2FA
   */


private temporary2FAToken(user: IUser, deviceId?: string): string {
  if (!config.auth?.jwtSecret) {
    throw new Error('JWT secret not configured');
  }

  const payload: TokenPayload = {
    userId: this.getUserId(user),
    email: user.email,
    role: user.role,
    deviceId,
    temp: true // Maintenant typé correctement
  };

  return jwt.sign(
    payload,
    config.auth.jwtSecret,
    { expiresIn: '10m' } as jwt.SignOptions
  );
}

  /**
   * Génère les tokens d'authentification pour un utilisateur
   */
  // Fixed generateAuthTokens method
  private generateAuthTokens(user: IUser, options?: AuthOptions): AuthTokens {
  try {
    const sessionId = crypto.randomUUID();
    
    // Validation des secrets JWT
    const jwtSecret = config.auth?.jwtSecret;
    const jwtRefreshSecret = config.auth?.jwtRefreshSecret;

    if (!jwtSecret || typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
      throw new Error('JWT secret not configured properly (must be at least 32 characters)');
    }
    if (!jwtRefreshSecret || typeof jwtRefreshSecret !== 'string' || jwtRefreshSecret.length < 32) {
      throw new Error('JWT refresh secret not configured properly (must be at least 32 characters)');
    }

    const payload: TokenPayload = {
      userId: this.getUserId(user),
      email: user.email,
      role: user.role,
      sessionId,
      deviceId: options?.deviceInfo?.deviceId
    };

    // Validation du payload
    if (!payload.userId || !payload.email) {
      throw new Error('Invalid user data for token generation');
    }

    const accessTokenExpiry = options?.rememberMe ? '30d' : (config.auth?.jwtExpiresIn || '15m');
    const refreshTokenExpiry = options?.rememberMe ? '90d' : (config.auth?.jwtRefreshExpiresIn || '7d');

    const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: accessTokenExpiry } as jwt.SignOptions);
    const refreshToken = jwt.sign(payload, jwtRefreshSecret, { expiresIn: refreshTokenExpiry } as jwt.SignOptions);

    return {
      accessToken,
      refreshToken,
      sessionId
    };
  } catch (error) {
    logger.error('Error generating auth tokens', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: this.getUserId(user)
    });
    throw new Error('Failed to generate authentication tokens');
  }
}
  /**
   * Génère des codes de secours pour la 2FA
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      // Génère des codes de 8 caractères alphanumériques
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}