import { NotificationManager } from './NotificationManager';
import {
  NotificationChannel,
  NotificationType,
  NotificationPriority,
  NotificationRequest
} from '../types/notificationTypes';
import { createLogger } from '../../utils/logger/logger';
import User from '../../users/models/userModel';
import Property from '../../property/model/propertyModel';
import { Types } from 'mongoose';

const logger = createLogger('ActivityNotificationService');

export class ActivityNotificationService {
  private notificationManager: NotificationManager;

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager;
  }

  /**
   * Notification pour demande de visite
   */
  async sendVisitRequestNotification(activity: any): Promise<boolean> {
    try {
      const [property, client] = await Promise.all([
        Property.findById(activity.propertyId).populate('ownerId'),
        User.findById(activity.clientId)
      ]);

      if (!property || !client) {
        logger.warn('Propriété ou client non trouvé pour notification de visite');
        return false;
      }

      // Notification in-app + email pour le propriétaire
      const owner = property.ownerId as any;
      const ownerNotification: NotificationRequest = {
        userId: owner._id.toString(),
        type: NotificationType.VISIT_SCHEDULED,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        priority: NotificationPriority.HIGH,
        title: 'Nouvelle demande de visite',
        message: `${client.firstName} ${client.lastName} souhaite visiter votre propriété "${property.title}"`,
        data: {
          email: {
            to: owner.email,
            subject: 'Nouvelle demande de visite - EasyRent',
            templateData: {
              propertyName: property.title,
              clientName: `${client.firstName} ${client.lastName}`,
              visitDate: activity.visitDate,
              message: activity.message,
              propertyUrl: `/properties/${property._id}`,
              activityUrl: `/activities/${activity._id}`
            }
          },
          inApp: {
            userId: owner._id.toString(),
            title: 'Nouvelle demande de visite',
            message: `${client.firstName} ${client.lastName} souhaite visiter "${property.title}"`,
            actionUrl: `/activities/${activity._id}`,
            actionLabel: 'Voir la demande',
            category: 'visit',
            icon: 'calendar'
          }
        },
        metadata: {
          activityId: activity._id
        } as any
      };

      const result = await this.notificationManager.sendTemplateNotification(
        'visit_request',
        ownerNotification.data?.email?.templateData || {},
        ownerNotification
      );

      logger.info('Notification de demande de visite envoyée', {
        propertyId: property._id,
        ownerId: owner._id,
        clientId: client._id,
        success: result.success
      });

      return result.success;
    } catch (error) {
      logger.error('Erreur envoi notification demande de visite', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        activityId: activity._id
      });
      return false;
    }
  }

  /**
   * Notification pour acceptation/refus de visite
   */
  async sendVisitResponseNotification(
    activity: any,
    isAccepted: boolean,
    reason?: string
  ): Promise<boolean> {
    try {
      const [property, client] = await Promise.all([
        Property.findById(activity.propertyId),
        User.findById(activity.clientId)
      ]);

      if (!property || !client) {
        logger.warn('Propriété ou client non trouvé pour notification de réponse visite');
        return false;
      }

      const notificationType = isAccepted
        ? NotificationType.VISIT_SCHEDULED
        : NotificationType.VISIT_CANCELLED;

      const title = isAccepted
        ? 'Visite acceptée !'
        : 'Visite refusée';

      const message = isAccepted
        ? `Votre demande de visite pour "${property.title}" a été acceptée`
        : `Votre demande de visite pour "${property.title}" a été refusée`;

      // Notification in-app + email + SMS pour le client
      const clientNotification: NotificationRequest = {
        userId: client._id.toString(),
        type: notificationType,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
        priority: NotificationPriority.HIGH,
        title,
        message,
        data: {
          email: {
            to: client.email,
            subject: `${title} - EasyRent`,
            templateData: {
              propertyName: property.title,
              clientName: `${client.firstName} ${client.lastName}`,
              isAccepted,
              reason,
              visitDate: activity.visitDate,
              propertyUrl: `/properties/${property._id}`,
              activityUrl: `/activities/${activity._id}`
            }
          },
          sms: client.phoneNumber ? {
            to: client.phoneNumber,
            message: `EasyRent: ${message}. ${isAccepted ? 'Détails sur votre compte.' : reason || ''}`
          } : undefined,
          inApp: {
            userId: client._id.toString(),
            title,
            message,
            actionUrl: `/activities/${activity._id}`,
            actionLabel: 'Voir détails',
            category: 'visit',
            icon: isAccepted ? 'check-circle' : 'x-circle'
          }
        },
        metadata: {
          activityId: activity._id
        } as any
      };

      const templateId = isAccepted ? 'visit_accepted' : 'visit_rejected';
      const result = await this.notificationManager.sendTemplateNotification(
        templateId,
        clientNotification.data?.email?.templateData || {},
        clientNotification
      );

      logger.info('Notification de réponse visite envoyée', {
        propertyId: property._id,
        clientId: client._id,
        isAccepted,
        success: result.success
      });

      return result.success;
    } catch (error) {
      logger.error('Erreur envoi notification réponse visite', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        activityId: activity._id,
        isAccepted
      });
      return false;
    }
  }

  /**
   * Notification pour demande de réservation
   */
  async sendReservationRequestNotification(activity: any): Promise<boolean> {
    try {
      const [property, client] = await Promise.all([
        Property.findById(activity.propertyId).populate('ownerId'),
        User.findById(activity.clientId)
      ]);

      if (!property || !client) {
        logger.warn('Propriété ou client non trouvé pour notification de réservation');
        return false;
      }

      const owner = property.ownerId as any;
      const ownerNotification: NotificationRequest = {
        userId: owner._id.toString(),
        type: NotificationType.BOOKING_REQUEST,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        priority: NotificationPriority.HIGH,
        title: 'Nouvelle demande de réservation',
        message: `${client.firstName} ${client.lastName} souhaite réserver votre propriété "${property.title}"`,
        data: {
          email: {
            to: owner.email,
            subject: 'Nouvelle demande de réservation - EasyRent',
            templateData: {
              propertyName: property.title,
              clientName: `${client.firstName} ${client.lastName}`,
              reservationDate: activity.reservationDate,
              documentsUploaded: activity.documentsUploaded,
              amount: property.ownerCriteria?.depositAmount || property.monthlyRent,
              propertyUrl: `/properties/${property._id}`,
              activityUrl: `/activities/${activity._id}`
            }
          },
          inApp: {
            userId: owner._id.toString(),
            title: 'Nouvelle demande de réservation',
            message: `${client.firstName} ${client.lastName} souhaite réserver "${property.title}"`,
            actionUrl: `/activities/${activity._id}`,
            actionLabel: 'Examiner la demande',
            category: 'reservation',
            icon: 'home'
          }
        },
        metadata: {
          activityId: activity._id
        } as any
      };

      const result = await this.notificationManager.sendTemplateNotification(
        'reservation_request',
        ownerNotification.data?.email?.templateData || {},
        ownerNotification
      );

      logger.info('Notification de demande de réservation envoyée', {
        propertyId: property._id,
        ownerId: owner._id,
        clientId: client._id,
        success: result.success
      });

      return result.success;
    } catch (error) {
      logger.error('Erreur envoi notification demande de réservation', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        activityId: activity._id
      });
      return false;
    }
  }

  /**
   * Notification pour acceptation/refus de réservation
   */
  async sendReservationResponseNotification(
    activity: any,
    isAccepted: boolean,
    reason?: string
  ): Promise<boolean> {
    try {
      const [property, client] = await Promise.all([
        Property.findById(activity.propertyId),
        User.findById(activity.clientId)
      ]);

      if (!property || !client) {
        logger.warn('Propriété ou client non trouvé pour notification de réponse réservation');
        return false;
      }

      const notificationType = isAccepted
        ? NotificationType.BOOKING_CONFIRMED
        : NotificationType.BOOKING_CANCELLED;

      const title = isAccepted
        ? 'Réservation acceptée !'
        : 'Réservation refusée';

      const message = isAccepted
        ? `Votre réservation pour "${property.title}" a été acceptée. Vous pouvez procéder au paiement.`
        : `Votre réservation pour "${property.title}" a été refusée`;

      const clientNotification: NotificationRequest = {
        userId: client._id.toString(),
        type: notificationType,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
        priority: NotificationPriority.HIGH,
        title,
        message,
        data: {
          email: {
            to: client.email,
            subject: `${title} - EasyRent`,
            templateData: {
              propertyName: property.title,
              clientName: `${client.firstName} ${client.lastName}`,
              isAccepted,
              reason,
              reservationDate: activity.reservationDate,
              amount: property.ownerCriteria?.depositAmount || property.monthlyRent,
              propertyUrl: `/properties/${property._id}`,
              activityUrl: `/activities/${activity._id}`,
              paymentUrl: isAccepted ? `/payment/${activity._id}` : undefined
            }
          },
          sms: client.phoneNumber ? {
            to: client.phoneNumber,
            message: `EasyRent: ${message}. ${isAccepted ? 'Procédez au paiement sur votre compte.' : reason || ''}`
          } : undefined,
          inApp: {
            userId: client._id.toString(),
            title,
            message,
            actionUrl: isAccepted ? `/payment/${activity._id}` : `/activities/${activity._id}`,
            actionLabel: isAccepted ? 'Procéder au paiement' : 'Voir détails',
            category: 'reservation',
            icon: isAccepted ? 'credit-card' : 'x-circle'
          }
        }
      };

      const templateId = isAccepted ? 'reservation_accepted' : 'reservation_rejected';
      const result = await this.notificationManager.sendTemplateNotification(
        templateId,
        clientNotification.data?.email?.templateData || {},
        clientNotification
      );

      logger.info('Notification de réponse réservation envoyée', {
        propertyId: property._id,
        clientId: client._id,
        isAccepted,
        success: result.success
      });

      return result.success;
    } catch (error) {
      logger.error('Erreur envoi notification réponse réservation', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        activityId: activity._id,
        isAccepted
      });
      return false;
    }
  }

  /**
   * Notification pour paiement effectué
   */
  async sendPaymentNotification(activity: any): Promise<boolean> {
    try {
      const [property, client] = await Promise.all([
        Property.findById(activity.propertyId).populate('ownerId'),
        User.findById(activity.clientId)
      ]);

      if (!property || !client) {
        logger.warn('Propriété ou client non trouvé pour notification de paiement');
        return false;
      }

      // Notification au propriétaire
      const owner = property.ownerId as any;
      const ownerNotification: NotificationRequest = {
        userId: owner._id.toString(),
        type: NotificationType.PAYMENT_RECEIVED,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        priority: NotificationPriority.HIGH,
        title: 'Paiement reçu',
        message: `Paiement de ${activity.amount}€ reçu pour "${property.title}"`,
        data: {
          email: {
            to: owner.email,
            subject: 'Paiement reçu - EasyRent',
            templateData: {
              propertyName: property.title,
              clientName: `${client.firstName} ${client.lastName}`,
              amount: activity.amount,
              paymentDate: activity.payementDate,
              reference: activity._id,
              propertyUrl: `/properties/${property._id}`,
              activityUrl: `/activities/${activity._id}`
            }
          },
          inApp: {
            userId: owner._id.toString(),
            title: 'Paiement reçu',
            message: `Paiement de ${activity.amount}€ reçu de ${client.firstName} ${client.lastName}`,
            actionUrl: `/activities/${activity._id}`,
            actionLabel: 'Voir détails',
            category: 'payment',
            icon: 'dollar-sign'
          }
        }
      };

      // Notification au client (confirmation)
      const clientNotification: NotificationRequest = {
        userId: client._id.toString(),
        type: NotificationType.PAYMENT_RECEIVED,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
        priority: NotificationPriority.HIGH,
        title: 'Paiement confirmé',
        message: `Votre paiement de ${activity.amount}€ a été confirmé pour "${property.title}"`,
        data: {
          email: {
            to: client.email,
            subject: 'Paiement confirmé - EasyRent',
            templateData: {
              propertyName: property.title,
              clientName: `${client.firstName} ${client.lastName}`,
              amount: activity.amount,
              paymentDate: activity.payementDate,
              reference: activity._id,
              propertyUrl: `/properties/${property._id}`,
              invoiceUrl: `/invoice/${activity._id}`
            }
          },
          sms: client.phoneNumber ? {
            to: client.phoneNumber,
            message: `EasyRent: Paiement de ${activity.amount}€ confirmé pour ${property.title}. Réf: ${activity._id}`
          } : undefined,
          inApp: {
            userId: client._id.toString(),
            title: 'Paiement confirmé',
            message: `Votre paiement de ${activity.amount}€ a été confirmé`,
            actionUrl: `/invoice/${activity._id}`,
            actionLabel: 'Télécharger facture',
            category: 'payment',
            icon: 'check-circle'
          }
        }
      };

      // Envoyer les deux notifications en parallèle
      const [ownerResult, clientResult] = await Promise.all([
        this.notificationManager.sendTemplateNotification(
          'payment_received_owner',
          ownerNotification.data?.email?.templateData || {},
          ownerNotification
        ),
        this.notificationManager.sendTemplateNotification(
          'payment_confirmed_client',
          clientNotification.data?.email?.templateData || {},
          clientNotification
        )
      ]);

      logger.info('Notifications de paiement envoyées', {
        propertyId: property._id,
        ownerId: owner._id,
        clientId: client._id,
        amount: activity.amount,
        ownerSuccess: ownerResult.success,
        clientSuccess: clientResult.success
      });

      return ownerResult.success && clientResult.success;
    } catch (error) {
      logger.error('Erreur envoi notifications de paiement', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        activityId: activity._id
      });
      return false;
    }
  }

  /**
   * Notification de rappel de paiement
   */
  async sendPaymentReminderNotification(activity: any): Promise<boolean> {
    try {
      const [property, client] = await Promise.all([
        Property.findById(activity.propertyId),
        User.findById(activity.clientId)
      ]);

      if (!property || !client) return false;

      const daysLeft = Math.ceil((new Date(activity.reservationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      const clientNotification: NotificationRequest = {
        userId: client._id.toString(),
        type: NotificationType.PAYMENT_FAILED,
        channels: [NotificationChannel.IN_APP, NotificationChannel.SMS, NotificationChannel.EMAIL],
        priority: NotificationPriority.HIGH,
        title: 'Rappel de paiement',
        message: `N'oubliez pas de payer votre réservation pour "${property.title}"`,
        data: {
          email: {
            to: client.email,
            subject: 'Rappel de paiement - EasyRent',
            templateData: {
              propertyName: property.title,
              clientName: `${client.firstName} ${client.lastName}`,
              amount: property.ownerCriteria?.depositAmount || property.monthlyRent,
              daysLeft,
              paymentUrl: `/payment/${activity._id}`
            }
          },
          sms: client.phoneNumber ? {
            to: client.phoneNumber,
            message: `EasyRent: Rappel - Paiement de ${property.ownerCriteria?.depositAmount || property.monthlyRent}€ requis pour ${property.title}. ${daysLeft} jour(s) restant(s).`
          } : undefined,
          inApp: {
            userId: client._id.toString(),
            title: 'Rappel de paiement',
            message: `Paiement en attente pour "${property.title}"`,
            actionUrl: `/payment/${activity._id}`,
            actionLabel: 'Payer maintenant',
            category: 'payment',
            icon: 'clock'
          }
        }
      };

      const result = await this.notificationManager.sendTemplateNotification(
        'payment_reminder',
        clientNotification.data?.email?.templateData || {},
        clientNotification
      );

      return result.success;
    } catch (error) {
      logger.error('Erreur envoi rappel de paiement', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        activityId: activity._id
      });
      return false;
    }
  }

  /**
   * Planifier les notifications de rappel
   */
  async scheduleActivityReminders(activity: any): Promise<void> {
    try {
      // Rappel de paiement 24h avant expiration de la réservation
      if (activity.isReservationAccepted && !activity.isPayment) {
        const reminderDate = new Date(activity.reservationDate);
        reminderDate.setDate(reminderDate.getDate() - 1); // 24h avant

        if (reminderDate > new Date()) {
          await this.notificationManager.scheduleNotification(
            {
              userId: activity.clientId.toString(),
              type: NotificationType.PAYMENT_FAILED,
              channels: [NotificationChannel.IN_APP, NotificationChannel.SMS],
              title: 'Rappel de paiement',
              message: 'N\'oubliez pas de payer votre réservation',
              metadata: {
                activityId: activity._id.toString(),
                reminderType: 'payment'
              }
            },
            reminderDate
          );
        }
      }

      // Rappel de visite 2h avant
      if (activity.isVisitAccepted && activity.visitDate) {
        const visitReminderDate = new Date(activity.visitDate);
        visitReminderDate.setHours(visitReminderDate.getHours() - 2); // 2h avant

        if (visitReminderDate > new Date()) {
          await this.notificationManager.scheduleNotification(
            {
              userId: activity.clientId.toString(),
              type: NotificationType.VISIT_REMINDER,
              channels: [NotificationChannel.IN_APP, NotificationChannel.SMS],
              title: 'Rappel de visite',
              message: 'Votre visite commence dans 2 heures',
              metadata: {
                activityId: activity._id.toString(),
                reminderType: 'visit'
              }
            },
            visitReminderDate
          );
        }
      }
    } catch (error) {
      logger.error('Erreur planification des rappels d\'activité', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        activityId: activity._id
      });
    }
  }

  /**
   * Obtenir les followers d'un utilisateur (pour les propriétés)
   */
  private async getUserFollowers(userId: string): Promise<string[]> {
    try {
      // Ici vous pourriez implémenter un système de follow
      // Pour l'instant, on retourne tous les utilisateurs actifs
      const users = await User.find({
        _id: { $ne: userId },
        isActive: true
      }).limit(100).select('_id');

      return users.map(user => user._id.toString());
    } catch (error) {
      logger.error('Erreur récupération followers', { error });
      return [];
    }
  }
}