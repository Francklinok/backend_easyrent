export interface NotificationBase {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: Date;
  updatedAt?: Date;
  scheduledAt?: Date;
  expiresAt?: Date;
  metadata?: NotificationMetadata;
}

export enum NotificationType {
  // User-related
  USER_REGISTRATION = 'user_registration',
  USER_VERIFICATION = 'user_verification',
  PASSWORD_RESET = 'password_reset',
  PASSWORD_CHANGED = 'password_changed',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  SECURITY_ALERT = 'security_alert',

  // Property-related
  PROPERTY_APPROVED = 'property_approved',
  PROPERTY_REJECTED = 'property_rejected',
  PROPERTY_PUBLISHED = 'property_published',
  PROPERTY_RENTED = 'property_rented',
  PROPERTY_AVAILABLE = 'property_available',

  // Booking/Reservation
  BOOKING_REQUEST = 'booking_request',
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_CANCELLED = 'booking_cancelled',
  VISIT_SCHEDULED = 'visit_scheduled',
  VISIT_CANCELLED = 'visit_cancelled',
  VISIT_REMINDER = 'visit_reminder',

  // Payment/Financial
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_REFUND = 'payment_refund',
  SUBSCRIPTION_EXPIRED = 'subscription_expired',
  INVOICE_GENERATED = 'invoice_generated',

  // Communication
  MESSAGE_RECEIVED = 'message_received',
  REVIEW_RECEIVED = 'review_received',
  SUPPORT_TICKET = 'support_ticket',

  // System
  MAINTENANCE_NOTICE = 'maintenance_notice',
  FEATURE_UPDATE = 'feature_update',
  SYSTEM_ALERT = 'system_alert',

  // Custom
  CUSTOM = 'custom'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
  PUSH = 'push',
  WEBHOOK = 'webhook'
}

export interface NotificationMetadata {
  source?: string;
  campaign?: string;
  channel?: NotificationChannel[];
  tags?: string[];
  deliveryAttempts?: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
}

export interface EmailNotificationData {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  templateId?: string;
  templateData?: Record<string, any>;
  htmlContent?: string;
  textContent?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  disposition?: 'attachment' | 'inline';
  cid?: string;
}

export interface SmsNotificationData {
  to: string | string[];
  message: string;
  from?: string;
  mediaUrls?: string[];
}

export interface InAppNotificationData {
  userId: string | string[];
  title: string;
  message: string;
  icon?: string;
  image?: string;
  actionUrl?: string;
  actionLabel?: string;
  category?: string;
  persistent?: boolean;
}

export interface PushNotificationData {
  tokens: string[];
  title: string;
  body: string;
  icon?: string;
  image?: string;
  sound?: string;
  badge?: number;
  data?: Record<string, any>;
  clickAction?: string;
  category?: string;
  tag?: string;
}

export interface WebhookNotificationData {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  payload: Record<string, any>;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
  };
}

export interface NotificationRequest {
  userId: string | string[];
  type: NotificationType;
  channels: NotificationChannel[];
  priority?: NotificationPriority;
  title: string;
  message: string;
  data?: {
    email?: EmailNotificationData;
    sms?: SmsNotificationData;
    inApp?: InAppNotificationData;
    push?: PushNotificationData;
    webhook?: WebhookNotificationData;
  };
  scheduledAt?: Date;
  expiresAt?: Date;
  metadata?: Partial<NotificationMetadata>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  channels: NotificationChannel[];
  defaultPriority: NotificationPriority;
  subject?: string;
  emailTemplate?: {
    html: string;
    text?: string;
  };
  smsTemplate?: string;
  inAppTemplate?: {
    title: string;
    message: string;
  };
  pushTemplate?: {
    title: string;
    body: string;
  };
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  enabled: boolean;
  frequency?: 'immediate' | 'daily' | 'weekly' | 'monthly';
  quietHours?: {
    start: string; // HH:mm format
    end: string;   // HH:mm format
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationHistory {
  id: string;
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  attempts: number;
  lastAttemptAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
  errorMessage?: string;
  providerId?: string; // External provider ID (SendGrid ID, Twilio ID, etc.)
  metadata?: Record<string, any>;
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
  CLICKED = 'clicked',
  EXPIRED = 'expired'
}

export interface NotificationQueue {
  id: string;
  notification: NotificationRequest;
  priority: NotificationPriority;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  lastAttemptAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  read: number;
  clicked: number;
  byChannel: Record<NotificationChannel, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
}

export interface NotificationProvider {
  name: string;
  type: NotificationChannel;
  isEnabled: boolean;
  config: Record<string, any>;
  rateLimit?: {
    requests: number;
    window: number; // in seconds
    resetTime: Date;
  };
}