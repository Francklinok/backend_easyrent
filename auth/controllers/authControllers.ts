# Architecture Backend Avancée pour Gestion d'Utilisateurs

Ce document présente une architecture complète pour un système de gestion d'utilisateurs de niveau professionnel, incluant les endpoints API RESTful, les middlewares de sécurité, et l'organisation des services.

## Structure des Dossiers

```
/
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   ├── userController.ts
│   │   │   ├── presenceController.ts
│   │   │   ├── profileController.ts
│   │   │   └── adminController.ts
│   │   ├── middlewares/
│   │   │   ├── authMiddleware.ts
│   │   │   ├── rateLimiter.ts
│   │   │   ├── validator.ts
│   │   │   ├── errorHandler.ts
│   │   │   ├── rbacMiddleware.ts
│   │   │   └── requestLogger.ts
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   ├── userRoutes.ts
│   │   │   ├── presenceRoutes.ts
│   │   │   ├── profileRoutes.ts
│   │   │   └── adminRoutes.ts
│   │   └── validators/
│   │       ├── authValidator.ts
│   │       ├── userValidator.ts
│   │       └── profileValidator.ts
│   ├── services/
│   │   ├── authService.ts
│   │   ├── userService.ts
│   │   ├── userPresenceService.ts
│   │   ├── notificationService.ts
│   │   ├── analyticsService.ts
│   │   └── securityAuditService.ts
│   ├── models/
│   │   ├── userModel.ts
│   │   ├── roleModel.ts
│   │   ├── permissionModel.ts
│   │   ├── auditLogModel.ts
│   │   └── securityEventModel.ts
│   ├── types/
│   │   ├── userTypes.ts
│   │   ├── authTypes.ts
│   │   └── presenceTypes.ts
│   ├── config/
│   │   ├── env.config.ts
│   │   ├── mongo.config.ts
│   │   ├── redis.config.ts
│   │   └── security.config.ts
│   └── utils/
│       ├── logger/
│       ├── crypto/
│       ├── validator/
│       └── helpers/
└── tests/
```

## Endpoints API

### 1. Authentification

```
POST   /api/auth/register               # Inscription d'un nouvel utilisateur
POST   /api/auth/login                  # Connexion
POST   /api/auth/logout                 # Déconnexion
POST   /api/auth/refresh                # Rafraîchir le token
POST   /api/auth/verify/:token          # Vérifier l'adresse email
POST   /api/auth/password/forgot        # Demander réinitialisation du mot de passe
POST   /api/auth/password/reset/:token  # Réinitialiser le mot de passe
POST   /api/auth/two-factor/setup       # Configurer l'authentification à deux facteurs
POST   /api/auth/two-factor/verify      # Vérifier un code 2FA
DELETE /api/auth/two-factor             # Désactiver l'authentification à deux facteurs
GET    /api/auth/sessions               # Lister les sessions actives
DELETE /api/auth/sessions/:id           # Révoquer une session spécifique
```

### 2. Gestion des Utilisateurs

```
GET    /api/users                       # Lister les utilisateurs (avec pagination et filtres)
GET    /api/users/:id                   # Obtenir les détails d'un utilisateur
POST   /api/users/search                # Recherche avancée (texte, filtres, tri)
PUT    /api/users/:id                   # Mettre à jour un utilisateur
PATCH  /api/users/:id/activate          # Activer un compte utilisateur
PATCH  /api/users/:id/deactivate        # Désactiver un compte utilisateur
DELETE /api/users/:id                   # Supprimer un utilisateur (soft delete)
GET    /api/users/:id/logs              # Historique des activités d'un utilisateur
```

### 3. Profil Utilisateur

```
GET    /api/profile                     # Obtenir son profil
PUT    /api/profile                     # Mettre à jour son profil
PUT    /api/profile/password            # Changer son mot de passe
POST   /api/profile/avatar              # Télécharger/modifier sa photo de profil
DELETE /api/profile/avatar              # Supprimer sa photo de profil
GET    /api/profile/security            # Obtenir les données de sécurité (dernière connexion, etc.)
GET    /api/profile/preferences         # Obtenir ses préférences
PUT    /api/profile/preferences         # Mettre à jour ses préférences
GET    /api/profile/devices             # Lister les appareils connectés
DELETE /api/profile/devices/:id         # Déconnecter un appareil spécifique
```

### 4. Présence Utilisateur

