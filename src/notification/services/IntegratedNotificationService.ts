import { Server as SocketIOServer } from 'socket.io';
import { NotificationManager } from './NotificationManager';
import { ActivityNotificationService } from './ActivityNotificationService';
import { PropertyNotificationService } from './PropertyNotificationService';
import { ChatNotificationService } from './ChatNotificationService';
import { NotificationType, NotificationChannel, NotificationPriority } from '../types/notificationTypes';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('IntegratedNotificationService');

/**
 * Service central d'intégration des notifications
 * Point d'entrée unique pour toutes les notifications de l'application
 */
export class IntegratedNotificationService {
  private notificationManager: NotificationManager;
  private activityNotifications: ActivityNotificationService;
  private propertyNotifications: PropertyNotificationService;
  private chatNotifications: ChatNotificationService;

  constructor(io?: SocketIOServer) {
    this.notificationManager = new NotificationManager(io);
    this.activityNotifications = new ActivityNotificationService(this.notificationManager);
    this.propertyNotifications = new PropertyNotificationService(this.notificationManager);
    this.chatNotifications = new ChatNotificationService(this.notificationManager);

    logger.info('Service intégré de notifications initialisé');
  }

  // ==================== PROPERTY NOTIFICATIONS ====================

  /**
   * Nouvelle propriété créée - Broadcast à tous les utilisateurs (style Instagram)
   */
  async onNewPropertyCreated(property: any): Promise<boolean> {
    try {
      logger.info('Notification nouvelle propriété', { propertyId: property._id });

      // Notification broadcast
      const broadcastResult = await this.propertyNotifications.sendNewPropertyNotification(property);

      // Notification dans la zone géographique
      const areaResult = await this.propertyNotifications.sendNewPropertyInAreaNotification(property);

      // Planifier des rappels
      await this.propertyNotifications.schedulePropertyReminders(property);

      return broadcastResult && areaResult;
    } catch (error) {
      logger.error('Erreur notification nouvelle propriété', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        propertyId: property._id
      });
      return false;
    }
  }

  /**
   * Statut de propriété modifié
   */
  async onPropertyStatusChanged(property: any, oldStatus: string, newStatus: string): Promise<boolean> {
    try {
      logger.info('Notification changement statut propriété', {
        propertyId: property._id,
        oldStatus,
        newStatus
      });

      return await this.propertyNotifications.sendPropertyStatusUpdateNotification(
        property,
        oldStatus,
        newStatus
      );
    } catch (error) {
      logger.error('Erreur notification changement statut', { error });
      return false;
    }
  }

  /**
   * Prix de propriété modifié
   */
  async onPropertyPriceChanged(property: any, oldPrice: number, newPrice: number): Promise<boolean> {
    try {
      if (newPrice < oldPrice) {
        logger.info('Notification baisse de prix', {
          propertyId: property._id,
          oldPrice,
          newPrice
        });

        return await this.propertyNotifications.sendPriceDropNotification(
          property,
          oldPrice,
          newPrice
        );
      }
      return true;
    } catch (error) {
      logger.error('Erreur notification changement prix', { error });
      return false;
    }
  }

  // ==================== ACTIVITY NOTIFICATIONS ====================

  /**
   * Demande de visite créée
   */
  async onVisitRequested(activity: any): Promise<boolean> {
    try {
      logger.info('Notification demande de visite', { activityId: activity._id });

      const result = await this.activityNotifications.sendVisitRequestNotification(activity);

      // Planifier des rappels
      await this.activityNotifications.scheduleActivityReminders(activity);

      return result;
    } catch (error) {
      logger.error('Erreur notification demande de visite', { error });
      return false;
    }
  }

  /**
   * Visite acceptée ou refusée
   */
  async onVisitResponseGiven(activity: any, isAccepted: boolean, reason?: string): Promise<boolean> {
    try {
      logger.info('Notification réponse visite', {
        activityId: activity._id,
        isAccepted,
        reason
      });

      return await this.activityNotifications.sendVisitResponseNotification(
        activity,
        isAccepted,
        reason
      );
    } catch (error) {
      logger.error('Erreur notification réponse visite', { error });
      return false;
    }
  }

  /**
   * Demande de réservation créée
   */
  async onReservationRequested(activity: any): Promise<boolean> {
    try {
      logger.info('Notification demande de réservation', { activityId: activity._id });

      const result = await this.activityNotifications.sendReservationRequestNotification(activity);

      // Planifier des rappels de paiement
      await this.activityNotifications.scheduleActivityReminders(activity);

      return result;
    } catch (error) {
      logger.error('Erreur notification demande de réservation', { error });
      return false;
    }
  }

  /**
   * Réservation acceptée ou refusée
   */
  async onReservationResponseGiven(activity: any, isAccepted: boolean, reason?: string): Promise<boolean> {
    try {
      logger.info('Notification réponse réservation', {
        activityId: activity._id,
        isAccepted,
        reason
      });

      return await this.activityNotifications.sendReservationResponseNotification(
        activity,
        isAccepted,
        reason
      );
    } catch (error) {
      logger.error('Erreur notification réponse réservation', { error });
      return false;
    }
  }

  /**
   * Paiement effectué
   */
  async onPaymentCompleted(activity: any): Promise<boolean> {
    try {
      logger.info('Notification paiement effectué', { activityId: activity._id });

      return await this.activityNotifications.sendPaymentNotification(activity);
    } catch (error) {
      logger.error('Erreur notification paiement', { error });
      return false;
    }
  }

  /**
   * Rappel de paiement
   */
  async onPaymentReminder(activity: any): Promise<boolean> {
    try {
      logger.info('Rappel de paiement', { activityId: activity._id });

      return await this.activityNotifications.sendPaymentReminderNotification(activity);
    } catch (error) {
      logger.error('Erreur rappel de paiement', { error });
      return false;
    }
  }

  // ==================== CHAT NOTIFICATIONS ====================

  /**
   * Nouveau message reçu
   */
  async onNewMessage(message: any, conversation: any): Promise<boolean> {
    try {
      logger.info('Notification nouveau message', {
        messageId: message._id,
        conversationId: conversation._id
      });

      return await this.chatNotifications.sendNewMessageNotification(message, conversation);
    } catch (error) {
      logger.error('Erreur notification nouveau message', { error });
      return false;
    }
  }

  /**
   * Réaction à un message
   */
  async onMessageReaction(message: any, reactorId: string, reactionType: string, conversation: any): Promise<boolean> {
    try {
      logger.info('Notification réaction message', {
        messageId: message._id,
        reactorId,
        reactionType
      });

      return await this.chatNotifications.sendMessageReactionNotification(
        message,
        reactorId,
        reactionType,
        conversation
      );
    } catch (error) {
      logger.error('Erreur notification réaction message', { error });
      return false;
    }
  }

  /**
   * Message mentionné
   */
  async onMessageMention(message: any, mentionedUserIds: string[], conversation: any): Promise<boolean> {
    try {
      logger.info('Notification mention message', {
        messageId: message._id,
        mentionedUserIds
      });

      return await this.chatNotifications.sendMessageMentionNotification(
        message,
        mentionedUserIds,
        conversation
      );
    } catch (error) {
      logger.error('Erreur notification mention message', { error });
      return false;
    }
  }

  /**
   * Nouvelle conversation créée
   */
  async onConversationCreated(conversation: any, creatorId: string): Promise<boolean> {
    try {
      logger.info('Notification nouvelle conversation', {
        conversationId: conversation._id,
        creatorId
      });

      return await this.chatNotifications.sendConversationCreatedNotification(conversation, creatorId);
    } catch (error) {
      logger.error('Erreur notification nouvelle conversation', { error });
      return false;
    }
  }

  // ==================== SERVICE MARKETPLACE NOTIFICATIONS ====================

  /**
   * Nouveau service proposé
   */
  async onNewServiceOffered(service: any): Promise<boolean> {
    try {
      logger.info('Notification nouveau service proposé', { serviceId: service._id });

      // Notifier les utilisateurs intéressés par ce type de service
      const targetUsers = await this.getInterestedUsers('service', service);
      const result = await this.notificationManager.sendNotification({
        userId: targetUsers,
        type: NotificationType.CUSTOM,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        title: '🔧 Nouveau service disponible',
        message: `${service.title} proposé dans votre région`,
        data: {
          inApp: {
            userId: targetUsers,
            title: '🔧 Nouveau service disponible',
            message: `${service.title} proposé dans votre région`,
            category: 'service',
            actionUrl: `/services/${service._id}`
          }
        },
        priority: NotificationPriority.NORMAL,
        metadata: {
          source: 'service_marketplace',
          tags: ['new_service', service.category]
        }
      });
      return result.success;
    } catch (error) {
      logger.error('Erreur notification nouveau service', { error });
      return false;
    }
  }

  /**
   * Demande de service reçue
   */
  async onServiceRequested(serviceRequest: any): Promise<boolean> {
    try {
      logger.info('Notification demande de service', { requestId: serviceRequest._id });

      const result = await this.notificationManager.sendNotification({
        userId: serviceRequest.providerId,
        type: NotificationType.CUSTOM,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        title: '📞 Nouvelle demande de service',
        message: `Quelqu'un souhaite votre service: ${serviceRequest.serviceTitle}`,
        data: {
          inApp: {
            userId: serviceRequest.providerId,
            title: '📞 Nouvelle demande de service',
            message: `Quelqu'un souhaite votre service: ${serviceRequest.serviceTitle}`,
            category: 'service',
            actionUrl: `/service-requests/${serviceRequest._id}`
          }
        },
        priority: NotificationPriority.HIGH,
        metadata: {
          source: 'service_marketplace',
          tags: ['service_request']
        }
      });
      return result.success;
    } catch (error) {
      logger.error('Erreur notification demande de service', { error });
      return false;
    }
  }

  /**
   * Service accepté/refusé
   */
  async onServiceResponseGiven(serviceRequest: any, isAccepted: boolean, response?: string): Promise<boolean> {
    try {
      logger.info('Notification réponse service', {
        requestId: serviceRequest._id,
        isAccepted
      });

      const title = isAccepted ? '✅ Service accepté' : '❌ Service refusé';
      const message = isAccepted
        ? `Votre demande pour ${serviceRequest.serviceTitle} a été acceptée`
        : `Votre demande pour ${serviceRequest.serviceTitle} a été refusée`;
      const fullMessage = response ? `${message}: ${response}` : message;

      const result = await this.notificationManager.sendNotification({
        userId: serviceRequest.clientId,
        type: NotificationType.CUSTOM,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        title,
        message: fullMessage,
        data: {
          inApp: {
            userId: serviceRequest.clientId,
            title,
            message: fullMessage,
            category: 'service',
            actionUrl: `/service-requests/${serviceRequest._id}`
          }
        },
        priority: NotificationPriority.HIGH,
        metadata: {
          source: 'service_marketplace',
          tags: [isAccepted ? 'service_accepted' : 'service_refused']
        }
      });
      return result.success;
    } catch (error) {
      logger.error('Erreur notification réponse service', { error });
      return false;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Obtenir les utilisateurs intéressés par un type de contenu
   */
  private async getInterestedUsers(type: 'property' | 'service', item: any): Promise<string[]> {
    // Logique pour trouver les utilisateurs intéressés
    // Pour l'instant, retourne une liste vide, mais peut être étendue
    return [];
  }

  /**
   * Envoyer notification custom
   */
  async sendCustomNotification(request: any): Promise<any> {
    return await this.notificationManager.sendNotification(request);
  }

  /**
   * Obtenir les statistiques de notifications
   */
  async getNotificationStats(userId?: string, startDate?: Date, endDate?: Date) {
    return await this.notificationManager.getNotificationStats(userId, startDate, endDate);
  }

  /**
   * Marquer une notification comme lue
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    return await this.notificationManager.inApp.markAsRead(notificationId, userId);
  }

  /**
   * Marquer toutes les notifications comme lues
   */
  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    return await this.notificationManager.inApp.markAllAsRead(userId);
  }

  /**
   * Obtenir les notifications d'un utilisateur
   */
  async getUserNotifications(userId: string, options: any = {}) {
    return await this.notificationManager.inApp.getNotifications(userId, options);
  }

  /**
   * Obtenir le nombre de notifications non lues
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationManager.inApp.getUnreadCount(userId);
  }

  /**
   * Vérifier si un utilisateur est connecté
   */
  isUserConnected(userId: string): boolean {
    return this.notificationManager.inApp.isUserConnected(userId);
  }

  /**
   * Obtenir les utilisateurs connectés
   */
  getConnectedUsers() {
    return this.notificationManager.inApp.getConnectedUsers();
  }

  /**
   * Envoyer notification broadcast à tous les utilisateurs connectés
   */
  async sendBroadcastNotification(
    title: string,
    message: string,
    excludeUserIds: string[] = []
  ): Promise<boolean> {
    return await this.notificationManager.inApp.sendBroadcastNotification(
      title,
      message,
      excludeUserIds
    );
  }

  /**
   * Planifier une notification
   */
  async scheduleNotification(request: any, scheduledAt: Date): Promise<string> {
    return await this.notificationManager.scheduleNotification(request, scheduledAt);
  }

  /**
   * Obtenir le statut de tous les services
   */
  async getServicesStatus() {
    return await this.notificationManager.getAllServicesStatus();
  }

  /**
   * Tester tous les services
   */
  async testAllServices() {
    return await this.notificationManager.testAllServices();
  }

  /**
   * Arrêter le service (cleanup)
   */
  stop(): void {
    this.notificationManager.stopQueueProcessing();
    logger.info('Service intégré de notifications arrêté');
  }

  // ==================== GETTERS ====================

  /**
   * Accès au gestionnaire principal
   */
  get manager(): NotificationManager {
    return this.notificationManager;
  }

  /**
   * Accès aux notifications d'activité
   */
  get activity(): ActivityNotificationService {
    return this.activityNotifications;
  }

  /**
   * Accès aux notifications de propriété
   */
  get property(): PropertyNotificationService {
    return this.propertyNotifications;
  }

  /**
   * Accès aux notifications de chat
   */
  get chat(): ChatNotificationService {
    return this.chatNotifications;
  }

  /**
   * Accès aux services individuels
   */
  get email() {
    return this.notificationManager.email;
  }

  get sms() {
    return this.notificationManager.sms;
  }

  get inApp() {
    return this.notificationManager.inApp;
  }
}