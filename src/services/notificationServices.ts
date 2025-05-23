import nodemailer from 'nodemailer';
import { createLogger } from '../utils/logger/logger';
import { VerificationStatus } from '../users/types/userTypes';

import config from '../../config';

const logger = createLogger('ServiceName');

export class NotificationService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor() {
    // Configuration du transporteur d'emails
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });

    this.fromEmail = config.email.fromAddress || 'noreply@ai.com';
  }

  /**
   * Envoie un email de vérification à un nouvel utilisateur
   */
  async sendVerificationEmail(email: string, firstName: string, token: string,): Promise<boolean> {
    try {
      logger.info('Sending verification email', { email });
      
      const verificationUrl = `${config.app.frontendUrl}/verify-account?token=${token}`;
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Vérifiez votre compte',
        html: `
          <h1>Bienvenue ${firstName}!</h1>
          <p>Merci de vous être inscrit. Veuillez vérifier votre compte en cliquant sur le lien ci-dessous :</p>
          <a href="${verificationUrl}">Vérifier mon compte</a>
          <p>Ce lien est valide pendant 24 heures.</p>
          <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
        `
      });
      
      logger.info('Verification email sent successfully', { email });
      return true;
    } catch (error) {
      logger.error('Error sending verification email', { error, email });
      return false;
    }
  }

  /**
   * Envoie un email de bienvenue après vérification du compte
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    try {
      logger.info('Sending welcome email', { email });
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Bienvenue sur notre plateforme',
        html: `
          <h1>Bienvenue ${firstName}!</h1>
          <p>Votre compte a été vérifié avec succès.</p>
          <p>Vous pouvez maintenant profiter de tous les services de notre plateforme.</p>
          <a href="${config.app.frontendUrl}/login">Se connecter</a>
        `
      });
      
      logger.info('Welcome email sent successfully', { email });
      return true;
    } catch (error) {
      logger.error('Error sending welcome email', { error, email });
      return false;
    }
  }

  /**
   * Envoie un email de réinitialisation de mot de passe
   */
  async sendPasswordResetEmail(email: string, token: string, firstName: string): Promise<boolean> {
    try {
      logger.info('Sending password reset email', { email });
      
      const resetUrl = `${config.app.frontendUrl}/reset-password?token=${token}`;
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        html: `
          <h1>Bonjour ${firstName},</h1>
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :</p>
          <a href="${resetUrl}">Réinitialiser mon mot de passe</a>
          <p>Ce lien est valide pendant 1 heure.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
        `
      });
      
      logger.info('Password reset email sent successfully', { email });
      return true;
    } catch (error) {
      logger.error('Error sending password reset email', { error, email });
      return false;
    }
  }

  /**
   * Envoie une confirmation de changement de mot de passe
   */
  async sendPasswordChangeConfirmationEmail(email: string, firstName: string): Promise<boolean> {
    try {
      logger.info('Sending password change confirmation email', { email });
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Confirmation de changement de mot de passe',
        html: `
          <h1>Bonjour ${firstName},</h1>
          <p>Votre mot de passe a été modifié avec succès.</p>
          <p>Si vous n'avez pas effectué cette modification, veuillez contacter immédiatement notre support.</p>
          <a href="${config.app.frontendUrl}/contact-support">Contacter le support</a>
        `
      });
      
      logger.info('Password change confirmation email sent successfully', { email });
      return true;
    } catch (error) {
      logger.error('Error sending password change confirmation email', { error, email });
      return false;
    }
  }

  /**
   * Envoie une notification de désactivation de compte
   */
  async sendAccountDeactivationEmail(email: string, firstName: string): Promise<boolean> {
    try {
      logger.info('Sending account deactivation email', { email });
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Votre compte a été désactivé',
        html: `
          <h1>Bonjour ${firstName},</h1>
          <p>Votre compte a été désactivé.</p>
          <p>Si vous souhaitez réactiver votre compte ou si vous avez des questions, veuillez contacter notre support.</p>
          <a href="${config.app.frontendUrl}/contact-support">Contacter le support</a>
        `
      });
      
      logger.info('Account deactivation email sent successfully', { email });
      return true;
    } catch (error) {
      logger.error('Error sending account deactivation email', { error, email });
      return false;
    }
  }

  /**
   * Envoie une notification de réactivation de compte
   */
  async sendAccountReactivationEmail(email: string, firstName: string): Promise<boolean> {
    try {
      logger.info('Sending account reactivation email', { email });
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email, 
        subject: 'Votre compte a été réactivé',
        html: `
          <h1>Bonjour ${firstName},</h1>
          <p>Votre compte a été réactivé avec succès.</p>
          <p>Vous pouvez maintenant vous connecter et utiliser à nouveau tous nos services.</p>
          <a href="${config.app.frontendUrl}/login">Se connecter</a>
        `
      });
      
      logger.info('Account reactivation email sent successfully', { email });
      return true;
    } catch (error) {
      logger.error('Error sending account reactivation email', { error, email });
      return false;
    }
  }

  /**
   * Envoie une notification de changement de statut de vérification pour les agents
   */
  async sendAgentVerificationStatusEmail(
    email: string, 
    firstName: string, 
    status: VerificationStatus,
    comment?: string
  ): Promise<boolean> {
    try {
      logger.info('Sending agent verification status email', { email, status });
      
      let subject: string;
      let statusMessage: string;
      
      switch (status) {
        case VerificationStatus.VERIFIED:
          subject = 'Votre compte agent a été vérifié';
          statusMessage = 'Votre compte agent a été vérifié avec succès. Vous pouvez maintenant accéder à toutes les fonctionnalités d\'agent sur notre plateforme.';
          break;
        case VerificationStatus.REJECTED:
          subject = 'Votre demande de vérification a été rejetée';
          statusMessage = 'Nous sommes désolés de vous informer que votre demande de vérification d\'agent a été rejetée.';
          break;
        case VerificationStatus.PENDING:
          subject = 'Votre demande de vérification est en cours d\'examen';
          statusMessage = 'Votre demande de vérification d\'agent est en cours d\'examen par notre équipe.';
          break;
        default:
          subject = 'Mise à jour du statut de votre compte agent';
          statusMessage = 'Le statut de votre compte agent a été mis à jour.';
      }
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject,
        html: `
          <h1>Bonjour ${firstName},</h1>
          <p>${statusMessage}</p>
          ${comment ? `<p>Commentaire: ${comment}</p>` : ''}
          <p>Si vous avez des questions, n'hésitez pas à contacter notre support.</p>
          <a href="${config.app.frontendUrl}/contact-support">Contacter le support</a>
        `
      });
      
      logger.info('Agent verification status email sent successfully', { email, status });
      return true;
    } catch (error) {
      logger.error('Error sending agent verification status email', { error, email, status });
      return false;
    }
  }

  /**
   * Envoie une notification d'alerte de sécurité à l'utilisateur
   * @param email L'email de l'utilisateur
   * @param firstName Le prénom de l'utilisateur
   * @param comment Détails supplémentaires sur l'alerte de sécurité (optionnel)
   * @param alertType Type d'alerte de sécurité (optionnel)
   * @returns Booléen indiquant si l'email a été envoyé avec succès
   */
  async sendSecurityNotification(
    email: string, 
    firstName: string, 
    comment?: string,
    alertType: 'login_attempt' | 'password_changed' | 'account_accessed' | 'information_changed' | 'other' = 'other'
  ): Promise<boolean> {
    try {
      logger.info('Sending security alert email', { email, alertType });
      
      let subject: string;
      let alertMessage: string;
      
      switch (alertType) {
        case 'login_attempt':
          subject = 'Alerte de sécurité: Tentative de connexion suspecte';
          alertMessage = 'Nous avons détecté une tentative de connexion inhabituelle à votre compte.';
          break;
        case 'password_changed':
          subject = 'Alerte de sécurité: Modification de votre mot de passe';
          alertMessage = 'Votre mot de passe a été modifié récemment.';
          break;
        case 'account_accessed':
          subject = 'Alerte de sécurité: Accès à votre compte';
          alertMessage = 'Votre compte a été accédé depuis un nouvel appareil ou une nouvelle localisation.';
          break;
        case 'information_changed':
          subject = 'Alerte de sécurité: Modification de vos informations';
          alertMessage = 'Certaines informations de votre compte ont été modifiées récemment.';
          break;
        default:
          subject = 'Alerte de sécurité sur votre compte';
          alertMessage = 'Une activité inhabituelle a été détectée sur votre compte.';
      }
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject,
        html: `
          <h1>Bonjour ${firstName},</h1>
          <p>${alertMessage}</p>
          ${comment ? `<p>Détails: ${comment}</p>` : ''}
          <p>Si cette activité ne provient pas de vous, veuillez immédiatement:</p>
          <ol>
            <li>Changer votre mot de passe</li>
            <li>Activer l'authentification à deux facteurs si ce n'est pas déjà fait</li>
            <li>Contacter notre équipe de support</li>
          </ol>
          <a href="${config.app.frontendUrl}/change-password">Changer mon mot de passe</a>
          <br>
          <a href="${config.app.frontendUrl}/security-settings">Paramètres de sécurité</a>
          <br>
          <a href="${config.app.frontendUrl}/contact-support">Contacter le support</a>
          <br>
          <p>Si cette activité provient de vous, vous pouvez ignorer cet email.</p>
          <p>Merci de votre vigilance,</p>
          <p>L'équipe de sécurité</p>
        `
      });
      
      logger.info('Security alert email sent successfully', { email, alertType });
      return true;
    } catch (error) {
      logger.error('Error sending security alert email', { error, email, alertType });
      return false;
    }
  }

  /**
   * Envoie une notification de restauration de compte
   * @param email L'email de l'utilisateur
   * @param firstName Le prénom de l'utilisateur
   * @param comment Commentaire optionnel sur la restauration
   * @returns Booléen indiquant si l'email a été envoyé avec succès
   */
  async sendAccountRestoredEmail(email: string, firstName: string, comment?: string): Promise<boolean> {
    try {
      logger.info('Sending account restored email', { email });
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Votre compte a été restauré',
        html: `
          <h1>Bonjour ${firstName},</h1>
          <p>Nous sommes heureux de vous informer que votre compte a été restauré avec succès.</p>
          ${comment ? `<p>Note: ${comment}</p>` : ''}
          <p>Vous pouvez maintenant vous connecter et accéder à tous vos services.</p>
          <p>Pour des raisons de sécurité, nous vous recommandons de:</p>
          <ul>
            <li>Vérifier vos informations de compte</li>
            <li>Changer votre mot de passe</li>
            <li>Activer l'authentification à deux facteurs</li>
          </ul>
          <a href="${config.app.frontendUrl}/login">Se connecter</a>
          <br>
          <a href="${config.app.frontendUrl}/security-settings">Paramètres de sécurité</a>
          <p>Si vous avez des questions, n'hésitez pas à contacter notre support.</p>
          <a href="${config.app.frontendUrl}/contact-support">Contacter le support</a>
        `
      });
      
      logger.info('Account restored email sent successfully', { email });
      return true;
    } catch (error) {
      logger.error('Error sending account restored email', { error, email });
      return false;
    }
  }

  /**
   * Envoie une notification de suppression définitive de compte
   * @param email L'email de l'utilisateur
   * @param firstName Le prénom de l'utilisateur
   * @param comment Commentaire optionnel sur la suppression
   * @returns Booléen indiquant si l'email a été envoyé avec succès
   */
  async sendAccountDeletedEmail(email: string, firstName: string, comment?: string): Promise<boolean> {
    try {
      logger.info('Sending account deleted email', { email });
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Confirmation de suppression de votre compte',
        html: `
          <h1>Bonjour ${firstName},</h1>
          <p>Nous confirmons que votre compte a été définitivement supprimé de notre plateforme.</p>
          ${comment ? `<p>Raison: ${comment}</p>` : ''}
          <p>Toutes vos données personnelles ont été supprimées de nos serveurs conformément à notre politique de confidentialité.</p>
          <p>Si cette suppression n'était pas intentionnelle ou si vous souhaitez créer un nouveau compte, vous pouvez:</p>
          <ul>
            <li>Créer un nouveau compte</li>
            <li>Contacter notre équipe de support</li>
          </ul>
          <a href="${config.app.frontendUrl}/register">Créer un nouveau compte</a>
          <br>
          <a href="${config.app.frontendUrl}/contact-support">Contacter le support</a>
          <p>Nous vous remercions d'avoir utilisé nos services.</p>
        `
      });
      
      logger.info('Account deleted email sent successfully', { email });
      return true;
    } catch (error) {
      logger.error('Error sending account deleted email', { error, email });
      return false;
    }
  }

  /**
   * Envoie une notification de verrouillage de compte
   * @param email L'email de l'utilisateur
   * @param firstName Le prénom de l'utilisateur
   * @param reason Raison du verrouillage (optionnel)
   * @param unlockDate Date de déverrouillage automatique (optionnel)
   * @returns Booléen indiquant si l'email a été envoyé avec succès
   */
  async sendAccountLockedEmail(
    email: string, 
    firstName: string, 
    reason?: string,
    unlockDate?: Date
  ): Promise<boolean> {
    try {
      logger.info('Sending account locked email', { email });
      
      const unlockInfo = unlockDate 
        ? `<p>Votre compte sera automatiquement déverrouillé le ${unlockDate.toLocaleDateString('fr-FR')} à ${unlockDate.toLocaleTimeString('fr-FR')}.</p>`
        : '<p>Veuillez contacter notre équipe de support pour débloquer votre compte.</p>';
      
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Votre compte a été temporairement verrouillé',
        html: `
          <h1>Bonjour ${firstName},</h1>
          <p>Votre compte a été temporairement verrouillé pour des raisons de sécurité.</p>
          ${reason ? `<p>Raison: ${reason}</p>` : ''}
          ${unlockInfo}
          <p>Pendant que votre compte est verrouillé, vous ne pourrez pas:</p>
          <ul>
            <li>Vous connecter à votre compte</li>
            <li>Accéder à vos services</li>
            <li>Effectuer des transactions</li>
          </ul>
          <p>Si vous pensez qu'il s'agit d'une erreur ou si vous avez des questions, veuillez contacter immédiatement notre équipe de support.</p>
          <a href="${config.app.frontendUrl}/contact-support">Contacter le support</a>
          <p>Nous nous excusons pour la gêne occasionnée.</p>
        `
      });
      
      logger.info('Account locked email sent successfully', { email });
      return true;
    } catch (error) {
      logger.error('Error sending account locked email', { error, email });
      return false;
    }
  }
}