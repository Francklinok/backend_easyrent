
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
// import qrcode from 'qrcode';
import config from '../../../config';
import { UserService } from './userService';
import { createLogger } from '../../utils/logger/logger';
// import { UserPresenceService } from './userPresence';
import { AuthOptions,
  TwoFactorSetup ,
  SecurityInfo,
  ActiveSession,
  TokenPayload,
  AuthTokens,
  LoginDetails,
  UserInfo,
  TwoFactorValidationResult,
   IUser} from '../types/userTypes';
// import  bcrypt from  "bcrypt"
import { RefreshToken } from '../types/userTypes';
import User from '../models/userModel';
import { Types } from 'mongoose';
import appCacheAndPresenceService from '../../services/redisInstance';
// import { appCacheAndPresenceService } from '../../services/appCacheAndPresence';
// Création d'une instance du logger
const logger = createLogger("AuthService");

/**
 * Service gérant l'authentification des utilisateurs
 */
export class AuthService {
  private userService: UserService;
  // private presenceService: UserPresenceService;

  constructor(userService?: UserService) {
    this.userService = userService || new UserService();
    // this.presenceService = new UserPresenceService();
  }

  /**
   * Authentifie un utilisateur avec des options supplémentaires
   */

  async authenticate(
  email: string,
  password: string,
  req: Request,
  options?: AuthOptions
): Promise<AuthTokens | null> {
  const startTime = Date.now();
 
  try {
    // Validation des entrées
    if (!email || !password) {
      logger.warn('Tentative d\'authentification avec des identifiants manquants', {
        hasEmail: !!email,
        hasPassword: !!password,
        ip: req.ip
      });
      return null;
    }

    console.log(password);

    // Récupération de l'utilisateur avec mot de passe
    const user = await this.userService.getUserByEmailWithPassword(email);
   
    if (!user) {
      logger.warn('Échec d\'authentification - utilisateur non trouvé', {
        email: email.substring(0, 5) + '***',
        ip: req.ip
      });
      return null;
    }

    // Vérification que l'utilisateur est actif
    if (!user.isActive) {
      logger.warn('Échec d\'authentification - compte inactif', {
        userId: user._id?.toString(),
        email: email.substring(0, 5) + '***'
      });
      return null;
    }
    
    if (!user.isEmailVerified) {
      logger.warn("Échec d'authentification - email non vérifié", {
        userId: user._id?.toString(),
        email: email.substring(0, 5) + '***'
      });

      // tu peux soit bloquer direct
      return null;

      // OU renvoyer un statut spécial (plus propre)
      // throw new Error("EMAIL_NOT_VERIFIED");
    }

    // Vérification du mot de passe
    logger.info('Tentative de vérification du mot de passe', {
      userId: user._id?.toString(),
      email: email.substring(0, 5) + '***'
    });

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn('Échec d\'authentification - mot de passe invalide', {
        userId: user._id?.toString(),
        email: email.substring(0, 5) + '***'
      });

      // Enregistrer la tentative échouée
      user.recordLoginAttempt({
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
        successful: false
      });
     
      await user.save();
      return null;
    }

    // Authentification réussie
    logger.info('Authentification réussie', {
      userId: user._id?.toString(),
      email: email.substring(0, 5) + '***',
      executionTime: `${Date.now() - startTime}ms`
    });

    // Mettre à jour les informations de connexion
    user.updateLastLogin(req.ip || 'unknown', req.headers['user-agent'] as string);
    user.recordLoginAttempt({
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
      successful: true
    });

    // ⚠️ SAUVEGARDER L'UTILISATEUR AVANT GÉNÉRATION DES TOKENS
    await user.save();

    // Générer les tokens
  const tokens = await this.generateAuthTokens(user, {
  rememberMe: options?.rememberMe,
  deviceInfo: {
    deviceId: options?.deviceInfo?.deviceId || '',
    deviceName: options?.deviceInfo?.deviceName || '',
    platform: options?.deviceInfo?.platform || '',
    version: options?.deviceInfo?.version || '',
    userAgent: req.headers['user-agent'],
    ip: req.ip
  }
    });

    // ⚠️ VÉRIFICATION CRUCIALE : L'utilisateur a-t-il été sauvegardé ?
    const userAfterTokens = await this.userService.getUserByEmailWithPassword(email);
   
    logger.info('Vérification après génération des tokens', {
      userId: user._id?.toString(),
      refreshTokensCountBefore: user.refreshTokens?.length || 0,
      refreshTokensCountAfter: userAfterTokens?.refreshTokens?.length || 0,
      tokenGenerated: !!tokens?.refreshToken
    });

    if (!userAfterTokens?.refreshTokens || userAfterTokens.refreshTokens.length === 0) {
      logger.error('❌ PROBLÈME : Aucun refresh token sauvegardé en base !', {
        userId: user._id?.toString()
      });
    } else {
      logger.info('✅ Refresh tokens correctement sauvegardés', {
        userId: user._id?.toString(),
        count: userAfterTokens.refreshTokens.length
      });
    }

    return tokens;

  } catch (error) {
    logger.error('Erreur lors de l\'authentification', {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      email: email.substring(0, 5) + '***',
      executionTime: `${Date.now() - startTime}ms`
    });
    throw new Error('Erreur lors de l\'authentification');
  }
}


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
      const user = await this.userService.getUserById(decoded.userId);
      
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

  async getUserById(id: string) {
     return this.userService.getUserById(id);
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

    // await this.presenceService.setUserOffline(userId);
    await appCacheAndPresenceService.setUserOffline(userId)
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
        await appCacheAndPresenceService.setUserOffline(userId)

      // await this.presenceService.setUserOffline(userId);
      
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

      const user = await this.userService.getUserById(decoded.userId);
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

async generateTwoFactorSecret(userId: string): Promise<any | null> {
  try {
    logger.info('[2FA] Step 1 - Getting user', { userId });

    const user = await this.userService.getUserById(userId);
    if (!user) {
      logger.warn('[2FA] User not found', { userId });
      return null;
    }

    if (!user.email) {
      logger.error('[2FA] User is missing email', { userId });
      throw new Error('User is missing email');
    }

    logger.info('[2FA] Step 2 - Generating secret');
    
    const secret = speakeasy.generateSecret({
      name: user.email,
      issuer: config?.app?.name || 'MyApp',
      length: 32
    });

    if (!secret.otpauth_url) {
      logger.error('[2FA] Missing OTP Auth URL', { userId });
      throw new Error('OTP Auth URL could not be generated');
    }

    logger.debug('[2FA] OTP Auth URL generated successfully', { userId });

    logger.info('[2FA] Step 3 - Skipping QR code generation');
    // Users can manually enter the secret or use the otpauth URL

    logger.info('[2FA] Step 4 - Generating backup codes');
    const backupCodes = this.generateBackupCodes();

    logger.info('[2FA] Step 5 - Updating user with temporary secret');

    try {
      await this.userService.updateUser(userId, {
        secret: secret.base32,
        'security.tempTwoFactorSecret': secret.base32,
        'security.tempTwoFactorSecretExpires': new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        'security.backupCodes': backupCodes.map((code:any) => ({
          code,
          used: false,
          createdAt: new Date()
      }))})

      logger.info('[2FA] Temporary secret stored successfully', { userId });
    } catch (error: any) {
      logger.error('[2FA] Failed to store temporary 2FA secret in DB', {
        userId,
        error: error.message
      });
      // This is critical - if we can't store the secret, the setup will fail
      throw new Error('Failed to store 2FA secret');
    }

    logger.info('[2FA] Step 6 - 2FA setup completed successfully', { userId });

    return {
      tempTwoFactorSecret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      // qrCodeUrl removed - users can scan the otpauth URL or enter secret manually
      backupCodes
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

async confirmTwoFactorSetup(userId: string, token: string): Promise<boolean> {
  try {
    const user = await this.userService.getUserById(userId);
    if (!user || !user.security?.tempTwoFactorSecret) {
      logger.warn('[2FA] No temporary secret found for user', { userId });
      return false;
    }

    // Vérifier que le secret temporaire n'a pas expiré
    if (user.security.tempTwoFactorSecretExpires && 
        new Date() > user.security.tempTwoFactorSecretExpires) {
      logger.warn('[2FA] Temporary secret expired', { userId });
      return false;
    }

    // Vérifier le token TOTP
    const verified = speakeasy.totp.verify({
      secret: user.security.tempTwoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      logger.warn('[2FA] Invalid token provided', { userId });
      return false;
    }

    // FIXED: Activer le 2FA en déplaçant le secret temporaire vers le secret permanent
    await this.userService.updateUser(userId, {
      'security.twoFactorSecret': user.security.tempTwoFactorSecret,
      'security.tempTwoFactorSecret': null,           // FIXED: Added null value
      'security.tempTwoFactorSecretExpires': null     // FIXED: Added null value and semicolon
    });

    logger.info('[2FA] Two-factor authentication enabled successfully', { userId });
    return true;

  } catch (error: any) {
    logger.error('[2FA] Error confirming 2FA setup', {
      error: error.message,
      userId
    });
    return false;
  }
}
  
  async validateBackupCode(userId: string, code: string): Promise<boolean> {
  try {

    const secret = speakeasy.generateSecret({ name: 'MyApp (test@example.com)' });

    logger.debug('Secret base32 pour  verification:', secret.base32);
    logger.debug('OTPAuth URL:', secret.otpauth_url);

    const user = await this.userService.getUserById(userId);
    if (!user || !user.security?.backupCodes) {
      return false;
    }

    // Rechercher le code de sauvegarde
    const backupCode = user.security.backupCodes.find(
      bc => bc.code === code && !bc.used
    );

    if (!backupCode) {
      logger.warn('[2FA] Invalid or already used backup code', { userId });
      return false;
    }

    // Marquer le code comme utilisé
    backupCode.used = true;
    backupCode.usedAt = new Date();

    // FIXED: Use proper update method instead of user.save()
    await this.userService.updateUser(userId, {
      'security.backupCodes': user.security.backupCodes
    });

    logger.info('[2FA] Backup code used successfully', { 
      userId,
      remainingCodes: user.security.backupCodes.filter(bc => !bc.used).length
    });

    return true;

  } catch (error: any) {
    logger.error('[2FA] Error validating backup code', {
      error: error.message,
      userId
    });
    return false;
  }
}


  // Méthode pour générer de nouveaux codes de sauvegarde
  async regenerateBackupCodes(userId: string): Promise<string[] | null> {
    try {
      const newCodes = this.generateBackupCodes();
      
      const updateData = {
        'security.backupCodes': newCodes.map(code => ({
          code,
          used: false,
          createdAt: new Date()
        }))
      };

      await this.userService.updateUser(userId, updateData);

      logger.info('[2FA] Backup codes regenerated successfully', { 
        userId,
        newCodesCount: newCodes.length 
      });

      return newCodes;

    } catch (error: any) {
      logger.error('[2FA] Error regenerating backup codes', {
        error: error.message,
        userId
      });
      return null;
    }
  }
  
 /**
 * Vérifie un token de vérification de compte et active le compte
 */

async verifyAccountToken(token: string): Promise<{ success: boolean; message: string; userId?: string }> {
  try {
    // Valider le token de vérification
    const tokenData = await this.validateVerificationToken(token);
    
    if (!tokenData) {
      logger.warn('Invalid account verification token', { token: token.substring(0, 8) + '...' });
      return {
        success: false,
        message: 'Token de vérification invalide ou expiré'
      };
    }

    const { userId, email } = tokenData;

    // Récupérer l'utilisateur
    const user = await this.userService.getUserById(userId);
    if (!user) {
      logger.warn('User not found for account verification', { userId });
      return {
        success: false,
        message: 'Utilisateur introuvable'
      };
    }

    // Vérifier si le compte n'est pas déjà vérifié
    if (user.isEmailVerified) {
      logger.info('Account already verified', { userId, email });
      return {
        success: true,
        message: 'Compte déjà vérifié',
        userId
      };
    }

    // Marquer l'email comme vérifié et nettoyer le token
    try {
      await this.userService.updateUser(userId, {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpires: null
      });

      logger.info('Account verified successfully', { userId, email });
      return {
        success: true,
        message: 'Compte vérifié avec succès',
        userId
      };
    } catch (updateError) {
      const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
      logger.error('Error updating user verification status', { error: errorMessage, userId });
      return {
        success: false,
        message: 'Erreur lors de la mise à jour du statut de vérification'
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error during account verification', { error: errorMessage });
    return {
      success: false,
      message: `Erreur lors de la vérification du compte: ${errorMessage}`
    };
  }
}

  /**
   * Vérifie un code 2FA
  //  */
  // async verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
  //   try {
  //     const user = await this.userService.getUserById(userId) as UserInfo | null;
  //     if (!user || !user.twoFactorSecret) {
  //       return false;
  //     }

  //     const isValid = speakeasy.totp.verify({
  //       secret: user.twoFactorSecret,
  //       encoding: 'base32',
  //       token: code,
  //       window: 2
  //     });
      
  //     if (isValid) {
  //       logger.info('2FA code verified successfully', { userId });
  //     } else {
  //       logger.warn('Invalid 2FA code', { userId });
  //     }

  //     return isValid;
  //   } catch (error) {
  //     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  //     logger.error('Error verifying 2FA code', { error: errorMessage, userId });
  //     return false;
  //   }
  // }
  async verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
  try {
    const user = await this.userService.getUserById(userId) 
    if (!user || !user.security?.tempTwoFactorSecret) {
      logger.debug('user  is  not  define')

      return false;
    }

    logger.info('the  code  is  :',{code})

    const isValid = speakeasy.totp.verify({
      secret: user.security.tempTwoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2
    });
    
    const generatedToken = speakeasy.totp({
  secret: user.security.tempTwoFactorSecret,
  encoding: 'base32'
});
logger.debug('expected token (TOTP) would be:', { generatedToken });



    if (isValid) {
      // Si le code est bon, on sauvegarde le secret de façon permanente
      await this.userService.updateUser(userId, {
        'security.twoFactorSecret': user.security.tempTwoFactorSecret,
        'security.tempTwoFactorSecret': null,
        'security.tempTwoFactorSecretExpires': null
      });
      logger.info('2FA setup confirmed and saved permanently', { userId });
    } else {
      logger.warn('Invalid 2FA code during setup', { userId });
    }

    return isValid;
  } catch (error) {
    logger.error('Error during 2FA setup confirmation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
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
      const user = await this.userService.getUserById(userId);
      if (!user || !user.security?.tempTwoFactorSecret) {
        return false;
      }

      const isValid = speakeasy.totp.verify({
        secret: user.security.tempTwoFactorSecret,
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
      const user = await this.userService.getUserById(userId);
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
   * Génère un code de vérification d'email à 6 chiffres
  */
async generateVerificationToken(userId: string): Promise<string> {
  try {
    // Générer un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    logger.info('🔍 DEBUG - Generated verification code:', {
      userId,
      code: code.substring(0, 3) + '***',
      codeLength: code.length
    });
    
    // Stocker le code dans la base de données avec expiration de 15 minutes
    const tokenExpiration = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await this.userService.updateUser(userId, {
      emailVerificationToken: code,
      emailVerificationTokenExpires: tokenExpiration
    });
    
    logger.info('Verification code generated and saved', { userId });
    return code;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error generating verification code', { error: errorMessage, userId });
    throw new Error(`Verification code generation failed: ${errorMessage}`);
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
      const tokens = await  this.generateAuthTokens(user, options);
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
      const user = await this.userService.getUserById(userId);
      if (!user) {
        logger.warn('User not found for 2FA token verification', { userId });
        return false;
      }

      // Vérifier le code avec le secret temporaire
      const tempSecret = user.security?.tempTwoFactorSecret;
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
      const user = await this.userService.getUserById(userId);
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
      const lastPasswordChange = user.passwordChangedAt || user.createdAt;

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
  private isUserAccountLocked(user: IUser): boolean {
    // Handle security structure
    if (user.security?.accountLocked && user.security.lockExpiresAt && user.security.lockExpiresAt > new Date()) {
      return true;
    }

    return false;
  }

  /**
   * Récupère les informations de verrouillage du compte
   */
  private getAccountLockoutInfo(user: IUser): { isLocked: boolean; lockUntil?: Date } {
    // Handle security structure
    if (user.security) {
      return {
        isLocked: user.security.accountLocked || false,
        lockUntil: user.security.lockExpiresAt
      };
    }

    return {
      isLocked: false,
      lockUntil: undefined
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

  async generateAuthTokens(
  user: IUser,
  options?: AuthOptions
): Promise<AuthTokens> {
  try {
    // Generate access token
    const payload = {
      userId: user._id?.toString(),
      email: user.email,
      role: user.role,
      // sessionId: sessionId 
    };
    
    const accessToken = jwt.sign(
      payload,
      config.auth.jwtSecret,
      { expiresIn: '30m' }
    );
    
    // Generate refresh token
    const refreshToken = jwt.sign(
      payload,
      config.auth.jwtRefreshSecret,
      
      {
        expiresIn: options?.rememberMe ? '30d' : '7d'
      }
    );
    
    if (!refreshToken) {
      throw new Error('Impossible de générer le refresh token');
    }
    
    // Generate session ID
    const sessionId = crypto.randomUUID();
    
    // Create refresh token document with proper typing
    const refreshTokenDoc: RefreshToken = {
      tokenId: crypto.randomUUID(),
      token: refreshToken,
      hashedToken: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      user: user._id as Types.ObjectId,
      device: options?.deviceInfo?.deviceName || options?.deviceInfo?.deviceId || 'Unknown',
      userAgent: options?.deviceInfo?.userAgent || 'Unknown',
      ip: options?.deviceInfo?.ip || 'Unknown',
      ipAddress: options?.deviceInfo?.ip || 'Unknown',
      sessionId: sessionId,
      expiresAt: new Date(Date.now() + (options?.rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000),
      isActive: true,
      lastUsedAt: new Date(),
      createdAt: new Date()
    };
    
    logger.info('Tentative d\'ajout du refresh token', {
      userId: user._id?.toString(),
      refreshTokensCountBefore: user.refreshTokens?.length || 0,
      hasRefreshToken: !!refreshToken,
      refreshTokenLength: refreshToken?.length || 0
    });
    
    // Initialize array if it doesn't exist
    if (!user.refreshTokens) {
      user.refreshTokens = [];
    }
    
    // Add refresh token to user array
    user.refreshTokens.push(refreshTokenDoc);
    
    logger.info('Refresh token ajouté au tableau utilisateur', {
      userId: user._id?.toString(),
      refreshTokensCountAfter: user.refreshTokens.length,
      lastTokenDevice: refreshTokenDoc.device
    });
    
    // Save user
    const savedUser = await user.save();
    
    logger.info('Utilisateur sauvegardé avec tokens', {
      userId: user._id?.toString(),
      refreshTokensInSavedUser: savedUser.refreshTokens?.length || 0,
      saveSuccessful: !!savedUser._id
    });
    
    // Final verification
    const verificationUser = await User.findById(user._id).select('+refreshTokens');
    
    logger.info('Vérification finale en base de données', {
      userId: user._id?.toString(),
      refreshTokensInDB: verificationUser?.refreshTokens?.length || 0,
      verificationSuccessful: (verificationUser?.refreshTokens?.length || 0) > 0
    });
    
    if (!verificationUser?.refreshTokens || verificationUser.refreshTokens.length === 0) {
      logger.error('❌ ÉCHEC CRITIQUE : Le refresh token n\'a pas été sauvegardé !');
      throw new Error('Échec de sauvegarde du refresh token');
    }
    
    logger.info('✅ Tokens générés et sauvegardés avec succès', {
      userId: user._id?.toString(),
      hasRefreshTokens: verificationUser.refreshTokens.length,
      accessTokenLength: accessToken.length,
      refreshTokenLength: refreshToken.length
    });
    
    // Return AuthTokens object (matches the interface)
    return {
      accessToken,
      refreshToken,
      sessionId
    };
    
  } catch (error) {
    logger.error('Erreur lors de la génération des tokens', {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      userId: user._id?.toString(),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`Erreur lors de la génération des tokens: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

  /**
   * Génère des codes de secours pour la 2FA
   */
  // private generateBackupCodes(): string[] {
  //   const codes: string[] = [];
  //   for (let i = 0; i < 10; i++) {
  //     // Génère des codes de 8 caractères alphanumériques
  //     const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  //     codes.push(code);
  //   }
  //   return codes;
  // } 
  private generateBackupCodes(count: number = 10): string[] {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Génère un code aléatoire de 8 caractères
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}