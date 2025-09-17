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

const logger = createLogger('PropertyNotificationService');

export class PropertyNotificationService {
  private notificationManager: NotificationManager;

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager;
  }

  /**
   * Notification broadcast pour nouvelle propriété (comme Instagram)
   * Notifie tous les utilisateurs de l'application
   */
  async sendNewPropertyNotification(property: any): Promise<boolean> {
    try {
      const owner = await User.findById(property.ownerId);
      if (!owner) {
        logger.warn('Propriétaire non trouvé pour nouvelle propriété');
        return false;
      }

      // Récupérer tous les utilisateurs actifs sauf le propriétaire
      const users = await User.find({
        _id: { $ne: property.ownerId },
        isActive: true,
        // Vous pouvez ajouter d'autres filtres ici (préférences de notification, etc.)
      }).select('_id email firstName lastName phoneNumber').limit(500); // Limiter pour éviter le spam

      if (users.length === 0) {
        logger.info('Aucun utilisateur à notifier pour la nouvelle propriété');
        return true;
      }

      const userIds = users.map(user => user._id.toString());

      // Notification broadcast in-app pour tous
      const broadcastNotification: NotificationRequest = {
        userId: userIds,
        type: NotificationType.PROPERTY_PUBLISHED,
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.NORMAL,
        title: 'Nouvelle propriété disponible !',
        message: `${owner.firstName} ${owner.lastName} a publié une nouvelle propriété : "${property.title}" à ${property.area}`,
        data: {
          inApp: {
            userId: userIds,
            title: 'Nouvelle propriété disponible !',
            message: `Nouvelle propriété à ${property.area} - ${property.monthlyRent}€/mois`,
            actionUrl: `/properties/${property._id}`,
            actionLabel: 'Voir la propriété',
            category: 'property',
            icon: 'home',
            image: property.images?.[0]
          }
        },
        metadata: {
          propertyId: property._id.toString(),
          ownerId: property.ownerId.toString(),
          broadcast: true,
          source: 'new_property'
        }
      };

      // Envoyer notification broadcast
      const result = await this.notificationManager.sendNotification(broadcastNotification);

      // Optionnel : Envoyer emails aux utilisateurs premium/intéressés
      await this.sendNewPropertyEmailsToInterestedUsers(property, owner, users);

      logger.info('Notification broadcast nouvelle propriété envoyée', {
        propertyId: property._id,
        ownerId: property.ownerId,
        usersNotified: userIds.length,
        success: result.success
      });

      return result.success;
    } catch (error) {
      logger.error('Erreur envoi notification nouvelle propriété', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        propertyId: property._id
      });
      return false;
    }
  }

  /**
   * Notification pour changement de statut de propriété
   */
  async sendPropertyStatusUpdateNotification(
    property: any,
    oldStatus: string,
    newStatus: string
  ): Promise<boolean> {
    try {
      const owner = await User.findById(property.ownerId);
      if (!owner) return false;

      let notificationType: NotificationType;
      let title: string;
      let message: string;

      switch (newStatus) {
        case 'disponible':
          notificationType = NotificationType.PROPERTY_AVAILABLE;
          title = 'Propriété disponible';
          message = `Votre propriété "${property.title}" est maintenant disponible`;
          break;
        case 'loué':
        case 'vendu':
          notificationType = NotificationType.PROPERTY_RENTED;
          title = newStatus === 'loué' ? 'Propriété louée' : 'Propriété vendue';
          message = `Félicitations ! Votre propriété "${property.title}" a été ${newStatus === 'loué' ? 'louée' : 'vendue'}`;
          break;
        case 'retiré':
          notificationType = NotificationType.PROPERTY_REJECTED;
          title = 'Propriété retirée';
          message = `Votre propriété "${property.title}" a été retirée du marché`;
          break;
        default:
          notificationType = NotificationType.PROPERTY_APPROVED;
          title = 'Statut de propriété mis à jour';
          message = `Le statut de votre propriété "${property.title}" a été mis à jour`;
      }

      const ownerNotification: NotificationRequest = {
        userId: owner._id.toString(),
        type: notificationType,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        priority: NotificationPriority.NORMAL,
        title,
        message,
        data: {
          email: {
            to: owner.email,
            subject: `${title} - EasyRent`,
            templateData: {
              propertyName: property.title,
              ownerName: `${owner.firstName} ${owner.lastName}`,
              oldStatus,
              newStatus,
              propertyUrl: `/properties/${property._id}`,
              dashboardUrl: '/dashboard'
            }
          },
          inApp: {
            userId: owner._id.toString(),
            title,
            message,
            actionUrl: `/properties/${property._id}`,
            actionLabel: 'Voir la propriété',
            category: 'property',
            icon: 'home'
          }
        }
      };

      const result = await this.notificationManager.sendTemplateNotification(
        'property_status_update',
        ownerNotification.data?.email?.templateData || {},
        ownerNotification
      );

      // Si la propriété devient disponible, notifier les utilisateurs intéressés
      if (newStatus === 'disponible') {
        await this.notifyInterestedUsersPropertyAvailable(property);
      }

      logger.info('Notification changement statut propriété envoyée', {
        propertyId: property._id,
        ownerId: property.ownerId,
        oldStatus,
        newStatus,
        success: result.success
      });

      return result.success;
    } catch (error) {
      logger.error('Erreur envoi notification changement statut', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        propertyId: property._id
      });
      return false;
    }
  }

  /**
   * Notification pour propriété similaire disponible
   */
  async sendSimilarPropertyNotification(
    newProperty: any,
    interestedUsers: string[]
  ): Promise<boolean> {
    try {
      if (interestedUsers.length === 0) return true;

      const owner = await User.findById(newProperty.ownerId);
      if (!owner) return false;

      const notification: NotificationRequest = {
        userId: interestedUsers,
        type: NotificationType.PROPERTY_AVAILABLE,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        priority: NotificationPriority.NORMAL,
        title: 'Propriété similaire disponible',
        message: `Une propriété similaire à vos critères est disponible à ${newProperty.area}`,
        data: {
          inApp: {
            userId: interestedUsers,
            title: 'Propriété similaire disponible',
            message: `${newProperty.bedrooms} chambres, ${newProperty.monthlyRent}€/mois à ${newProperty.area}`,
            actionUrl: `/properties/${newProperty._id}`,
            actionLabel: 'Voir la propriété',
            category: 'property',
            icon: 'heart',
            image: newProperty.images?.[0]
          }
        }
      };

      const result = await this.notificationManager.sendNotification(notification);

      logger.info('Notification propriété similaire envoyée', {
        propertyId: newProperty._id,
        usersNotified: interestedUsers.length,
        success: result.success
      });

      return result.success;
    } catch (error) {
      logger.error('Erreur envoi notification propriété similaire', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  /**
   * Notification pour baisse de prix
   */
  async sendPriceDropNotification(
    property: any,
    oldPrice: number,
    newPrice: number
  ): Promise<boolean> {
    try {
      // Récupérer les utilisateurs qui ont sauvegardé cette propriété ou des similaires
      const interestedUsers = await this.getInterestedUsers(property);

      if (interestedUsers.length === 0) return true;

      const percentageDecrease = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

      const notification: NotificationRequest = {
        userId: interestedUsers,
        type: NotificationType.PROPERTY_AVAILABLE,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        priority: NotificationPriority.HIGH,
        title: 'Baisse de prix !',
        message: `Le prix de "${property.title}" a baissé de ${percentageDecrease}% !`,
        data: {
          email: {
            to: '', // Will be set for each user
            subject: 'Baisse de prix sur une propriété qui vous intéresse - EasyRent',
            templateData: {
              propertyName: property.title,
              oldPrice,
              newPrice,
              percentageDecrease,
              area: property.area,
              propertyUrl: `/properties/${property._id}`
            }
          },
          inApp: {
            userId: interestedUsers,
            title: `Baisse de prix - ${percentageDecrease}% !`,
            message: `${property.title} - Maintenant ${newPrice}€/mois (était ${oldPrice}€)`,
            actionUrl: `/properties/${property._id}`,
            actionLabel: 'Voir l\'offre',
            category: 'property',
            icon: 'trending-down'
          }
        }
      };

      const result = await this.notificationManager.sendTemplateNotification(
        'price_drop',
        notification.data?.email?.templateData || {},
        notification
      );

      logger.info('Notification baisse de prix envoyée', {
        propertyId: property._id,
        oldPrice,
        newPrice,
        percentageDecrease,
        usersNotified: interestedUsers.length,
        success: result.success
      });

      return result.success;
    } catch (error) {
      logger.error('Erreur envoi notification baisse de prix', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        propertyId: property._id
      });
      return false;
    }
  }

  /**
   * Notification pour nouvelles propriétés dans une zone
   */
  async sendNewPropertyInAreaNotification(property: any): Promise<boolean> {
    try {
      // Récupérer les utilisateurs qui recherchent dans cette zone
      const interestedUsers = await User.find({
        'searchPreferences.areas': property.area,
        isActive: true,
        _id: { $ne: property.ownerId }
      }).select('_id email firstName lastName');

      if (interestedUsers.length === 0) return true;

      const userIds = interestedUsers.map(user => user._id.toString());

      const notification: NotificationRequest = {
        userId: userIds,
        type: NotificationType.PROPERTY_PUBLISHED,
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.NORMAL,
        title: `Nouvelle propriété à ${property.area}`,
        message: `Une nouvelle propriété correspond à vos critères de recherche`,
        data: {
          inApp: {
            userId: userIds,
            title: `Nouvelle propriété à ${property.area}`,
            message: `${property.bedrooms} chambres - ${property.monthlyRent}€/mois`,
            actionUrl: `/properties/${property._id}`,
            actionLabel: 'Découvrir',
            category: 'property',
            icon: 'map-pin'
          }
        }
      };

      const result = await this.notificationManager.sendNotification(notification);

      logger.info('Notification nouvelle propriété dans zone envoyée', {
        propertyId: property._id,
        area: property.area,
        usersNotified: userIds.length,
        success: result.success
      });

      return result.success;
    } catch (error) {
      logger.error('Erreur envoi notification nouvelle propriété zone', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  /**
   * Envoyer des emails aux utilisateurs intéressés pour nouvelle propriété
   */
  private async sendNewPropertyEmailsToInterestedUsers(
    property: any,
    owner: any,
    users: any[]
  ): Promise<void> {
    try {
      // Filtrer les utilisateurs qui ont activé les notifications email
      const emailUsers = users.filter(user =>
        user.notificationPreferences?.newProperties !== false && user.email
      );

      if (emailUsers.length === 0) return;

      // Envoyer en batch de 50 pour éviter de surcharger
      const batchSize = 50;
      for (let i = 0; i < emailUsers.length; i += batchSize) {
        const batch = emailUsers.slice(i, i + batchSize);

        const emailPromises = batch.map(user =>
          this.notificationManager.email.sendTemplateEmail(
            'new_property_alert',
            {
              to: user.email,
              subject: `Nouvelle propriété à ${property.area} - EasyRent`,
              templateData: {
                userName: `${user.firstName} ${user.lastName}`,
                propertyName: property.title,
                ownerName: `${owner.firstName} ${owner.lastName}`,
                area: property.area,
                price: property.monthlyRent,
                bedrooms: property.bedrooms,
                surface: property.surface,
                propertyUrl: `/properties/${property._id}`,
                unsubscribeUrl: `/unsubscribe/${user._id}`
              }
            },
            user._id.toString()
          )
        );

        await Promise.all(emailPromises);

        // Petit délai entre les batches
        if (i + batchSize < emailUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info('Emails nouvelle propriété envoyés', {
        propertyId: property._id,
        emailsSent: emailUsers.length
      });
    } catch (error) {
      logger.error('Erreur envoi emails nouvelle propriété', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }

  /**
   * Notifier les utilisateurs intéressés qu'une propriété est disponible
   */
  private async notifyInterestedUsersPropertyAvailable(property: any): Promise<void> {
    try {
      const interestedUsers = await this.getInterestedUsers(property);

      if (interestedUsers.length === 0) return;

      const notification: NotificationRequest = {
        userId: interestedUsers,
        type: NotificationType.PROPERTY_AVAILABLE,
        channels: [NotificationChannel.IN_APP],
        priority: NotificationPriority.NORMAL,
        title: 'Propriété de nouveau disponible',
        message: `"${property.title}" est de nouveau disponible !`,
        data: {
          inApp: {
            userId: interestedUsers,
            title: 'Propriété disponible',
            message: `"${property.title}" à ${property.area}`,
            actionUrl: `/properties/${property._id}`,
            actionLabel: 'Voir maintenant',
            category: 'property',
            icon: 'refresh-cw'
          }
        }
      };

      await this.notificationManager.sendNotification(notification);
    } catch (error) {
      logger.error('Erreur notification propriété disponible', { error });
    }
  }

  /**
   * Récupérer les utilisateurs intéressés par une propriété
   */
  private async getInterestedUsers(property: any): Promise<string[]> {
    try {
      // Ici vous pourriez implémenter un système de favoris/recherches sauvegardées
      // Pour l'instant, on cherche par critères similaires
      const users = await User.find({
        _id: { $ne: property.ownerId },
        isActive: true,
        $or: [
          { 'searchPreferences.areas': property.area },
          {
            'searchPreferences.maxRent': { $gte: property.monthlyRent },
            'searchPreferences.minRent': { $lte: property.monthlyRent }
          },
          { 'searchPreferences.minBedrooms': { $lte: property.bedrooms } }
        ]
      }).select('_id').limit(100);

      return users.map(user => user._id.toString());
    } catch (error) {
      logger.error('Erreur récupération utilisateurs intéressés', { error });
      return [];
    }
  }

  /**
   * Planifier des notifications de propriétés
   */
  async schedulePropertyReminders(property: any): Promise<void> {
    try {
      // Rappel au propriétaire si pas d'activité après 7 jours
      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + 7);

      await this.notificationManager.scheduleNotification(
        {
          userId: property.ownerId.toString(),
          type: NotificationType.SYSTEM_ALERT,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
          title: 'Boostez votre propriété',
          message: 'Votre propriété n\'a pas eu d\'activité récente. Voulez-vous la mettre en avant ?',
          data: {
            inApp: {
              userId: property.ownerId.toString(),
              title: 'Boostez votre propriété',
              message: 'Augmentez la visibilité de votre annonce',
              actionUrl: `/properties/${property._id}/boost`,
              actionLabel: 'Booster',
              category: 'property'
            }
          },
          metadata: {
            propertyId: property._id.toString(),
            reminderType: 'boost'
          }
        },
        reminderDate
      );
    } catch (error) {
      logger.error('Erreur planification rappels propriété', { error });
    }
  }
}