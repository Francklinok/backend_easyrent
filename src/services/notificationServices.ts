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

    this.fromEmail = config.email.fromAddress || 'noreply@example.com';
  }

  /**
   * Envoie un email de vérification à un nouvel utilisateur
   */
  async sendVerificationEmail(email: string, token: string, firstName: string): Promise<boolean> {
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
}

//////////////:
// import nodemailer from 'nodemailer';
// import createLogger from '../../utils/logger/logger';
// import { VerificationStatus } from '../types/userTypes';
// import config from '../../config/config';

// const logger = createLogger;

// export class NotificationService {
//   private transporter: nodemailer.Transporter;
//   private fromEmail: string;

//   constructor() {
//     // Configuration du transporteur d'emails
//     this.transporter = nodemailer.createTransport({
//       host: config.email.host,
//       port: config.email.port,
//       secure: config.email.secure,
//       auth: {
//         user: config.email.user,
//         pass: config.email.password,
//       },
//     });

//     this.fromEmail = config.email.fromAddress || 'noreply@example.com';
//   }

//   /**
//    * Envoie un email de vérification à un nouvel utilisateur
//    */
//   async sendVerificationEmail(email: string, token: string, firstName: string): Promise<boolean> {
//     try {
//       logger.info('Sending verification email', { email });
      
//       const verificationUrl = `${config.app.frontendUrl}/verify-account?token=${token}`;
      
//       await this.transporter.sendMail({
//         from: this.fromEmail,
//         to: email,
//         subject: 'Vérifiez votre compte',
//         html: `
//           <h1>Bienvenue ${firstName}!</h1>
//           <p>Merci de vous être inscrit. Veuillez vérifier votre compte en cliquant sur le lien ci-dessous :</p>
//           <a href="${verificationUrl}">Vérifier mon compte</a>
//           <p>Ce lien est valide pendant 24 heures.</p>
//           <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
//         `
//       });
      
//       logger.info('Verification email sent successfully', { email });
//       return true;
//     } catch (error) {
//       logger.error('Error sending verification email', { error, email });
//       return false;
//     }
//   }

//   /**
//    * Envoie un email de bienvenue après vérification du compte
//    */
//   async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
//     try {
//       logger.info('Sending welcome email', { email });
      
//       await this.transporter.sendMail({
//         from: this.fromEmail,
//         to: email,
//         subject: 'Bienvenue sur notre plateforme',
//         html: `
//           <h1>Bienvenue ${firstName}!</h1>
//           <p>Votre compte a été vérifié avec succès.</p>
//           <p>Vous pouvez maintenant profiter de tous les services de notre plateforme.</p>
//           <a href="${config.app.frontendUrl}/login">Se connecter</a>
//         `
//       });
      
//       logger.info('Welcome email sent successfully', { email });
//       return true;
//     } catch (error) {
//       logger.error('Error sending welcome email', { error, email });
//       return false;
//     }
//   }

//   /**
//    * Envoie un email de réinitialisation de mot de passe
//    */
//   async sendPasswordResetEmail(email: string, token: string, firstName: string): Promise<boolean> {
//     try {
//       logger.info('Sending password reset email', { email });
      
//       const resetUrl = `${config.app.frontendUrl}/reset-password?token=${token}`;
      
//       await this.transporter.sendMail({
//         from: this.fromEmail,
//         to: email,
//         subject: 'Réinitialisation de votre mot de passe',
//         html: `
//           <h1>Bonjour ${firstName},</h1>
//           <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
//           <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :</p>
//           <a href="${resetUrl}">Réinitialiser mon mot de passe</a>
//           <p>Ce lien est valide pendant 1 heure.</p>
//           <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
//         `
//       });
      
//       logger.info('Password reset email sent successfully', { email });
//       return true;
//     } catch (error) {
//       logger.error('Error sending password reset email', { error, email });
//       return false;
//     }
//   }

//   /**
//    * Envoie une confirmation de changement de mot de passe
//    */
//   async sendPasswordChangeConfirmationEmail(email: string, firstName: string): Promise<boolean> {
//     try {
//       logger.info('Sending password change confirmation email', { email });
      
