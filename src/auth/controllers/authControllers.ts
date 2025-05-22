import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../users/services/authService';
import { UserService } from '../../users/services/userService';
import { NotificationService } from '../../services/notificationServices';
import { SecurityAuditService } from '../../security/services/securityAuditServices';
import { AppError } from '../utils/AppError';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('AuthController');
const authService = new AuthService();
const userService = new UserService();
const notificationService = new NotificationService();
const securityAuditService = new SecurityAuditService();

/**
 * Contrôleur pour les opérations d'authentification
 */
class AuthControllers {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { firstName, lastName, username, email, password, phoneNumber, dateOfBirth, address, ...userData } = req.body;
      
      // Vérifier si l'email est déjà utilisé
      const existingUserByEmail = await userService.getUserByEmail(email);
      if (existingUserByEmail) {
        res.status(409).json({
          success: false,
          message: 'Cet email est déjà utilisé'
        });
        return;
      }

      // Vérifier si le nom d'utilisateur est déjà utilisé
      const existingUserByUsername = await userService.getUserByUsername(username);
      if (existingUserByUsername) {
        res.status(409).json({
          success: false,
          message: 'Ce nom d\'utilisateur est déjà utilisé'
        });
        return;
      }
      
      // Créer l'utilisateur avec tous les champs validés
      const user = await userService.createUser({
        firstName,
        lastName,
        username,
        email,
        password,
        phoneNumber,
        dateOfBirth,
        address,
        ...userData
      }, true); // Envoyer l'email de vérification
      
