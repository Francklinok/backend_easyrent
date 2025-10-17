/**
 * ==================================================
 * NOTIFICATION SYSTEM - UNIFIED EXPORTS
 * ==================================================
 *
 * This is the consolidated notification system for EasyRent.
 * All notification functionality is centralized here.
 *
 * MAIN ENTRY POINTS:
 * - IntegratedNotificationService: Complete notification orchestrator
 * - NotificationManager: Low-level multi-channel manager
 * - UnifiedNotificationService: Technical email/push service
 *
 * USAGE EXAMPLES:
 *
 * 1. Send a notification (recommended):
 * ```typescript
 * import { IntegratedNotificationService } from '@/notification';
 * const notifService = new IntegratedNotificationService(io);
 * await notifService.onNewPropertyCreated(property);
 * ```
 *
 * 2. Custom notification:
 * ```typescript
 * import { NotificationManager, NotificationChannel } from '@/notification';
 * const manager = new NotificationManager(io);
 * await manager.sendNotification({
 *   userId: 'user123',
 *   type: NotificationType.CUSTOM,
 *   channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
 *   title: 'Hello',
 *   message: 'World',
 *   priority: NotificationPriority.HIGH
 * });
 * ```
 *
 * 3. Send technical emails:
 * ```typescript
 * import { UnifiedNotificationService } from '@/notification';
 * const emailService = new UnifiedNotificationService();
 * await emailService.sendVerificationEmail(email, firstName, code);
 * ```
 */

// ==================== TYPES ====================
export * from './types/notificationTypes';

// ==================== MODELS ====================
export * from './models';

// ==================== SERVICES ====================
export * from './services';

// ==================== CONVENIENCE EXPORTS ====================

// Main service (use this for most cases)
export { IntegratedNotificationService } from './services/IntegratedNotificationService';
export { NotificationManager } from './services/NotificationManager';

// Models
export {
  Notification,
  NotificationHistory,
  INotification,
  INotificationHistory,
  INotificationModel
} from './models/Notification';

export {
  NotificationPreference,
  INotificationPreference
} from './models/NotificationPreference';

// Core services
export { EmailNotificationService } from './services/EmailNotificationService';
export { SmsNotificationService } from './services/SmsNotificationService';
export { InAppNotificationService } from './services/InAppNotificationService';
export { PushNotificationService } from './services/PushNotificationService';  // ✅ AJOUTÉ

// Specialized services
export { ActivityNotificationService } from './services/ActivityNotificationService';
export { PropertyNotificationService } from './services/PropertyNotificationService';
export { ChatNotificationService } from './services/ChatNotificationService';

// Technical service (for direct email/push operations)
export { NotificationService as UnifiedNotificationService } from '../services/notificationServices';

// Types and enums
export {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationStatus,
  type NotificationRequest,
  type NotificationMetadata,
  type EmailNotificationData,
  type SmsNotificationData,
  type InAppNotificationData,
  type PushNotificationData,
  type NotificationStats,
  type NotificationProvider
} from './types/notificationTypes';