import express from 'express';
import { body } from 'express-validator';
import { commonValidation } from '../utils/userValidator';
import {
  validate,
  authenticate,
  requireTwoFactor,
  apiLimiter,
  authLimiter,
  sensitiveOperationLimiter,
  sensitiveRequestLogger,
  csrfProtection,
  sanitizeInput,
  securityHeaders
} from '../middlewares';
import AuthControllers from '../controllers/authControllers';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpStatusCode } from '../types/httpStatusCodes';

const authController = new AuthControllers();
const authRouter = express.Router();


// ============ MIDDLEWARES GLOBAUX ============
authRouter.use(securityHeaders);
authRouter.use(sanitizeInput);

// ============ ROUTES PUBLIQUES ============

/**
 * @route   POST /auth/register
 * @desc    Inscription d'un nouvel utilisateur
 * @access  Public
 */
authRouter.post(
  '/register',
  apiLimiter,
  authLimiter,
  sensitiveRequestLogger,
  validate([
    commonValidation.firstName(),
    commonValidation.lastName(),
    commonValidation.username(),
    commonValidation.email(),
    commonValidation.password(),
    commonValidation.phoneNumber(),
    // Validation supplémentaire pour les champs optionnels
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Format de date invalide')
      .custom((value) => {
        const birthDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        if (age < 13 || age > 120) {
          throw new Error('Âge invalide (doit être entre 13 et 120 ans)');
        }
        return true;
      }),
    body('address')
      .optional()
      .isObject()
      .withMessage('Adresse invalide'),
    body('address.street')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Rue trop longue'),
    body('address.city')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Ville trop longue'),
    body('address.country')
      .optional()
      .isISO31661Alpha2()
      .withMessage('Code pays invalide')
  ]),
  asyncHandler(authController.register.bind(authController))
);

/**
 * @route   POST /auth/login
 * @desc    Connexion d'un utilisateur
 * @access  Public
 */
authRouter.post(
  '/login',
  apiLimiter,
  authLimiter,
  sensitiveRequestLogger,
  validate([
    commonValidation.email(),
    body('password')
      .notEmpty()
      .withMessage('Mot de passe requis'),
    body('rememberMe')
      .optional()
      .isBoolean()
      .withMessage('RememberMe doit être un booléen'),
    body('deviceInfo')
      .optional()
      .isObject()
      .withMessage('Informations d\'appareil invalides')
  ]),
  asyncHandler(authController.login.bind(authController))
);

/**
 * @route   POST /auth/refresh-token
 * @desc    Rafraîchissement du token d'accès
 * @access  Public
 */
authRouter.post(
  '/refresh-token',
  apiLimiter,
  validate([
    commonValidation.refreshToken()
  ]),
  asyncHandler(authController.refreshToken.bind(authController))
);

/**
 * @route   POST /auth/forgot-password
 * @desc    Demande de réinitialisation de mot de passe
 * @access  Public
 */
authRouter.post(
  '/forgot-password',
  apiLimiter,
  authLimiter,
  sensitiveRequestLogger,
  validate([
    commonValidation.email(),
    body('redirectUrl')
      .optional()
      .isURL()
      .withMessage('URL de redirection invalide')
  ]),
  asyncHandler(authController.forgotPassword.bind(authController))
);

/**
 * @route   POST /auth/reset-password/:token
 * @desc    Réinitialisation du mot de passe
 * @access  Public
 */
authRouter.post(
  '/reset-password/:token',
  apiLimiter,
  sensitiveOperationLimiter,
  sensitiveRequestLogger,
  validate([
    commonValidation.token(),
    commonValidation.password()
  ]),
  asyncHandler(authController.resetPassword.bind(authController))
);

/**
 * @route   GET /auth/verify-email/:token
 * @desc    Vérification d'email
 * @access  Public
 */
authRouter.get(
  '/verify-email/:token',
  apiLimiter,
  validate([
    commonValidation.token()
  ]),
  asyncHandler(authController.verifyEmail.bind(authController))
);

/**
 * @route   POST /auth/resend-verification
 * @desc    Renvoyer l'email de vérification
 * @access  Public
 */
authRouter.post(
  '/resend-verification',
  apiLimiter,
  authLimiter,
  validate([
    commonValidation.email()
  ]),
  asyncHandler(authController.resendVerificationEmail.bind(authController))
);

// ============ ROUTES AUTHENTIFIÉES ============

/**
 * @route   POST /auth/logout
 * @desc    Déconnexion de l'utilisateur
 * @access  Private
 */
authRouter.post(
  '/logout',
  authenticate,
  validate([
    body('allDevices')
      .optional()
      .isBoolean()
      .withMessage('AllDevices doit être un booléen')
  ]),
  asyncHandler(authController.logout.bind(authController))
);

/**
 * @route   POST /auth/change-password
 * @desc    Changement de mot de passe
 * @access  Private
 */
authRouter.post(
  '/change-password',
  authenticate,
  sensitiveOperationLimiter,
  sensitiveRequestLogger,
  validate([
    body('currentPassword')
      .notEmpty()
      .withMessage('Mot de passe actuel requis'),
    commonValidation.password()
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('Le nouveau mot de passe doit être différent de l\'ancien');
        }
        return true;
      })
  ]),
  asyncHandler(authController.changePassword.bind(authController))
);

// ============ ROUTES 2FA ============

/**
 * @route   POST /auth/2fa/setup
 * @desc    Configuration de l'authentification à deux facteurs
 * @access  Private
 */
