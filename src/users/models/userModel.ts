import { Schema, model } from 'mongoose';
import validator from 'validator';
import { hashPasswordMiddleware } from '../middleware/hashPasswordMiddleware';
import { IUser, LoginHistory } from '../types/userTypes';
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
import bcrypt from  "bcrypt"
import { createLogger } from '../../utils/logger/logger';

const   logger = createLogger('models')

const UserSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, 'Le prénom est obligatoire'],
      trim: true,
      minlength: [2, 'Le prénom doit contenir au moins 2 caractères']
    },
    lastName: {
      type: String,
      required: [true, 'Le nom est obligatoire'],
      trim: true,
      minlength: [2, 'Le nom doit contenir au moins 2 caractères']
    },
    username: {
      type: String,
      required: [true, 'Le nom d\'utilisateur est obligatoire'],
      trim: true,
      unique: true,
      lowercase: true,
      minlength: [3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères'],
      validate: {
        validator: (val: string) => /^[a-z0-9_.-]+$/.test(val),
        message: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et points'
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
      select: false
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CLIENT
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    lastLogin: {
      type:Date,
    },
    lastIp: { 
      type: String 
    }, 
    presenceStatus: { 
        type: String, 
        enum: ['online', 'away', 'offline'], 
        default: 'offline' 
        },
    lastActive: { 
      type: Date, 
      default: Date.now 
    },
    profilePicture: {
      type:String,
      default: 'https://cdn.monsite.com/images/avatar-blanc.png',
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true
    },

    address: AddressSchema,
    dateOfBirth: Date,
    verificationToken: String,
    emailVerificationToken: String,
    emailVerificationTokenExpires: Date,
    passwordResetToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    passwordResetExpires: Date,
    passwordChangedAt: Date,
    refreshTokens: [String],
    loginHistory: [LoginHistorySchema],
    loginAttempts: [LoginHistorySchema],
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: Date,
    deletedBy: String,
    preferences: {
      type: UserPreferencesSchema,
      default: () => ({})
    },
    agentDetails: AgentDetailsSchema,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        delete ret.password;
        delete ret.__v;
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

UserSchema.index({firstname:1})

UserSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  phoneNumber: 'text',
  'address.city': 'text',
  'address.country': 'text'
});

// Création d'un champ virtuel pour le nom complet
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Méthode pour obtenir le nom complet
UserSchema.methods.getFullName = function(): string {
  return `${this.firstName} ${this.lastName}`;
};


// Ajouter les middlewares
// UserSchema.pre('save', hashPasswordMiddleware);

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
   logger.info("voicie  le password  a  l  entrer", this.password)
  try {
    this.password = await PasswordUtils.hashPassword(this.password);
    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error('Erreur de hashage'));
  }
});

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

//methodes
// UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
//   // 'this' refers to the Mongoose document
//   // this.password will be accessible here because .select('+password') was used in the query
//   // and Mongoose *does* provide it to schema methods when explicitly selected.

//   // Log to confirm if this.password is present here
//   logger.info('[UserSchema.methods.comparePassword] this.password directly:', this.password ? 'present' : 'not present');
//   logger.info('[UserSchema.methods.comparePassword] this.password length directly:', this.password ? this.password.length : 'N/A');


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