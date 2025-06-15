import nodemailer, { Transporter } from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { createLogger } from '../utils/logger/logger';
import { VerificationStatus } from '../users/types/userTypes';
import config from '../../config';
import  webpush from  'web-push'
import { EmailOptions,QueuedEmail} from '../type/notificationType';
import { PushNotificationOptions } from '../type/notificationType';
import { WebPushSubscription } from '../type/notificationType';
import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import { MulticastMessage } from 'firebase-admin/messaging';

const logger = createLogger('NotificationService');

export class NotificationService {
  private transporter!: Transporter;
  private fromEmail: string;
  private isSendGridEnabled: boolean;
  private isSMTPEnabled: boolean;
  private isWebPushEnabled: boolean;
  private isFirebaseEnabled: boolean;
  private emailStrategy: 'sendgrid-first' | 'smtp-first';
  private emailQueue: QueuedEmail[] = [];
  private isProcessingQueue = false;
 
   private rateLimiter = {
    sendgrid: {
      requests: 0,
      resetTime: Date.now() + 60000, // Reset every minute
      limit: 100 // SendGrid allows 100 emails per minute on free tier
    },
    smtp: {
      requests: 0,
      resetTime: Date.now() + 60000,
      limit: 60 // Conservative limit for SMTP
    },
     firebase: {
      requests: 0,
      resetTime: Date.now() + 60000,
      limit: 1000 // Firebase permet beaucoup plus
    },
    webpush: {
      requests: 0,
      resetTime: Date.now() + 60000,
      limit: 500
    }
  };

  constructor() {
    this.fromEmail = config.sendgrid.fromAddress || config.email.fromAddress || 'noreply@easyrent.com';
    this.emailStrategy = config.email.strategy;
    // Vérifier et initialiser SendGrid
    this.isSendGridEnabled = this.initializeSendGrid();
    
    // Vérifier et initialiser SMTP
    this.isSMTPEnabled = this.initializeSMTP();

    this.isWebPushEnabled = this.initializeWebPush();
    this.isFirebaseEnabled = this.initializeFirebase();
    this.logServicesStatus();
    // Vérifier qu'au moins un service est disponible
  }

  private logServicesStatus(): void {
    const availableServices = [];
    if (this.isSendGridEnabled) availableServices.push('SendGrid');
    if (this.isSMTPEnabled) availableServices.push('SMTP');
    if (this.isWebPushEnabled) availableServices.push('WebPush');
    if (this.isFirebaseEnabled) availableServices.push('Firebase');

    if (availableServices.length === 0) {
      logger.error('Aucun service de notification configuré !');
    } else {
      logger.info('Services de notification initialisés', {
        services: availableServices,
        emailStrategy: this.emailStrategy,
        primaryEmailService: this.getPrimaryService(),
        pushServices: {
          webPush: this.isWebPushEnabled,
          firebase: this.isFirebaseEnabled
        }
      })}}

