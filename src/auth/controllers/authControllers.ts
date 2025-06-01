import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../users/services/authService';
import { UserService } from '../../users/services/userService';
import { NotificationService } from '../../services/notificationServices';
import { SecurityAuditService } from '../../security/services/securityAuditServices';
import { AppError } from '../utils/AppError';
import { createLogger } from '../../utils/logger/logger';
import { IUser } from '../../users/types/userTypes';
// Interface pour typer les utilisateurs

declare module 'express-serve-static-core' {
  interface Request {
    sessionId?: string;
    user?: {
      userId: string;
    };
  }
}

const logger = createLogger('AuthController');
/**
 * Contrôleur pour les opérations d'authentification
 */
 class AuthControllers {
   
  private authService: AuthService;
  private userService: UserService;
  private notificationService: NotificationService;
  private securityAuditService: SecurityAuditService;

  constructor() {
    this.authService = new AuthService();
    this.userService = new UserService();
    this.notificationService = new NotificationService();
    this.securityAuditService = new SecurityAuditService();
    
    logger.info('AuthController initialisé avec succès');
  }

  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();
  logger.info('Début de la tentative d\'inscription', { 
    ip: req.ip, 
    userAgent: req.headers['user-agent'],
    email: req.body.email?.substring(0, 5) + '***'
  });

  try {
    const { firstName, lastName, username, email, password, phoneNumber, dateOfBirth, address, ...userData }: IUser = req.body;
    
    // Validation des données requises
    if (!email || !password || !username) {
      logger.warn('Tentative d\'inscription avec données manquantes', { 
        hasEmail: !!email, 
        hasPassword: !!password, 
        hasUsername: !!username,
        ip: req.ip 
      });
      
      res.status(400).json({
        success: false,
        message: 'Email, mot de passe et nom d\'utilisateur sont requis'
      });
      return;
    }

    // Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: 'Format d\'email invalide'
      });
      return;
    }

    // Validation de la force du mot de passe
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 8 caractères'
      });
      return;
    }

    // Vérifications parallèles pour optimiser les performances
    const [existingUserByEmail, existingUserByUsername] = await Promise.all([
      this.userService.getUserByEmail(email),
      this.userService.getUserByUsername(username)
    ]);

    if (existingUserByEmail) {
      logger.warn('Tentative d\'inscription avec email déjà utilisé', { 
        email: email.substring(0, 5) + '***',
        ip: req.ip 
      });
      
      res.status(409).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
      return;
    }

    if (existingUserByUsername) {
      logger.warn('Tentative d\'inscription avec nom d\'utilisateur déjà utilisé', { 
        username: username.substring(0, 3) + '***',
        ip: req.ip 
      });
      
      res.status(409).json({
        success: false,
        message: 'Ce nom d\'utilisateur est déjà utilisé'
      });
      return;
    }

    console.log(password, firstName)

    // ✅ CORRECTION : Créer l'utilisateur SANS envoyer l'email automatiquement
    const user: IUser = await this.userService.createUser({
      firstName,
      lastName,
      username,
      email,
      password,
      phoneNumber,
      dateOfBirth,
      address,
      ...userData
    }, false); // ← IMPORTANT : false pour éviter le double envoi

    // Vérifier que l'utilisateur a été créé avec succès
    if (!user || (!user.id && !user._id)) {
      logger.error('Échec de la création de l\'utilisateur - utilisateur null ou sans ID', { 
        email: email.substring(0, 5) + '***',
        username: username.substring(0, 3) + '***'
      });
      throw new AppError('Échec de la création de l\'utilisateur', 500);
    }

    const userId = user._id || user.id;
    
    // ✅ Générer le token de vérification
    const verificationToken = await this.authService.generateVerificationToken(userId.toString());
    
    logger.info('📨 Envoi de l\'e-mail avec token :', {
      email: user.email.substring(0, 5) + '***',
      firstName: user.firstName,
      token: verificationToken.substring(0, 10) + '...',
      tokenLength: verificationToken.length
    });

    // ✅ Envoyer l'email de vérification UNE SEULE FOIS
    const emailSent = await this.notificationService.sendVerificationEmail(
      user.email,
      user.firstName || '',
      verificationToken
    );

    // Journalisation de sécurité
    try {
      await this.securityAuditService.logEvent({
        eventType: 'USER_REGISTERED',
        userId: userId.toString(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        details: {
          email: email.substring(0, 5) + '***', 
          username: username.substring(0, 3) + '***',
          emailSent
        }
      });
    } catch (auditError) {
      logger.warn('Erreur lors de la journalisation d\'inscription', { 
        error: auditError instanceof Error ? auditError.message : 'Erreur inconnue',
        userId: userId.toString()
      });
    }

    const executionTime = Date.now() - startTime;
    logger.info('Nouvel utilisateur inscrit avec succès', { 
      userId: userId.toString(),
      email: email.substring(0, 5) + '***',
      username: username.substring(0, 3) + '***',
      executionTime: `${executionTime}ms`,
      verificationTokenGenerated: !!verificationToken,
      emailSent
    });

    res.status(201).json({
      success: true,
      message: 'Inscription réussie. Veuillez vérifier votre email pour activer votre compte',
      data: {
        userId: userId.toString(),
        email: user.email,
        username: user.username,
        requiresEmailVerification: true,
        emailSent
      }
    });
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    logger.error('Erreur lors de l\'inscription', { 
      error: error.message,
      stack: error.stack,
      email: req.body.email?.substring(0, 5) + '***',
      executionTime: `${executionTime}ms`,
      ip: req.ip
    });
    next(error);
  }
}

  /**
   * Connexion d'un utilisateur
   */

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const { email, password, rememberMe, deviceInfo } = req.body;

    logger.info('Tentative de connexion', {
      email: email?.substring(0, 5) + '***',
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
      hasPassword: !!password
    });

    console.log(password, email )


    try {
      // Validation des champs requis
      if (!email || !password) {
        logger.warn('Tentative de connexion avec des données manquantes', {
          hasEmail: !!email,
          hasPassword: !!password,
          ip: req.ip
        });

        res.status(400).json({
          success: false,
          message: 'Email et mot de passe requis'
        });
        return;
      }

      // Authentification
      const tokens = await this.authService.authenticate(email, password, req, {
        rememberMe,
        deviceInfo
      });

      if (!tokens) {
        const executionTime = Date.now() - startTime;
        logger.warn('Échec de connexion - identifiants invalides', {
          email: email.substring(0, 5) + '***',
          ip: req.ip,
          executionTime: `${executionTime}ms`
        });

        res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
        return;
      }

      // Récupération des données utilisateur pour la réponse
      // const user = await this.userService.getUserByEmail(email);
      const user = await this.userService.getUserByEmailWithRefreshTokens(email);
      if (!user) {
        throw new Error('Utilisateur non trouvé après authentification');
      }

      // Vérification 2FA si activé
      if (user.preferences?.twoFactorEnabled) {
        logger.info('Connexion réussie - 2FA requis', {
          userId: user._id?.toString(),
          email: email.substring(0, 5) + '***'
        });

        res.status(200).json({
          success: true,
          message: 'Authentification réussie, validation 2FA requise',
          requireTwoFactor: true,
          temporaryToken: tokens.accessToken
        });
        return;
      }
         logger.info('État des refresh tokens après authentification', {
      userId: user._id?.toString(),
      refreshTokensCount: user.refreshTokens?.length || 0,
      hasTokensInResponse: !!tokens.refreshToken
    });

   
        // Connexion réussie
    const executionTime = Date.now() - startTime;
    logger.info('Connexion réussie', {
      userId: user._id?.toString(),
      email: email.substring(0, 5) + '***',
      rememberMe,
      executionTime: `${executionTime}ms`,
      refreshTokensInDB: user.refreshTokens?.length || 0
    });

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
            lastName: user.lastName,
            role: user.role,
            profilePicture: user.profilePicture
          }
        }
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la connexion', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        email: email?.substring(0, 5) + '***',
        executionTime: `${executionTime}ms`,
        ip: req.ip
      });
      next(error);
    }
  }

