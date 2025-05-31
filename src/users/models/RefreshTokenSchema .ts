import { Schema, model, CallbackError } from "mongoose";
import { IRefreshTokenDocument } from '../types/userTypes';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('RefreshTokenModel');

const RefreshTokenSchema = new Schema<IRefreshTokenDocument>({
  token: { 
    type: String, 
    required: true, 
    unique: true,
    index: true // Index pour les recherches rapides
  },
  hashedToken: {
    type: String,
    required: true,
    unique: true // Stocker le hash du token pour plus de sécurité
  },
  device: { 
    type: String,
    maxlength: 200,
    trim: true
  },
  userAgent: {
    type: String,
    maxlength: 500 // Info complète du navigateur/app
  },
  ip: { 
    type: String,
    validate: {
      validator: function(v: any) {
        // Validation basique IPv4/IPv6
        return !v || /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v);
      },
      message: 'Format IP invalide'
    }
  },
  location: {
    country: String,
    city: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true // Index pour les requêtes par utilisateur
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    immutable: true // Empêche la modification
  },
  expiresAt: { 
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL index correct
  },
  revokedAt: {
    type: Date,
    default: null
  },
  sessionId: {
    type: String,
    index: true // Pour lier plusieurs tokens à une même session
  }
}, {
  timestamps: false, // On gère manuellement createdAt/updatedAt
  collection: 'refreshTokens',
  toJSON: {
    transform: (_, ret) => {
      // Ne jamais exposer le token original dans les réponses JSON
      delete ret.token;
      delete ret.__v;
      return ret;
    }
  }
});

// Index composés pour optimiser les requêtes fréquentes
RefreshTokenSchema.index({ user: 1, isActive: 1 });
RefreshTokenSchema.index({ user: 1, createdAt: -1 });
RefreshTokenSchema.index({ sessionId: 1, isActive: 1 });
RefreshTokenSchema.index({ expiresAt: 1, isActive: 1 });

// ================================
// MIDDLEWARE
// ================================

// Middleware pour hasher le token avant sauvegarde
RefreshTokenSchema.pre('save', async function(next: (err?: CallbackError) => void) {
  try {
    if (this.isModified('token')) {
      const crypto = require('crypto');
      this.hashedToken = crypto.createHash('sha256').update(this.token).digest('hex');
      
      logger.debug('Token hashé pour l\'utilisateur', {
        userId: this.user?.toString(),
        sessionId: this.sessionId
      });
    }
    next();
  } catch (error) {
    logger.error('Erreur lors du hashage du token de rafraîchissement', {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      userId: this.user?.toString()
    });
    next(error instanceof Error ? error : new Error('Erreur de hashage du token'));
  }
});

// Middleware pour nettoyer les références dans le modèle User lors de la suppression
RefreshTokenSchema.pre('deleteOne', async function(next: (err?: CallbackError) => void) {
  try {
    const docToDelete = await this.model.findOne(this.getFilter());
    if (docToDelete) {
      const User = require('./userModel').default;
      await User.updateOne(
        { _id: docToDelete.user },
        { $pull: { refreshTokens: docToDelete._id } }
      );
    }
    next();
  } catch (error) {
    logger.error('Erreur lors du nettoyage des références utilisateur', {
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
    next();
  }
});

RefreshTokenSchema.pre('findOneAndDelete', async function(next: (err?: CallbackError) => void) {
  try {
    const docToDelete = await this.model.findOne(this.getFilter());
    if (docToDelete) {
      const User = require('./userModel').default;
      await User.updateOne(
        { _id: docToDelete.user },
        { $pull: { refreshTokens: docToDelete._id } }
      );
    }
    next();
  } catch (error) {
    logger.error('Erreur lors du nettoyage des références utilisateur (findOneAndDelete)', {
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
    next();
  }
});

// ================================
// MÉTHODES D'INSTANCE
// ================================

RefreshTokenSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

RefreshTokenSchema.methods.revoke = async function(): Promise<IRefreshTokenDocument> {
  try {
    this.isActive = false;
    this.revokedAt = new Date();
    
    logger.info('Token de rafraîchissement révoqué', {
      tokenId: this._id?.toString(),
      userId: this.user?.toString(),
      sessionId: this.sessionId
    });
    
    return await this.save();
  } catch (error) {
    logger.error('Erreur lors de la révocation du token', {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      tokenId: this._id?.toString()
    });
    throw error;
  }
};

RefreshTokenSchema.methods.updateLastUsed = async function(): Promise<IRefreshTokenDocument> {
  try {
    this.lastUsedAt = new Date();
    
    logger.debug('Dernière utilisation du token mise à jour', {
      tokenId: this._id?.toString(),
      userId: this.user?.toString()
    });
    
    return await this.save();
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du token', {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      tokenId: this._id?.toString()
    });
    throw error;
  }
};

// ================================
// MÉTHODES STATIQUES
// ================================

RefreshTokenSchema.statics.revokeAllForUser = function(userId: string) {
  logger.info('Révocation de tous les tokens pour l\'utilisateur', { userId });
  
  return this.updateMany(
    { user: userId, isActive: true },
    { isActive: false, revokedAt: new Date() }
  );
};

RefreshTokenSchema.statics.findActiveByUser = function(userId: string) {
  return this.find({ 
    user: userId, 
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

RefreshTokenSchema.statics.cleanupExpired = function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  logger.info('Nettoyage des tokens expirés');
  
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isActive: false, revokedAt: { $lt: thirtyDaysAgo } }
    ]
  });
};

RefreshTokenSchema.statics.findByHashedToken = function(hashedToken: string) {
  return this.findOne({
    hashedToken,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).populate('user', 'email firstName lastName role isActive');
};

RefreshTokenSchema.statics.countActiveByUser = function(userId: string) {
  return this.countDocuments({
    user: userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

RefreshTokenSchema.statics.revokeBySessionId = function(sessionId: string) {
  logger.info('Révocation des tokens par session', { sessionId });
  
  return this.updateMany(
    { sessionId, isActive: true },
    { isActive: false, revokedAt: new Date() }
  );
};

RefreshTokenSchema.statics.getTokenStats = async function(userId?: string) {
  const matchStage = userId ? { user: require('mongoose').Types.ObjectId(userId) } : {};
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: 1 },
        activeTokens: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$isActive', true] },
                  { $gt: ['$expiresAt', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        },
        expiredTokens: {
          $sum: {
            $cond: [{ $lt: ['$expiresAt', new Date()] }, 1, 0]
          }
        },
        revokedTokens: {
          $sum: {
            $cond: [{ $eq: ['$isActive', false] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalTokens: 0,
    activeTokens: 0,
    expiredTokens: 0,
    revokedTokens: 0
  };
};

// Création du modèle

export default RefreshTokenSchema;