//       await this.transporter.sendMail({
//         from: this.fromEmail,
//         to: email,
//         subject: 'Confirmation de changement de mot de passe',
//         html: `
//           <h1>Bonjour ${firstName},</h1>
//           <p>Votre mot de passe a été modifié avec succès.</p>
//           <p>Si vous n'avez pas effectué cette modification, veuillez contacter immédiatement notre support.</p>
//           <a href="${config.app.frontendUrl}/contact-support">Contacter le support</a>
//         `
//       });
      
//       logger.info('Password change confirmation email sent successfully', { email });
//       return true;
//     } catch (error) {
//       logger.error('Error sending password change confirmation email', { error, email });
//       return false;
//     }
//   }

//   /**
//    * Envoie une notification de désactivation de compte
//    */
//   async sendAccountDeactivationEmail(email: string, firstName: string): Promise<boolean> {
//     try {
//       logger.info('Sending account deactivation email', { email });
      
//       await this.transporter.sendMail({
//         from: this.fromEmail,
//         to: email,
//         subject: 'Votre compte a été désactivé',
//         html: `
//           <h1>Bonjour ${firstName},</h1>
//           <p>Votre compte a été désactivé.</p>
//           <p>Si vous souhaitez réactiver votre compte ou si vous avez des questions, veuillez contacter notre support.</p>
//           <a href="${config.app.frontendUrl}/contact-support">Contacter le support</a>
//         `
//       });
      
//       logger.info('Account deactivation email sent successfully', { email });
//       return true;
//     } catch (error) {
//       logger.error('Error sending account deactivation email', { error, email });
//       return false;
//     }
//   }

//   /**
//    * Envoie une notification de réactivation de compte
//    */
//   async sendAccountReactivationEmail(email: string, firstName: string): Promise<boolean> {
//     try {
//       logger.info('Sending account reactivation email', { email });
      
//       await this.transporter.sendMail({
//         from: this.fromEmail,
//         to: email,
//         subject: 'Votre compte a été réactivé',
//         html: `
//           <h1>Bonjour ${firstName},</h1>
//           <p>Votre compte a été réactivé avec succès.</p>
//           <p>Vous pouvez maintenant vous connecter et utiliser à nouveau tous nos services.</p>
//           <a href="${config.app.frontendUrl}/login">Se connecter</a>
//         `
//       });
      
//       logger.info('Account reactivation email sent successfully', { email });
//       return true;
//     } catch (error) {
//       logger.error('Error sending account reactivation email', { error, email });
//       return false;
//     }
//   }

//   /**
//    * Envoie une notification de changement de statut de vérification pour les agents
//    */
//   async sendAgentVerificationStatusEmail(
//     email: string, 
//     firstName: string, 
//     status: VerificationStatus,
//     comment?: string
//   ): Promise<boolean> {
//     try {
//       logger.info('Sending agent verification status email', { email, status });
      
//       let subject: string;
//       let statusMessage: string;
      
//       switch (status) {
//         case VerificationStatus.VERIFIED:
//           subject = 'Votre compte agent a été vérifié';
//           statusMessage = 'Votre compte agent a été vérifié avec succès. Vous pouvez maintenant accéder à toutes les fonctionnalités d\'agent sur notre plateforme.';
//           break;
//         case VerificationStatus.REJECTED:
//           subject = 'Votre demande de vérification a été rejetée';
//           statusMessage = 'Nous sommes désolés de vous informer que votre demande de vérification d\'agent a été rejetée.';
//           break;
//         case VerificationStatus.PENDING:
//           subject = 'Votre demande de vérification est en cours d\'examen';
//           statusMessage = 'Votre demande de vérification d\'agent est en cours d\'examen par notre équipe.';
//           break;
//         default:
//           subject = 'Mise à jour du statut de votre compte agent';
//           statusMessage = 'Le statut de votre compte agent a été mis à jour.';
//       }
      
//       await this.transporter.sendMail({
//         from: this.fromEmail,
//         to: email,
//         subject,
//         html: `
//           <h1>Bonjour ${firstName},</h1>
//           <p>${statusMessage}</p>
//           ${comment ? `<p>Commentaire: ${comment}</p>` : ''}
//           <p>Si vous avez des questions, n'hésitez pas à contacter notre support.</p>
//           <a href="${config.app.frontendUrl}/contact-support">Contacter le support</a>
//         `
//       });
      
//       logger.info('Agent verification status email sent successfully', { email, status });
//       return true;
//     } catch (error) {
//       logger.error('Error sending agent verification status email', { error, email, status });
//       return false;
//     }
//   }
// }