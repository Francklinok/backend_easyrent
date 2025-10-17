import twilio from 'twilio';
import { SmsNotificationData, NotificationProvider, NotificationChannel, NotificationStatus } from '../types/notificationTypes';
import { NotificationHistory } from '../models/Notification';
import { createLogger } from '../../utils/logger/logger';
import config from '../../../config';

const logger = createLogger('SmsNotificationService');

export class SmsNotificationService {
  private twilioClient: twilio.Twilio | null = null;
  private isEnabled: boolean = false;
  private fromNumber: string;
  private rateLimiter = {
    requests: 0,
    resetTime: Date.now() + 60000, // Reset every minute
    limit: 100 // Twilio allows many SMS per minute
  };

  constructor() {
    this.fromNumber = config.twilio?.fromNumber || '';
    this.initializeTwilio();
  }

  private initializeTwilio(): void {
    if (!config.twilio?.enabled || !config.twilio.accountSid || !config.twilio.authToken) {
      logger.warn('Twilio SMS non configuré', {
        enabled: config.twilio?.enabled,
        hasAccountSid: !!config.twilio?.accountSid,
        hasAuthToken: !!config.twilio?.authToken,
        hasFromNumber: !!this.fromNumber
      });
      return;
    }

    try {
      this.twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
      this.isEnabled = true;
      logger.info('Twilio SMS initialisé avec succès', {
        fromNumber: this.fromNumber
      });
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation de Twilio', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }

  async sendSms(data: SmsNotificationData, userId: string, notificationId?: string): Promise<boolean> {
    if (!this.isEnabled || !this.twilioClient) {
      logger.warn('Service SMS non disponible');
      return false;
    }

    if (!this.canSendSms()) {
      logger.warn('Limite de taux SMS atteinte');
      return false;
    }

    try {
      const recipients = Array.isArray(data.to) ? data.to : [data.to];
      const validNumbers = recipients.filter(number => this.isValidPhoneNumber(number));

      if (validNumbers.length === 0) {
        logger.warn('Aucun numéro de téléphone valide fourni');
        return false;
      }

      const results = await Promise.all(
        validNumbers.map(async (phoneNumber) => {
          try {
            const message = await this.twilioClient!.messages.create({
              body: data.message,
              from: data.from || this.fromNumber,
              to: phoneNumber,
              mediaUrl: data.mediaUrls
            });

            this.updateRateLimit();

            // Record success in history
            await this.recordDeliveryHistory(
              notificationId || 'direct',
              userId,
              phoneNumber,
              NotificationStatus.SENT,
              message.sid
            );

            logger.info('SMS envoyé avec succès', {
              to: this.maskPhoneNumber(phoneNumber),
              messageSid: message.sid,
              status: message.status
            });

            return true;
          } catch (error: any) {
            logger.error('Erreur lors de l\'envoi SMS', {
              to: this.maskPhoneNumber(phoneNumber),
              error: error.message,
              code: error.code
            });

            // Record failure in history
            await this.recordDeliveryHistory(
              notificationId || 'direct',
              userId,
              phoneNumber,
              NotificationStatus.FAILED,
              undefined,
              error.message
            );

            return false;
          }
        })
      );

      return results.some(result => result);
    } catch (error) {
      logger.error('Erreur générale lors de l\'envoi SMS', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        userId,
        notificationId
      });
      return false;
    }
  }

  async sendTemplateSms(
    templateId: string,
    data: SmsNotificationData & { templateData?: Record<string, any> },
    userId: string,
    notificationId?: string
  ): Promise<boolean> {
    try {
      const templateContent = this.getSmsTemplate(templateId, data.templateData);

      const smsData: SmsNotificationData = {
        ...data,
        message: templateContent
      };

      return await this.sendSms(smsData, userId, notificationId);
    } catch (error) {
      logger.error('Erreur lors de l\'envoi SMS avec template', {
        templateId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        userId,
        notificationId
      });
      return false;
    }
  }

  async sendBulkSms(
    messages: Array<{
      to: string;
      data: SmsNotificationData;
      userId: string;
      notificationId?: string;
    }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    const batchSize = 20; // Process in smaller batches for SMS
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async ({ to, data, userId, notificationId }) => {
          const result = await this.sendSms({ ...data, to }, userId, notificationId);
          return result;
        })
      );

      success += results.filter(r => r).length;
      failed += results.filter(r => !r).length;

