import { Schema, model } from 'mongoose';
import { createLogger } from '../../utils/logger/logger';

// const logger = createLogger('UserModel');

// Schéma pour les détails de sécurité
const SecurityDetailsSchema = new Schema({
  question: String,
  answer: String,
  backupCodes: [{
    code: String,
    used: { type: Boolean, default: false },
    usedAt: Date,
    createdAt: { type: Date, default: Date.now }
  }],
  accountLocked: { type: Boolean, default: false },
  lockExpiresAt: Date,
  recoveryCodes: [{
    code: String,
    used: { type: Boolean, default: false },
    usedAt: Date,
    createdAt: { type: Date, default: Date.now }
  }],
  trustedDevices: [{
    deviceId: String,
    name: String,
    userAgent: String,
    ipAddress: String,
    addedAt: { type: Date, default: Date.now },
    lastUsed: { type: Date, default: Date.now }
  }],
  twoFactorSecret: String,
  tempTwoFactorSecret: String,
  tempTwoFactorSecretExpires: Date
});

export  default SecurityDetailsSchema