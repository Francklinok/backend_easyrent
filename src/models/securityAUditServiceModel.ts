import mongoose, { Schema } from 'mongoose';
import { SecurityAuditEvent } from '../type/type';

/**
 * Schéma mongoose pour les événements d'audit de sécurité
 */
const SecurityAuditSchema = new Schema<SecurityAuditEvent>({
  eventType: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  details: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: false // Nous utilisons notre propre champ timestamp
});

// Ajout d'index composites pour améliorer les performances des requêtes courantes
SecurityAuditSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
SecurityAuditSchema.index({ ipAddress: 1, timestamp: -1 });
SecurityAuditSchema.index({ eventType: 1, timestamp: -1 });

// Créer et exporter le modèle
export const SecurityAuditModel = mongoose.model<SecurityAuditEvent>('SecurityAudit', SecurityAuditSchema);