import { Server as SocketIOServer } from 'socket.io';
import { EmailNotificationService } from './EmailNotificationService';
import { SmsNotificationService } from './SmsNotificationService';
import { InAppNotificationService } from './InAppNotificationService';
import { Notification, NotificationHistory } from '../models/Notification';
import {
  NotificationRequest,
  NotificationChannel,
  NotificationType,
  NotificationPriority,
  NotificationStats,
  NotificationProvider,
  NotificationStatus
} from '../types/notificationTypes';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('NotificationManager');

export class NotificationManager {
  private emailService: EmailNotificationService;
  private smsService: SmsNotificationService;
  private inAppService: InAppNotificationService;
  private isProcessingQueue: boolean = false;
  private queueProcessingInterval: NodeJS.Timeout | null = null;

  constructor(io?: SocketIOServer) {
    this.emailService = new EmailNotificationService();
    this.smsService = new SmsNotificationService();
    this.inAppService = new InAppNotificationService(io);

    // Démarrer le traitement automatique de la queue
    this.startQueueProcessing();

    logger.info('NotificationManager initialisé');
  }

  /**
   * Méthode principale pour envoyer des notifications multicanaux
   */
  async sendNotification(request: NotificationRequest): Promise<{
    success: boolean;
    results: Record<NotificationChannel, boolean>;
    notificationId?: string;
  }> {
    const results: Record<NotificationChannel, boolean> = {} as any;
    let overallSuccess = false;

    try {
      const userIds = Array.isArray(request.userId) ? request.userId : [request.userId];

      // Traitement pour chaque utilisateur
      for (const userId of userIds) {
        // Créer la notification en base pour les canaux in-app
        let notificationId: string | undefined;

        if (request.channels.includes(NotificationChannel.IN_APP)) {
          const notification = new Notification({
            userId,
            type: request.type,
            title: request.title,
            message: request.message,
            data: request.data,
            priority: request.priority || NotificationPriority.NORMAL,
            isRead: false,
            scheduledAt: request.scheduledAt,
            expiresAt: request.expiresAt,
            metadata: {
              ...request.metadata,
              channel: request.channels,
              source: request.metadata?.source || 'api'
            }
          });

          const savedNotification = await notification.save();
          notificationId = savedNotification._id.toString();
        }

        // Envoyer via chaque canal demandé
        for (const channel of request.channels) {
          try {
            let channelResult = false;

            switch (channel) {
              case NotificationChannel.EMAIL:
                if (request.data?.email) {
                  channelResult = await this.emailService.sendEmail(
                    request.data.email,
                    userId,
                    notificationId
                  );
                }
                break;

              case NotificationChannel.SMS:
                if (request.data?.sms) {
                  channelResult = await this.smsService.sendSms(
                    request.data.sms,
                    userId,
                    notificationId
                  );
                }
                break;

              case NotificationChannel.IN_APP:
                if (request.data?.inApp) {
                  channelResult = await this.inAppService.sendNotification(
                    { ...request.data.inApp, userId },
                    notificationId
                  );
                } else {
                  // Utiliser les données générales pour in-app
                  channelResult = await this.inAppService.sendNotification({
                    userId,
                    title: request.title,
                    message: request.message,
                    category: this.getNotificationCategory(request.type)
                  }, notificationId);
                }
                break;

              case NotificationChannel.PUSH:
                // Intégrer avec le service push existant
                if (request.data?.push) {
                  // Utiliser le service push existant depuis notificationServices.ts
                  channelResult = await this.sendPushNotification(request.data.push, userId, notificationId);
                }
                break;

              case NotificationChannel.WEBHOOK:
                if (request.data?.webhook) {
                  channelResult = await this.sendWebhook(request.data.webhook, userId, notificationId);
                }
                break;
            }

            results[channel] = channelResult;
            if (channelResult) {
              overallSuccess = true;
            }

            logger.debug('Résultat envoi canal', {
              channel,
              success: channelResult,
              userId,
              notificationId
            });

          } catch (error) {
            logger.error('Erreur envoi canal', {
              channel,
              error: error instanceof Error ? error.message : 'Erreur inconnue',
              userId,
              notificationId
            });
            results[channel] = false;
          }
        }
      }

      return {
        success: overallSuccess,
        results,
        notificationId
      };

    } catch (error) {
      logger.error('Erreur lors de l\'envoi de notification', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        request: {
          type: request.type,
          channels: request.channels,
          userId: request.userId
        }
      });

      return {
        success: false,
        results,
        notificationId: undefined
      };
    }
  }

  /**
   * Envoyer une notification avec template prédéfini
   */
  async sendTemplateNotification(
    templateId: string,
    templateData: Record<string, any>,
    request: Omit<NotificationRequest, 'title' | 'message'>
  ): Promise<{ success: boolean; results: Record<NotificationChannel, boolean> }> {
    // Récupérer le template (ici simplifié, normalement depuis BDD)
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template non trouvé: ${templateId}`);
    }

    // Remplacer les variables dans le template
    const title = this.replaceTemplateVariables(template.title, templateData);
    const message = this.replaceTemplateVariables(template.message, templateData);

    return this.sendNotification({
      ...request,
      title,
      message,
      type: template.type,
      priority: template.priority
    });
  }

  /**
   * Planifier une notification pour plus tard
   */
  async scheduleNotification(
    request: NotificationRequest,
    scheduledAt: Date
  ): Promise<string> {
    try {
      const notification = new Notification({
        userId: Array.isArray(request.userId) ? request.userId[0] : request.userId,
        type: request.type,
        title: request.title,
        message: request.message,
        data: request.data,
        priority: request.priority || NotificationPriority.NORMAL,
        isRead: false,
        scheduledAt,
        expiresAt: request.expiresAt,
        metadata: {
          ...request.metadata,
          channel: request.channels,
          source: 'scheduled',
          scheduledRequest: request
        }
      });

      const savedNotification = await notification.save();

      logger.info('Notification planifiée', {
        notificationId: savedNotification._id.toString(),
        scheduledAt,
        type: request.type,
        userId: request.userId
      });

      return savedNotification._id.toString();
    } catch (error) {
      logger.error('Erreur lors de la planification', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        scheduledAt
      });
      throw error;
    }
  }

  /**
   * Traiter les notifications planifiées
   */
  private async processScheduledNotifications(): Promise<void> {
    try {
      const now = new Date();
      const scheduledNotifications = await Notification.find({
        scheduledAt: { $lte: now },
        isRead: false,
        'metadata.processed': { $ne: true }
      }).limit(50);

      if (scheduledNotifications.length === 0) {
        return;
      }

      logger.info('Traitement des notifications planifiées', {
        count: scheduledNotifications.length
      });

      for (const notification of scheduledNotifications) {
        try {
          const request = notification.metadata?.scheduledRequest as NotificationRequest;
          if (request) {
            await this.sendNotification(request);

            // Marquer comme traitée
            notification.metadata = notification.metadata || {};
            notification.metadata.processed = true;
            notification.metadata.processedAt = new Date();
            await notification.save();
          }
        } catch (error) {
          logger.error('Erreur traitement notification planifiée', {
            notificationId: notification._id.toString(),
            error: error instanceof Error ? error.message : 'Erreur inconnue'
          });
        }
      }
    } catch (error) {
      logger.error('Erreur traitement notifications planifiées', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }

  /**
   * Démarrer le traitement automatique de la queue
   */
  private startQueueProcessing(): void {
    if (this.queueProcessingInterval) {
      return;
    }

    this.queueProcessingInterval = setInterval(async () => {
      if (!this.isProcessingQueue) {
        this.isProcessingQueue = true;
        try {
          await this.processScheduledNotifications();
          await this.inAppService.cleanupExpiredNotifications();
        } catch (error) {
          logger.error('Erreur traitement queue', {
            error: error instanceof Error ? error.message : 'Erreur inconnue'
          });
        } finally {
          this.isProcessingQueue = false;
        }
      }
    }, 60000); // Toutes les minutes

    logger.info('Traitement automatique de la queue démarré');
  }

  /**
   * Arrêter le traitement automatique
   */
  stopQueueProcessing(): void {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
      logger.info('Traitement automatique de la queue arrêté');
    }
  }

  /**
   * Obtenir les statistiques de notifications
   */
  async getNotificationStats(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<NotificationStats> {
    try {
      const query: any = {};
      if (userId) query.userId = userId;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = startDate;
        if (endDate) query.createdAt.$lte = endDate;
      }

      const [notifications, history] = await Promise.all([
        Notification.find(query),
        NotificationHistory.find(query)
      ]);

      const stats: NotificationStats = {
        total: notifications.length,
        sent: history.filter(h => h.status === NotificationStatus.SENT).length,
        delivered: history.filter(h => h.status === NotificationStatus.DELIVERED).length,
        failed: history.filter(h => h.status === NotificationStatus.FAILED).length,
        read: history.filter(h => h.status === NotificationStatus.READ).length,
        clicked: history.filter(h => h.status === NotificationStatus.CLICKED).length,
        byChannel: {} as any,
        byType: {} as any,
        byPriority: {} as any
      };

      // Stats par canal
      for (const channel of Object.values(NotificationChannel)) {
        const channelHistory = history.filter(h => h.channel === channel);
        stats.byChannel[channel] = {
          sent: channelHistory.filter(h => h.status === NotificationStatus.SENT).length,
          delivered: channelHistory.filter(h => h.status === NotificationStatus.DELIVERED).length,
          failed: channelHistory.filter(h => h.status === NotificationStatus.FAILED).length
        };
      }

      // Stats par type
      for (const type of Object.values(NotificationType)) {
        stats.byType[type] = notifications.filter(n => n.type === type).length;
      }

      // Stats par priorité
      for (const priority of Object.values(NotificationPriority)) {
        stats.byPriority[priority] = notifications.filter(n => n.priority === priority).length;
      }

      return stats;
    } catch (error) {
      logger.error('Erreur récupération statistiques', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      throw error;
    }
  }

  /**
   * Obtenir le statut de tous les services
   */
  async getAllServicesStatus(): Promise<NotificationProvider[]> {
    const services = await Promise.all([
      this.emailService.getProviderStatus(),
      this.smsService.getProviderStatus(),
      this.inAppService.getProviderStatus()
    ]);

    return services;
  }

  /**
   * Tester tous les services
   */
  async testAllServices(): Promise<Record<NotificationChannel, boolean>> {
    const results: Record<NotificationChannel, boolean> = {} as any;

    try {
      const [emailTest, smsTest] = await Promise.all([
        this.emailService.testConfiguration(),
        this.smsService.testConfiguration()
      ]);

      results[NotificationChannel.EMAIL] = emailTest;
      results[NotificationChannel.SMS] = smsTest;
      results[NotificationChannel.IN_APP] = true; // Toujours disponible si le service est initialisé

      logger.info('Test de tous les services terminé', results);
      return results;
    } catch (error) {
      logger.error('Erreur test des services', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      throw error;
    }
  }

  // Méthodes privées utilitaires

  private async sendPushNotification(pushData: any, userId: string, notificationId?: string): Promise<boolean> {
    // Intégration avec le service push existant
    try {
      // Utiliser le NotificationService existant pour les push notifications
      const { NotificationService } = await import('../../services/notificationServices');
      const pushService = new NotificationService();

      let success = false;

      if (pushData.tokens && pushData.tokens.length > 0) {
        success = await pushService.sendFCMPushNotification(pushData.tokens, {
          title: pushData.title,
          body: pushData.body,
          icon: pushData.icon,
          data: pushData.data
        });
      }

      return success;
    } catch (error) {
      logger.error('Erreur envoi push notification', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  private async sendWebhook(webhookData: any, userId: string, notificationId?: string): Promise<boolean> {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(webhookData.url, {
        method: webhookData.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...webhookData.headers
        },
        body: JSON.stringify({
          ...webhookData.payload,
          userId,
          notificationId,
          timestamp: new Date().toISOString()
        })
      });

      return response.ok;
    } catch (error) {
      logger.error('Erreur envoi webhook', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        url: webhookData.url
      });
      return false;
    }
  }

  private getNotificationCategory(type: NotificationType): string {
    const categoryMap: Record<NotificationType, string> = {
      [NotificationType.USER_REGISTRATION]: 'account',
      [NotificationType.USER_VERIFICATION]: 'account',
      [NotificationType.PASSWORD_RESET]: 'security',
      [NotificationType.PASSWORD_CHANGED]: 'security',
      [NotificationType.ACCOUNT_LOCKED]: 'security',
      [NotificationType.ACCOUNT_UNLOCKED]: 'security',
      [NotificationType.SECURITY_ALERT]: 'security',
      [NotificationType.PROPERTY_APPROVED]: 'property',
      [NotificationType.PROPERTY_REJECTED]: 'property',
      [NotificationType.PROPERTY_PUBLISHED]: 'property',
      [NotificationType.PROPERTY_RENTED]: 'property',
      [NotificationType.PROPERTY_AVAILABLE]: 'property',
      [NotificationType.BOOKING_REQUEST]: 'booking',
      [NotificationType.BOOKING_CONFIRMED]: 'booking',
      [NotificationType.BOOKING_CANCELLED]: 'booking',
      [NotificationType.VISIT_SCHEDULED]: 'booking',
      [NotificationType.VISIT_CANCELLED]: 'booking',
      [NotificationType.VISIT_REMINDER]: 'booking',
      [NotificationType.PAYMENT_RECEIVED]: 'financial',
      [NotificationType.PAYMENT_FAILED]: 'financial',
      [NotificationType.PAYMENT_REFUND]: 'financial',
      [NotificationType.SUBSCRIPTION_EXPIRED]: 'financial',
      [NotificationType.INVOICE_GENERATED]: 'financial',
      [NotificationType.MESSAGE_RECEIVED]: 'communication',
      [NotificationType.REVIEW_RECEIVED]: 'communication',
      [NotificationType.SUPPORT_TICKET]: 'support',
      [NotificationType.MAINTENANCE_NOTICE]: 'system',
      [NotificationType.FEATURE_UPDATE]: 'system',
      [NotificationType.SYSTEM_ALERT]: 'system',
      [NotificationType.CUSTOM]: 'general'
    };

    return categoryMap[type] || 'general';
  }

  private async getTemplate(templateId: string): Promise<any> {
    // Ici, normalement on ferait une requête en base de données
    // Pour l'instant, templates statiques
    const templates: Record<string, any> = {
      welcome: {
        title: 'Bienvenue sur EasyRent !',
        message: 'Bienvenue {{firstName}}, votre compte a été créé avec succès.',
        type: NotificationType.USER_REGISTRATION,
        priority: NotificationPriority.HIGH
      },
      booking_confirmation: {
        title: 'Réservation confirmée',
        message: 'Votre réservation pour {{propertyName}} a été confirmée du {{checkIn}} au {{checkOut}}.',
        type: NotificationType.BOOKING_CONFIRMED,
        priority: NotificationPriority.HIGH
      },
      payment_success: {
        title: 'Paiement confirmé',
        message: 'Votre paiement de {{amount}}€ a été traité avec succès.',
        type: NotificationType.PAYMENT_RECEIVED,
        priority: NotificationPriority.NORMAL
      }
    };

    return templates[templateId];
  }

  private replaceTemplateVariables(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
   * Méthodes publiques pour l'accès aux services individuels
   */
  get email(): EmailNotificationService {
    return this.emailService;
  }

  get sms(): SmsNotificationService {
    return this.smsService;
  }

  get inApp(): InAppNotificationService {
    return this.inAppService;
  }
}