      // Journaliser l'événement
      await securityAuditService.logEvent({
        eventType: 'USER_REGISTERED',
        userId: user._id.toString(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { email, username }
      });
      
      logger.info('Nouvel utilisateur inscrit', { userId: user._id, email, username });
      
      res.status(201).json({
        success: true,
        message: 'Inscription réussie. Veuillez vérifier votre email pour activer votre compte',
        data: {
          userId: user._id,
          email: user.email,
          username: user.username
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Connexion d'un utilisateur
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, rememberMe, deviceInfo } = req.body;
      
      // Authentifier l'utilisateur avec les informations supplémentaires
      const tokens = await authService.authenticate(email, password, req, { rememberMe, deviceInfo });
      
      if (!tokens) {
        await securityAuditService.logEvent({
          eventType: 'FAILED_LOGIN',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          details: { email }
        });
        
        res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
        return;
      }
      
      // Obtenir les informations de l'utilisateur
      const user = await userService.getUserByEmail(email);
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }

      // Vérifier si le compte est vérifié
      if (!user.emailVerified) {
        res.status(403).json({
          success: false,
          message: 'Veuillez vérifier votre email avant de vous connecter'
        });
        return;
      }
      
      // Vérifier si 2FA est activé
      if (user.preferences?.twoFactorEnabled) {
        res.status(200).json({
          success: true,
          message: 'Authentification réussie, validation 2FA requise',
          requireTwoFactor: true,
          temporaryToken: tokens.accessToken // Token temporaire pour l'étape 2FA
        });
        return;
      }
      
      // Journaliser la connexion réussie
      await securityAuditService.logEvent({
        eventType: 'SUCCESSFUL_LOGIN',
        userId: user._id.toString(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { rememberMe, deviceInfo }
      });
      
      // Envoyer les tokens
      res.status(200).json({
        success: true,
        message: 'Connexion réussie',
        data: {
          ...tokens,
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Déconnexion d'un utilisateur
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      const { allDevices } = req.body;
      
      if (allDevices) {
        await authService.logoutAllDevices(userId);
      } else {
        await authService.logout(userId);
      }
      
      await securityAuditService.logEvent({
        eventType: allDevices ? 'USER_LOGOUT_ALL_DEVICES' : 'USER_LOGOUT',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { allDevices }
      });
      
      res.status(200).json({
        success: true,
        message: allDevices ? 'Déconnexion de tous les appareils réussie' : 'Déconnexion réussie'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Rafraîchir le token d'accès
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Token de rafraîchissement requis'
        });
        return;
      }
      
      const newTokens = await authService.refreshAccessToken(refreshToken);
      
      if (!newTokens) {
        res.status(401).json({
          success: false,
          message: 'Token de rafraîchissement invalide ou expiré'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Token rafraîchi avec succès',
        data: newTokens
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Demande de réinitialisation de mot de passe
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, redirectUrl } = req.body;
      
      const success = await userService.initiatePasswordReset(email, redirectUrl);
      
      // Toujours retourner un succès pour éviter l'énumération d'email
      res.status(200).json({
        success: true,
        message: 'Si un compte existe avec cet email, un lien de réinitialisation vous sera envoyé'
      });
      
      // Journaliser l'événement si l'email existe
      if (success) {
        const user = await userService.getUserByEmail(email);
        await securityAuditService.logEvent({
          eventType: 'PASSWORD_RESET_REQUESTED',
          userId: user?.id.toString(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          details: { email }
        });
      }
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Réinitialisation de mot de passe
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      const { password } = req.body;
      
      if (!token || !password) {
        res.status(400).json({
          success: false,
          message: 'Token et nouveau mot de passe requis'
        });
        return;
      }
      
      const result = await userService.resetPassword(token, password);
      
      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message || 'Token invalide ou expiré'
        });
        return;
      }
      
      await securityAuditService.logEvent({
        eventType: 'PASSWORD_RESET_COMPLETED',
        userId: result.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      ///
      if (!result.userId) {
        res.status(500).json({
          success: false,
          message: "Erreur interne : ID utilisateur manquant après réinitialisation"
        });
        return;
      }

      const user = await userService.getUserById(result.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé"
        });
        return;
      }


      // Envoyer une notification à l'utilisateur
      await notificationService.sendPasswordChangeConfirmationEmail(user.email, user.firstName);

      
      res.status(200).json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Vérification d'email
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      
      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Token de vérification requis'
        });
        return;
      }
      
      const result = await userService.verifyUser(token);
      
      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message || 'Token invalide ou expiré'
        });
        return;
      }
      
      await securityAuditService.logEvent({
        eventType: 'EMAIL_VERIFIED',
        userId: result.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(200).json({
        success: true,
        message: 'Email vérifié avec succès',
        data: {
          userId: result.userId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Renvoyer l'email de vérification
   */
  
async resendVerificationEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
   
    const user = await userService.getUserByEmail(email);
   
    if (!user) {
      // Ne pas révéler si l'email existe ou non
      res.status(200).json({
        success: true,
        message: 'Si un compte existe avec cet email et n\'est pas encore vérifié, un nouvel email de vérification sera envoyé'
      });
      return;
    }
    
    if (user.emailVerified) {
      res.status(400).json({
        success: false,
        message: 'Ce compte est déjà vérifié'
      });
      return;
    }
   
    // Generate a new verification token
    const verificationToken = await authService.generateVerificationToken(user.id.toString());
   
    // Send verification email with all required parameters
    await notificationService.sendVerificationEmail(
      user.email,           // email
      user.firstName,       // firstName
      verificationToken     // token
    );
   
    await securityAuditService.logEvent({
      eventType: 'VERIFICATION_EMAIL_RESENT',
      userId: user.id.toString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
   
    res.status(200).json({
      success: true,
      message: 'Email de vérification renvoyé avec succès'
    });
  } catch (error) {
    next(error);
  }
}

  /**
   * Changement de mot de passe
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      const { currentPassword, password } = req.body;
      
      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await userService.verifyPassword(userId, currentPassword);
      
      if (!isCurrentPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Mot de passe actuel incorrect'
        });
        return;
      }
      
      // Changer le mot de passe
      await userService.changePassword(userId, password);
      
      // Invalider toutes les sessions sauf la courante
      await authService.invalidateOtherSessions(userId, req.sessionId);
      
      await securityAuditService.logEvent({
        eventType: 'PASSWORD_CHANGED',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Envoyer une notification à l'utilisateur
      await notificationService.sendPasswordChangedNotification(userId);
      
      res.status(200).json({
        success: true,
        message: 'Mot de passe changé avec succès'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Configuration de l'authentification à deux facteurs
   */
  async setupTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      const { password } = req.body;
      
      // Vérifier le mot de passe avant la configuration
      const isPasswordValid = await userService.verifyPassword(userId, password);
      
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Mot de passe incorrect'
        });
        return;
      }
      
      // Générer un secret et un QR code
      const twoFactorSetup = await authService.generateTwoFactorSecret(userId);
      
      if (!twoFactorSetup) {
        throw new AppError('Erreur lors de la configuration de l\'authentification à deux facteurs', 500);
      }

      await securityAuditService.logEvent({
        eventType: 'TWO_FACTOR_SETUP_INITIATED',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(200).json({
        success: true,
        message: 'Configuration 2FA initiée avec succès',
        data: {
          qrCodeUrl: twoFactorSetup.qrCodeUrl,
          manualEntryKey: twoFactorSetup.secret,
          backupCodes: twoFactorSetup.backupCodes
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Vérification d'un code 2FA lors de la connexion
   */
  async verifyTwoFactorCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, token } = req.body;
      
      // Valider le token temporaire pour obtenir l'userId
      const decoded = await authService.validateTemporaryToken(token);
      if (!decoded) {
        res.status(401).json({
          success: false,
          message: 'Token temporaire invalide ou expiré'
        });
        return;
      }
      
      const { userId } = decoded;
      
      // Vérifier le code 2FA
      const isValid = await authService.verifyTwoFactorCode(userId, code);
      
      if (!isValid) {
        await securityAuditService.logEvent({
          eventType: 'FAILED_2FA',
          userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
        
        res.status(401).json({
          success: false,
          message: 'Code 2FA invalide'
        });
        return;
      }
      
      // Générer de nouveaux tokens après la 2FA réussie
      const tokens = await authService.generateTokensAfter2FA(userId);
      
      await securityAuditService.logEvent({
        eventType: 'SUCCESSFUL_2FA',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(200).json({
        success: true,
        message: 'Authentification à deux facteurs réussie',
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Activation finale de 2FA après configuration
   */
  async enableTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      const { code, backupCodes } = req.body;
      
      // Vérifier le code 2FA pour activer définitivement
      const isValid = await authService.verifyAndEnableTwoFactor(userId, code, backupCodes);
      
      if (!isValid) {
        res.status(401).json({
          success: false,
          message: 'Code 2FA invalide. Veuillez réessayer.'
        });
        return;
      }
      
      await securityAuditService.logEvent({
        eventType: 'TWO_FACTOR_ENABLED',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Envoyer une notification à l'utilisateur
      await notificationService.sendSecurityNotification(
        userId,
        'Authentification à deux facteurs activée',
        'L\'authentification à deux facteurs a été activée avec succès sur votre compte.'
      );
      
      res.status(200).json({
        success: true,
        message: 'Authentification à deux facteurs activée avec succès'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Désactiver l'authentification à deux facteurs
   */
  async disableTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      const { password, confirmationCode } = req.body;
      
      // Vérifier le mot de passe avant la désactivation
      const passwordValid = await userService.verifyPassword(userId, password);
      
      if (!passwordValid) {
        res.status(401).json({
          success: false,
          message: 'Mot de passe incorrect'
        });
        return;
      }

      // Si un code de confirmation est fourni, le vérifier
      if (confirmationCode) {
        const isCodeValid = await authService.verifyTwoFactorCode(userId, confirmationCode);
        if (!isCodeValid) {
          res.status(401).json({
            success: false,
            message: 'Code de confirmation invalide'
          });
          return;
        }
      }
      
      // Désactiver 2FA
      await authService.disableTwoFactor(userId);
      
      await securityAuditService.logEvent({
        eventType: 'TWO_FACTOR_DISABLED',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Envoyer une notification à l'utilisateur
      await notificationService.sendSecurityNotification(
        userId,
        'Authentification à deux facteurs désactivée',
        'L\'authentification à deux facteurs a été désactivée sur votre compte. Si vous n\'êtes pas à l\'origine de cette action, contactez immédiatement notre support.'
      );
      
      res.status(200).json({
        success: true,
        message: 'Authentification à deux facteurs désactivée avec succès'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Générer de nouveaux codes de secours 2FA
   */
  async generateBackupCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      
      const backupCodes = await authService.generateNewBackupCodes(userId);
      
      await securityAuditService.logEvent({
        eventType: 'TWO_FACTOR_BACKUP_CODES_GENERATED',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(200).json({
        success: true,
        message: 'Nouveaux codes de secours générés avec succès',
        data: {
          backupCodes
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vérification avec un code de secours 2FA
   */
  async verifyBackupCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { backupCode, token } = req.body;
      
      // Valider le token temporaire pour obtenir l'userId
      const decoded = await authService.validateTemporaryToken(token);
      if (!decoded) {
        res.status(401).json({
          success: false,
          message: 'Token temporaire invalide ou expiré'
        });
        return;
      }
      
      const { userId } = decoded;
      
      // Vérifier le code de secours
      const isValid = await authService.verifyBackupCode(userId, backupCode);
      
      if (!isValid) {
        await securityAuditService.logEvent({
          eventType: 'FAILED_BACKUP_CODE',
          userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
        
        res.status(401).json({
          success: false,
          message: 'Code de secours invalide ou déjà utilisé'
        });
        return;
      }
      
      // Générer de nouveaux tokens après la vérification réussie
      const tokens = await authService.generateTokensAfter2FA(userId);
      
      await securityAuditService.logEvent({
        eventType: 'SUCCESSFUL_BACKUP_CODE',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Envoyer une notification à l'utilisateur
      await notificationService.sendSecurityNotification(
        userId,
        'Code de secours utilisé',
        'Un code de secours a été utilisé pour accéder à votre compte. Si vous n\'êtes pas à l\'origine de cette action, veuillez sécuriser votre compte immédiatement.'
      );
      
      res.status(200).json({
        success: true,
        message: 'Authentification avec code de secours réussie',
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Obtenir les sessions actives
   */
  async getActiveSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      const { includeExpired } = req.query;
      
      const sessions = await authService.getActiveSessions(userId, includeExpired === 'true');
      
      res.status(200).json({
        success: true,
        message: 'Sessions récupérées avec succès',
        data: {
          sessions,
          total: sessions.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Révoquer une session spécifique
   */
  async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      const { id: sessionId } = req.params;
      
      const result = await authService.revokeSession(userId, sessionId);
      
      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Session non trouvée ou déjà révoquée'
        });
        return;
      }
      
      await securityAuditService.logEvent({
        eventType: 'SESSION_REVOKED',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { sessionId }
      });
      
      res.status(200).json({
        success: true,
        message: 'Session révoquée avec succès'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Révoquer toutes les sessions sauf la courante
   */
  async revokeAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      const currentSessionId = req.sessionId; // Suppose que le middleware authentifie et ajoute sessionId
      
      const revokedCount = await authService.revokeAllSessionsExceptCurrent(userId, currentSessionId);
      
      await securityAuditService.logEvent({
        eventType: 'ALL_SESSIONS_REVOKED',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { revokedCount }
      });
      
      res.status(200).json({
        success: true,
        message: `${revokedCount} sessions révoquées avec succès`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupération des informations de l'utilisateur connecté
   */
  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      
      const user = await userService.getUserById(userId);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }
      
      // Exclure le mot de passe et autres informations sensibles
      const { password, twoFactorSecret, ...safeUserData } = user;
      
      res.status(200).json({
        success: true,
        message: 'Informations utilisateur récupérées avec succès',
        data: safeUserData
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Informations de sécurité de l'utilisateur
   */
  async getSecurityInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      
      const securityInfo = await authService.getSecurityInfo(userId);
      
      res.status(200).json({
        success: true,
        message: 'Informations de sécurité récupérées avec succès',
        data: securityInfo
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Historique des connexions
   */
  async getLoginHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.user as { userId: string };
      const { limit = 10, page = 1 } = req.query;
      
      const history = await securityAuditService.getLoginHistory(
        userId, 
        parseInt(limit as string), 
        parseInt(page as string)
      );
      
      res.status(200).json({
        success: true,
        message: 'Historique de connexion récupéré avec succès',
        data: history
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AuthControllers;

