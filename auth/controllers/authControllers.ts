
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../src/users/services/authService';
import { UserService } from '../../src/services/service';
import { NotificationService } from '../../services/notificationService';
import { SecurityAuditService } from '../../services/securityAuditService';
import {AppError} from '../utils/AppError'
import createLogger from '../../utils/logger/logger';

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
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, firstName, lastName, ...userData } = req.body;
      
      // Vérifier si l'email est déjà utilisé
      const existingUser = await userService.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Cet email est déjà utilisé'
        });
      }
      
      // Créer l'utilisateur
      const user = await userService.createUser({
        email,
        password,
        firstName,
        lastName,
        ...userData
      }, true); // Envoyer l'email de vérification
      
      // Journaliser l'événement
      await securityAuditService.logEvent({
        eventType: 'USER_REGISTERED',
        userId: user._id.toString(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { email }
      });
      
      logger.info('Nouvel utilisateur inscrit', { userId: user._id, email });
      
      res.status(201).json({
        success: true,
        message: 'Inscription réussie. Veuillez vérifier votre email pour activer votre compte',
        data: {
          userId: user._id,
          email: user.email
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Connexion d'un utilisateur
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      
      // Authentifier l'utilisateur
      const tokens = await authService.authenticate(email, password, req);
      
      if (!tokens) {
        await securityAuditService.logEvent({
          eventType: 'FAILED_LOGIN',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          details: { email }
        });
        
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }
      
      // Obtenir les informations de l'utilisateur
      const user = await userService.getUserByEmail(email);
      
      // Vérifier si 2FA est activé
      if (user?.preferences?.twoFactorEnabled) {
        return res.status(200).json({
          success: true,
          message: 'Authentification réussie, validation 2FA requise',
          requireTwoFactor: true,
          temporaryToken: tokens.accessToken // Token temporaire pour l'étape 2FA
        });
      }
      
      // Journaliser la connexion réussie
      await securityAuditService.logEvent({
        eventType: 'SUCCESSFUL_LOGIN',
        userId: user?._id.toString(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Envoyer les tokens
      res.status(200).json({
        success: true,
        message: 'Connexion réussie',
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Déconnexion d'un utilisateur
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user as { userId: string };
      
      await authService.logout(userId);
      
      await securityAuditService.logEvent({
        eventType: 'USER_LOGOUT',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(200).json({
        success: true,
        message: 'Déconnexion réussie'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Rafraîchir le token d'accès
   */
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Token de rafraîchissement requis'
        });
      }
      
      const accessToken = await authService.refreshAccessToken(refreshToken);
      
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          message: 'Token de rafraîchissement invalide ou expiré'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Token rafraîchi avec succès',
        data: { accessToken }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Demande de réinitialisation de mot de passe
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      
      const success = await userService.initiatePasswordReset(email);
      
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
          userId: user?._id.toString(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Réinitialisation de mot de passe
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const { password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({
          success: false,
          message: 'Token et nouveau mot de passe requis'
        });
      }
      
      const result = await userService.resetPassword(token, password);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message || 'Échec de la réinitialisation du mot de passe'
        });
      }
      
      await securityAuditService.logEvent({
        eventType: 'PASSWORD_RESET_COMPLETED',
        userId: result.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Envoyer une notification à l'utilisateur
      await notificationService.sendPasswordChangedNotification(result.userId);
      
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
  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token de vérification requis'
        });
      }
      
      const result = await userService.verifyEmail(token);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message || 'Échec de la vérification d\'email'
        });
      }
      
      await securityAuditService.logEvent({
        eventType: 'EMAIL_VERIFIED',
        userId: result.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(200).json({
        success: true,
        message: 'Email vérifié avec succès'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Configuration de l'authentification à deux facteurs
   */
  async setupTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user as { userId: string };
      
      // Générer un secret et un QR code
      const twoFactorSetup = await authService.generateTwoFactorSecret(userId);
      
      if (!twoFactorSetup) {
        throw new AppError('Erreur lors de la configuration de l\'authentification à deux facteurs', 500);
      }
      
      res.status(200).json({
        success: true,
        message: 'Code QR 2FA généré avec succès',
        data: {
          qrCodeUrl: twoFactorSetup.qrCodeUrl,
          secret: twoFactorSetup.secret
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Vérification d'un code 2FA
   */
  async verifyTwoFactorCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, token } = req.body;
      
      // Valider le token temporaire pour obtenir l'userId
      const decoded = await authService.validateToken(token);
      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Token invalide ou expiré'
        });
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
        
        return res.status(401).json({
          success: false,
          message: 'Code 2FA invalide'
        });
      }
      
      // Générer de nouveaux tokens après la 2FA réussie
      const tokens = await authService.generateTokensAfter2FA(userId);
      
      // Marquer la session comme authentifiée avec 2FA
      if (req.session) {
        req.session.twoFactorAuthenticated = true;
      }
      
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
   * Désactiver l'authentification à deux facteurs
   */
  async disableTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user as { userId: string };
      const { password } = req.body;
      
      // Vérifier le mot de passe avant la désactivation
      const passwordValid = await userService.verifyPassword(userId, password);
      
      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          message: 'Mot de passe incorrect'
        });
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
   * Obtenir les sessions actives
   */
  async getActiveSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user as { userId: string };
      
      const sessions = await authService.getActiveSessions(userId);
      
      res.status(200).json({
        success: true,
        message: 'Sessions récupérées avec succès',
        data: sessions
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Révoquer une session spécifique
   */
  async revokeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.user as { userId: string };
      const { id: sessionId } = req.params;
      
      const result = await authService.revokeSession(userId, sessionId);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Session non trouvée ou déjà révoquée'
        });
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
}

export  default AuthControllers