import express from 'express';
import {
  // validate,
  authenticate,
  validationRules,
  // requireTwoFactor,
  // apiLimiter,
  // authLimiter,
  // sensitiveOperationLimiter,
  sensitiveRequestLogger
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
  sensitiveRequestLogger,
  validationRules.register,
  authController.register.bind(authController)
  // register
  
);

authRouter.post('/verify-email',
    validationRules.twoFactor,

  authController.verifyEmailCode.bind(authController)
)

authRouter.post('/verifyAccount',  
  authController.verifyAccount.bind(authController)
)

// authRouter.post('/verify-email', 
//   validationRules.twoFactor,
//   authController.verifyEmail.bind(authController)
// );

authRouter.post('/resend-verification', 
  authController.resendVerificationEmail.bind(authController));
  
// Login
authRouter.post(
  '/login',
  // apiLimiter,
  // authLimiter,
  sensitiveRequestLogger,
  validationRules.login,
  authController.login.bind(authController)
);

// Refresh Token
authRouter.post(
  '/refresh-token',
  validationRules.refreshToken,
  // apiLimiter,
  authController.refreshToken.bind(authController)
);

// Forgot Password
authRouter.post(
  '/forgot-password',
  // apiLimiter,
  // authLimiter,
  sensitiveRequestLogger,
  validationRules.forgotpassword,
  authController.forgotPassword.bind(authController)
);

// Reset Password
authRouter.post(
  '/reset-password',
  // apiLimiter,
  // sensitiveOperationLimiter,
  sensitiveRequestLogger,
  validationRules.resetPassword,
  authController.resetPassword.bind(authController)
);

authRouter.post('/change-Password',  authenticate, authController.changePassword.bind(authController))


// Verify Email
authRouter.get(
  '/verify-email/:token',
  // // apiLimiter,
  validationRules.verifyEmail,
  authController.verifyEmail.bind(authController)
);

authRouter.post('/resend-verification-email', authController.resendVerificationEmail.bind(authController));

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
  authenticate,
//   // sensitiveOperationLimiter,
  sensitiveRequestLogger,
  authController.setupTwoFactor.bind(authController)
);

// 2FA Verify (auth + sensible)
authRouter.post(
  '/2fa/verify',
    authenticate,
  sensitiveRequestLogger,
  validationRules.verifyTwoFactor,
  authController.verifyTwoFactor.bind(authController)
);

// Disable 2FA (auth + sensible)
authRouter.post(
  '/2fa/disable',
  authenticate,
  // requireTwoFactor,
  // sensitiveOperationLimiter,
  sensitiveRequestLogger,
   validationRules.password,
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
authRouter.get('/validateTwoFactorLogin',  authController.validateTwoFactorLogin.bind(authController))
//profile
authRouter.get('/get-profile', 
  authenticate, 
   authController.getProfile.bind(authController))

authRouter.put('/update-profile',
  authenticate, 
  validationRules.updateProfilePicture,
  authController.updateProfilePicture.bind(authController))

authRouter.patch('/updateProfile',  authController.updateProfile.bind(authController))
//account deletion
authRouter.delete('/deleteAccount',  authController.deleteAccount.bind(authController))




export default authRouter;


