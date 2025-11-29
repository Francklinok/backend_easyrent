import { IntegratedNotificationService } from '../../notification/services/IntegratedNotificationService';
import { createLogger } from '../../utils/logger/logger';
import User from '../../users/models/userModel';
import Property from '../../property/model/propertyModel';
import { Types } from 'mongoose';

const logger = createLogger('ActivityNotificationService');

export class ActivityNotificationService {
  private notificationService: IntegratedNotificationService;

  constructor(io: any) {
    this.notificationService = new IntegratedNotificationService(io);
  }

  async sendVisitRequestNotifications(activity: any, property: any, client: any) {
    try {
      const owner = await User.findById(property.ownerId);
      if (!owner) return;

      // Notification au propriétaire
      await this.notificationService.sendNotification({
        userId: owner._id.toString(),
        type: 'both',
        push: {
          notification: {
            title: '🏠 Nouvelle demande de visite',
            body: `${client.firstName} ${client.lastName} souhaite visiter "${property.title}"`,
            data: {
              type: 'visit_request',
              activityId: activity._id.toString(),
              propertyId: property._id.toString(),
              clientId: client._id.toString()
            }
          }
        },
        priority: 'high'
      });

      // Notification in-app au propriétaire
      await this.notificationService.createInAppNotification({
        userId: owner._id.toString(),
        title: 'Nouvelle demande de visite',
        message: `${client.firstName} ${client.lastName} souhaite visiter votre propriété "${property.title}"`,
        type: 'visit_request',
        data: {
          activityId: activity._id.toString(),
          propertyId: property._id.toString(),
          clientId: client._id.toString()
        }
      });

      // Notification de confirmation au client
      await this.notificationService.sendNotification({
        userId: client._id.toString(),
        type: 'both',
        push: {
          notification: {
            title: '✅ Demande de visite envoyée',
            body: `Votre demande de visite pour "${property.title}" a été envoyée au propriétaire`,
            data: {
              type: 'visit_confirmation',
              activityId: activity._id.toString(),
              propertyId: property._id.toString()
            }
          }
        },
        priority: 'normal'
      });

      await this.notificationService.createInAppNotification({
        userId: client._id.toString(),
        title: 'Demande de visite envoyée',
        message: `Votre demande de visite pour "${property.title}" a été envoyée. Vous recevrez une réponse bientôt.`,
        type: 'visit_confirmation',
        data: {
          activityId: activity._id.toString(),
          propertyId: property._id.toString()
        }
      });

    } catch (error) {
      logger.error('Erreur envoi notifications demande visite:', error);
    }
  }

  async sendVisitResponseNotifications(activity: any, isAccepted: boolean) {
    try {
      const [property, client] = await Promise.all([
        Property.findById(activity.propertyId),
        User.findById(activity.clientId)
      ]);

      if (!property || !client) return;

      const status = isAccepted ? 'acceptée' : 'refusée';
      const emoji = isAccepted ? '✅' : '❌';

      // Notification au client
      await this.notificationService.sendNotification({
        userId: client._id.toString(),
        type: 'both',
        push: {
          notification: {
            title: `${emoji} Visite ${status}`,
            body: `Votre demande de visite pour "${property.title}" a été ${status}`,
            data: {
              type: 'visit_response',
              activityId: activity._id.toString(),
              propertyId: property._id.toString(),
              accepted: isAccepted
            }
          }
        },
        priority: 'high'
      });

      await this.notificationService.createInAppNotification({
        userId: client._id.toString(),
        title: `Visite ${status}`,
        message: `Votre demande de visite pour "${property.title}" a été ${status} par le propriétaire`,
        type: 'visit_response',
        data: {
          activityId: activity._id.toString(),
          propertyId: property._id.toString(),
          accepted: isAccepted
        }
      });

    } catch (error) {
      logger.error('Erreur envoi notifications réponse visite:', error);
    }
  }

