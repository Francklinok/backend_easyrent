import { Schema, model } from 'mongoose';
import validator from 'validator';
import { hashPasswordMiddleware } from '../middleware/hashPasswordMiddleware';
import { IUser } from '../types/userTypes';
import { UserRole } from '../types/userTypes';
import AddressSchema from './addressSchema';
import AgentDetailsSchema from './agentDetailsSchema';
import UserPreferencesSchema from './userPreferenceSchema';
import LoginHistorySchema from './loginHistorySchema';
import { PasswordUtils } from '../utils/comparePassword';
import { generatePasswordResetToken } from '../utils/generatePasswordResetToken';
import { generateVerificationToken } from '../utils/generateVerificationToken';
import { isPasswordResetTokenValid } from '../utils/isPasswordResetTokenValid';
import { recordLoginAttempt } from '../utils/recordLoginAttempt';
import { updateLastLogin } from '../utils/updateLastLogin';
// import bcrypt from  "bcrypt"
import { createLogger } from '../../utils/logger/logger';
import RefreshTokenSchema from './RefreshTokenSchema ';
import SecurityDetailsSchema from './securitydetailsSchema';
import UserNotificationSchema from './notificationSchema';
import { UserNotification } from '../types/userTypes';
const   logger = createLogger('models')

const UserSchema = new Schema<IUser>(
  {
    // Informations de base
    firstName: {
      type: String,
      required: [true, 'Le prénom est obligatoire'],
      trim: true,
      minlength: [2, 'Le prénom doit contenir au moins 2 caractères'],
      maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
    },
    lastName: {
      type: String,
      required: [true, 'Le nom est obligatoire'],
      trim: true,
      minlength: [2, 'Le nom doit contenir au moins 2 caractères'],
      maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    username: {
      type: String,
      required: [true, 'Le nom d\'utilisateur est obligatoire'],
      trim: true,
      unique: true,
      lowercase: true,
      minlength: [3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères'],
      maxlength: [30, 'Le nom d\'utilisateur ne peut pas dépasser 30 caractères'],
      validate: {
        validator: (val: string) => /^[a-z0-9_.-]+$/.test(val),
        message: 'Le nom d\'utilisateur ne peut contenir que des lettres minuscules, chiffres, tirets et points'
      }
    },
    email: {
      type: String,
      required: [true, 'L\'email est obligatoire'],
      trim: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: (email: string) => validator.isEmail(email),
        message: 'Veuillez fournir un email valide'
      }
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est obligatoire'],
      minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
      select: false,
      validate: {
        validator: function(password: string) {
          // Validation du mot de passe : au moins une lettre majuscule, une minuscule, un chiffre
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
        },
        message: 'Le mot de passe doit contenir au moins une lettre majuscule, une minuscule et un chiffre'
      }
    },
    
    // Rôle et statuts
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CLIENT,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: Date,
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Vérification email
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true
    },
    // emailVerified: {
    //   type: Boolean,
    //   default: false
    // },
    verificationToken: String,
    emailVerificationToken: String,
    emailVerificationTokenExpires: Date,
    
    // Réinitialisation du mot de passe
    passwordResetToken: String,
    resetPasswordToken: String,
    passwordResetExpires: Date,
    resetPasswordExpires: Date,
    passwordChangedAt: Date,
    
    // Informations de contact
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
      validate: {
        validator: function(phone: string) {
          return !phone || validator.isMobilePhone(phone, 'any');
        },
        message: 'Numéro de téléphone invalide'
      }
    },
    // phone: String, // Alias pour phoneNumber
    // address: AddressSchema,
    // dateOfBirth: {
    //   type: Date,
    //   validate: {
    //     validator: function(date: Date) {
    //       return !date || date < new Date();
    //     },
    //     message: 'La date de naissance ne peut pas être dans le futur'
    //   }
    // },
    
    // Profil
    profilePicture: {
      type: String,
      default: 'https://cdn.monsite.com/images/avatar-blanc.png',
      validate: {
        validator: function(url: string) {
          return !url || validator.isURL(url);
        },
        message: 'URL de photo de profil invalide'
      }
    },
    // avatarUrl: String, // Alias pour profilePicture
    
    // Activité et présence
    lastLogin: Date,
    // lastLoginAt: Date, // Alias pour lastLogin
    lastActive: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastIp: String,
    lastUserAgent: String,
    presenceStatus: {
      type: String,
      enum: ['online', 'away', 'offline'],
      default: 'offline',
      index: true
    },
    
    // Sécurité et authentification
    refreshTokens: [RefreshTokenSchema],
    loginHistory: [LoginHistorySchema],
    loginAttempts: [LoginHistorySchema],
    security: SecurityDetailsSchema,
    
    // Préférences et données utilisateur
    preferences: {
      type: UserPreferencesSchema,
      default: () => ({
        theme: 'system',
        language: 'fr',
        twoFactorEnabled: false,
        marketingCommunications: false,
        notifications: {
          email: true,
          push: true,
          sms: false
        }
      })
    },
    preferencesHistory: [{
      preferences: UserPreferencesSchema,
      timestamp: { type: Date, default: Date.now }
    }],
    
    // Détails d'agent (pour les utilisateurs avec rôle AGENT)
    agentDetails: {
      type: AgentDetailsSchema,
      validate: {
        validator: function(this: IUser) {
          // Obligatoire seulement pour les agents
          return this.role !== UserRole.AGENT || !!this.agentDetails;
        },
        message: 'Les détails d\'agent sont obligatoires pour le rôle AGENT'
      }
    },
    
    // Notifications
    notifications: [UserNotificationSchema]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        // Nettoyage des données sensibles
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.resetPasswordToken;
        delete ret.emailVerificationToken;
        delete ret.verificationToken;
        delete ret.refreshTokens;
        delete ret.__v;
        delete ret.security?.twoFactorSecret;
        delete ret.security?.tempTwoFactorSecret;
        return ret;
      }
    },
    toObject: {
      virtuals: true
    }
  }
);
 