      // Delay between batches to respect rate limits
      if (i + batchSize < messages.length) {
        await this.delay(2000); // 2 seconds between batches
      }
    }

    logger.info('Envoi SMS en masse terminé', {
      total: messages.length,
      success,
      failed
    });

    return { success, failed };
  }

  async sendVerificationSms(phoneNumber: string, code: string, userId: string): Promise<boolean> {
    const message = `Votre code de vérification EasyRent est : ${code}. Ce code expire dans 15 minutes.`;

    return await this.sendSms({
      to: phoneNumber,
      message
    }, userId, 'verification');
  }

  async sendBookingNotificationSms(
    phoneNumber: string,
    bookingDetails: {
      propertyName: string;
      checkIn: string;
      checkOut: string;
      totalAmount: number;
    },
    userId: string
  ): Promise<boolean> {
    const message = `EasyRent: Réservation confirmée pour ${bookingDetails.propertyName} du ${bookingDetails.checkIn} au ${bookingDetails.checkOut}. Montant: ${bookingDetails.totalAmount}€. Détails sur votre compte.`;

    return await this.sendSms({
      to: phoneNumber,
      message
    }, userId, 'booking_confirmation');
  }

  async sendPaymentNotificationSms(
    phoneNumber: string,
    paymentDetails: {
      amount: number;
      reference: string;
      status: 'success' | 'failed';
    },
    userId: string
  ): Promise<boolean> {
    const message = paymentDetails.status === 'success'
      ? `EasyRent: Paiement de ${paymentDetails.amount}€ confirmé. Réf: ${paymentDetails.reference}`
      : `EasyRent: Échec du paiement de ${paymentDetails.amount}€. Réf: ${paymentDetails.reference}. Veuillez réessayer.`;

    return await this.sendSms({
      to: phoneNumber,
      message
    }, userId, 'payment_notification');
  }

  private getSmsTemplate(templateId: string, templateData: Record<string, any> = {}): string {
    const templates: Record<string, string> = {
      verification: `EasyRent: Votre code de vérification est ${templateData.code || 'N/A'}. Expire dans 15 min.`,
      welcome: `Bienvenue sur EasyRent ${templateData.firstName || ''}! Votre compte est activé. Commencez à explorer nos propriétés.`,
      password_reset: `EasyRent: Code de réinitialisation: ${templateData.code || 'N/A'}. Utilisez ce code pour changer votre mot de passe.`,
      booking_reminder: `EasyRent: Rappel - Votre séjour chez ${templateData.propertyName || 'N/A'} commence ${templateData.checkIn || 'bientôt'}.`,
      payment_reminder: `EasyRent: Paiement de ${templateData.amount || 'N/A'}€ dû le ${templateData.dueDate || 'N/A'}. Payez sur votre compte.`,
      visit_reminder: `EasyRent: Visite prévue ${templateData.visitDate || 'N/A'} à ${templateData.visitTime || 'N/A'} pour ${templateData.propertyName || 'N/A'}.`,
      emergency_alert: `EasyRent URGENT: ${templateData.message || 'Vérifiez votre compte immédiatement'}.`
    };

    const template = templates[templateId];
    if (!template) {
      throw new Error(`Template SMS non trouvé: ${templateId}`);
    }

    return template;
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation (international format)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/[\s-()]/g, ''));
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 6) return '***';
    return phoneNumber.substring(0, 3) + '***' + phoneNumber.substring(phoneNumber.length - 2);
  }

  private canSendSms(): boolean {
    const now = Date.now();

    if (now > this.rateLimiter.resetTime) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.resetTime = now + 60000;
    }

    return this.rateLimiter.requests < this.rateLimiter.limit;
  }

  private updateRateLimit(): void {
    this.rateLimiter.requests++;
  }

  private async recordDeliveryHistory(
    notificationId: string,
    userId: string,
    phoneNumber: string,
    status: NotificationStatus,
    providerId?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const history = new NotificationHistory({
        notificationId,
        userId,
        channel: NotificationChannel.SMS,
        status,
        attempts: 1,
        lastAttemptAt: new Date(),
        deliveredAt: status === NotificationStatus.SENT ? new Date() : undefined,
        providerId,
        errorMessage,
        metadata: {
          phoneNumber: this.maskPhoneNumber(phoneNumber),
          provider: 'twilio'
        }
      });

      await history.save();
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement de l\'historique SMS', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        notificationId,
        userId
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getProviderStatus(): Promise<NotificationProvider> {
    return {
      name: 'Twilio SMS',
      type: NotificationChannel.SMS,
      isEnabled: this.isEnabled,
      config: {
        fromNumber: this.fromNumber,
        accountSid: config.twilio?.accountSid ? '***' + config.twilio.accountSid.slice(-4) : 'N/A'
      },
      rateLimit: {
        requests: this.rateLimiter.requests,
        window: 60,
        resetTime: new Date(this.rateLimiter.resetTime)
      }
    };
  }

  async testConfiguration(): Promise<boolean> {
    if (!this.isEnabled || !this.twilioClient) {
      return false;
    }

    try {
      // Test by getting account info (doesn't send SMS)
      const account = await this.twilioClient.api.accounts(config.twilio!.accountSid).fetch();
      logger.info('Test configuration SMS réussi', {
        accountStatus: account.status,
        accountSid: account.sid
      });
      return account.status === 'active';
    } catch (error) {
      logger.error('Test configuration SMS échoué', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  // Get SMS delivery status from Twilio
  async getMessageStatus(messageSid: string): Promise<string | null> {
    if (!this.isEnabled || !this.twilioClient) {
      return null;
    }

    try {
      const message = await this.twilioClient.messages(messageSid).fetch();
      return message.status;
    } catch (error) {
      logger.error('Erreur lors de la récupération du statut SMS', {
        messageSid,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return null;
    }
  }

  // Get SMS usage statistics from Twilio
  async getUsageStats(startDate?: Date, endDate?: Date): Promise<any> {
    if (!this.isEnabled || !this.twilioClient) {
      return null;
    }

    try {
      const usage = await this.twilioClient.usage.records.list({
        category: 'sms',
        startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate: endDate || new Date()
      });

      return {
        totalMessages: usage.reduce((sum, record) => sum + parseInt(record.count.toString()), 0),
        totalCost: usage.reduce((sum, record) => sum + parseFloat(record.price.toString()), 0),
        records: usage.map(record => ({
          date: record.startDate,
          count: record.count,
          price: record.price,
          priceUnit: record.priceUnit
        }))
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des statistiques SMS', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return null;
    }
  }
}