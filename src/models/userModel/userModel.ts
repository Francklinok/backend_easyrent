import mongoose, { Schema, Document, model } from 'mongoose';
import bcrypt from 'bcrypt';
import validator from 'validator';
import { hashPasswordMiddleware } from '../../middlewares/userMiddlewares/userMiddlewares';
/**
 * Interface pour le modèle utilisateur
 */
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin' | 'moderator';
  isActive: boolean;
  lastLogin?: Date;
  profilePicture?: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getFullName(): string;
}

/**
 * Schéma utilisateur avec validation avancée
 */
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
        validator: (value: string) => /^[a-z0-9_.-]+$/.test(value),
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
        validator: (value: string) => validator.isEmail(value),
        message: 'Veuillez fournir un email valide'
      }
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est obligatoire'],
      minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
      select: false // Ne pas inclure par défaut dans les requêtes
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin', 'moderator'],
        message: '{VALUE} n\'est pas un rôle valide'
      },
      default: 'user'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    },
    profilePicture: {
      type: String
    }
  },
  { 
    timestamps: true,
    toJSON: { 
      transform: (_, ret) => {
        delete ret.password;
        return ret;
      },
      virtuals: true
    },
    toObject: { virtuals: true }
  }
);

// Index pour améliorer les performances des requêtes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

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
const User = model<IUser>('User', userSchema);


export default User;