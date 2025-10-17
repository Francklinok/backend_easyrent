import { INotification } from '../models/Notification';
import { NotificationPreference } from '../models/NotificationPreference';
import { NotificationProvider, NotificationChannel, PushNotificationData } from '../types/notificationTypes';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('PushNotificationService');

// Interface pour les différents services de push
interface PushProvider {
  sendNotification(token: string, payload: PushPayload): Promise<boolean>;
}

interface PushPayload {
  title: string;
  body: string;
  data?: any;
  badge?: number;
  sound?: string;
  icon?: string;
  image?: string;
  clickAction?: string;
}

// Implémentation Firebase Cloud Messaging
class FCMProvider implements PushProvider {
  private fcm: any;

  constructor() {
    try {
      const admin = require('firebase-admin');

      if (!admin.apps.length) {
        const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json');

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      }

      this.fcm = admin.messaging();
      logger.info('Firebase Cloud Messaging initialisé avec succès');
    } catch (error) {
      logger.warn('Firebase non configuré, push notifications désactivées', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      this.fcm = null;
    }
  }

  async sendNotification(token: string, payload: PushPayload): Promise<boolean> {
    if (!this.fcm) {
      throw new Error('Firebase not configured');
    }

    try {
      const message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.icon && { icon: payload.icon }),
          ...(payload.image && { image: payload.image })
        },
        data: payload.data ? this.stringifyData(payload.data) : {},
        android: {
          notification: {
            ...(payload.sound && { sound: payload.sound }),
            ...(payload.clickAction && { clickAction: payload.clickAction }),
            priority: 'high' as const
          }
        },
        apns: {
          payload: {
            aps: {
              ...(payload.badge && { badge: payload.badge }),
              ...(payload.sound && { sound: payload.sound }),
              'content-available': 1
            }
          }
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            ...(payload.icon && { icon: payload.icon }),
            ...(payload.image && { image: payload.image }),
            requireInteraction: payload.title.includes('urgent'),
            actions: payload.clickAction ? [
              {
                action: 'open',
                title: 'Ouvrir',
                icon: '/icons/open.png'
              }
            ] : undefined
          },
          fcmOptions: {
            link: payload.clickAction
          }
        }
      };

      const response = await this.fcm.send(message);
      logger.info('Push notification envoyée avec succès', {
        token: token.substring(0, 10) + '...',
        response
      });
      return true;

    } catch (error: any) {
      logger.error('Erreur envoi push FCM', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        code: error.code
      });

      // Gérer les tokens invalides
      if (error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/invalid-registration-token') {
        await this.cleanupInvalidToken(token);
      }

      return false;
    }
  }

  private stringifyData(data: any): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return result;
  }

  private async cleanupInvalidToken(token: string): Promise<void> {
    try {
      await NotificationPreference.updateMany(
        { pushToken: token },
        { $unset: { pushToken: 1 } }
      );
      logger.info('Token push invalide supprimé', { token: token.substring(0, 10) + '...' });
    } catch (error) {
      logger.error('Erreur suppression token invalide', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
}

// Implémentation Apple Push Notification Service
class APNSProvider implements PushProvider {
  async sendNotification(token: string, payload: PushPayload): Promise<boolean> {
    // À implémenter si nécessaire
    logger.warn('APNS provider non implémenté', { token: token.substring(0, 10) + '...' });
    return false;
  }
}

export class PushNotificationService {
  private providers: Map<string, PushProvider> = new Map();

  constructor() {
    // Initialiser les providers
    this.providers.set('fcm', new FCMProvider());
    this.providers.set('apns', new APNSProvider());
    logger.info('PushNotificationService initialisé');
  }

  /**
   * Envoyer une notification push à partir d'une notification existante
   */
  async sendNotification(notification: INotification): Promise<void> {
    try {
      // Récupérer le token push de l'utilisateur
      const preferences = await NotificationPreference.findOne({
        userId: notification.userId,
        pushToken: { $exists: true, $ne: null }
      });

      if (!preferences?.pushToken) {
        throw new Error('No push token found for user');
      }

      // Construire le payload
      const payload = this.buildPayload(notification);

      // Déterminer le provider basé sur la plateforme
      const platform = preferences.deviceInfo?.platform || 'android';
      const provider = this.getProvider(platform);

      // Envoyer la notification
      const success = await provider.sendNotification(preferences.pushToken, payload);

      if (!success) {
        throw new Error('Push notification failed');
      }

      logger.info('Notification push envoyée', {
        userId: notification.userId,
        type: notification.type,
        platform
      });

    } catch (error) {
      logger.error('Erreur PushNotificationService', {
        userId: notification.userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      throw error;
    }
  }

  /**
   * Envoyer une notification push personnalisée
   */
  async sendCustomNotification(data: PushNotificationData): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    const tokens = Array.isArray(data.tokens) ? data.tokens : [data.tokens];

    for (const token of tokens) {
      try {
        const payload: PushPayload = {
          title: data.title,
          body: data.body,
          icon: data.icon,
          image: data.image,
          sound: data.sound,
          badge: data.badge,
          data: data.data,
          clickAction: data.clickAction
        };

        // Déterminer la plateforme (par défaut Android)
        const provider = this.providers.get('fcm')!;
        const result = await provider.sendNotification(token, payload);

        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        logger.error('Erreur envoi notification personnalisée', {
          token: token.substring(0, 10) + '...',
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
    }

    logger.info('Envoi de notifications push personnalisées terminé', {
      total: tokens.length,
      success,
      failed
    });

    return { success, failed };
  }

  /**
   * Envoyer des notifications push en masse
   */
  async sendBulkNotifications(notifications: INotification[]): Promise<void> {
    const batchSize = 100; // FCM limite à 500, on prend une marge

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);

      const promises = batch.map(notification =>
        this.sendNotification(notification).catch(error => {
          logger.error('Erreur envoi notification en masse', {
            notificationId: notification._id,
            error: error instanceof Error ? error.message : 'Erreur inconnue'
          });
          return null;
        })
      );

      await Promise.allSettled(promises);

      // Petit délai entre les batches pour éviter la surcharge
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info('Envoi en masse terminé', { total: notifications.length });
  }

  /**
   * Tester un token push
   */
  async testPushToken(token: string, platform: string = 'android'): Promise<boolean> {
    try {
      const provider = this.getProvider(platform);

      const testPayload: PushPayload = {
        title: 'Test de notification',
        body: 'Votre token push fonctionne correctement !',
        data: { test: 'true' }
      };

      const result = await provider.sendNotification(token, testPayload);
      logger.info('Test du token push', {
        token: token.substring(0, 10) + '...',
        success: result
      });

      return result;
    } catch (error) {
      logger.error('Erreur test token push', {
        token: token.substring(0, 10) + '...',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  /**
   * Construire le payload à partir d'une notification
   */
  private buildPayload(notification: INotification): PushPayload {
    const payload: PushPayload = {
      title: notification.title,
      body: notification.message,
      data: {
        notificationId: notification._id.toString(),
        type: notification.type,
        category: (notification as any).category,
        priority: notification.priority,
        ...notification.metadata
      }
    };

    // Configuration spécifique selon le type
    switch ((notification as any).type) {
      case 'wallet':
        payload.icon = '/icons/wallet.png';
        payload.sound = 'default';
        break;
      case 'property':
        payload.icon = '/icons/property.png';
        payload.sound = 'default';
        break;
      case 'service':
        payload.icon = '/icons/service.png';
        break;
      case 'security':
        payload.icon = '/icons/security.png';
        payload.sound = 'alert';
        break;
      default:
        payload.icon = '/icons/default.png';
    }

    // Configuration selon la priorité
    switch (notification.priority) {
      case 'urgent':
        payload.sound = 'alert';
        payload.badge = 1;
        break;
      case 'high':
        payload.sound = 'default';
        payload.badge = 1;
        break;
      default:
        payload.sound = (notification as any).type === 'security' ? 'default' : undefined;
    }

    // Ajouter l'action si présente dans les métadonnées
    if (notification.metadata?.actionUrl) {
      payload.clickAction = notification.metadata.actionUrl;
    }

    // Ajouter l'image si présente
    if (notification.metadata?.imageUrl) {
      payload.image = notification.metadata.imageUrl;
    }

    return payload;
  }

  /**
   * Obtenir le provider selon la plateforme
   */
  private getProvider(platform: string): PushProvider {
    switch (platform) {
      case 'ios':
        return this.providers.get('apns') || this.providers.get('fcm')!;
      case 'android':
      case 'web':
      default:
        return this.providers.get('fcm')!;
    }
  }

  /**
   * Obtenir le statut du service
   */
  async getProviderStatus(): Promise<NotificationProvider> {
    const fcmProvider = this.providers.get('fcm') as any;
    const apnsProvider = this.providers.get('apns') as any;

    return {
      name: 'Push Notification Service',
      type: NotificationChannel.PUSH,
      isEnabled: fcmProvider?.fcm !== null,
      config: {
        fcmEnabled: fcmProvider?.fcm !== null,
        apnsEnabled: false,
        providers: ['FCM', 'APNS (à implémenter)']
      }
    };
  }
}
