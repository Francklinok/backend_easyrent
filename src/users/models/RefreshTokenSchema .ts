import { Schema } from "mongoose";

const RefreshTokenSchema = new Schema({
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
      validator: function(v:any) {
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
  collection: 'refreshTokens'
});

// Index composé pour optimiser les requêtes fréquentes
RefreshTokenSchema.index({ user: 1, isActive: 1 });
RefreshTokenSchema.index({ user: 1, createdAt: -1 });

// Middleware pour hasher le token avant sauvegarde
RefreshTokenSchema.pre('save', async function(next) {
  if (this.isModified('token')) {
    const crypto = require('crypto');
    this.hashedToken = crypto.createHash('sha256').update(this.token).digest('hex');
  }
  next();
});

// Méthodes d'instance
RefreshTokenSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

RefreshTokenSchema.methods.revoke = function() {
  this.isActive = false;
  this.revokedAt = new Date();
  return this.save();
};

RefreshTokenSchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

// Méthodes statiques
RefreshTokenSchema.statics.revokeAllForUser = function(userId) {
  return this.updateMany(
    { user: userId, isActive: true },
    { isActive: false, revokedAt: new Date() }
  );
};

RefreshTokenSchema.statics.findActiveByUser = function(userId) {
  return this.find({ 
    user: userId, 
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

RefreshTokenSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isActive: false, revokedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    ]
  });
};

export default RefreshTokenSchema;