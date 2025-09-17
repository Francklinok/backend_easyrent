// Main exports for the notification system
export * from './types/notificationTypes';
export * from './models/Notification';
export * from './services/EmailNotificationService';
export * from './services/SmsNotificationService';
export * from './services/InAppNotificationService';
export * from './services/NotificationManager';
export * from './services/ActivityNotificationService';
export * from './services/PropertyNotificationService';
export * from './services/IntegratedNotificationService';
export * from './services/EnhancedActivityService';
export * from './services/EnhancedPropertyService';

// Convenience exports - Services principaux
export { NotificationManager } from './services/NotificationManager';
export { IntegratedNotificationService } from './services/IntegratedNotificationService';
export { default as EnhancedActivityService } from './services/EnhancedActivityService';
export { default as EnhancedPropertyService } from './services/EnhancedPropertyService';

// Convenience exports - Models
export { Notification, NotificationHistory } from './models/Notification';

// Convenience exports - Types
export {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationStatus
} from './types/notificationTypes';