  async sendReservationRequestNotifications(activity: any, property: any, client: any) {
    try {
      const owner = await User.findById(property.ownerId);
      if (!owner) return;

      // Notification au propriétaire
      await this.notificationService.sendNotification({
        userId: owner._id.toString(),
        type: 'both',
        push: {
          notification: {
            title: '🏠 Nouvelle demande de réservation',
            body: `${client.firstName} ${client.lastName} souhaite réserver "${property.title}"`,
            data: {
              type: 'reservation_request',
              activityId: activity._id.toString(),
              propertyId: property._id.toString(),
              clientId: client._id.toString()
            }
          }
        },
        priority: 'high'
      });

      await this.notificationService.createInAppNotification({
        userId: owner._id.toString(),
        title: 'Nouvelle demande de réservation',
        message: `${client.firstName} ${client.lastName} souhaite réserver votre propriété "${property.title}"`,
        type: 'reservation_request',
        data: {
          activityId: activity._id.toString(),
          propertyId: property._id.toString(),
          clientId: client._id.toString()
        }
      });

      // Confirmation au client
      await this.notificationService.sendNotification({
        userId: client._id.toString(),
        type: 'both',
        push: {
          notification: {
            title: '✅ Demande de réservation envoyée',
            body: `Votre demande de réservation pour "${property.title}" a été envoyée`,
            data: {
              type: 'reservation_confirmation',
              activityId: activity._id.toString(),
              propertyId: property._id.toString()
            }
          }
        },
        priority: 'normal'
      });

      await this.notificationService.createInAppNotification({
        userId: client._id.toString(),
        title: 'Demande de réservation envoyée',
        message: `Votre demande de réservation pour "${property.title}" a été envoyée au propriétaire`,
        type: 'reservation_confirmation',
        data: {
          activityId: activity._id.toString(),
          propertyId: property._id.toString()
        }
      });

    } catch (error) {
      logger.error('Erreur envoi notifications demande réservation:', error);
    }
  }

  async sendReservationResponseNotifications(activity: any, isAccepted: boolean, reason?: string) {
    try {
      const [property, client] = await Promise.all([
        Property.findById(activity.propertyId),
        User.findById(activity.clientId)
      ]);

      if (!property || !client) return;

      const status = isAccepted ? 'acceptée' : 'refusée';
      const emoji = isAccepted ? '✅' : '❌';
      const message = isAccepted 
        ? `Votre réservation pour "${property.title}" a été acceptée ! Vous pouvez procéder au paiement.`
        : `Votre réservation pour "${property.title}" a été refusée. ${reason ? `Raison: ${reason}` : ''}`;

      await this.notificationService.sendNotification({
        userId: client._id.toString(),
        type: 'both',
        push: {
          notification: {
            title: `${emoji} Réservation ${status}`,
            body: message,
            data: {
              type: 'reservation_response',
              activityId: activity._id.toString(),
              propertyId: property._id.toString(),
              accepted: isAccepted
            }
          }
        },
        priority: 'high'
      });

      await this.notificationService.createInAppNotification({
        userId: client._id.toString(),
        title: `Réservation ${status}`,
        message,
        type: 'reservation_response',
        data: {
          activityId: activity._id.toString(),
          propertyId: property._id.toString(),
          accepted: isAccepted
        }
      });

    } catch (error) {
      logger.error('Erreur envoi notifications réponse réservation:', error);
    }
  }

  async sendPaymentNotifications(activity: any) {
    try {
      const [property, client, owner] = await Promise.all([
        Property.findById(activity.propertyId),
        User.findById(activity.clientId),
        Property.findById(activity.propertyId).then(p => p ? User.findById(p.ownerId) : null)
      ]);

      if (!property || !client || !owner) return;

      // Notification au client
      await this.notificationService.sendNotification({
        userId: client._id.toString(),
        type: 'both',
        push: {
          notification: {
            title: '💰 Paiement confirmé',
            body: `Votre paiement pour "${property.title}" a été confirmé`,
            data: {
              type: 'payment_confirmed',
              activityId: activity._id.toString(),
              propertyId: property._id.toString(),
              amount: activity.amount
            }
          }
        },
        priority: 'high'
      });

      await this.notificationService.createInAppNotification({
        userId: client._id.toString(),
        title: 'Paiement confirmé',
        message: `Votre paiement de ${activity.amount}€ pour "${property.title}" a été confirmé avec succès`,
        type: 'payment_confirmed',
        data: {
          activityId: activity._id.toString(),
          propertyId: property._id.toString(),
          amount: activity.amount
        }
      });

      // Notification au propriétaire
      await this.notificationService.sendNotification({
        userId: owner._id.toString(),
        type: 'both',
        push: {
          notification: {
            title: '💰 Paiement reçu',
            body: `Paiement de ${activity.amount}€ reçu pour "${property.title}"`,
            data: {
              type: 'payment_received',
              activityId: activity._id.toString(),
              propertyId: property._id.toString(),
              amount: activity.amount,
              clientId: client._id.toString()
            }
          }
        },
        priority: 'high'
      });

      await this.notificationService.createInAppNotification({
        userId: owner._id.toString(),
        title: 'Paiement reçu',
        message: `Vous avez reçu un paiement de ${activity.amount}€ de ${client.firstName} ${client.lastName} pour "${property.title}"`,
        type: 'payment_received',
        data: {
          activityId: activity._id.toString(),
          propertyId: property._id.toString(),
          amount: activity.amount,
          clientId: client._id.toString()
        }
      });

    } catch (error) {
      logger.error('Erreur envoi notifications paiement:', error);
    }
  }
}

export default ActivityNotificationService;