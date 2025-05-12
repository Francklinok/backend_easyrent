import express from 'express';
import { body, param } from 'express-validator';
import {
  validate,
  authenticate,
  requireTwoFactor,
  apiLimiter,
  authLimiter,
  sensitiveOperationLimiter,
  sensitiveRequestLogger
} from '../middlewares';
import  authControllers from "../controllers/authControllers"

const authController = new authControllers()

const router = express.Router();

// ─────────── Routes publiques ───────────

// Register
router.post(
  '/register',
  apiLimiter,
  authLimiter,
  sensitiveRequestLogger,
  validate([
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe trop court'),
    body('username').notEmpty().withMessage('Le nom d\'utilisateur est requis')
  ]),
  authController.register.bind(authController)
);

// Login
router.post(
  '/login',
  apiLimiter,
  authLimiter,
  sensitiveRequestLogger,
  validate([
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis'),
  ]),
  authController.login.bind(authController)
);

// Refresh Token
router.post(
  '/refresh-token',
  apiLimiter,
  authController.refreshToken.bind(authController)
);

// Forgot Password
router.post(
  '/forgot-password',
  apiLimiter,
  authLimiter,
  sensitiveRequestLogger,
  validate([
    body('email').isEmail().withMessage('Email invalide')
  ]),
  authController.forgotPassword.bind(authController)
);

// Reset Password
router.post(
  '/reset-password/:token',
  apiLimiter,
  sensitiveOperationLimiter,
  sensitiveRequestLogger,
  validate([
    param('token').notEmpty().withMessage('Jeton manquant'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe trop court')
  ]),
  authController.resetPassword.bind(authController)
);

// Verify Email
router.get(
  '/verify-email/:token',
  apiLimiter,
  validate([
    param('token').notEmpty().withMessage('Jeton invalide')
  ]),
  authController.verifyEmail.bind(authController)
);

// ─────────── Routes authentifiées ───────────

// Logout (authentifié uniquement)
router.post(
  '/logout',
  authenticate,
  authController.logout.bind(authController)
);

// 2FA Setup (auth + sensible)
router.post(
  '/2fa/setup',
  authenticate,
  sensitiveOperationLimiter,
  sensitiveRequestLogger,
  authController.setupTwoFactor.bind(authController)
);

// 2FA Verify (auth + sensible)
router.post(
  '/2fa/verify',
  authenticate,
  sensitiveRequestLogger,
  validate([
    body('code').isNumeric().withMessage('Code invalide')
  ]),
  authController.verifyTwoFactorCode.bind(authController)
);

export default router;
