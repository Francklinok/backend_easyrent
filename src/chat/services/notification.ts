
// services/notificationService.js
import webpush from 'web-push';
import admin from 'firebase-admin';
import User from '../model/userModel';
import NotificationPreference from '../model/notificationPreferenceModel';

class pushNotiifcation {
  constructor() {
    this.setupWebPush();
    this.setupFirebase();
  }

  setupWebPush() {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }

  setupFirebase() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
    }
  }

  /**
   * Envoie des notifications pour un nouveau message
   */
  async sendMessageNotifications(message, conversation) {
    try {
      const sender = await User.findById(message.senderId).select('name avatar');
      
      // Récupérer tous les participants sauf l'expéditeur
      const recipients = conversation.participants.filter(
        p => p.toString() !== message.senderId.toString()
      );

      // Traiter les notifications pour chaque destinataire
      await Promise.all(
        recipients.map(recipientId => 
          this.processRecipientNotification(recipientId, message, sender, conversation)
        )
      );

    } catch (error) {
      console.error('Erreur lors de l\'envoi des notifications:', error);
    }
  }

  /**
   * Traite les notifications pour un destinataire spécifique
   */
  async processRecipientNotification(recipientId, message, sender, conversation) {
    try {
      const recipient = await User.findById(recipientId).select('isOnline lastSeen fcmTokens webPushSubscriptions');
      const preferences = await NotificationPreference.findOne({ userId: recipientId });

      // Vérifier si les notifications sont activées
      if (!this.shouldSendNotification(preferences, message.messageType, recipient.isOnline)) {
        return;
      }

      const notificationData = this.buildNotificationData(message, sender, conversation);

      // Envoyer selon les canaux préférés
      const promises = [];

      // Push notifications mobiles (FCM)
      if (recipient.fcmTokens && recipient.fcmTokens.length > 0) {
        promises.push(this.sendFCMNotification(recipient.fcmTokens, notificationData));
      }

      // Web push notifications
      if (recipient.webPushSubscriptions && recipient.webPushSubscriptions.length > 0) {
        promises.push(this.sendWebPushNotification(recipient.webPushSubscriptions, notificationData));
      }

      // Email notifications (si l'utilisateur est hors ligne depuis longtemps)
      if (this.shouldSendEmailNotification(recipient, preferences)) {
        promises.push(this.sendEmailNotification(recipient.email, notificationData));
      }

      await Promise.allSettled(promises);

    } catch (error) {
      console.error(`Erreur notification pour ${recipientId}:`, error);
    }
  }

  /**
   * Construit les données de notification
   */
  buildNotificationData(message, sender, conversation) {
    const isGroup = conversation.type === 'group';
    let title, body, icon;

    switch (message.messageType) {
      case 'text':
        title = isGroup ? `${sender.name} dans ${conversation.name}` : sender.name;
        body = message.content.length > 100 
          ? message.content.substring(0, 100) + '...' 
          : message.content;
        break;
      
      case 'image':
        title = isGroup ? `${sender.name} dans ${conversation.name}` : sender.name;
        body = '📷 A envoyé une image';
        break;
      
      case 'video':
        title = isGroup ? `${sender.name} dans ${conversation.name}` : sender.name;
        body = '🎥 A envoyé une vidéo';
        break;
      
      case 'audio':
        title = isGroup ? `${sender.name} dans ${conversation.name}` : sender.name;
        body = '🎵 A envoyé un message vocal';
        break;
      
      case 'document':
        title = isGroup ? `${sender.name} dans ${conversation.name}` : sender.name;
        body = '📄 A envoyé un document';
        break;
      
      case 'location':
        title = isGroup ? `${sender.name} dans ${conversation.name}` : sender.name;
        body = '📍 A partagé sa localisation';
        break;
      
      default:
        title = isGroup ? `${sender.name} dans ${conversation.name}` : sender.name;
        body = 'Nouveau message';
    }

    return {
      title,
      body,
      icon: sender.avatar || '/default-avatar.png',
      badge: '/notification-badge.png',
      data: {
        messageId: message._id,
        conversationId: conversation._id,
        senderId: sender._id,
        messageType: message.messageType,
        timestamp: message.createdAt,
        url: `/chat/${conversation._id}`
      },
      actions: [
        {
          action: 'reply',
          title: '💬 Répondre',
          icon: '/icons/reply.png'
        },
        {
          action: 'mark_read',
          title: '✓ Marquer comme lu',
          icon: '/icons/check.png'
        }
      ]
    };
  }

  /**
   * Détermine si une notification doit être envoyée
   */
  shouldSendNotification(preferences, messageType, isRecipientOnline) {
    if (!preferences) return true; // Notifications activées par défaut

    // Vérifier les préférences globales
    if (!preferences.enabled) return false;

    // Vérifier les préférences par type de message
    const typePreference = preferences.messageTypes?.[messageType];
    if (typePreference === false) return false;

    // Vérifier les heures de silence
    if (this.isInQuietHours(preferences.quietHours)) return false;

    // Vérifier le mode "Ne pas déranger"
    if (preferences.doNotDisturb?.enabled) {
      const now = new Date();
      const dndStart = new Date(preferences.doNotDisturb.start);
      const dndEnd = new Date(preferences.doNotDisturb.end);
      
      if (now >= dndStart && now <= dndEnd) return false;
    }

    // Si l'utilisateur est en ligne et actif, pas besoin de push notification
    if (isRecipientOnline && preferences.disableWhenOnline) return false;

    return true;
  }

  /**
   * Envoie une notification FCM
   */
  async sendFCMNotification(tokens, notificationData) {
    try {
      const message = {
        notification: {
          title: notificationData.title,
          body: notificationData.body,
          imageUrl: notificationData.icon
        },
        data: {
          ...notificationData.data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        android: {
          notification: {
            channelId: 'chat_messages',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            icon: 'ic_notification',
            color: '#4A90E2'
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notificationData.title,
                body: notificationData.body
              },
              badge: 1,
              sound: 'default',
              category: 'MESSAGE_CATEGORY'
            }
          }
        },
        tokens: tokens.filter(token => token && token.trim() !== '')
      };

      const response = await admin.messaging().sendMulticast(message);
      
      // Nettoyer les tokens invalides
      if (response.failureCount > 0) {
        await this.cleanupInvalidTokens(tokens, response.responses);
      }

      return response;
    } catch (error) {
      console.error('Erreur FCM:', error);
      throw error;
    }
  }

  /**
   * Envoie une notification web push
   */
  async sendWebPushNotification(subscriptions, notificationData) {
    try {
      const payload = JSON.stringify({
        title: notificationData.title,
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        data: notificationData.data,
        actions: notificationData.actions,
        requireInteraction: true,
        silent: false
      });

      const promises = subscriptions.map(async (subscription) => {
        try {
          return await webpush.sendNotification(subscription, payload);
        } catch (error) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expirée, la supprimer
            await this.removeExpiredSubscription(subscription);
          }
          throw error;
        }
      });

      return await Promise.allSettled(promises);
    } catch (error) {
      console.error('Erreur Web Push:', error);
      throw error;
    }
  }

  /**
   * Envoie une notification par email
   */
  async sendEmailNotification(email, notificationData) {
    try {
      // Implémenter l'envoi d'email avec votre service préféré
      // (SendGrid, AWS SES, etc.)
      console.log(`Email notification sent to ${email}:`, notificationData.title);
    } catch (error) {
      console.error('Erreur email:', error);
      throw error;
    }
  }

  /**
   * Détermine si un email doit être envoyé
   */
  shouldSendEmailNotification(recipient, preferences) {
    if (!preferences?.email?.enabled) return false;
    
    const offlineThreshold = preferences.email.offlineThreshold || 30; // minutes
    const lastSeen = new Date(recipient.lastSeen);
    const now = new Date();
    const minutesOffline = (now - lastSeen) / (1000 * 60);
    
    return minutesOffline >= offlineThreshold;
  }

  /**
   * Vérifie si nous sommes dans les heures de silence
   */
  isInQuietHours(quietHours) {
    if (!quietHours?.enabled) return false;
    
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = quietHours.start;
    const endHour = quietHours.end;
    
    if (startHour <= endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      // Traverse minuit
      return currentHour >= startHour || currentHour < endHour;
    }
  }

  /**
   * Nettoie les tokens FCM invalides
   */
  async cleanupInvalidTokens(tokens, responses) {
    const invalidTokens = [];
    
    responses.forEach((response, index) => {
      if (!response.success) {
        const error = response.error;
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      // Supprimer les tokens invalides de la base de données
      await User.updateMany(
        { fcmTokens: { $in: invalidTokens } },
        { $pullAll: { fcmTokens: invalidTokens } }
      );
    }
  }

  /**
   * Supprime une souscription web push expirée
   */
  async removeExpiredSubscription(subscription) {
    try {
      await User.updateMany(
        { 'webPushSubscriptions.endpoint': subscription.endpoint },
        { $pull: { webPushSubscriptions: { endpoint: subscription.endpoint } } }
      );
    } catch (error) {
      console.error('Erreur lors de la suppression de la souscription:', error);
    }
  }

  /**
   * Enregistre un token FCM pour un utilisateur
   */
  async registerFCMToken(userId, token) {
    try {
      await User.findByIdAndUpdate(
        userId,
        { $addToSet: { fcmTokens: token } },
        { new: true }
      );
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du token FCM:', error);
      throw error;
    }
  }

  /**
   * Enregistre une souscription web push
   */
  async registerWebPushSubscription(userId, subscription) {
    try {
      await User.findByIdAndUpdate(
        userId,
        { $addToSet: { webPushSubscriptions: subscription } },
        { new: true }
      );
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la souscription web push:', error);
      throw error;
    }
  }

  /**
   * Met à jour les préférences de notification
   */
  async updateNotificationPreferences(userId, preferences) {
    try {
      return await NotificationPreference.findOneAndUpdate(
        { userId },
        preferences,
        { new: true, upsert: true }
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour des préférences:', error);
      throw error;
    }
  }
}

export default pushNotiifcation;

