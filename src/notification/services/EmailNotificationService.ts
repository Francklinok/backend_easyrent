import { NotificationService } from '../../services/notificationServices';
import { EmailNotificationData, NotificationProvider, NotificationChannel, NotificationStatus } from '../types/notificationTypes';
import { NotificationHistory } from '../models/Notification';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('EmailNotificationService');

export class EmailNotificationService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async sendEmail(data: EmailNotificationData, userId: string, notificationId?: string): Promise<boolean> {
    try {
      const recipients = Array.isArray(data.to) ? data.to : [data.to];
      const results = await Promise.all(
        recipients.map(async (email) => {
          const success = await this.notificationService.sendEmailSafely({
            to: email,
            subject: data.subject,
            html: data.htmlContent || '',
            text: data.textContent
          });

          // Record in history
          await this.recordDeliveryHistory(
            notificationId || 'direct',
            userId,
            email,
            success ? NotificationStatus.SENT : NotificationStatus.FAILED
          );

          return success;
        })
      );

      return results.some(result => result);
    } catch (error) {
      logger.error('Erreur lors de l\'envoi d\'email', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        userId,
        notificationId
      });
      return false;
    }
  }

  async sendTemplateEmail(
    templateId: string,
    data: EmailNotificationData & { templateData?: Record<string, any> },
    userId: string,
    notificationId?: string
  ): Promise<boolean> {
    try {
      // Get template content based on templateId
      const templateContent = await this.getEmailTemplate(templateId, data.templateData);

      const emailData: EmailNotificationData = {
        ...data,
        htmlContent: templateContent.html,
        textContent: templateContent.text
      };

      return await this.sendEmail(emailData, userId, notificationId);
    } catch (error) {
      logger.error('Erreur lors de l\'envoi d\'email avec template', {
        templateId,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        userId,
        notificationId
      });
      return false;
    }
  }

  async sendBulkEmail(
    emails: Array<{
      to: string;
      data: EmailNotificationData;
      userId: string;
      notificationId?: string;
    }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    const batchSize = 50; // Process in batches to avoid overwhelming the system
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async ({ to, data, userId, notificationId }) => {
          const result = await this.sendEmail({ ...data, to }, userId, notificationId);
          return result;
        })
      );

      success += results.filter(r => r).length;
      failed += results.filter(r => !r).length;

      // Small delay between batches
      if (i + batchSize < emails.length) {
        await this.delay(1000);
      }
    }

    logger.info('Envoi d\'emails en masse terminé', {
      total: emails.length,
      success,
      failed
    });

    return { success, failed };
  }

  private async getEmailTemplate(
    templateId: string,
    templateData: Record<string, any> = {}
  ): Promise<{ html: string; text?: string }> {
    // This would typically fetch from a database or template service
    // For now, we'll use predefined templates
    const templates: Record<string, { html: string; text?: string }> = {
      welcome: {
        html: this.getWelcomeTemplate(templateData),
        text: `Bienvenue ${templateData.firstName || 'cher utilisateur'} ! Votre compte a été créé avec succès.`
      },
      verification: {
        html: this.getVerificationTemplate(templateData),
        text: `Code de vérification: ${templateData.code || 'N/A'}`
      },
      password_reset: {
        html: this.getPasswordResetTemplate(templateData),
        text: `Réinitialisez votre mot de passe: ${templateData.resetLink || 'N/A'}`
      },
      booking_confirmation: {
        html: this.getBookingConfirmationTemplate(templateData),
        text: `Votre réservation a été confirmée.`
      },
      payment_confirmation: {
        html: this.getPaymentConfirmationTemplate(templateData),
        text: `Votre paiement de ${templateData.amount || 'N/A'} a été confirmé.`
      }
    };

    const template = templates[templateId];
    if (!template) {
      throw new Error(`Template non trouvé: ${templateId}`);
    }

    return template;
  }

  private getWelcomeTemplate(data: Record<string, any>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
          <h1 style="color: #28a745;">Bienvenue sur EasyRent, ${data.firstName || 'cher utilisateur'} !</h1>
          <p style="font-size: 16px;">
            Votre compte a été créé avec succès. Nous sommes ravis de vous compter parmi nos utilisateurs.
          </p>
          <div style="margin: 30px 0;">
            <a href="${data.dashboardUrl || '#'}"
               style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none;
                      border-radius: 5px; display: inline-block; font-weight: bold;">
              Accéder à mon compte
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private getVerificationTemplate(data: Record<string, any>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
          <h1 style="color: #007bff;">Code de vérification</h1>
          <p>Voici votre code de vérification :</p>
          <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin: 0; font-size: 32px; letter-spacing: 8px;">${data.code || 'N/A'}</h2>
          </div>
          <p style="color: #666;">Ce code expire dans 15 minutes.</p>
        </div>
      </div>
    `;
  }

  private getPasswordResetTemplate(data: Record<string, any>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h1 style="color: #dc3545;">Réinitialisation de mot de passe</h1>
          <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetLink || '#'}"
               style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none;
                      border-radius: 5px; display: inline-block; font-weight: bold;">
              Réinitialiser
            </a>
          </div>
          <p style="color: #666;">Ce lien expire dans 1 heure.</p>
        </div>
      </div>
    `;
  }

  private getBookingConfirmationTemplate(data: Record<string, any>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h1 style="color: #28a745;">Réservation confirmée</h1>
          <p>Votre réservation a été confirmée avec succès !</p>
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Détails de la réservation :</h3>
            <p><strong>Propriété :</strong> ${data.propertyName || 'N/A'}</p>
            <p><strong>Date d'arrivée :</strong> ${data.checkIn || 'N/A'}</p>
            <p><strong>Date de départ :</strong> ${data.checkOut || 'N/A'}</p>
            <p><strong>Montant total :</strong> ${data.totalAmount || 'N/A'} €</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.bookingUrl || '#'}"
               style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none;
                      border-radius: 5px; display: inline-block; font-weight: bold;">
              Voir ma réservation
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private getPaymentConfirmationTemplate(data: Record<string, any>): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h1 style="color: #28a745;">Paiement confirmé</h1>
          <p>Votre paiement a été traité avec succès !</p>
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Détails du paiement :</h3>
            <p><strong>Montant :</strong> ${data.amount || 'N/A'} €</p>
            <p><strong>Référence :</strong> ${data.reference || 'N/A'}</p>
            <p><strong>Date :</strong> ${data.date || new Date().toLocaleDateString('fr-FR')}</p>
            <p><strong>Méthode :</strong> ${data.paymentMethod || 'N/A'}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.invoiceUrl || '#'}"
               style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none;
                      border-radius: 5px; display: inline-block; font-weight: bold;">
              Télécharger la facture
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private async recordDeliveryHistory(
    notificationId: string,
    userId: string,
    email: string,
    status: NotificationStatus
  ): Promise<void> {
    try {
      const history = new NotificationHistory({
        notificationId,
        userId,
        channel: NotificationChannel.EMAIL,
        status,
        attempts: 1,
        lastAttemptAt: new Date(),
        deliveredAt: status === NotificationStatus.SENT ? new Date() : undefined,
        metadata: {
          email,
          provider: 'internal'
        }
      });

      await history.save();
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement de l\'historique', {
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
    const status = this.notificationService.getServicesStatus();

    return {
      name: 'Email Service',
      type: NotificationChannel.EMAIL,
      isEnabled: status.email.sendgrid || status.email.smtp,
      config: {
        primaryService: status.email.primary,
        sendgridEnabled: status.email.sendgrid,
        smtpEnabled: status.email.smtp
      }
    };
  }

  async testConfiguration(): Promise<boolean> {
    try {
      const testResult = await this.notificationService.testEmailConfiguration();
      return testResult.overall;
    } catch (error) {
      logger.error('Erreur lors du test de configuration email', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }
}