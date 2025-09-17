import { Server as SocketIOServer } from 'socket.io';
import { NotificationManager } from './NotificationManager';
import { ActivityNotificationService } from './ActivityNotificationService';
import { PropertyNotificationService } from './PropertyNotificationService';
import { ChatNotificationService } from './ChatNotificationService';
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
      return await this.notificationManager.sendNotification({
        type: 'push',
        title: '🔧 Nouveau service disponible',
        body: `${service.title} proposé dans votre région`,
        data: {
          type: 'service_marketplace',
          action: 'new_service',
          serviceId: service._id.toString(),
          category: service.category,
          location: service.location
        },
        targetUsers: await this.getInterestedUsers('service', service),
        priority: 'normal'
      });
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

      return await this.notificationManager.sendNotification({
        type: 'push',
        title: '📞 Nouvelle demande de service',
        body: `Quelqu'un souhaite votre service: ${serviceRequest.serviceTitle}`,
        data: {
          type: 'service_marketplace',
          action: 'service_request',
          requestId: serviceRequest._id.toString(),
          clientId: serviceRequest.clientId,
          serviceId: serviceRequest.serviceId
        },
        targetUsers: [serviceRequest.providerId],
        priority: 'high'
      });
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
      const body = isAccepted
        ? `Votre demande pour ${serviceRequest.serviceTitle} a été acceptée`
        : `Votre demande pour ${serviceRequest.serviceTitle} a été refusée`;

      return await this.notificationManager.sendNotification({
        type: 'push',
        title,
        body: response ? `${body}: ${response}` : body,
        data: {
          type: 'service_marketplace',
          action: isAccepted ? 'service_accepted' : 'service_refused',
          requestId: serviceRequest._id.toString(),
          providerId: serviceRequest.providerId,
          response
        },
        targetUsers: [serviceRequest.clientId],
        priority: 'high'
      });
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