/**
 * Vérification de compte utilisateur
 */
async verifyAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();

  try {
    const token = req.query.token as string;

    if (!token) {
      logger.warn('Tentative de vérification de compte sans token', { ip: req.ip });
      res.status(400).json({
        success: false,
        message: 'Token de vérification manquant dans la requête'
      });
      return;
    }

    logger.info('Tentative de vérification de compte', {
      tokenLength: token.length,
      ip: req.ip
    });

    // Étape 1 : valider le token
    const tokenData = await this.authService.validateVerificationToken(token);

    if (!tokenData) {
      logger.warn('Échec de vérification de compte', {
        reason: 'Token invalide ou expiré',
        ip: req.ip
      });
      res.status(404).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
      return;
    }

    // Étape 2 : Vérifier l’utilisateur (mise à jour des champs, etc.)
    const updateResult = await this.userService.verifyUser(token);

    if (!updateResult.success) {
      logger.error('Erreur lors de la mise à jour du statut de vérification', {
        userId: tokenData.userId,
        error: updateResult.message
      });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du compte'
      });
      return;
    }

    // Étape 3 : journalisation de l'événement
    await this.securityAuditService.logEvent({
      eventType: 'ACCOUNT_VERIFIED',
      userId: updateResult.userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { verificationMethod: 'email_token' }
    });

 

    const executionTime = Date.now() - startTime;
    logger.info('Compte vérifié avec succès', {
      userId: updateResult.userId,
      executionTime: `${executionTime}ms`
    });

    res.status(200).json({
      success: true,
      message: 'Compte vérifié avec succès',
      data: {
        userId: updateResult.userId,
        isVerified: true
      }
    });

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    logger.error('Erreur lors de la vérification de compte', {
      error: error.message,
      stack: error.stack,
      token: req.query.token ? 'présent' : 'absent',
      executionTime: `${executionTime}ms`,
      ip: req.ip
    });
    next(error);
  }
}

  /**
   * Déconnexion d'un utilisateur
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { userId } = req.user as { userId: string };
      const { allDevices } = req.body;
      
      logger.info('Tentative de déconnexion', { 
        userId,
        allDevices: !!allDevices,
        ip: req.ip 
      });
      
      await this.authService.logout(userId);
      
      await this.securityAuditService.logEvent({
        eventType: allDevices ? 'USER_LOGOUT_ALL_DEVICES' : 'USER_LOGOUT',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { allDevices }
      });
      
      const executionTime = Date.now() - startTime;
      logger.info('Déconnexion réussie', { 
        userId,
        allDevices: !!allDevices,
        executionTime: `${executionTime}ms`
      });
      
      res.status(200).json({
        success: true,
        message: allDevices ? 'Déconnexion de tous les appareils réussie' : 'Déconnexion réussie'
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la déconnexion', { 
        error: error.message,
        stack: error.stack,
        userId: req.user?.userId,
        executionTime: `${executionTime}ms`
      });
      next(error);
    }
  }
  
  /**
   * Rafraîchir le token d'accès
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        logger.warn('Tentative de rafraîchissement sans token', { ip: req.ip });
        
        res.status(400).json({
          success: false,
          message: 'Token de rafraîchissement requis'
        });
        return;
      }
      
      logger.info('Tentative de rafraîchissement de token', { 
        tokenLength: refreshToken.length,
        ip: req.ip 
      });
      
      const newTokens = await this.authService.refreshAccessToken(refreshToken);
      
      if (!newTokens) {
        logger.warn('Échec du rafraîchissement - token invalide', { ip: req.ip });
        
        res.status(401).json({
          success: false,
          message: 'Token de rafraîchissement invalide ou expiré'
        });
        return;
      }
      
      const executionTime = Date.now() - startTime;
      logger.info('Token rafraîchi avec succès', { 
        executionTime: `${executionTime}ms`,
        ip: req.ip 
      });
      
      res.status(200).json({
        success: true,
        message: 'Token rafraîchi avec succès',
        data: newTokens
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors du rafraîchissement du token', { 
        error: error.message,
        stack: error.stack,
        executionTime: `${executionTime}ms`,
        ip: req.ip
      });
      next(error);
    }
  }
  
  /**
   * Demande de réinitialisation de mot de passe
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { email, redirectUrl } = req.body;
      
      if (!email) {
        logger.warn('Demande de réinitialisation sans email', { ip: req.ip });
        
        res.status(400).json({
          success: false,
          message: 'Email requis'
        });
        return;
      }
      
      logger.info('Demande de réinitialisation de mot de passe', { 
        email: email.substring(0, 5) + '***',
        ip: req.ip 
      });
      
      const success = await this.userService.initiatePasswordReset(email, redirectUrl);
      
      // Journaliser l'événement si l'email existe
      if (success) {
        const user = await this.userService.getUserByEmail(email);
        if (user) {
          const userId = user._id || user.id;
          await this.securityAuditService.logEvent({
            eventType: 'PASSWORD_RESET_REQUESTED',
            userId: userId.toString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { email: email.substring(0, 5) + '***' }
          });
        }
      }
      
      const executionTime = Date.now() - startTime;
      logger.info('Demande de réinitialisation traitée', { 
        email: email.substring(0, 5) + '***',
        success,
        executionTime: `${executionTime}ms`
      });
      
      // Toujours retourner un succès pour éviter l'énumération d'email
      res.status(200).json({
        success: true,
        message: 'Si un compte existe avec cet email, un lien de réinitialisation vous sera envoyé'
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la demande de réinitialisation', { 
        error: error.message,
        stack: error.stack,
        email: req.body.email?.substring(0, 5) + '***',
        executionTime: `${executionTime}ms`
      });
      next(error);
    }
  }
  
  /**
   * Réinitialisation de mot de passe
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { token } = req.params;
      const { password } = req.body;
      
      if (!token || !password) {
        logger.warn('Tentative de réinitialisation avec données manquantes', { 
          hasToken: !!token,
          hasPassword: !!password,
          ip: req.ip 
        });
        
        res.status(400).json({
          success: false,
          message: 'Token et nouveau mot de passe requis'
        });
        return;
      }
      
      logger.info('Tentative de réinitialisation de mot de passe', { 
        tokenLength: token.length,
        ip: req.ip 
      });
      
      const result = await this.userService.resetPassword(token, password);
      
      if (!result.success) {
        logger.warn('Échec de réinitialisation', { 
          reason: result.message,
          ip: req.ip 
        });
        
        res.status(400).json({
          success: false,
          message: result.message || 'Token invalide ou expiré'
        });
        return;
      }
      
      if (!result.userId) {
        logger.error('Réinitialisation réussie mais userId manquant', { ip: req.ip });
        
        res.status(500).json({
          success: false,
          message: "Erreur interne : ID utilisateur manquant après réinitialisation"
        });
        return;
      }

      const user = await this.userService.getUserById(result.userId);

      if (!user) {
        logger.error('Utilisateur non trouvé après réinitialisation', { 
          userId: result.userId 
        });
        
        res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé"
        });
        return;
      }

      // Opérations asynchrones
      const asyncOperations = [
        this.securityAuditService.logEvent({
          eventType: 'PASSWORD_RESET_COMPLETED',
          userId: result.userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }),
        this.notificationService.sendPasswordChangeConfirmationEmail(user.email, user.firstName || '')
      ];

      await Promise.all(asyncOperations);
      
      const executionTime = Date.now() - startTime;
      logger.info('Mot de passe réinitialisé avec succès', { 
        userId: result.userId,
        executionTime: `${executionTime}ms`
      });
      
      res.status(200).json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès'
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la réinitialisation du mot de passe', { 
        error: error.message,
        stack: error.stack,
        executionTime: `${executionTime}ms`,
        ip: req.ip
      });
      next(error);
    }
  }
  
  /**
   * Vérification d'email
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const token = req.query.token as string;
      logger.warn('le token de verification est donc:', { token });


      // const { token } = req.params;
      
      if (!token) {
        logger.warn('Tentative de vérification sans token', { ip: req.ip });
        
        res.status(400).json({
          success: false,
          message: 'Token de vérification requis'
        });
        return;
      }
      
      logger.info('Tentative de vérification d\'email', { 
        tokenLength: token.length,
        ip: req.ip 
      });
      
      const result = await this.userService.verifyUser(token);
      
      if (!result.success) {
        logger.warn('Échec de vérification d\'email', { 
          reason: result.message,
          ip: req.ip 
        });
        
        res.status(400).json({
          success: false,
          message: result.message || 'Token invalide ou expiré'
        });
        return;
      }
      
      await this.securityAuditService.logEvent({
        eventType: 'EMAIL_VERIFIED',
        userId: result.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      const executionTime = Date.now() - startTime;
      logger.info('Email vérifié avec succès', { 
        userId: result.userId,
        executionTime: `${executionTime}ms`
      });
      
      res.status(200).json({
        success: true,
        message: 'Email vérifié avec succès',
        data: {
          userId: result.userId
        }
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la vérification d\'email', { 
        error: error.message,
        stack: error.stack,
        executionTime: `${executionTime}ms`,
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * Renvoyer l'email de vérification
   */
  async resendVerificationEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { email } = req.body;
      
      if (!email) {
        logger.warn('Demande de renvoi de vérification sans email', { ip: req.ip });
        
        res.status(400).json({
          success: false,
          message: 'Email requis'
        });
        return;
      }
   
      logger.info('Demande de renvoi d\'email de vérification', { 
        email: email.substring(0, 5) + '***',
        ip: req.ip 
      });
   
      const user = await this.userService.getUserByEmail(email);
   
      if (!user) {
        logger.info('Demande de renvoi pour email inexistant', { 
          email: email.substring(0, 5) + '***',
          ip: req.ip 
        });
        
        res.status(200).json({
          success: true,
          message: 'Si un compte existe avec cet email et n\'est pas encore vérifié, un nouvel email de vérification sera envoyé'
        });
        return;
      }
      
      if (user.emailVerified) {
        logger.warn('Tentative de renvoi pour compte déjà vérifié', { 
          userId: (user._id || user.id).toString(),
          email: email.substring(0, 5) + '***'
        });
        
        res.status(400).json({
          success: false,
          message: 'Ce compte est déjà vérifié'
        });
        return;
      }
   
      const userId = user._id || user.id;
      const verificationToken = await this.authService.generateVerificationToken(userId.toString());
   
      // Opérations asynchrones
      const asyncOperations = [
        this.notificationService.sendVerificationEmail(
          user.email,
          user.firstName || '',
          verificationToken
        ),
        this.securityAuditService.logEvent({
          eventType: 'VERIFICATION_EMAIL_RESENT',
          userId: userId.toString(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        })
      ];

      await Promise.all(asyncOperations);
   
      const executionTime = Date.now() - startTime;
      logger.info('Email de vérification renvoyé avec succès', { 
        userId: userId.toString(),
        email: email.substring(0, 5) + '***',
        executionTime: `${executionTime}ms`
      });
   
      res.status(200).json({
        success: true,
        message: 'Email de vérification renvoyé avec succès'
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors du renvoi d\'email de vérification', { 
        error: error.message,
        stack: error.stack,
        email: req.body.email?.substring(0, 5) + '***',
        executionTime: `${executionTime}ms`
      });
      next(error);
    }
  }

  /**
   * Changement de mot de passe
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { userId } = req.user as { userId: string };
      const { currentPassword, password } = req.body;
      
      if (!currentPassword || !password) {
        logger.warn('Tentative de changement de mot de passe avec données manquantes', { 
          userId,
          hasCurrentPassword: !!currentPassword,
          hasNewPassword: !!password
        });
        
        res.status(400).json({
          success: false,
          message: 'Mot de passe actuel et nouveau mot de passe requis'
        });
        return;
      }
      
      logger.info('Tentative de changement de mot de passe', { userId, ip: req.ip });
      
      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await this.userService.verifyPassword(userId, currentPassword);
      
      if (!isCurrentPasswordValid) {
        logger.warn('Changement de mot de passe échoué - mot de passe actuel incorrect', { 
          userId 
        });
        
        res.status(401).json({
          success: false,
          message: 'Mot de passe actuel incorrect'
        });
        return;
      }
      
      // Changer le mot de passe
      await this.userService.changePassword(userId, currentPassword, password);
      
      if (!req.sessionId) {
        logger.error('Session ID manquant lors du changement de mot de passe', { 
          userId 
        });
        
        res.status(400).json({
          success: false,
          message: 'Session ID manquant'
        });
        return;
      }

      // Invalider toutes les sessions sauf la courante
      await this.authService.invalidateOtherSessions(userId, req.sessionId);
      
      const user = await this.userService.getUserById(userId);

      if (!user) {
        logger.error('Utilisateur non trouvé après changement de mot de passe', { 
          userId 
        });
        
        res.status(404).json({ 
          success: false, 
          message: 'Utilisateur non trouvé' 
        });
        return;
      }

      // Opérations asynchrones
      const asyncOperations = [
        this.securityAuditService.logEvent({
          eventType: 'PASSWORD_CHANGED',
          userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }),
        this.notificationService.sendSecurityNotification(
          user.email, 
          user.firstName || '', 
          'password_changed'
        )
      ];

      await Promise.all(asyncOperations);
      
      const executionTime = Date.now() - startTime;
      logger.info('Mot de passe changé avec succès', { 
        userId,
        executionTime: `${executionTime}ms`
      });
      
      res.status(200).json({
        success: true,
        message: 'Mot de passe changé avec succès'
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors du changement de mot de passe', { 
        error: error.message,
        stack: error.stack,
        userId: req.user?.userId,
        executionTime: `${executionTime}ms`
      });
      next(error);
    }
  }
  
  /**
   * Configuration de l'authentification à deux facteurs
   */
  async setupTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { userId } = req.user as { userId: string };
      const { password } = req.body;
      
      if (!password) {
        logger.warn('Tentative de configuration 2FA sans mot de passe', { userId });
        
        res.status(400).json({
          success: false,
          message: 'Mot de passe requis pour configurer l\'authentification à deux facteurs'
        });
        return;
      }
      
      logger.info('Configuration de l\'authentification à deux facteurs', { userId, ip: req.ip });
      
      // Vérifier le mot de passe
      const isPasswordValid = await this.userService.verifyPassword(userId, password);
      
      if (!isPasswordValid) {
        logger.warn('Configuration 2FA échouée - mot de passe incorrect', { userId });
        
        res.status(401).json({
          success: false,
          message: 'Mot de passe incorrect'
        });
        return;
      }
      
      // Générer le secret 2FA
      const twoFactorData = await this.authService.generateTwoFactorSecret(userId);
      
      await this.securityAuditService.logEvent({
        eventType: 'TWO_FACTOR_SETUP_INITIATED',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      const executionTime = Date.now() - startTime;
      logger.info('Secret 2FA généré avec succès', { 
        userId,
        executionTime: `${executionTime}ms`
      });
      
      res.status(200).json({
        success: true,
        message: 'Secret 2FA généré avec succès',
        data: twoFactorData
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la configuration 2FA', { 
        error: error.message,
        stack: error.stack,
        userId: req.user?.userId,
        executionTime: `${executionTime}ms`
      });
      next(error);
    }
  }
  
  /**
   * Validation de l'authentification à deux facteurs
   */
  async verifyTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { userId } = req.user as { userId: string };
      const { token, password } = req.body;
      
      if (!token || !password) {
        logger.warn('Tentative de vérification 2FA avec données manquantes', { 
          userId,
          hasToken: !!token,
          hasPassword: !!password
        });
        
        res.status(400).json({
          success: false,
          message: 'Code 2FA et mot de passe requis'
        });
        return;
      }
      
      logger.info('Vérification de l\'authentification à deux facteurs', { userId, ip: req.ip });
      
      // Vérifier le mot de passe
      const isPasswordValid = await this.userService.verifyPassword(userId, password);
      
      if (!isPasswordValid) {
        logger.warn('Vérification 2FA échouée - mot de passe incorrect', { userId });
        
        res.status(401).json({
          success: false,
          message: 'Mot de passe incorrect'
        });
        return;
      }
      
      // Vérifier le code 2FA
      const isValidToken = await this.authService.verifyTwoFactorCode(userId, token);
      
      if (!isValidToken) {
        logger.warn('Vérification 2FA échouée - code invalide', { userId });
        
        res.status(401).json({
          success: false,
          message: 'Code 2FA invalide'
        });
        return;
      }
      
      // Activer 2FA pour l'utilisateur
      await this.userService.enableTwoFactor(userId);
      
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        logger.error('Utilisateur non trouvé après activation 2FA', { userId });
        
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }

      // Opérations asynchrones
      const asyncOperations = [
        this.securityAuditService.logEvent({
          eventType: 'TWO_FACTOR_ENABLED',
          userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }),
        this.notificationService.sendSecurityNotification(
          user.email,
          user.firstName || '',
          'two_factor_enabled'
        )
      ];

      await Promise.all(asyncOperations);
      
      const executionTime = Date.now() - startTime;
      logger.info('Authentification à deux facteurs activée avec succès', { 
        userId,
        executionTime: `${executionTime}ms`
      });
      
      res.status(200).json({
        success: true,
        message: 'Authentification à deux facteurs activée avec succès'
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la vérification 2FA', { 
        error: error.message,
        stack: error.stack,
        userId: req.user?.userId,
        executionTime: `${executionTime}ms`
      });
      next(error);
    }
  }
  
  /**
   * Désactivation de l'authentification à deux facteurs
   */
  async disableTwoFactor(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { userId } = req.user as { userId: string };
      const { password, token } = req.body;
      
      if (!password || !token) {
        logger.warn('Tentative de désactivation 2FA avec données manquantes', { 
          userId,
          hasPassword: !!password,
          hasToken: !!token
        });
        
        res.status(400).json({
          success: false,
          message: 'Mot de passe et code 2FA requis'
        });
        return;
      }
      
      logger.info('Désactivation de l\'authentification à deux facteurs', { userId, ip: req.ip });
      
      // Vérifier le mot de passe
      const isPasswordValid = await this.userService.verifyPassword(userId, password);
      
      if (!isPasswordValid) {
        logger.warn('Désactivation 2FA échouée - mot de passe incorrect', { userId });
        
        res.status(401).json({
          success: false,
          message: 'Mot de passe incorrect'
        });
        return;
      }
      
      // Vérifier le code 2FA
      const isValidToken = await this.authService.verifyTwoFactorToken(userId, token);
      
      if (!isValidToken) {
        logger.warn('Désactivation 2FA échouée - code invalide', { userId });
        
        res.status(401).json({
          success: false,
          message: 'Code 2FA invalide'
        });
        return;
      }
      
      // Désactiver 2FA pour l'utilisateur
      await this.userService.disableTwoFactor(userId);
      
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        logger.error('Utilisateur non trouvé après désactivation 2FA', { userId });
        
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }

      // Opérations asynchrones
      const asyncOperations = [
        this.securityAuditService.logEvent({
          eventType: 'TWO_FACTOR_DISABLED',
          userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }),
        this.notificationService.sendSecurityNotification(
          user.email,
          user.firstName || '',
          'two_factor_disabled'
        )
      ];

      await Promise.all(asyncOperations);
      
      const executionTime = Date.now() - startTime;
      logger.info('Authentification à deux facteurs désactivée avec succès', { 
        userId,
        executionTime: `${executionTime}ms`
      });
      
      res.status(200).json({
        success: true,
        message: 'Authentification à deux facteurs désactivée avec succès'
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la désactivation 2FA', { 
        error: error.message,
        stack: error.stack,
        userId: req.user?.userId,
        executionTime: `${executionTime}ms`
      });
      next(error);
    }
  }

  /**
   * Vérification du code 2FA lors de la connexion
   */

  async validateTwoFactorLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { temporaryToken, token } = req.body;
      
      if (!temporaryToken || !token) {
        logger.warn('Tentative de validation 2FA avec données manquantes', { 
          hasTemporaryToken: !!temporaryToken,
          hasToken: !!token,
          ip: req.ip
        });
        
        res.status(400).json({
          success: false,
          message: 'Token temporaire et code 2FA requis'
        });
        return;
      }
      
      logger.info('Validation du code 2FA pour la connexion', { 
        tokenLength: token.length,
        ip: req.ip 
      });

      const authResult = await this.authService.validateTwoFactorLogin(temporaryToken, token);

      if (!authResult.success  || !authResult.userId) {
        // Handle failure case
        res.status(401).json({
          success: false,
          message: authResult.message || 'Code 2FA invalide'
        });
        return;
      }

      const id:any = authResult.userId
      
      const user = await this.userService.getUserById(id);
      
      if (!user) {
        logger.error('Utilisateur non trouvé après validation 2FA', { 
          userId: authResult.userId 
        });
        
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }

      await this.securityAuditService.logEvent({
        eventType: 'TWO_FACTOR_LOGIN_SUCCESS',
        userId: authResult.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      const executionTime = Date.now() - startTime;
      logger.info('Connexion 2FA validée avec succès', { 
        userId: authResult.userId,
        executionTime: `${executionTime}ms`
      });
      
      res.status(200).json({
        success: true,
        message: 'Connexion réussie',
        data: {
          ...authResult.tokens,
          user: {
            id: user._id || user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName
          }
        }
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la validation 2FA', { 
        error: error.message,
        stack: error.stack,
        executionTime: `${executionTime}ms`,
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * Obtenir le profil de l'utilisateur connecté
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { userId } = req.user as { userId: string };
      
      logger.info('Récupération du profil utilisateur', { userId });
      
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        logger.warn('Profil non trouvé', { userId });
        
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }
      
      const executionTime = Date.now() - startTime;
      logger.info('Profil récupéré avec succès', { 
        userId,
        executionTime: `${executionTime}ms`
      });
      
      // Retourner les données sans le mot de passe
      const { password, ...userProfile } = user;
      
      res.status(200).json({
        success: true,
        message: 'Profil récupéré avec succès',
        data: {
          user: {
            id: user._id || user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            dateOfBirth: user.dateOfBirth,
            address: user.address,
            emailVerified: user.emailVerified,
            twoFactorEnabled: user.preferences?.twoFactorEnabled || false
          }
        }
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la récupération du profil', { 
        error: error.message,
        stack: error.stack,
        userId: req.user?.userId,
        executionTime: `${executionTime}ms`
      });
      next(error);
    }
  }

  /**
   * Mise à jour du profil utilisateur
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { userId } = req.user as { userId: string };
      const { firstName, lastName, phoneNumber, dateOfBirth, address } = req.body;
      
      logger.info('Mise à jour du profil utilisateur', { userId, ip: req.ip });
      
      const updateData: Partial<IUser> = {};
      
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
      if (address !== undefined) updateData.address = address;
      
      if (Object.keys(updateData).length === 0) {
        logger.warn('Tentative de mise à jour sans données', { userId });
        
        res.status(400).json({
          success: false,
          message: 'Aucune donnée à mettre à jour'
        });
        return;
      }
      
      const updatedUser = await this.userService.updateUser(userId, updateData);
      
      if (!updatedUser) {
        logger.error('Échec de la mise à jour du profil', { userId });
        
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }

      await this.securityAuditService.logEvent({
        eventType: 'PROFILE_UPDATED',
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { updatedFields: Object.keys(updateData) }
      });
      
      const executionTime = Date.now() - startTime;
      logger.info('Profil mis à jour avec succès', { 
        userId,
        updatedFields: Object.keys(updateData),
        executionTime: `${executionTime}ms`
      });
      
      res.status(200).json({
        success: true,
        message: 'Profil mis à jour avec succès',
        data: {
          user: {
            id: updatedUser._id || updatedUser.id,
            email: updatedUser.email,
            username: updatedUser.username,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            phoneNumber: updatedUser.phoneNumber,
            dateOfBirth: updatedUser.dateOfBirth,
            address: updatedUser.address,
            emailVerified: updatedUser.emailVerified,
            twoFactorEnabled: updatedUser.preferences?.twoFactorEnabled || false
          }
        }
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la mise à jour du profil', { 
        error: error.message,
        stack: error.stack,
        userId: req.user?.userId,
        executionTime: `${executionTime}ms`
      });
      next(error);
    }
  }

  /**
   * Suppression du compte utilisateur
   */


  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { userId } = req.user as { userId: string };
      const { password, confirmationText } = req.body;
      
      if (!password || confirmationText !== 'DELETE') {
        logger.warn('Tentative de suppression de compte avec données manquantes', { 
          userId,
          hasPassword: !!password,
          hasConfirmation: confirmationText === 'DELETE'
        });
        
        res.status(400).json({
          success: false,
          message: 'Mot de passe et confirmation requis (tapez "DELETE")'
        });
        return;
      }
      
      logger.info('Tentative de suppression de compte', { userId, ip: req.ip });
      
      // Vérifier le mot de passe
      const isPasswordValid = await this.userService.verifyPassword(userId, password);
      
      if (!isPasswordValid) {
        logger.warn('Suppression de compte échouée - mot de passe incorrect', { userId });
        
        res.status(401).json({
          success: false,
          message: 'Mot de passe incorrect'
        });
        return;
      }
      
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        logger.error('Utilisateur non trouvé lors de la suppression', { userId });
        
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }

      // Supprimer le compte
      await this.userService.deleteUser(userId);
      
      // Invalider toutes les sessions
      await this.authService.logout(userId);

      // Opérations asynchrones
      const asyncOperations = [
        this.securityAuditService.logEvent({
          eventType: 'ACCOUNT_DELETED',
          userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }),
        this.notificationService.sendAccountDeletedEmail(
          user.email,
          user.firstName || ''
        )
      ];

      await Promise.all(asyncOperations);
      
      const executionTime = Date.now() - startTime;
      logger.info('Compte supprimé avec succès', { 
        userId,
        email: user.email.substring(0, 5) + '***',
        executionTime: `${executionTime}ms`
      });
      
      res.status(200).json({
        success: true,
        message: 'Compte supprimé avec succès'
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de la suppression du compte', { 
        error: error.message,
        stack: error.stack,
        userId: req.user?.userId,
        executionTime: `${executionTime}ms`
      });
      next(error);
    }
  }
}

export default AuthControllers ;