```
GET    /api/presence/users              # Obtenir la liste des utilisateurs en ligne
GET    /api/presence/users/:id          # Obtenir le statut de présence d'un utilisateur
PUT    /api/presence/status             # Mettre à jour son statut de présence
PUT    /api/presence/last-active        # Mettre à jour la date de dernière activité
```

### 5. Administration

```
GET    /api/admin/users                 # Liste avancée des utilisateurs avec métriques
PUT    /api/admin/users/:id/role        # Modifier le rôle d'un utilisateur
GET    /api/admin/metrics/user          # Métriques sur les utilisateurs
GET    /api/admin/metrics/auth          # Métriques d'authentification
GET    /api/admin/security/logs         # Journaux de sécurité
GET    /api/admin/security/alerts       # Alertes de sécurité
POST   /api/admin/email                 # Envoyer un email aux utilisateurs
GET    /api/admin/audit-logs            # Journaux d'audit
GET    /api/admin/settings              # Paramètres du système
PUT    /api/admin/settings              # Mettre à jour les paramètres du système
```

### 6. Rôles et Permissions

```
GET    /api/roles                       # Liste des rôles
POST   /api/roles                       # Créer un nouveau rôle
GET    /api/roles/:id                   # Détails d'un rôle
PUT    /api/roles/:id                   # Mettre à jour un rôle
DELETE /api/roles/:id                   # Supprimer un rôle
GET    /api/permissions                 # Liste des permissions
GET    /api/users/:id/permissions       # Permissions spécifiques d'un utilisateur
PUT    /api/users/:id/permissions       # Modifier les permissions d'un utilisateur
```

## Middlewares

### 1. authMiddleware.ts

```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { TokenPayload } from '../types/authTypes';
import { AuthService } from '../../services/authService';
import createLogger from '../../utils/logger/logger';

const logger = createLogger('AuthMiddleware');
const authService = new AuthService();

### 2. rateLimiter.ts

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { envConfig } from '../../config/env.config';
import createLogger from '../../utils/logger/logger';

const logger = createLogger('RateLimiter');

// Client Redis pour le rate limiting
const redisClient = createClient({
  url: envConfig.REDIS_URL || 'redis://localhost:6379'
});

// Initialiser la connexion Redis
(async () => {
  try {
    await redisClient.connect();
    logger.info('Connexion Redis pour le rate limiter établie');
  } catch (error) {
    logger.error('Erreur de connexion Redis pour le rate limiter', { 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    });
  }
})();




// Middleware de limitation spécifique pour les opérations sensibles
export const sensitiveOperationLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 requêtes par heure
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de tentatives pour cette opération sensible, veuillez réessayer plus tard'
  }
});
```

### 3. validator.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import createLogger from '../../utils/logger/logger';

const logger = createLogger('Validator');

/**
 * Middleware pour valider les entrées avec express-validator
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Exécuter toutes les validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Vérifier les erreurs
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Journaliser les erreurs de validation
    logger.warn('Validation échouée', { 
      path: req.path,
      errors: errors.array(),
      body: req.body
    });

    // Retourner les erreurs
    return res.status(400).json({ 
      success: false, 
      message: 'Données invalides',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  };
};

/**
 * Sanitize le corps de la requête pour éviter les injections NoSQL
 */
