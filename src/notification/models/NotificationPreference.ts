import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationPreference extends Document {
  userId: string;
  preferences: {
    wallet: ChannelPreferences;
    property: ChannelPreferences;
    service: ChannelPreferences;
    general: ChannelPreferences;
    security: ChannelPreferences;
    reminder: ChannelPreferences;
    marketplace: ChannelPreferences;
    defi: ChannelPreferences;
    governance: ChannelPreferences;
  };
  pushToken?: string;
  deviceInfo?: {
    platform?: 'ios' | 'android' | 'web';
    deviceId?: string;
    appVersion?: string;
  };
  quietHours?: {
    enabled: boolean;
    startTime: string; // Format HH:mm
    endTime: string;   // Format HH:mm
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ChannelPreferences {
  inApp: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
}

const ChannelPreferencesSchema = new Schema({
  inApp: { type: Boolean, default: true },
  push: { type: Boolean, default: true },
  email: { type: Boolean, default: false },
  sms: { type: Boolean, default: false }
}, { _id: false });

const NotificationPreferenceSchema = new Schema<INotificationPreference>({
  userId: { type: String, required: true, unique: true, index: true },
  preferences: {
    wallet: { type: ChannelPreferencesSchema, default: { inApp: true, push: true, email: false, sms: false } },
    property: { type: ChannelPreferencesSchema, default: { inApp: true, push: true, email: true, sms: false } },
    service: { type: ChannelPreferencesSchema, default: { inApp: true, push: true, email: false, sms: false } },
    general: { type: ChannelPreferencesSchema, default: { inApp: true, push: false, email: false, sms: false } },
    security: { type: ChannelPreferencesSchema, default: { inApp: true, push: true, email: true, sms: false } },
    reminder: { type: ChannelPreferencesSchema, default: { inApp: true, push: true, email: false, sms: false } },
    marketplace: { type: ChannelPreferencesSchema, default: { inApp: true, push: true, email: false, sms: false } },
    defi: { type: ChannelPreferencesSchema, default: { inApp: true, push: true, email: true, sms: false } },
    governance: { type: ChannelPreferencesSchema, default: { inApp: true, push: true, email: false, sms: false } }
  },
  pushToken: { type: String },
  deviceInfo: {
    platform: { type: String, enum: ['ios', 'android', 'web'] },
    deviceId: { type: String },
    appVersion: { type: String }
  },
  quietHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '22:00' },
    endTime: { type: String, default: '08:00' },
    timezone: { type: String, default: 'UTC' }
  }
}, {
  timestamps: true
});

// Index pour les requêtes fréquentes
NotificationPreferenceSchema.index({ userId: 1 });
NotificationPreferenceSchema.index({ pushToken: 1 });

export const NotificationPreference = mongoose.models.NotificationPreference || mongoose.model<INotificationPreference>(
  'NotificationPreference',
  NotificationPreferenceSchema
);
