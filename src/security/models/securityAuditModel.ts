import { Schema, model, Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import { 
  SecurityAuditDocument, 
  AuditEventSeverity, 
  SecurityEventType 
} from '../type/auditType';

// Définition du schéma
const SecurityAuditSchema = new Schema<SecurityAuditDocument>({
  eventType: {
    type: String,
    required: true,
    enum: Object.values(SecurityEventType),
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  details: {
    type: Schema.Types.Mixed,
    default: {},
    // On peut définir des sous-schémas pour les champs courants
    description: String,
    status: {
      type: String,
      enum: ['success', 'failure', 'warning', 'info']
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    email: String,
    loginMethod: {
      type: String,
      enum: ['password', 'oauth', 'sso', 'api_key']
    },
    failureReason: String,
    sessionId: String,
    sessionDuration: Number,
    changedFields: [String],
    oldValues: Schema.Types.Mixed,
    newValues: Schema.Types.Mixed,
    targetResource: String,
    requiredPermissions: [String],
    adminId: String,
    targetUserId: String,
    actionTaken: String,
    geolocation: {
      country: String,
      city: String,
      latitude: Number,
      longitude: Number
    },
    deviceInfo: {
      type: String,
      osName: String,
      osVersion: String,
      browser: String,
      browserVersion: String
    }
  },
  severity: {
    type: String,
    enum: Object.values(AuditEventSeverity),
    default: AuditEventSeverity.INFO,
    required: true,
    index: true
  },
  targetResource: {
    type: String,
    index: true
  },
  targetUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  sessionId: {
    type: String,
    index: true
  }
}, {
  timestamps: true, // Ajoute createdAt et updatedAt
  collection: 'security_audit_events'
});

// Création d'index composites pour optimiser les requêtes fréquentes
SecurityAuditSchema.index({ userId: 1, timestamp: -1 });
SecurityAuditSchema.index({ eventType: 1, timestamp: -1 });
SecurityAuditSchema.index({ timestamp: -1, severity: 1 });
SecurityAuditSchema.index({ sessionId: 1, timestamp: 1 });

// Méthodes statiques (optionnelles)
interface SecurityAuditModelInterface extends Model<SecurityAuditDocument> {
  // Méthodes personnalisées si nécessaire
  findByUserAndDateRange(userId: string, startDate: Date, endDate: Date): Promise<SecurityAuditDocument[]>;
  getRecentActivityByIp(ipAddress: string, limit?: number): Promise<SecurityAuditDocument[]>;
  countEventsByType(startDate: Date, endDate: Date): Promise<Record<string, number>>;
}

// Implémentation des méthodes statiques
SecurityAuditSchema.static('findByUserAndDateRange', function findByUserAndDateRange(
  userId: string, 
  startDate: Date, 
  endDate: Date
): Promise<SecurityAuditDocument[]> {
  return this.find({
    userId: new ObjectId(userId),
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort({ timestamp: -1 });
});

SecurityAuditSchema.static('getRecentActivityByIp', function getRecentActivityByIp(
  ipAddress: string,
  limit = 20
): Promise<SecurityAuditDocument[]> {
  return this.find({ ipAddress })
    .sort({ timestamp: -1 })
    .limit(limit);
});

SecurityAuditSchema.static('countEventsByType', async function countEventsByType(
  startDate: Date,
  endDate: Date
): Promise<Record<string, number>> {
  const results = await this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$eventType",
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Formater les résultats
  const counts: Record<string, number> = {};
  results.forEach(item => {
    counts[item._id] = item.count;
  });
  
  return counts;
});

// Export du modèle
export const SecurityAuditModel = model<SecurityAuditDocument, SecurityAuditModelInterface>(
  'SecurityAudit',
  SecurityAuditSchema
);