// Index pour améliorer les performances des requêtes
// UserSchema.index({ email: 1 });
// UserSchema.index({ username: 1 });

// UserSchema.index({ email: 1, isActive: 1 });
// UserSchema.index({ username: 1, isActive: 1 });
// UserSchema.index({ role: 1, isActive: 1 });
// UserSchema.index({ isEmailVerified: 1, isActive: 1 });
// UserSchema.index({ createdAt: -1 });
// UserSchema.index({ lastActive: -1 });

// Index de recherche textuelle
UserSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  username: 'text',
  phoneNumber: 'text',
  'address.city': 'text',
  'address.country': 'text'
}, {
  weights: {
    firstName: 10,
    lastName: 10,
    email: 8,
    username: 8,
    phoneNumber: 5,
    'address.city': 3,
    'address.country': 3
  }
});

// Index géospatial pour l'adresse
UserSchema.index({ 'address.coordinates': '2dsphere' });

// ================================
// CHAMPS VIRTUELS
// ================================

UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// UserSchema.virtual('id').get(function() {
//   return this.id.toHexString();
// });

// // Méthode pour obtenir le nom complet
// UserSchema.methods.getFullName = function(): string {
//   return `${this.firstName} ${this.lastName}`;
// };


// Alias virtuels pour la compatibilité
// UserSchema.virtual('phone').get(function() {
//   return this.phoneNumber;
// });

// UserSchema.virtual('avatarUrl').get(function() {
//   return this.profilePicture;
// });

// UserSchema.virtual('lastLoginAt').get(function() {
//   return this.lastLogin;
// });

// UserSchema.virtual('emailVerified').get(function() {
//   return this.isEmailVerified;
// });


UserSchema.index({firstName:1})

// UserSchema.index({
//   firstName: 'text',
//   lastName: 'text',
//   email: 'text',
//   phoneNumber: 'text',
//   'address.city': 'text',
//   'address.country': 'text'
// });


// Ajouter les middlewares
// UserSchema.pre('save', hashPasswordMiddleware);

// Dans votre model, modifiez le pre middleware :
UserSchema.pre('save', async function (next) {
  try {
    // Vérifier si le password doit être hashé
    if (this.isModified('password')) {
      if (typeof this.password !== 'string') {
        throw new Error("Le mot de passe n'est pas une chaîne valide.");
      }

      // ✅ AJOUT: Vérifier si le password est déjà hashé
      const isAlreadyHashed = this.password.startsWith('$2b$') || this.password.startsWith('$2a$');
      
      if (!isAlreadyHashed) {
        logger.info('Hashage du mot de passe pour l\'utilisateur', {
          userId: this._id?.toString(),
          email: this.email
        });

        this.password = await PasswordUtils.hashPassword(this.password);
        this.passwordChangedAt = new Date();
      } else {
        logger.info('Mot de passe déjà hashé, pas de re-hashage', {
          userId: this._id?.toString(),
          email: this.email
        });
        // Juste mettre à jour la date de changement si nécessaire
        if (this.isNew) {
          this.passwordChangedAt = new Date();
        }
      }
    }

    if (this.isModified('presenceStatus') && this.presenceStatus === 'online') {
      this.lastActive = new Date();
    }

    if (this.role === UserRole.AGENT && !this.agentDetails) {
      throw new Error('Les détails d\'agent sont obligatoires pour le rôle AGENT');
    }

    if (this.role !== UserRole.AGENT && this.agentDetails) {
      this.agentDetails = undefined;
    }

    next();
  } catch (error) {
    logger.error('Erreur dans le pre-save du modèle utilisateur', { error });
    next(error instanceof Error ? error : new Error('Erreur lors de la sauvegarde de l\'utilisateur.'));
  }
});
// UserSchema.pre('save', async function (next) {
//   try {
//     if (this.isModified('password')) {
//       if (typeof this.password !== 'string') {
//         throw new Error("Le mot de passe n'est pas une chaîne valide.");
//       }