    private getPrimaryService(): string {
    if (this.emailStrategy === 'smtp-first' && this.isSMTPEnabled) return 'SMTP';
    if (this.emailStrategy === 'sendgrid-first' && this.isSendGridEnabled) return 'SendGrid';
    if (this.isSendGridEnabled) return 'SendGrid';
    if (this.isSMTPEnabled) return 'SMTP';
    return 'None';
  }
  /**
   * Initialise SendGrid
   */
  private initializeSendGrid(): boolean {
    if (!config.sendgrid.enabled || !config.sendgrid.apiKey) {
      logger.warn('SendGrid non configuré', {
        enabled: config.sendgrid.enabled,
        hasApiKey: !!config.sendgrid.apiKey
      });
      return false;
    }
    try {
      sgMail.setApiKey(config.sendgrid.apiKey);
      logger.info('SendGrid initialisé avec succès');
      return true;
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation de SendGrid', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  /**
   * Initialise SMTP
   */
  private initializeSMTP(): boolean {
     if (!config.email.enabled || !config.email.host || !config.email.user || !config.email.password) {
          logger.warn('SMTP not configured - missing required settings', {
            enabled: config.email.enabled,
            hasHost: !!config.email.host,
            hasUser: !!config.email.user,
            hasPassword: !!config.email.password
          });
          return false;
        }
    try {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.password
        },
        // Options pour améliorer la fiabilité
        pool: config.email.pool || true,
        maxConnections: config.email.maxConnections || 5,
        maxMessages: 100,
        rateDelta: 20000,
        rateLimit: 5,
        // Options de timeout
        connectionTimeout: config.email.timeout || 15000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
        // Options TLS
        tls: {
          rejectUnauthorized: config.app.env === 'production',
          minVersion: 'TLSv1.2'
        },
        // Debug en développement
        debug: config.app.env === 'development',
        logger: config.app.env === 'development'
      });

      // Vérification de connexion asynchrone
      this.verifyConnectionAsync();
      
      logger.info('SMTP initialisé avec succès', {
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure
      });
      
      return true;
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation SMTP', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }
  /**
   * Initialise Web Push
   */
  private initializeWebPush(): boolean {
    if (!config.webpush?.enabled || !config.webpush.vapidPublicKey || !config.webpush.vapidPrivateKey) {
      logger.warn('Web Push non configuré', {
        enabled: config.webpush?.enabled,
        hasPublicKey: !!config.webpush?.vapidPublicKey,
        hasPrivateKey: !!config.webpush?.vapidPrivateKey
      });
      return false;
    }
    try {
      webpush.setVapidDetails(
        config.webpush.vapidSubject || 'mailto:noreply@easyrent.com',
        config.webpush.vapidPublicKey,
        config.webpush.vapidPrivateKey
      );

      logger.info('Web Push initialisé avec succès');
      return true;
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation Web Push', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  /**
   * Initialise Firebase Admin
   */
  private initializeFirebase(): boolean {
    if (!config.firebase?.enabled || !config.firebase.serviceAccount) {
      logger.warn('Firebase non configuré', {
        enabled: config.firebase?.enabled,
        hasServiceAccount: !!config.firebase?.serviceAccount
      });
      return false;
    }

    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(config.firebase.serviceAccount as  ServiceAccount),
          projectId: config.firebase.projectId
        });
      }

      logger.info('Firebase Admin initialisé avec succès');
      return true;
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation Firebase', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }
  /**
   * Vérification de connexion SMTP asynchrone
   */
  private async verifyConnectionAsync(): Promise<void> {
    if (!this.transporter) return;

    try {
      await Promise.race([
        this.transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection verification timeout')), 10000)
        )
      ]);
      logger.info('Connexion SMTP vérifiée avec succès');
    } catch (error) {
      logger.error('Échec de la vérification SMTP', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        host: config.email.host,
        port: config.email.port
      });
    }
  }
  /**
   * Envoie une notification push via Firebase Cloud Messaging
   */
  async sendFCMPushNotification(
    tokens: string | string[], 
    notification: PushNotificationOptions
  ): Promise<boolean> {

    if (!this.isFirebaseEnabled) {
      logger.warn('Firebase non disponible pour l\'envoi de push notifications');
      return false;
    }

    if (!this.canSendPush('firebase')) {
      logger.warn('Limite de taux Firebase atteinte');
      return false;
    }

    try {
      const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
      const validTokens = tokensArray.filter(token => token && token.trim() !== '');

      if (validTokens.length === 0) {
        logger.warn('Aucun token FCM valide fourni');
        return false;
      }
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.icon
        },
        data: {
          ...notification.data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          timestamp: new Date().toISOString()
        },
        android: {
          notification: {
            channelId: notification.androidChannelId || 'default',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            icon: notification.androidIcon || 'ic_notification',
            color: notification.androidColor || '#4A90E2'
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body
              },
              badge: notification.badge || 1,
              sound: notification.sound || 'default',
              category: notification.category || 'DEFAULT'
            }
          }    
        }, 
        tokens: validTokens
      };
    const response = await (admin.messaging() as any).sendMulticast(message);
      // const response = await admin.messaging().sendMulticast(message);
      this.updateRateLimit('firebase');

      // Nettoyer les tokens invalides
      if (response.failureCount > 0) {
        await this.cleanupInvalidFCMTokens(validTokens, response.responses);
      }

      logger.info('Notification FCM envoyée', {
        successCount: response.successCount,
        failureCount: response.failureCount,
        tokens: validTokens.length
      });

      return response.successCount > 0;
    } catch (error) {
      logger.error('Erreur lors de l\'envoi FCM', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        tokens: Array.isArray(tokens) ? tokens.length : 1
      });
      return false;
    }
  }

  /**
   * Envoie une notification Web Push
   */
  async sendWebPushNotification(
    subscriptions: WebPushSubscription | WebPushSubscription[],
    notification: PushNotificationOptions
  ): Promise<boolean> {
    if (!this.isWebPushEnabled) {
      logger.warn('Web Push non disponible');
      return false;
    }

    if (!this.canSendPush('webpush')) {
      logger.warn('Limite de taux Web Push atteinte');
      return false;
    }

    try {
      const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [subscriptions];
      const validSubscriptions = subscriptionsArray.filter(sub => 
        sub && sub.endpoint && sub.keys && sub.keys.p256dh && sub.keys.auth
      );

      if (validSubscriptions.length === 0) {
        logger.warn('Aucune subscription Web Push valide fournie');
        return false;
      }

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge || '/notification-badge.png',
        data: {
          ...notification.data,
          timestamp: new Date().toISOString()
        },
        actions: notification.actions || [],
        requireInteraction: notification.requireInteraction || false,
        silent: notification.silent || false,
        tag: notification.tag || 'default',
        renotify: notification.renotify || false
      });

      const promises = validSubscriptions.map(async (subscription, index) => {
        try {
          const result = await webpush.sendNotification(subscription, payload, {
            TTL: notification.ttl || 86400, // 24 heures par défaut
            urgency: notification.urgency || 'normal',
            topic: notification.topic
          });
          
          return { success: true, index, result };
        } catch (error: any) {
          // Gérer les subscriptions expirées
          if (error.statusCode === 410 || error.statusCode === 404) {
            await this.removeExpiredWebPushSubscription(subscription);
          }
          
          return { success: false, index, error };
        }
      });

      const results = await Promise.allSettled(promises);
      this.updateRateLimit('webpush');
      
      const successCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;

      logger.info('Notifications Web Push envoyées', {
        total: validSubscriptions.length,
        success: successCount,
        failed: validSubscriptions.length - successCount
      });

      return successCount > 0;
    } catch (error) {
      logger.error('Erreur lors de l\'envoi Web Push', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  /**
   * Envoie un email via SendGrid
   */
  private async sendWithSendGrid(mailOptions: EmailOptions): Promise<boolean> {
    if (!this.isSendGridEnabled) {
      logger.debug('SendGrid not enabled, skipping');
      return false;
    }

    if (!this.isValidEmail(mailOptions.to)) {
      logger.error('Invalid email address for SendGrid', { to: this.maskEmail(mailOptions.to) });
      return false;
    }
    try {
      const msg = {
        to: mailOptions.to,
        from: {
          email: this.fromEmail,
          name: 'EasyRent'
        },
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text || this.stripHtml(mailOptions.html),
        tracking_settings: {
        click_tracking: { enable: false },
        open_tracking: { enable: false }
      },
      };
      logger.debug('Sending email via SendGrid', {
        to: this.maskEmail(mailOptions.to),
        subject: mailOptions.subject,
        fromEmail: this.fromEmail
      })
      const response = await sgMail.send(msg);

      logger.info('Email envoyé avec SendGrid', {
        to: this.maskEmail(mailOptions.to),
        subject: mailOptions.subject,
        messageId: response[0].headers['x-message-id'],
        statusCode: response[0].statusCode
      });

      return true;
    } catch (error: any) {
      logger.error('Erreur SendGrid', {
        to: this.maskEmail(mailOptions.to),
        subject: mailOptions.subject,
        error: error.message || 'Erreur inconnue',
        code: error.code,
        statusCode: error.response?.status
      });

      return false;
    }
  }
  /**
   * Envoie un email via SMTP
   */
  private async sendWithSMTP(mailOptions: EmailOptions): Promise<boolean> {
  if (!this.isSMTPEnabled || !this.transporter) {
      logger.debug('SMTP not enabled or transporter not available, skipping');
      return false;
    }

    if (!this.isValidEmail(mailOptions.to)) {
      logger.error('Invalid email address for SMTP', { to: this.maskEmail(mailOptions.to) });
      return false;
    }

    try {
      const smtpOptions = {
        from: {
          name: 'EasyRent',
          address: this.fromEmail
        },
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text || this.stripHtml(mailOptions.html)

      };
      logger.debug('Sending email via SMTP', {
        to: this.maskEmail(mailOptions.to),
        subject: mailOptions.subject,
        fromEmail: this.fromEmail
      });

      const result = await Promise.race([
        this.transporter.sendMail(smtpOptions),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
        )
      ]) as any;

      logger.info('Email envoyé avec SMTP', {
        to: this.maskEmail(mailOptions.to),
        subject: mailOptions.subject,
        messageId: result.messageId
      });

      return true;
    } catch (error) {
      logger.error('Erreur SMTP', {
        to: this.maskEmail(mailOptions.to),
        subject: mailOptions.subject,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });

      return false;
    }
  }
  
  /**
   * Méthode unifiée pour envoyer des notifications
   */
  async sendNotification(options: {
    type: 'email' | 'push' | 'both';
    email?: EmailOptions;
    push?: {
      fcmTokens?: string[];
      webpushSubscriptions?: WebPushSubscription[];
      notification: PushNotificationOptions;
    };
    
    priority?: 'low' | 'medium'|'normal'| 'high' | 'urgent';

  }): Promise<{ email: boolean; push: boolean }> {
    const results = { email: false, push: false };

    try {
      // Envoi des emails
      if (options.type === 'email' || options.type === 'both') {
        if (options.email) {
          if (options.priority === 'high') {
            results.email = await this.sendUrgentEmail(options.email);
          } else {
            results.email = await this.sendEmailSafely(options.email);
          }
        }
      }

      // Envoi des notifications push
      if (options.type === 'push' || options.type === 'both') {
        if (options.push) {
          const pushPromises: Promise<boolean>[] = [];

          // Firebase push notifications
          if (options.push.fcmTokens && options.push.fcmTokens.length > 0) {
            pushPromises.push(
              this.sendFCMPushNotification(options.push.fcmTokens, options.push.notification)
            );
          }

          // Web push notifications
          if (options.push.webpushSubscriptions && options.push.webpushSubscriptions.length > 0) {
            pushPromises.push(
              this.sendWebPushNotification(options.push.webpushSubscriptions, options.push.notification)
            );
          }

          if (pushPromises.length > 0) {
            const pushResults = await Promise.all(pushPromises);
            results.push = pushResults.some(result => result);
          }
        }
      }

      return results;
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de notification unifiée', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        type: options.type
      });
      return results;
    }
  }
    
  /**
   * Nettoie les tokens FCM invalides
   */
  // private async cleanupInvalidFCMTokens(tokens: string[], responses: any[]): Promise<void> {
  //   const invalidTokens: string[] = [];
    
  //   responses.forEach((response, index) => {
  //     if (!response.success && response.error) {
  //       const errorCode = response.error.code;
  //       if (errorCode === 'messaging/invalid-registration-token' || 
  //           errorCode === 'messaging/registration-token-not-registered') {
  //         invalidTokens.push(tokens[index]);
  //       }
  //     }
  //   });

  //   if (invalidTokens.length > 0) {
  //     logger.info('Nettoyage des tokens FCM invalides', { count: invalidTokens.length });
  //     // Ici vous pouvez ajouter la logique pour supprimer les tokens de votre base de données
  //     // await User.updateMany(...);
  //   }
  // }

  private async cleanupInvalidFCMTokens(tokens: string[], responses: admin.messaging.SendResponse[]): Promise<void> {
  const invalidTokens = tokens.filter((_, index) => {
    const response = responses[index];
    return !response.success && response.error && (
      response.error.code === 'messaging/invalid-registration-token' ||
      response.error.code === 'messaging/registration-token-not-registered'
    );
  });

  if (invalidTokens.length > 0) {
    logger.info('Nettoyage des tokens FCM invalides', { count: invalidTokens.length });

    // Exemple de suppression dans une collection MongoDB
    // await User.updateMany(
    //   { fcmTokens: { $in: invalidTokens } },
    //   { $pull: { fcmTokens: { $in: invalidTokens } } }
    // );
  }
}
  /**
   * Supprime une subscription Web Push expirée
   */
  private async removeExpiredWebPushSubscription(subscription: WebPushSubscription): Promise<void> {
    try {
      logger.info('Suppression d\'une subscription Web Push expirée', {
        endpoint: subscription.endpoint
      });
      // ajout de  la logique de  suppresion  de  la subscription dans  la  base de données
      // await User.updateMany(...);
    } catch (error) {
      logger.error('Erreur lors de la suppression de la subscription expirée', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }

/**
   * Masque l'email pour les logs
   */
  private maskEmail(email: string): string {
    if (!email || email.length < 3) return '***';
    const [local, domain] = email.split('@');
    if (!domain) return email.substring(0, 3) + '***';
    return local.substring(0, Math.min(3, local.length)) + '***@' + domain;
  }

  /**
   * Vérifie si on peut envoyer des push notifications
   */
  private canSendPush(service: 'firebase' | 'webpush'): boolean {
    const now = Date.now();
    
    if (now > this.rateLimiter[service].resetTime) {
      this.rateLimiter[service].requests = 0;
      this.rateLimiter[service].resetTime = now + 60000;
    }

    return this.rateLimiter[service].requests < this.rateLimiter[service].limit;
  }
  /**
 * Improved email sending method that respects the configured strategy
 */
private async sendEmailSafely(mailOptions: EmailOptions): Promise<boolean> {
  // Vérifier qu'au moins un service est disponible
  if (!this.isSendGridEnabled && !this.isSMTPEnabled) {
    logger.error('Aucun service email disponible', {
      to: this.maskEmail(mailOptions.to),
      subject: mailOptions.subject
    });
    return false;
  }

  // Check that at least one service is available
  if (!this.isSendGridEnabled && !this.isSMTPEnabled) {
    logger.error('No email service available', {
      to: this.maskEmail(mailOptions.to),
      subject: mailOptions.subject
    });
    return false;
  }

  const services = this.getServicesInOrder();
  
  for (const service of services) {
    try {
      let success = false;
      
      if (service === 'sendgrid' && this.isSendGridEnabled) {
        logger.debug('Tentative d\'envoi via SendGrid...');
        success = await this.sendWithSendGrid(mailOptions);
      } else if (service === 'smtp' && this.isSMTPEnabled) {
        logger.debug('Tentative d\'envoi via SMTP...');
        success = await this.sendWithSMTP(mailOptions);
      }
      
      if (success) {
        return true;
      }
      
      logger.warn(`${service.toUpperCase()} a échoué, tentative avec le service suivant...`);
    } catch (error) {
      logger.error(`Erreur lors de l'envoi avec ${service}`, {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        to: this.maskEmail(mailOptions.to)
      });
    }
  }

  // Tous les services ont échoué
  logger.error('Échec de tous les services email', {
    to: this.maskEmail(mailOptions.to),
    subject: mailOptions.subject,
    strategy: this.emailStrategy,
    sendgridEnabled: this.isSendGridEnabled,
    smtpEnabled: this.isSMTPEnabled
  });

  return false;
}

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

/**
 * Get services in the correct order based on strategy
 */
private getServicesInOrder(): ('sendgrid' | 'smtp')[] {
  switch (this.emailStrategy) {
    case 'sendgrid-first':
      return ['sendgrid', 'smtp'];
    case 'smtp-first':
      return ['smtp', 'sendgrid'];
    default:
      // Default to SendGrid first if available, otherwise SMTP
      return this.isSendGridEnabled ? ['sendgrid', 'smtp'] : ['smtp', 'sendgrid'];
  }
}

  private async queueEmail(
    mailOptions: EmailOptions, 
    priority: 'high' | 'normal' | 'low' = 'normal',
    maxAttempts: number = 3
  ): Promise<string> {
    const queuedEmail: QueuedEmail = {
      ...mailOptions,
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      priority,
      attempts: 0,
      maxAttempts,
      scheduledAt: new Date()
    };

    // Insert based on priority
    if (priority === 'high') {
      this.emailQueue.unshift(queuedEmail);
    } else {
      this.emailQueue.push(queuedEmail);
    }

    logger.info('Email ajouté à la queue', {
      id: queuedEmail.id,
      to: this.maskEmail(mailOptions.to),
      priority,
      queueLength: this.emailQueue.length
    });

    // Start processing if not already running
    if (!this.isProcessingQueue) {
      this.processEmailQueue();
    }

    return queuedEmail.id;
  }

  /**
   * Process email queue with rate limiting
   */
  private async processEmailQueue(): Promise<void> {
    if (this.isProcessingQueue || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    logger.debug('Début du traitement de la queue email');

    while (this.emailQueue.length > 0) {
      const email = this.emailQueue.shift()!;
      
      try {
        // Check rate limits
        if (!this.canSendEmail()) {
          // Re-queue the email for later
          this.emailQueue.unshift(email);
          logger.debug('Rate limit atteint, pause de 10 secondes');
          await this.delay(10000);
          continue;
        }

        const success = await this.sendEmailSafely(email);
        
        if (success) {
          logger.info('Email envoyé avec succès depuis la queue', {
            id: email.id,
            to: this.maskEmail(email.to),
            attempts: email.attempts + 1
          });
        } else {
          email.attempts++;
          
          if (email.attempts < email.maxAttempts) {
            // Re-queue with exponential backoff
            email.scheduledAt = new Date(Date.now() + (email.attempts * 30000)); // 30s, 60s, 90s...
            this.emailQueue.push(email);
            
            logger.warn('Email échoué, re-ajouté à la queue', {
              id: email.id,
              attempts: email.attempts,
              maxAttempts: email.maxAttempts
            });
          } else {
            logger.error('Email définitivement échoué après tous les essais', {
              id: email.id,
              to: this.maskEmail(email.to),
              attempts: email.attempts
            });
          }
        }
        
        // Small delay between emails
        await this.delay(1000);
        
      } catch (error) {
        logger.error('Erreur lors du traitement de la queue', {
          emailId: email.id,
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
        
        // Re-queue failed email if attempts remaining
        if (email.attempts < email.maxAttempts) {
          email.attempts++;
          this.emailQueue.push(email);
        }
      }
    }

    this.isProcessingQueue = false;
    logger.debug('Fin du traitement de la queue email');
  }

  /**
   * Check if we can send email based on rate limits
   */
  private canSendEmail(): boolean {
    const now = Date.now();
    
    // Reset counters if time window has passed
    if (now > this.rateLimiter.sendgrid.resetTime) {
      this.rateLimiter.sendgrid.requests = 0;
      this.rateLimiter.sendgrid.resetTime = now + 60000;
    }
    
    if (now > this.rateLimiter.smtp.resetTime) {
      this.rateLimiter.smtp.requests = 0;
      this.rateLimiter.smtp.resetTime = now + 60000;
    }

    // Check if either service is available within limits
    const canUseSendGrid = this.isSendGridEnabled && 
      this.rateLimiter.sendgrid.requests < this.rateLimiter.sendgrid.limit;
    
    const canUseSMTP = this.isSMTPEnabled && 
      this.rateLimiter.smtp.requests < this.rateLimiter.smtp.limit;

    return canUseSendGrid || canUseSMTP;
  }

  /**
   * Update rate limiter after sending
   */
  private updateRateLimit(service: 'sendgrid' | 'smtp' | 'firebase' | 'webpush'): void {
    if (this.rateLimiter[service]) {
      this.rateLimiter[service].requests++;
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public method to send high priority emails immediately
   */
  async sendUrgentEmail(mailOptions: EmailOptions): Promise<boolean> {
    // Try to send immediately, fallback to high priority queue
    const success = await this.sendEmailSafely(mailOptions);
    
    if (!success) {
      await this.queueEmail(mailOptions, 'high', 5); // More attempts for urgent emails
      return false;
    }
    
    return true;
  }

  /**
   * Obtient le statut de tous les services
   */
  getServicesStatus(): {
    email: { sendgrid: boolean; smtp: boolean; primary: string };
    push: { firebase: boolean; webpush: boolean };
  } {
    return {
      email: {
        sendgrid: this.isSendGridEnabled,
        smtp: this.isSMTPEnabled,
        primary: this.getPrimaryService()
      },
      push: {
        firebase: this.isFirebaseEnabled,
        webpush: this.isWebPushEnabled
      }
    };
  }

  
  /**
   * Test de la configuration email
   */
  async testEmailConfiguration(): Promise<{
    sendgrid: boolean;
    smtp: boolean;
    overall: boolean;
  }> {
    const testResults = {
      sendgrid: false,
      smtp: false,
      overall: false
    };

    // Test SendGrid
    if (this.isSendGridEnabled) {
      try {
        // SendGrid n'a pas de méthode verify(), on teste avec un faux email
        testResults.sendgrid = true;
        logger.info('SendGrid configuré et prêt');
      } catch (error) {
        logger.error('Test SendGrid échoué', { error });
      }
    }

    if (this.isSMTPEnabled && this.transporter) {
      try {
        await Promise.race([
          this.transporter.verify(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('SMTP test timeout')), 10000)
          )
        ]);
        testResults.smtp = true;
        logger.info('SMTP configured and ready');
      } catch (error) {
        logger.error('SMTP test failed', { error });
      }
    }

    testResults.overall = testResults.sendgrid || testResults.smtp;
    logger.info('Résultats des tests email', testResults);
    return testResults;
  }

 /**
  *  send account reactivation  email
  */
  async sendAccountReactivationEmail(email: string, firstName: string): Promise<boolean> {
    const mailOptions : EmailOptions= {
   
      to: email,
      subject: 'Votre compte a été réactivé - EasyRent',
      html: this.getAccountReactivationTemplate(firstName)
    };

    return this.sendEmailSafely(mailOptions);
  }
  
  async debugVerificationEmail(email: string, firstName: string, token?: string): Promise<void> {
    const verificationUrl = `${config.app.frontendUrl}/verify-account?token=${token}`;
    
      console.log('🔍 DEBUG EMAIL VERIFICATION:');
      console.log('Email:', email);
      console.log('FirstName:', firstName);
      console.log('Token:', token);
      console.log('Frontend URL:', config.app.frontendUrl);
      console.log('Full Verification URL:', verificationUrl);
      console.log('Token length:', token?.length);
      console.log('Token type:', typeof token);
  }

/**
 * send  email  verification
 */
   async sendVerificationEmail(email: string, firstName: string, token: string): Promise<boolean> {
    if (!token) {
      logger.error('Verification token is missing', { email: this.maskEmail(email) });
      return false;
    }

    const verificationUrl = `${config.app.frontendUrl}/verify-account?token=${token}`;
    this.debugVerificationEmail(email, firstName, token);

    const mailOptions: EmailOptions = {
      to: email,
      subject: 'Vérifiez votre compte - EasyRent',
      html: this.getVerificationEmailTemplate(firstName, verificationUrl),
      text: `Bonjour ${firstName}, veuillez vérifier votre compte en visitant : ${verificationUrl}`
    };

    return this.sendEmailSafely(mailOptions);
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    this.debugVerificationEmail(email,firstName)

    const mailOptions: EmailOptions = {
      to: email,
      subject: 'Bienvenue sur EasyRent !',
      html: this.getWelcomeEmailTemplate(firstName)
    };

    return this.sendEmailSafely(mailOptions);
  }

  /**
   * password reset email
   */
 async sendPasswordResetEmail(email: string, resetLink: string, firstName: string): Promise<boolean> {
    if (!resetLink) {
      logger.error('Reset link is missing', { email: this.maskEmail(email) });
      return false;
    }

    this.debugVerificationEmail(email, firstName);
    logger.info('Password reset link provided', { 
      resetLink: resetLink.substring(0, 50) + '...',
      email: this.maskEmail(email)
    });

    const mailOptions: EmailOptions = {
      to: email,
      subject: 'Réinitialisation de votre mot de passe - EasyRent',
      html: this.getPasswordResetEmailTemplate(firstName, resetLink),

    };
    
    return this.sendEmailSafely(mailOptions);
  }

  /**
   * send  password change  confirmation email
   */
  async sendPasswordChangeConfirmationEmail(email: string, firstName: string): Promise<boolean> {
    const mailOptions = {
   
      to: email,
      subject: 'Confirmation de changement de mot de passe - EasyRent',
      html: this.getPasswordChangeConfirmationTemplate(firstName)
    };

    return this.sendEmailSafely(mailOptions);
  }
  
  async sendAgentVerificationStatusEmail(
    email: string, 
    firstName: string, 
    status: VerificationStatus,
    comment?: string
  ): Promise<boolean> {
    let subject: string;
    
    switch (status) {
      case VerificationStatus.VERIFIED:
        subject = 'Votre compte agent a été vérifié - EasyRent';
        break;
      case VerificationStatus.REJECTED:
        subject = 'Votre demande de vérification a été rejetée - EasyRent';
        break;
      case VerificationStatus.PENDING:
        subject = 'Votre demande de vérification est en cours - EasyRent';
        break;
      default:
        subject = 'Mise à jour de votre compte agent - EasyRent';
    }
    
    const mailOptions = {
   
      to: email,
      subject,
      html: this.getAgentVerificationStatusTemplate(firstName, status, comment)
    };

    return this.sendEmailSafely(mailOptions);
  }

  async sendSecurityNotification(
    email: string, 
    firstName: string, 
    comment?: string,
    alertType: 'login_attempt' | 'password_changed' | 'account_accessed' | 'information_changed' | 'other' = 'other'
  ): Promise<boolean> {
    let subject: string;
    let alertMessage: string;

    
    switch (alertType) {
      case 'login_attempt':
        subject = 'Alerte de sécurité: Tentative de connexion suspecte - EasyRent';
        break;
      case 'password_changed':
        subject = 'Alerte de sécurité: Modification de votre mot de passe - EasyRent';
        break;
      case 'account_accessed':
        subject = 'Alerte de sécurité: Accès à votre compte - EasyRent';
        break;
      case 'information_changed':
        subject = 'Alerte de sécurité: Modification de vos informations - EasyRent';
        break;
      default:
        subject = 'Alerte de sécurité sur votre compte - EasyRent';
    }
    
    const mailOptions = {
      to: email,
      subject,
      html: this.getSecurityAlertEmailTemplate(firstName, alertType, comment)
    };

    return this.sendEmailSafely(mailOptions);
  }

  async sendAccountDeactivationEmail(email: string, firstName: string): Promise<boolean> {
    const mailOptions = {
      to: email,
      subject: 'Votre compte a été désactivé - EasyRent',
      html: this.getAccountDeactivationTemplate(firstName)
    };

    return this.sendEmailSafely(mailOptions);
  }

  async sendAccountLockedEmail(
    email: string, 
    firstName: string, 
    reason?: string,
    lockDuration?: string
  ): Promise<boolean> {
    const mailOptions = {
      to: email,
      subject: '🔒 Votre compte a été temporairement verrouillé - EasyRent',
      html: this.getAccountLockedEmailTemplate(firstName, reason, lockDuration)
    };

    return this.sendEmailSafely(mailOptions);
  }

  async sendAccountDeletedEmail(email: string, firstName: string, comment?: string): Promise<boolean> {
    const mailOptions = {
   
      to: email,
      subject: 'Confirmation de suppression de votre compte - EasyRent',
      html: this.getAccountDeletedTemplate(firstName, comment)
    };

    return this.sendEmailSafely(mailOptions);
  }

  async sendAccountRestoredEmail(
    email: string, 
    firstName: string, 
    comment?: string
  ): Promise<boolean> {
    const mailOptions = {
      to: email,
      subject: '✅ Votre compte a été restauré - EasyRent',
      html: this.getAccountRestoredEmailTemplate(firstName, comment)
    };

    return this.sendEmailSafely(mailOptions);
  }

async sendAccountStatusNotification(
  email: string, 
  firstName: string, 
  status: 'activated' | 'deactivated' | 'locked' | 'unlocked' | 'verified' | 'suspended' | 'restored',
  comment?: string
): Promise<boolean> {
  let subject: string;
  let statusColor: string;
  let statusMessage: string;
  
  switch (status) {
    case 'activated':
      subject = 'Votre compte a été activé - EasyRent';
      statusColor = '#28a745';
      statusMessage = 'Votre compte EasyRent a été activé avec succès. Vous pouvez maintenant accéder à tous nos services.';
      break;
    case 'deactivated':
      subject = 'Votre compte a été désactivé - EasyRent';
      statusColor = '#ffc107';
      statusMessage = 'Votre compte EasyRent a été temporairement désactivé.';
      break;
    case 'locked':
      subject = '🔒 Votre compte a été verrouillé - EasyRent';
      statusColor = '#dc3545';
      statusMessage = 'Votre compte a été temporairement verrouillé pour des raisons de sécurité.';
      break;
    case 'unlocked':
      subject = '🔓 Votre compte a été déverrouillé - EasyRent';
      statusColor = '#28a745';
      statusMessage = 'Votre compte a été déverrouillé et est maintenant accessible.';
      break;
    case 'verified':
      subject = '✅ Votre compte a été vérifié - EasyRent';
      statusColor = '#28a745';
      statusMessage = 'Votre compte a été vérifié avec succès. Vous avez maintenant accès à toutes les fonctionnalités.';
      break;
    case 'suspended':
      subject = '⚠️ Votre compte a été suspendu - EasyRent';
      statusColor = '#dc3545';
      statusMessage = 'Votre compte a été suspendu en raison d\'une violation de nos conditions d\'utilisation.';
      break;
    case 'restored':
      subject = '✅ Votre compte a été restauré - EasyRent';
      statusColor = '#28a745';
      statusMessage = 'Votre compte a été restauré et est maintenant pleinement fonctionnel.';
      break;
    default:
      subject = 'Mise à jour de votre compte - EasyRent';
      statusColor = '#007bff';
      statusMessage = 'Le statut de votre compte a été mis à jour.';
  }
  
  const mailOptions = {
    to: email,
    subject,
    html: this.getAccountStatusNotificationTemplate(firstName, status, statusMessage, statusColor, comment)
  };

  return this.sendEmailSafely(mailOptions);
}

private getAccountStatusNotificationTemplate(
  firstName: string, 
  status: string, 
  statusMessage: string, 
  statusColor: string, 
  comment?: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor};">
        <h1 style="color: ${statusColor};">Bonjour ${firstName},</h1>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          ${statusMessage}
        </p>
        
        ${comment ? `
          <div style="background-color: #e9ecef; border: 1px solid #dee2e6; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #495057;">
              <strong>Information complémentaire :</strong> ${comment}
            </p>
          </div>
        ` : ''}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.app.frontendUrl}/dashboard" 
             style="background-color: ${statusColor}; color: white; padding: 15px 30px; text-decoration: none; 
                    border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">
            Accéder à mon compte
          </a>
          <a href="${config.app.frontendUrl}/contact-support" 
             style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; 
                    border-radius: 4px; display: inline-block; margin: 5px;">
            Contacter le support
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 20px;">
          Si vous avez des questions concernant cette notification, n'hésitez pas à contacter notre équipe de support.
        </p>
        
        <p style="font-weight: bold; margin-top: 20px;">
          L'équipe EasyRent
        </p>
      </div>
    </div>
  `;
}

  private getVerificationEmailTemplate(firstName: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vérification de compte - EasyRent</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h1 style="color: #007bff; text-align: center; margin-bottom: 30px;">Bienvenue sur EasyRent, ${firstName}!</h1>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Merci de vous être inscrit sur EasyRent. Pour finaliser votre inscription et activer votre compte, 
            veuillez cliquer sur le bouton ci-dessous :
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; 
                      border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
              ✅ Vérifier mon compte
            </a>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⏰ Important :</strong> Ce lien est valide pendant 24 heures seulement.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <div style="font-size: 12px; color: #999;">
            <p><strong>Problème avec le bouton ?</strong></p>
            <p>Copiez et collez ce lien dans votre navigateur :</p>
            <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
              ${verificationUrl}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(firstName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
          <h1 style="color: #28a745; margin-bottom: 20px;">🎉 Bienvenue sur EasyRent, ${firstName}!</h1>
          <p style="font-size: 16px; margin-bottom: 20px;">
            Votre compte a été vérifié avec succès. Vous pouvez maintenant profiter de tous les services de notre plateforme de location.
          </p>
          <div style="margin: 30px 0;">
            <a href="${config.app.frontendUrl}/dashboard" 
               style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; 
                      border-radius: 5px; display: inline-block; font-weight: bold;">
              🚀 Accéder à mon tableau de bord
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private getPasswordResetEmailTemplate(firstName: string, resetUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h1 style="color: #dc3545;">Réinitialisation de mot de passe</h1>
          <p>Bonjour ${firstName},</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe EasyRent. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; 
                      border-radius: 5px; display: inline-block; font-weight: bold;">
              🔑 Réinitialiser mon mot de passe
            </a>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px;">
            <p style="margin: 0; color: #856404;">
              <strong>⏰ Important :</strong> Ce lien expire dans 1 heure.
            </p>
          </div>
          
          <p style="margin-top: 20px;">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
        </div>
      </div>
    `;
  }
  
  private getAccountReactivationTemplate(firstName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
          <h1 style="color: #28a745;">✅ Compte Réactivé</h1>
          <p>Bonjour ${firstName},</p>
          <p>Votre compte EasyRent a été réactivé avec succès.</p>
          <p>Vous pouvez maintenant vous connecter et utiliser à nouveau tous nos services.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.app.frontendUrl}/login" 
               style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; 
                      border-radius: 5px; display: inline-block; font-weight: bold;">
              Se connecter
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private getAccountDeactivationTemplate(firstName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
          <h1 style="color: #ffc107;">⚠️ Compte Désactivé</h1>
          <p>Bonjour ${firstName},</p>
          <p style="font-size: 16px; font-weight: bold; color: #856404;">
            Votre compte EasyRent a été temporairement désactivé.
          </p>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>Que signifie cela ?</strong>
            </p>
            <ul style="color: #856404; margin: 10px 0;">
              <li>Vous ne pouvez plus vous connecter à votre compte</li>
              <li>Vos annonces ne sont plus visibles</li>
              <li>Vous ne pouvez pas effectuer de nouvelles actions</li>
            </ul>
          </div>
          
          <p style="color: #333;">
            Cette mesure est généralement temporaire. Pour réactiver votre compte ou obtenir plus d'informations, 
            veuillez contacter notre équipe de support.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.app.frontendUrl}/contact-support" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; 
                      border-radius: 4px; display: inline-block; margin: 5px;">
              Contacter le support
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            Nous nous efforçons de maintenir un environnement sûr pour tous nos utilisateurs.
          </p>
          <p style="font-weight: bold;">L'équipe EasyRent</p>
        </div>
      </div>
    `;
  }

  private getAccountDeletedTemplate(firstName: string, comment?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
          <h1 style="color: #dc3545;">❌ Compte Supprimé</h1>
          <p>Bonjour ${firstName},</p>
          <p style="font-size: 16px; font-weight: bold; color: #dc3545;">
            Votre compte EasyRent a été définitivement supprimé.
          </p>
          
          ${comment ? `
            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #721c24;">
                <strong>Raison :</strong> ${comment}
              </p>
            </div>
          ` : ''}
          
          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #0c5460;">
              <strong>Conséquences de la suppression :</strong>
            </p>
            <ul style="color: #0c5460; margin: 10px 0;">
              <li>Toutes vos données personnelles ont été supprimées</li>
              <li>Vos annonces ne sont plus accessibles</li>
              <li>Votre historique de transactions est archivé selon nos obligations légales</li>
              <li>Vous ne pouvez plus accéder à votre compte</li>
            </ul>
          </div>
          
          <p style="color: #333;">
            Si vous pensez que cette suppression est une erreur, ou si vous souhaitez créer un nouveau compte, 
            vous pouvez contacter notre équipe de support.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.app.frontendUrl}/contact-support" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; 
                      border-radius: 4px; display: inline-block; margin: 5px;">
              Contacter le support
            </a>
            <a href="${config.app.frontendUrl}/register" 
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; 
                      border-radius: 4px; display: inline-block; margin: 5px;">
              Créer un nouveau compte
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            Merci d'avoir utilisé EasyRent. Nous espérons vous revoir bientôt.
          </p>
          <p style="font-weight: bold;">L'équipe EasyRent</p>
        </div>
      </div>
    `;
  }

  private getAccountLockedEmailTemplate(firstName: string, reason?: string, lockDuration?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
          <h1 style="color: #dc3545;">🔒 Compte Temporairement Verrouillé</h1>
          <p>Bonjour ${firstName},</p>
          <p style="font-size: 16px; font-weight: bold; color: #dc3545;">
            Votre compte a été temporairement verrouillé pour des raisons de sécurité.
          </p>
          
          ${reason ? `
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>Raison :</strong> ${reason}
              </p>
            </div>
          ` : ''}
          
          ${lockDuration ? `
            <p style="color: #333;">
              <strong>Durée du verrouillage :</strong> ${lockDuration}
            </p>
          ` : ''}
          
          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #0c5460;">
              <strong>Que faire maintenant ?</strong>
            </p>
            <ul style="color: #0c5460; margin: 10px 0;">
              <li>Attendez la fin de la période de verrouillage</li>
              <li>Contactez notre support si vous pensez qu'il s'agit d'une erreur</li>
              <li>Vérifiez la sécurité de votre compte</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.app.frontendUrl}/contact-support" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; 
                      border-radius: 4px; display: inline-block; margin: 5px;">
              Contacter le support
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            Cette mesure de sécurité nous aide à protéger votre compte et nos services.
          </p>
          <p style="font-weight: bold;">L'équipe de sécurité</p>
        </div>
      </div>
    `;
  }

  private getAccountRestoredEmailTemplate(firstName: string, comment?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
          <h1 style="color: #28a745;">✅ Compte Restauré avec Succès</h1>
          <p>Bonjour ${firstName},</p>
          <p style="font-size: 16px; font-weight: bold; color: #28a745;">
            Bonne nouvelle ! Votre compte a été restauré et est maintenant accessible.
          </p>
          
          ${comment ? `
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #155724;">
                <strong>Note :</strong> ${comment}
              </p>
            </div>
          ` : ''}
          
          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #0c5460;">
              <strong>Recommandations de sécurité :</strong>
            </p>
            <ul style="color: #0c5460; margin: 10px 0;">
              <li>Changez votre mot de passe si nécessaire</li>
              <li>Activez l'authentification à deux facteurs</li>
              <li>Vérifiez vos paramètres de sécurité</li>
              <li>Surveillez l'activité de votre compte</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.app.frontendUrl}/login" 
               style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; 
                      border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">
              Se connecter
            </a>
            <a href="${config.app.frontendUrl}/security-settings" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; 
                      border-radius: 4px; display: inline-block; margin: 5px;">
              Paramètres sécurité
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            Merci pour votre patience. Nous nous efforçons de maintenir la sécurité de tous nos utilisateurs.
          </p>
          <p style="font-weight: bold;">L'équipe de support</p>
        </div>
      </div>
    `;
  }

  private getPasswordChangeConfirmationTemplate(firstName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h1 style="color: #28a745;">Confirmation de changement de mot de passe</h1>
          <p>Bonjour ${firstName},</p>
          <p>Votre mot de passe EasyRent a été modifié avec succès.</p>
          <p>Si vous n'avez pas effectué cette modification, veuillez contacter immédiatement notre support.</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${config.app.frontendUrl}/contact-support" 
               style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Contacter le support
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private getAgentVerificationStatusTemplate(firstName: string, status: VerificationStatus, comment?: string): string {
    let statusMessage: string;
    let statusColor: string;
    switch (status) {
      case VerificationStatus.VERIFIED:
        statusMessage = 'Votre compte agent a été vérifié avec succès. Vous pouvez maintenant accéder à toutes les fonctionnalités d\'agent sur EasyRent.';
        statusColor = '#28a745';
        break;
      case VerificationStatus.REJECTED:
        statusMessage = 'Nous sommes désolés de vous informer que votre demande de vérification d\'agent a été rejetée.';
        statusColor = '#dc3545';
        break;
      case VerificationStatus.PENDING:
        statusMessage = 'Votre demande de vérification d\'agent est en cours d\'examen par notre équipe.';
        statusColor = '#ffc107';
        break;
      default:
        statusMessage = 'Le statut de votre compte agent a été mis à jour.';
        statusColor = '#007bff';
    }
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: ${statusColor};">Bonjour ${firstName},</h1>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor};">
          <p style="margin: 0; font-size: 16px;">${statusMessage}</p>
          ${comment ? `<p style="margin-top: 15px; font-style: italic; color: #666;">Commentaire: ${comment}</p>` : ''}
        </div>
        <p style="margin-top: 20px;">Si vous avez des questions, n'hésitez pas à contacter notre support.</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${config.app.frontendUrl}/contact-support" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Contacter le support
          </a>
        </div>
      </div>
    `;
  }

  private getSecurityAlertEmailTemplate(
  firstName: string, 
  alertType: 'login_attempt' | 'password_changed' | 'account_accessed' | 'information_changed' | 'other',
  comment?: string
): string {
  let alertMessage: string;
  let alertIcon: string;
  
  switch (alertType) {
    case 'login_attempt':
      alertMessage = 'Une tentative de connexion suspecte a été détectée sur votre compte.';
      alertIcon = '🔐';
      break;
    case 'password_changed':
      alertMessage = 'Votre mot de passe a été modifié.';
      alertIcon = '🔑';
      break;
    case 'account_accessed':
      alertMessage = 'Votre compte a été accédé depuis un nouvel appareil ou emplacement.';
      alertIcon = '📱';
      break;
    case 'information_changed':
      alertMessage = 'Vos informations personnelles ont été modifiées.';
      alertIcon = '✏️';
      break;
    default:
      alertMessage = 'Une activité de sécurité importante a été détectée sur votre compte.';
      alertIcon = '⚠️';
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
        <h1 style="color: #dc3545;">🚨 Alerte de Sécurité</h1>
        <p>Bonjour ${firstName},</p>
        <p style="font-size: 16px; font-weight: bold; color: #dc3545;">
          ${alertIcon} ${alertMessage}
        </p>
        
        ${comment ? `
          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #721c24;">
              <strong>Détails :</strong> ${comment}
            </p>
          </div>
        ` : ''}
        
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>Si cette activité ne provient pas de vous, veuillez immédiatement :</strong>
          </p>
        </div>
        
        <ol style="color: #333;">
          <li>Changer votre mot de passe</li>
          <li>Activer l'authentification à deux facteurs si ce n'est pas déjà fait</li>
          <li>Contacter notre équipe de support</li>
        </ol>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${config.app.frontendUrl}/change-password" 
             style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; 
                    border-radius: 4px; display: inline-block; margin: 5px;">
            Changer mot de passe
          </a>
          <a href="${config.app.frontendUrl}/security-settings" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; 
                    border-radius: 4px; display: inline-block; margin: 5px;">
            Paramètres sécurité
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666;">
          Si cette activité provient de vous, vous pouvez ignorer cet email.
        </p>
        <p style="font-weight: bold;">L'équipe de sécurité EasyRent</p>
      </div>
    </div>
  `;
}
}