authRouter.post(
  '/2fa/setup',
  authenticate,
  sensitiveOperationLimiter,
  sensitiveRequestLogger,
  validate([
    body('password')
      .notEmpty()
      .withMessage('Mot de passe requis pour configurer 2FA')
  ]),
  asyncHandler(authController.setupTwoFactor.bind(authController))
);

/**
 * @route   POST /auth/2fa/verify
 * @desc    Vérification du code 2FA
 * @access  Public (avec token temporaire)
 */
authRouter.post(
  '/2fa/verify',
  sensitiveRequestLogger,
  validate([
    commonValidation.twoFactorCode(),
    body('token')
      .notEmpty()
      .withMessage('Token temporaire requis')
      .isJWT()
      .withMessage('Format de token invalide')
  ]),
  asyncHandler(authController.verifyTwoFactorCode.bind(authController))
);

/**
 * @route   POST /auth/2fa/enable
 * @desc    Activation finale de 2FA après configuration
 * @access  Private
 */
authRouter.post(
  '/2fa/enable',
  authenticate,
  sensitiveOperationLimiter,
  sensitiveRequestLogger,
  validate([
    commonValidation.twoFactorCode(),
    body('backupCodes')
      .optional()
      .isArray()
      .withMessage('Codes de secours invalides')
  ]),
  asyncHandler(authController.enableTwoFactor.bind(authController))
);

/**
 * @route   POST /auth/2fa/disable
 * @desc    Désactivation de l'authentification à deux facteurs
 * @access  Private
 */
authRouter.post(
  '/2fa/disable',
  authenticate,
  requireTwoFactor,
  sensitiveOperationLimiter,
  sensitiveRequestLogger,
  validate([
    body('password')
      .notEmpty()
      .withMessage('Mot de passe requis'),
    body('confirmationCode')
      .optional()
      .matches(TWO_FA_CODE_REGEX)
      .withMessage('Code de confirmation invalide')
  ]),
  asyncHandler(authController.disableTwoFactor.bind(authController))
);

/**
 * @route   GET /auth/2fa/backup-codes
 * @desc    Génération de nouveaux codes de secours
 * @access  Private
 */
authRouter.get(
  '/2fa/backup-codes',
  authenticate,
  requireTwoFactor,
  sensitiveOperationLimiter,
  sensitiveRequestLogger,
  asyncHandler(authController.generateBackupCodes.bind(authController))
);

/**
 * @route   POST /auth/2fa/backup-code
 * @desc    Vérification avec un code de secours
 * @access  Public (avec token temporaire)
 */
authRouter.post(
  '/2fa/backup-code',
  sensitiveRequestLogger,
  validate([
    body('backupCode')
      .notEmpty()
      .withMessage('Code de secours requis')
      .isLength({ min: 8, max: 16 })
      .withMessage('Code de secours invalide'),
    body('token')
      .notEmpty()
      .withMessage('Token temporaire requis')
      .isJWT()
      .withMessage('Format de token invalide')
  ]),
  asyncHandler(authController.verifyBackupCode.bind(authController))
);

// ============ GESTION DES SESSIONS ============

/**
 * @route   GET /auth/sessions
 * @desc    Récupération des sessions actives
 * @access  Private
 */
authRouter.get(
  '/sessions',
  authenticate,
  validate([
    body('includeExpired')
      .optional()
      .isBoolean()
      .withMessage('IncludeExpired doit être un booléen')
  ]),
  asyncHandler(authController.getActiveSessions.bind(authController))
);

/**
 * @route   DELETE /auth/sessions/:id
 * @desc    Révocation d'une session spécifique
 * @access  Private
 */
authRouter.delete(
  '/sessions/:id',
  authenticate,
  validate([
    commonValidation.sessionId()
  ]),
  asyncHandler(authController.revokeSession.bind(authController))
);

/**
 * @route   DELETE /auth/sessions
 * @desc    Révocation de toutes les sessions sauf la courante
 * @access  Private
 */
authRouter.delete(
  '/sessions',
  authenticate,
  sensitiveOperationLimiter,
  sensitiveRequestLogger,
  asyncHandler(authController.revokeAllSessions.bind(authController))
);

// ============ ROUTES D'INFORMATIONS ============

/**
 * @route   GET /auth/me
 * @desc    Récupération des informations de l'utilisateur connecté
 * @access  Private
 */
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(authController.getCurrentUser.bind(authController))
);

/**
 * @route   GET /auth/security-info
 * @desc    Informations de sécurité de l'utilisateur
 * @access  Private
 */
authRouter.get(
  '/security-info',
  authenticate,
  asyncHandler(authController.getSecurityInfo.bind(authController))
);

/**
 * @route   GET /auth/login-history
 * @desc    Historique des connexions
 * @access  Private
 */
authRouter.get(
  '/login-history',
  authenticate,
  validate([
    body('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limite invalide (1-100)'),
    body('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page invalide')
  ]),
  asyncHandler(authController.getLoginHistory.bind(authController))
);

// ============ GESTION D'ERREURS ============

// Middleware de gestion d'erreurs spécifique aux routes d'authentification
authRouter.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log de l'erreur avec contexte
  const errorContext = {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.userId,
    error: error.message,
    stack: error.stack
  };
  
  console.error('Erreur dans les routes d\'authentification:', errorContext);
  
  // Réponse d'erreur standardisée
  if (!res.headersSent) {
    const statusCode = error.statusCode || HttpStatusCode.INTERNAL_SERVER_ERROR;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Erreur interne du serveur',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

export default authRouter;