import express from 'express';
import { body, param } from 'express-validator';
import {
  // validate,
  authenticate,
  // requireTwoFactor,
  // apiLimiter,
  // authLimiter,
  // sensitiveOperationLimiter,
  // sensitiveRequestLogger
} from '../middlewares';

import AuthControllers from "../controllers/authControllers";
// import { authenticate } from '../../users/middleware/authMiddleware';
const authController = new AuthControllers();
const authRouter = express.Router();

// ─────────── Routes publiques ───────────
// Register
authRouter.post(
  '/register',
  // apiLimiter,
  // authLimiter,
  // sensitiveRequestLogger,
  // validate([
  //   body('email').isEmail().withMessage('Email invalide'),
  //   body('password').isLength({ min: 6 }).withMessage('Mot de passe trop court'),
  //   body('username').notEmpty().withMessage('Le nom d\'utilisateur est requis')
  // ]),
  authController.register.bind(authController)
  // register
  
);


authRouter.post('/verifyAccount',  
  authController.verifyAccount.bind(authController)
)

authRouter.get('/verify-email', 
  authController.verifyEmail.bind(authController)
);

authRouter.post('/resend-verification', 
  authController.resendVerificationEmail.bind(authController));
  
// Login
authRouter.post(
  '/login',
  // apiLimiter,
  // authLimiter,
  // sensitiveRequestLogger,
  // validate([
  //   body('email').isEmail().withMessage('Email invalide'),
  //   body('password').notEmpty().withMessage('Mot de passe requis'),
  // ]),
  authController.login.bind(authController)
);

// Refresh Token
authRouter.post(
  '/refresh-token',
  // apiLimiter,
  authController.refreshToken.bind(authController)
);

// Forgot Password
authRouter.post(
  '/forgot-password',
  // apiLimiter,
  // authLimiter,
  // sensitiveRequestLogger,
  // validate([
  //   body('email').isEmail().withMessage('Email invalide')
  // ]),
  authController.forgotPassword.bind(authController)
);

// Reset Password
authRouter.post(
  '/reset-password/:token',
  // apiLimiter,
  // sensitiveOperationLimiter,
  // sensitiveRequestLogger,
  // validate([
  //   param('token').notEmpty().withMessage('Jeton manquant'),
  //   body('password').isLength({ min: 6 }).withMessage('Mot de passe trop court')
  // ]),
  authController.resetPassword.bind(authController)
);

// Verify Email
authRouter.get(
  '/verify-email/:token',
  // // apiLimiter,
  // validate([
  //   param('token').notEmpty().withMessage('Jeton invalide')
  // ]),
  authController.verifyEmail.bind(authController)
);

// ─────────── Routes authentifiées ───────────
// Logout (authentifié uniquement)
authRouter.post(
  '/logout',
  authenticate,
  authController.logout.bind(authController)
);

// 2FA Setup (auth + sensible)
authRouter.post(
  '/2fa/setup',
//   // authenticate,
//   // sensitiveOperationLimiter,
//   // sensitiveRequestLogger,
  authController.setupTwoFactor.bind(authController)
);

// 2FA Verify (auth + sensible)
authRouter.post(
  '/2fa/verify',
  // // sensitiveRequestLogger,
  // validate([
  //   body('code').isNumeric().withMessage('Code invalide'),
  //   body('token').notEmpty().withMessage('Token requis')
  // ]),
  authController.verifyTwoFactor.bind(authController)
);

// Disable 2FA (auth + sensible)
authRouter.post(
  '/2fa/disable',
  // authenticate,
  // requireTwoFactor,
  // sensitiveOperationLimiter,
  // sensitiveRequestLogger,
  // validate([
  //   body('password').notEmpty().withMessage('Mot de passe requis')
  // ]),
  authController.disableTwoFactor.bind(authController)
);

// Get active sessions (auth)
// authRouter.get(
//   '/sessions',
//   authenticate,
//   authController.getActiveSessions.bind(authController)
// );

// // Revoke session (auth)
// authRouter.delete(
//   '/sessions/:id',
//   authenticate,
//   param('id').notEmpty().withMessage('ID de session requis'),
//   authController.revokeSession.bind(authController)
// );

export default authRouter;


