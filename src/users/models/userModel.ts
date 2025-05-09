import mongoose, { Schema, Document, model } from 'mongoose';

import validator from 'validator';
import { hashPasswordMiddleware } from '../userMiddleware/hashPasswordMiddleware';
import { IUser } from '../userTypes/userTypes';
import { UserRole } from '../userTypes/userTypes';
import addressSchema from './addressSchema';
import agentDetailsSchema from './agentDetailsSchema';
import userPreferencesSchema from './userPreferenceSchema';
import loginHistorySchema from './loginHistorySchema';
import { comparePassword } from '../utils/comparePassword';
import { generatePasswordResetToken } from '../utils/generatePasswordResetToken';
import { generateVerificationToken } from '../utils/generateVerificationToken';
import { isPasswordResetTokenValid } from '../utils/isPasswordResetTokenValid';
import { recordLoginAttempt } from '../utils/recordLoginAttempt';
import { updateLastLogin } from '../utils/updateLastLogin';


const userSchema = new Schema<IUser>(
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
    lastLogin: Date,
    profilePicture: String,
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    address: addressSchema,
    dateOfBirth: Date,
    verificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    refreshTokens: [String],
    loginHistory: [loginHistorySchema],
    preferences: {
      type: userPreferencesSchema,
      default: () => ({})
    },
    agentDetails: agentDetailsSchema
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

export const UserModel = mongoose.model<IUser>('User', userSchema);


// Index pour améliorer les performances des requêtes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({firstname:1})

userSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  phoneNumber: 'text',
  'address.city': 'text',
  'address.country': 'text'
});

// Création d'un champ virtuel pour le nom complet
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Méthode pour obtenir le nom complet
userSchema.methods.getFullName = function(): string {
  return `${this.firstName} ${this.lastName}`;
};


// Ajouter les middlewares
userSchema.pre('save', hashPasswordMiddleware);
//creation du model user
userSchema.methods.comparePassword = comparePassword;
userSchema.methods.generateVerificationToken = generateVerificationToken;
userSchema.methods.generatePasswordResetToken = generatePasswordResetToken;
userSchema.methods.isPasswordResetTokenValid = isPasswordResetTokenValid;
userSchema.methods.recordLoginAttempt = recordLoginAttempt;
userSchema.methods.updateLastLogin = updateLastLogin;


const User = model<IUser>('User', userSchema);


export default User;