import { body, param, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { query } from 'express-validator';

// ============ CONSTANTES DE VALIDATION ============
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const TOKEN_REGEX = /^[a-zA-Z0-9_-]+$/;
const TWO_FA_CODE_REGEX = /^\d{6}$/;

// ============ MIDDLEWARE DE GESTION DES ERREURS ============
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : undefined,
        message: error.msg
      }))
    });
    return;
  }
  
  next();
};

// ============ VALIDATEURS RÉUTILISABLES ============
export const validate = {
  email: (): ValidationChain =>
    body('email')
      .trim()
      .toLowerCase()
      .isEmail().withMessage('Format d\'email invalide')
      .isLength({ max: 320 }).withMessage('Email trop long'),

  password: (isRequired = true): ValidationChain => {
    let validator = body('password');

    if (isRequired) {
      validator = validator.notEmpty().withMessage('Le mot de passe est requis');
    }

    return validator
      .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
      .withMessage(`Le mot de passe doit contenir entre ${PASSWORD_MIN_LENGTH} et ${PASSWORD_MAX_LENGTH} caractères`)
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial');
  },

  username: (): ValidationChain =>
    body('username')
      .trim()
      .toLowerCase()
      .isLength({ min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH })
      .withMessage(`Le nom d'utilisateur doit contenir entre ${USERNAME_MIN_LENGTH} et ${USERNAME_MAX_LENGTH} caractères`)
      .matches(/^[a-zA-Z0-9_.-]+$/)
      .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et points'),

  firstName: (): ValidationChain =>
    body('firstName')
      .trim()
      .notEmpty().withMessage('Le prénom est requis')
      .isLength({ min: 2, max: 50 }).withMessage('Le prénom doit contenir entre 2 et 50 caractères')
      .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/)
      .withMessage('Le prénom contient des caractères invalides'),

  lastName: (): ValidationChain =>
    body('lastName')
      .trim()
      .notEmpty().withMessage('Le nom est requis')
      .isLength({ min: 2, max: 50 }).withMessage('Le nom doit contenir entre 2 et 50 caractères')
      .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/)
      .withMessage('Le nom contient des caractères invalides'),

  phoneNumber: (): ValidationChain =>
    body('phoneNumber')
      .optional()
      .trim()
      .isMobilePhone('any')
      .withMessage('Numéro de téléphone invalide'),

  token: (paramName = 'token'): ValidationChain =>
    param(paramName)
      .notEmpty().withMessage('Token manquant')
      .matches(TOKEN_REGEX).withMessage('Format de token invalide')
      .isLength({ min: 16, max: 256 }).withMessage('Token invalide'),

  twoFactorCode: (): ValidationChain =>
    body('code')
      .trim()
      .matches(TWO_FA_CODE_REGEX)
      .withMessage('Le code 2FA doit contenir exactement 6 chiffres'),

  refreshToken: (): ValidationChain =>
    body('refreshToken')
      .notEmpty().withMessage('Token de rafraîchissement requis')
      .isJWT().withMessage('Format de token invalide'),

  sessionId: (): ValidationChain =>
    param('id')
      .isMongoId()
      .withMessage('ID de session invalide'),

  // Ajout d'un validateur pour la photo de profil
  profilePicture: (): ValidationChain =>
    body('profilePicture')
      .notEmpty().withMessage('Photo de profil requise')
      .isString().withMessage('La photo doit être une chaîne de caractères')
      .custom((value) => {
        // Validation URL ou base64
        const urlRegex = /^https?:\/\/.+/;
        const base64Regex = /^data:image\/(jpeg|jpg|png|gif);base64,/;
        
        if (!urlRegex.test(value) && !base64Regex.test(value)) {
          throw new Error('La photo doit être une URL valide ou une image en base64');
        }
        return true;
      }),

  tokenFromQuery: (): ValidationChain =>
    query('token')
      .notEmpty().withMessage('Token manquant')
      .matches(TOKEN_REGEX).withMessage('Format de token invalide')
      .isLength({ min: 16, max: 256 }).withMessage('Token invalide'),

  forgotPasswordValidation: (): ValidationChain =>
    body('email')
      .trim()
      .toLowerCase()
      .isEmail().withMessage('Format d\'email invalide')
      .isLength({ max: 320 }).withMessage('Email trop long')
};
      


// ============ VALIDATIONS COMPOSÉES ============
 const validationRules = {
  // Inscription
  register: [
    validate.username(),
    validate.email(),
    validate.password(),
    validate.firstName(),
    validate.lastName(),
    validate.phoneNumber(),
    handleValidationErrors
  ],

  // Connexion
  login: [
    validate.email(),
    validate.password(),
    handleValidationErrors
  ],

  // Mise à jour de photo de profil
  updateProfilePicture: [
    validate.profilePicture(),
    handleValidationErrors
  ],

  // Vérification email
  verifyEmail: [
    validate.tokenFromQuery(),
    handleValidationErrors
  ],

  // Code 2FA
  twoFactor: [
    validate.twoFactorCode(),
    handleValidationErrors
  ],

  // Refresh token
  refreshToken: [
    validate.refreshToken(),
    handleValidationErrors
  ],

  password:[
    validate.password(),
    handleValidationErrors
  ],
  resetPassword:[
    validate.token(),
    validate.password(),
    handleValidationErrors
  ],
  verifyTwoFactor:[
    validate.twoFactorCode(),
    validate.token()
  ],
  forgotpassword:[
    validate.forgotPasswordValidation(),
    handleValidationErrors
  ]
};

export default validationRules