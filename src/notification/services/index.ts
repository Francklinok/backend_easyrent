// Core services exports
export * from './EmailNotificationService';
export * from './SmsNotificationService';
export * from './InAppNotificationService';
export * from './PushNotificationService';  // ✅ AJOUTÉ
export * from './NotificationManager';

// Specialized domain services
export * from './ActivityNotificationService';
export * from './PropertyNotificationService';
export * from './ChatNotificationService';

// Integrated service (main entry point)
export * from './IntegratedNotificationService';

// Named exports for convenience
export { EmailNotificationService } from './EmailNotificationService';
export { SmsNotificationService } from './SmsNotificationService';
export { InAppNotificationService } from './InAppNotificationService';
export { PushNotificationService } from './PushNotificationService';  // ✅ AJOUTÉ
export { NotificationManager } from './NotificationManager';
export { ActivityNotificationService } from './ActivityNotificationService';
export { PropertyNotificationService } from './PropertyNotificationService';
export { ChatNotificationService } from './ChatNotificationService';
export { IntegratedNotificationService } from './IntegratedNotificationService';

// For backward compatibility, re-export the unified notification service from src/services
export { NotificationService as UnifiedNotificationService } from '../../services/notificationServices';
