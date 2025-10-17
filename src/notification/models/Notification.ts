import mongoose, { Document, Schema, Model } from 'mongoose';
import {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationStatus,
  NotificationMetadata
} from '../types/notificationTypes';

// Interface pour le document Mongoose (sans conflits avec Document)
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId | string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: NotificationPriority;
  isRead: boolean;
  scheduledAt?: Date;
  expiresAt?: Date;
  metadata?: NotificationMetadata;
  createdAt: Date;
  updatedAt: Date;

  // Méthodes d'instance
  markAsRead(): Promise<INotification>;
  markAsClicked(): Promise<INotification>;
  isExpired(): boolean;
}

// Interface for static methods
export interface INotificationModel extends Model<INotification> {
  findUnread(userId: string, limit?: number): any;
  findByType(userId: string, type: NotificationType): any;
  markAllAsRead(userId: string): Promise<any>;
  getUnreadCount(userId: string): Promise<number>;
  cleanupExpired(): Promise<any>;
}

const notificationMetadataSchema = new Schema({
  source: { type: String },
  campaign: { type: String },
  channel: [{ type: String, enum: Object.values(NotificationChannel) }],
  tags: [{ type: String }],
  deliveryAttempts: { type: Number, default: 0 },
  lastAttemptAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  clickedAt: { type: Date }
}, { _id: false });

const notificationSchema = new Schema<INotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(NotificationType),
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 255
  },
  message: {
    type: String,
    required: true,
    maxlength: 2000
  },
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },
  priority: {
    type: String,
    enum: Object.values(NotificationPriority),
    default: NotificationPriority.NORMAL,
    index: true
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  scheduledAt: {
    type: Date,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  },
  metadata: {
    type: notificationMetadataSchema,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'notifications'
});

// Indexes for better query performance
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ userId: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ scheduledAt: 1 });

// Instance methods
notificationSchema.methods.markAsRead = function(): Promise<INotification> {
  this.isRead = true;
  this.metadata = this.metadata || {};
  this.metadata.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsClicked = function(): Promise<INotification> {
  this.metadata = this.metadata || {};
  this.metadata.clickedAt = new Date();
  if (!this.isRead) {
    this.isRead = true;
    this.metadata.readAt = new Date();
  }
  return this.save();
};

notificationSchema.methods.isExpired = function(): boolean {
  return this.expiresAt ? new Date() > this.expiresAt : false;
};

// Static methods
notificationSchema.statics.findUnread = function(userId: string, limit?: number) {
  const query = this.find({ userId, isRead: false }).sort({ createdAt: -1 });
  return limit ? query.limit(limit) : query;
};

notificationSchema.statics.findByType = function(userId: string, type: NotificationType) {
  return this.find({ userId, type }).sort({ createdAt: -1 });
};

notificationSchema.statics.markAllAsRead = function(userId: string) {
  return this.updateMany(
    { userId, isRead: false },
    {
      isRead: true,
      'metadata.readAt': new Date()
    }
  );
};

notificationSchema.statics.getUnreadCount = function(userId: string) {
  return this.countDocuments({ userId, isRead: false });
};

notificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// Virtual for formatted creation time
notificationSchema.virtual('timeAgo').get(function(this: INotification) {
  const now = new Date();
  const created = this.createdAt;
  if (!created) return 'À l\'instant';

  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;

  return created.toLocaleDateString('fr-FR');
});

// Ensure virtuals are included in JSON output
notificationSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

export const Notification = mongoose.model<INotification, INotificationModel>('Notification', notificationSchema);

// Notification History Schema
export interface INotificationHistory extends Document {
  notificationId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  channel: NotificationChannel;
  status: NotificationStatus;
  attempts: number;
  lastAttemptAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
  errorMessage?: string;
  providerId?: string;
  metadata?: Record<string, any>;
}

const notificationHistorySchema = new Schema<INotificationHistory>({
  notificationId: {
    type: Schema.Types.ObjectId,
    ref: 'Notification',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: Object.values(NotificationChannel),
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(NotificationStatus),
    required: true,
    index: true
  },
  attempts: {
    type: Number,
    default: 1
  },
  lastAttemptAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: Date,
  readAt: Date,
  clickedAt: Date,
  errorMessage: String,
  providerId: String,
  metadata: Schema.Types.Mixed
}, {
  timestamps: true,
  collection: 'notification_history'
});

// Indexes for notification history
notificationHistorySchema.index({ userId: 1, createdAt: -1 });
notificationHistorySchema.index({ notificationId: 1, channel: 1 });
notificationHistorySchema.index({ status: 1, createdAt: -1 });

export const NotificationHistory = mongoose.model<INotificationHistory>('NotificationHistory', notificationHistorySchema);