export const sanitizeMongoose = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    // Supprimer les opérateurs MongoDB du corps de la requête
    const sanitize = (obj: any): any => {
      if (obj instanceof Object) {
        for (const key in obj) {
          if (key.startsWith('$')) {
            delete obj[key];
          } else if (obj[key] instanceof Object) {
            obj[key] = sanitize(obj[key]);
          }
        }
      }
      return obj;
    };

    req.body = sanitize(req.body);
  }
  next();
};
```

### 4. errorHandler.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import createLogger from '../../utils/logger/logger';
import { envConfig } from '../../config/env.config';

const logger = createLogger('ErrorHandler');

/**
 * Gestionnaire d'erreurs centralisé
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Journaliser l'erreur
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || 'Erreur interne du serveur';
  
  logger.error('Erreur serveur', {
    statusCode,
    message: errorMessage,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId
  });

  // Préparer la réponse
  const response = {
    success: false,
    message: errorMessage,
    ...(envConfig.NODE_ENV === 'development' && { stack: err.stack })
  };

  // Envoyer la réponse
  res.status(statusCode).json(response);
};

/**
 * Middleware pour capturer les routes non trouvées
 */
export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route non trouvée', { path: req.path, method: req.method });
  
  res.status(404).json({
    success: false,
    message: 'Ressource non trouvée'
  });
};


/**
 * Classe d'erreur personnalisée avec code HTTP
 */
export class AppError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}



import { Request, Response, NextFunction } from 'express';
import createLogger from '../../utils/logger/logger';

const logger = createLogger('RBACMiddleware');

/**
 * Interface pour les modèles de permissions
 */
interface PermissionModel {
  action: string;
  resource: string;
}

/**
 * Middleware de contrôle d'accès basé sur les rôles et les permissions
 */
export const checkPermission = (requiredPermission: PermissionModel) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Accès non autorisé: utilisateur non authentifié'
        });
      }

      const { userId } = req.user;
      
      // Vérifier les permissions de l'utilisateur
      const hasPermission = await checkUserPermission(
        userId, 
        requiredPermission.action, 
        requiredPermission.resource
      );

      if (!hasPermission) {
        logger.warn('Accès refusé: permission insuffisante', {
          userId,
          requiredPermission,
          path: req.path
        });
        
        return res.status(403).json({
          success: false,
          message: 'Accès interdit: permission insuffisante'
        });
      }

      next();
    } catch (error) {
      logger.error('Erreur lors de la vérification des permissions', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        userId: req.user?.userId
      });
      
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la vérification des permissions'
      });
    }
  };
};

/**
 * Vérifier si l'utilisateur a la permission requise
 */
async function checkUserPermission(
  userId: string, 
  action: string, 
  resource: string
): Promise<boolean> {
  // Exemple d'implémentation - à remplacer par votre logique
  // Ceci pourrait interroger une base de données ou un service RBAC externe
  
  // Note: Implémentation fictive, à adapter avec votre modèle de données
  const userPermissions = await getUserPermissionsFromDb(userId);
  
  // Vérifier les permissions directes
  const directPermission = userPermissions.some(p => 
    p.action === action && p.resource === resource
  );
  
  if (directPermission) return true;
  
  // Vérifier les permissions avec wildcard
  const wildcardPermission = userPermissions.some(p => 
    (p.action === '*' || p.action === action) && 
    (p.resource === '*' || p.resource === resource)
  );
  
  return wildcardPermission;
}

/**
 * Fonction fictive pour récupérer les permissions d'un utilisateur
 */
async function getUserPermissionsFromDb(userId: string): Promise<PermissionModel[]> {
  // Exemple - à remplacer par votre implémentation
  return []; 
}
```

### 6. requestLogger.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import createLogger from '../../utils/logger/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('RequestLogger');

/**
 * Middleware pour attribuer un ID unique à chaque requête et journaliser
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Attribuer un ID unique à la requête pour le suivi
  const requestId = uuidv4();
  req.requestId = requestId;
  
  // Enregistrer les informations de base de la requête
  const startTime = Date.now();
  const logData = {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.userId
  };
  
  logger.info('Requête reçue', logData);
  
  // Capturer la fin de la requête pour enregistrer la durée et le code de statut
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Requête terminée', {
      ...logData,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
};

/**
 * Middleware pour journaliser les requêtes sensibles avec plus de détails
 */
export const sensitiveRequestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Ne pas journaliser les mots de passe ou autres données sensibles
  const sensitiveFields = ['password', 'token', 'secret', 'credit_card', 'cardNumber'];
  
  // Copier le corps de la requête pour la journalisation
  const safeBody = { ...req.body };
  
  // Masquer les champs sensibles
  sensitiveFields.forEach(field => {
    if (field in safeBody) {
      safeBody[field] = '********';
    }
  });
  
  logger.info('Requête sensible reçue', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    body: safeBody,
    userId: req.user?.userId
  });
  
  next();
};
```

## Implémentation des Controllers

Voici un exemple d'implémentation pour le contrôleur d'authentification:

### authController.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../services/authService';
import { UserService } from '../../services/userService';
import { NotificationService } from '../../services/notificationService';
import { SecurityAuditService } from '../../services/securityAuditService';
import { AppError } from '../middlewares/errorHandler';
import createLogger from '../../utils/logger/logger';

const logger = createLogger('AuthController');
const authService = new AuthService();
const userService = new UserService();
const notificationService = new NotificationService();
const securityAuditService = new SecurityAuditService();

/**
 * Contrôleur pour les opérations d'authentification
 */
export class AuthController {
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