//       logger.info('Hashage du mot de passe pour l\'utilisateur', {
//         userId: this._id?.toString(),
//         email: this.email
//       });

//       this.password = await PasswordUtils.hashPassword(this.password);
//       this.passwordChangedAt = new Date();
//     }

//     if (this.isModified('presenceStatus') && this.presenceStatus === 'online') {
//       this.lastActive = new Date();
//     }

//     if (this.role === UserRole.AGENT && !this.agentDetails) {
//       throw new Error('Les détails d\'agent sont obligatoires pour le rôle AGENT');
//     }

//     if (this.role !== UserRole.AGENT && this.agentDetails) {
//       this.agentDetails = undefined;
//     }

//     next();
//   } catch (error) {
//     logger.error('Erreur dans le pre-save du modèle utilisateur', { error });
//     next(error instanceof Error ? error : new Error('Erreur lors de la sauvegarde de l\'utilisateur.'));
//   }
// });



// Middleware pour la suppression logique
UserSchema.pre('save', function(next) {
  if (this.isModified('isDeleted') && this.isDeleted) {
    this.deletedAt = new Date();
    this.isActive = false;
  }
  next();
});


UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    if (!this.password) {
      logger.error('Aucun mot de passe trouvé pour l\'utilisateur', { 
        userId: this._id?.toString() 
      });
      return false;
    }

    logger.debug('Comparaison mot de passe', {
      userId: this._id?.toString(),
      email: this.email,
      hasPassword: !!this.password
    });

    return await PasswordUtils.comparePassword(candidatePassword, this.password);
  } catch (error) {
    logger.error('Erreur dans comparePassword', {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      userId: this._id?.toString()
    });
    return false;
  }
};

UserSchema.methods.updatePresenceStatus = function(status: 'online' | 'away' | 'offline'): void {
  if (['online', 'away', 'offline'].includes(status)) {
    this.presenceStatus = status;
    
    if (status === 'online') {
      this.lastActive = new Date();
    }
  }
};


UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    if (!this.password) {
      logger.error('[model] Aucun mot de passe trouvé pour l\'utilisateur', { 
        userId: this._id?.toString() 
      });
      return false;
    }

    logger.debug('Comparaison mot de passe pour utilisateur', {
      userId: this._id?.toString(),
      email: this.email,
      hasPassword: !!this.password,
      passwordHashLength: this.password?.length || 0
    });
    console.log('voicie  les mots  de  passe  necessaire  ')
    console.log(candidatePassword)
    console.log(this.password)

    return await PasswordUtils.comparePassword(candidatePassword, this.password);
  } catch (error) {
    logger.error('Erreur dans comparePassword', {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      userId: this._id?.toString()
    });
    return false;
  }
};


//   return comparePasswordHelper(candidatePassword, this.password);
// };

// UserSchema.methods.comparePassword = comparePassword;
UserSchema.methods.generateVerificationToken = generateVerificationToken;
UserSchema.methods.generatePasswordResetToken = generatePasswordResetToken;
UserSchema.methods.isPasswordResetTokenValid = isPasswordResetTokenValid;
UserSchema.methods.recordLoginAttempt = recordLoginAttempt;
UserSchema.methods.updateLastLogin = updateLastLogin;


// Méthode pour mettre à jour le statut de présence
UserSchema.methods.updatePresenceStatus = function(status: string): void {
  if (['online', 'away', 'offline'].includes(status)) {
    this.presenceStatus = status;
    
    // Si l'utilisateur devient "online", mettre à jour lastActive
    if (status === 'online') {
      this.lastActive = new Date();
    }
  }
};

const User = model<IUser>('User', UserSchema);


export default User;