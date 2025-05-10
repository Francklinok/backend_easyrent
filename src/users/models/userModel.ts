import { Schema, model } from 'mongoose';
import validator from 'validator';
import { hashPasswordMiddleware } from '../middleware/hashPasswordMiddleware';
import { IUser, LoginHistory } from '../types/userTypes';
import { UserRole } from '../types/userTypes';
import AddressSchema from './addressSchema';
import AgentDetailsSchema from './agentDetailsSchema';
import UserPreferencesSchema from './userPreferenceSchema';
import LoginHistorySchema from './loginHistorySchema';
import { comparePassword } from '../utils/comparePassword';
import { generatePasswordResetToken } from '../utils/generatePasswordResetToken';
import { generateVerificationToken } from '../utils/generateVerificationToken';
import { isPasswordResetTokenValid } from '../utils/isPasswordResetTokenValid';
import { recordLoginAttempt } from '../utils/recordLoginAttempt';
import { updateLastLogin } from '../utils/updateLastLogin';


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
    lastLogin: {
      type:Date,
    },
    lastIp: { 
      type: String 
    },  presenceStatus: { 
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
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    address: AddressSchema,
    dateOfBirth: Date,
    verificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    refreshTokens: [String],
    loginHistory: [LoginHistorySchema],
    preferences: {
      type: UserPreferencesSchema,
      default: () => ({})
    },
    agentDetails: AgentDetailsSchema
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
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
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
UserSchema.pre('save', hashPasswordMiddleware);

//methodes
UserSchema.methods.comparePassword = comparePassword;
UserSchema.methods.generateVerificationToken = generateVerificationToken;
UserSchema.methods.generatePasswordResetToken = generatePasswordResetToken;
UserSchema.methods.isPasswordResetTokenValid = isPasswordResetTokenValid;
UserSchema.methods.recordLoginAttempt = recordLoginAttempt;
UserSchema.methods.updateLastLogin = updateLastLogin;


// Méthode pour mettre à jour les informations de dernière connexion
UserSchema.methods.updateLastLogin = function(ip: string, userAgent: string): void {
  this.lastLogin = new Date();
  this.lastIp = ip;
  this.lastUserAgent = userAgent;
  this.lastActive = new Date();
  this.presenceStatus = 'online';
};

// Méthode pour enregistrer une tentative de connexion
UserSchema.methods.recordLoginAttempt = function(attempt: Omit<LoginHistory, 'timestamp'>): void {
  const { ipAddress, userAgent, successful } = attempt;
  
  this.loginAttempts.push({
    timestamp: new Date(),
    ipAddress,
    userAgent,
    successful
  });
  
  // Limiter le nombre d'entrées d'historique (garder les 10 dernières tentatives)
  if (this.loginAttempts.length > 10) {
    this.loginAttempts = this.loginAttempts.slice(-10);
  }
};

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