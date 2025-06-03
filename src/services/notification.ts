// // import nodemailer, { Transporter } from 'nodemailer';
// // import { createLogger } from '../utils/logger/logger';
// // import { VerificationStatus } from '../users/types/userTypes';
// // import config from '../../config';
// // import sgMail from '@sendgrid/mail';


// // const logger = createLogger('NotificationService');

// // export class NotificationService {
// //   private transporter!: Transporter;
// //   private fromEmail: string;
// //   private isEmailEnabled: boolean;

// //   constructor() {
// //     this.fromEmail = config.email.fromAddress || 'noreply@easyrent.com';
// //     this.isEmailEnabled = config.email.enabled && this.isEmailConfigValid();
    
// //     if (this.isEmailEnabled) {
// //       this.initializeTransporter();
// //     } else {
// //       logger.warn('Email service disabled or configuration invalid', {
// //         enabled: config.email.enabled,
// //         configValid: this.isEmailConfigValid()
// //       });
// //     }
// //   }

// //   /**
// //    * Vérifie si la configuration email est valide
// //    */
// //   private isEmailConfigValid(): boolean {
// //     return !!(
// //       config.email.host &&
// //       config.email.user &&
// //       config.email.password &&
// //       config.email.port
// //     );
// //   }

// //   /**
// //    * Initialise le transporteur email avec gestion d'erreur améliorée
// //    */
// //   private initializeTransporter(): void {
// //     try {
// //       // Configuration SMTP avec options de production
// //       this.transporter = nodemailer.createTransport({
// //         host: config.email.host,
// //         port: config.email.port,
// //         secure: config.email.secure, // true pour port 465, false pour autres ports
// //         auth: {
// //           user: config.email.user,
// //           pass: config.email.password
// //         },
// //         // Options pour améliorer la fiabilité
// //         pool: config.email.pool || true,
// //         maxConnections: config.email.maxConnections || 5,
// //         maxMessages: 100,
// //         rateDelta: 20000,
// //         rateLimit: 5,
// //         // Options de timeout
// //         connectionTimeout: config.email.timeout || 15000,
// //         greetingTimeout: 10000,
// //         socketTimeout: 30000,
// //         // Options TLS
// //         tls: {
// //           rejectUnauthorized: config.app.env === 'production',
// //           minVersion: 'TLSv1.2'
// //         },
// //         // Options pour debug en développement
// //         debug: config.app.env === 'development',
// //         logger: config.app.env === 'development'
// //       });

// //       // Vérifier la configuration au démarrage (en mode non-bloquant)
// //       this.verifyConnectionAsync();
      
// //       logger.info('Email transporter initialized successfully', {
// //         host: config.email.host,
// //         port: config.email.port,
// //         secure: config.email.secure,
// //         fromEmail: this.fromEmail
// //       });
// //     } catch (error) {
// //       logger.error('Failed to initialize email transporter', { 
// //         error: error instanceof Error ? error.message : 'Erreur inconnue' 
// //       });
// //       this.isEmailEnabled = false;
// //     }
// //   }

// //   /**
// //    * Vérification de connexion asynchrone pour ne pas bloquer le démarrage
// //    */
// //   private async verifyConnectionAsync(): Promise<void> {
// //     try {
// //       // Timeout pour éviter de bloquer trop longtemps
// //       await Promise.race([
// //         this.transporter.verify(),
// //         new Promise((_, reject) => 
// //           setTimeout(() => reject(new Error('Connection verification timeout')), 10000)
// //         )
// //       ]);
// //       logger.info('SMTP connection verified successfully');
// //     } catch (error) {
// //       logger.error('SMTP connection verification failed', { 
// //         error: error instanceof Error ? error.message : 'Erreur inconnue',
// //         host: config.email.host,
// //         port: config.email.port,
// //       });
// //       // En développement, on peut continuer sans email
// //       if (config.app.env === 'development') {
// //         logger.warn('Continuing without email service in development mode');
// //       }
// //     }
// //   }

// // private async sendWithSendGrid(mailOptions: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
// //   if (!config.sendgrid.enabled || !config.sendgrid.apiKey) {
// //     logger.warn('SendGrid non activé ou mal configuré');
// //     return false;
// //   }

// //   try {
// //     sgMail.setApiKey(config.sendgrid.apiKey);

// //     const msg = {
// //       to: mailOptions.to,
// //       from: this.fromEmail, // ou config.sendgrid.fromAddress
// //       subject: mailOptions.subject,
// //       html: mailOptions.html,
// //       text: mailOptions.text || '',
// //     };

// //     const response = await sgMail.send(msg);

// //     logger.info('Email envoyé avec SendGrid', {
// //       to: this.maskEmail(mailOptions.to),
// //       subject: mailOptions.subject,
// //       responseStatus: response[0].statusCode
// //     });

// //     return true;
// //   } catch (error) {
// //     logger.error('Erreur lors de l’envoi via SendGrid', {
// //       to: this.maskEmail(mailOptions.to),
// //       subject: mailOptions.subject,
// //       error: error instanceof Error ? error.message : 'Erreur inconnue'
// //     });

// //     return false;
// //   }
// // }


// //   /**
// //    * Méthode helper pour envoyer un email avec gestion d'erreur unifiée
// //   //  */
// //   // private async sendEmailSafely(mailOptions: any): Promise<boolean> {
// //   //   if (!this.isEmailEnabled) {
// //   //     logger.warn('Email service disabled, skipping email send', {
// //   //       to: mailOptions.to,
// //   //       subject: mailOptions.subject
// //   //     });
// //   //     return false;
// //   //   }

// //   //   try {
// //   //     // Vérifier que le transporter est toujours actif
// //   //     if (!this.transporter) {
// //   //       logger.error('Email transporter not initialized');
// //   //       return false;
// //   //     }

// //   //     // Envoyer avec timeout
// //   //     const result = await Promise.race([
// //   //       this.transporter.sendMail(mailOptions),
// //   //       new Promise((_, reject) => 
// //   //         setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
// //   //       )
// //   //     ]) as any;

// //   //     logger.info('Email sent successfully', { 
// //   //       to: this.maskEmail(mailOptions.to),
// //   //       subject: mailOptions.subject,
// //   //       messageId: result.messageId 
// //   //     });
// //   //     return true;
// //   //   } catch (error) {
// //   //     logger.error('Error sending email', { 
// //   //       error: error instanceof Error ? error.message : 'Erreur inconnue',
// //   //       to: this.maskEmail(mailOptions.to),
// //   //       subject: mailOptions.subject,
// //   //       stack: error instanceof Error ? error.stack : undefined
// //   //     });
// //   //     return false;
// //   //   }
// //   // }
// //   private async sendEmailSafely(mailOptions: any): Promise<boolean> {
// //   if (!this.isEmailEnabled) {
// //     logger.warn('Transport SMTP désactivé, tentative avec SendGrid...');
// //     return this.sendWithSendGrid(mailOptions);
// //   }

// //   try {
// //     if (!this.transporter) {
// //       throw new Error('Transport SMTP non initialisé');
// //     }

// //     const result = await Promise.race([
// //       this.transporter.sendMail(mailOptions),
// //       new Promise((_, reject) =>
// //         setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
// //       )
// //     ]) as any;

// //     logger.info('Email envoyé avec SMTP', {
// //       to: this.maskEmail(mailOptions.to),
// //       subject: mailOptions.subject,
// //       messageId: result.messageId
// //     });

// //     return true;
// //   } catch (smtpError) {
// //     logger.warn('Échec SMTP, tentative SendGrid...', {
// //       error: smtpError instanceof Error ? smtpError.message : 'Erreur SMTP inconnue'
// //     });

// //     // ⛑️ Fallback vers SendGrid
// //     return this.sendWithSendGrid(mailOptions);
// //   }
// // }


// //   /**
// //    * Masque l'email pour les logs
// //    */
// //   private maskEmail(email: string): string {
// //     if (!email || email.length < 3) return '***';
// //     const [local, domain] = email.split('@');
// //     if (!domain) return email.substring(0, 3) + '***';
// //     return local.substring(0, Math.min(3, local.length)) + '***@' + domain;
// //   }

// //   // ✅ Méthodes d'envoi d'email refactorisées

// //   async sendAccountReactivationEmail(email: string, firstName: string): Promise<boolean> {
// //     const mailOptions = {
// //       from: {
// //         name: 'EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject: 'Votre compte a été réactivé - EasyRent',
// //       html: this.getAccountReactivationTemplate(firstName)
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   async sendVerificationEmail(email: string, firstName: string, token: string): Promise<boolean> {
// //     const verificationUrl = `${config.app.frontendUrl}/verify-account?token=${token}`;
    
// //     const mailOptions = {
// //       from: {
// //         name: 'EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject: 'Vérifiez votre compte - EasyRent',
// //       html: this.getVerificationEmailTemplate(firstName, verificationUrl),
// //       text: `Bonjour ${firstName}, veuillez vérifier votre compte en visitant : ${verificationUrl}`
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
// //     const mailOptions = {
// //       from: {
// //         name: 'EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject: 'Bienvenue sur EasyRent !',
// //       html: this.getWelcomeEmailTemplate(firstName)
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   async sendPasswordResetEmail(email: string, firstName: string, resetToken: string): Promise<boolean> {
// //     const resetUrl = `${config.app.frontendUrl}/reset-password?token=${resetToken}`;
    
// //     const mailOptions = {
// //       from: {
// //         name: 'EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject: 'Réinitialisation de votre mot de passe - EasyRent',
// //       html: this.getPasswordResetEmailTemplate(firstName, resetUrl)
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   async sendPasswordChangeConfirmationEmail(email: string, firstName: string): Promise<boolean> {
// //     const mailOptions = {
// //       from: {
// //         name: 'EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject: 'Confirmation de changement de mot de passe - EasyRent',
// //       html: this.getPasswordChangeConfirmationTemplate(firstName)
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   async sendAgentVerificationStatusEmail(
// //     email: string, 
// //     firstName: string, 
// //     status: VerificationStatus,
// //     comment?: string
// //   ): Promise<boolean> {
// //     let subject: string;
    
// //     switch (status) {
// //       case VerificationStatus.VERIFIED:
// //         subject = 'Votre compte agent a été vérifié - EasyRent';
// //         break;
// //       case VerificationStatus.REJECTED:
// //         subject = 'Votre demande de vérification a été rejetée - EasyRent';
// //         break;
// //       case VerificationStatus.PENDING:
// //         subject = 'Votre demande de vérification est en cours - EasyRent';
// //         break;
// //       default:
// //         subject = 'Mise à jour de votre compte agent - EasyRent';
// //     }
    
// //     const mailOptions = {
// //       from: {
// //         name: 'EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject,
// //       html: this.getAgentVerificationStatusTemplate(firstName, status, comment)
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   async sendSecurityNotification(
// //     email: string, 
// //     firstName: string, 
// //     comment?: string,
// //     alertType: 'login_attempt' | 'password_changed' | 'account_accessed' | 'information_changed' | 'other' = 'other'
// //   ): Promise<boolean> {
// //     let subject: string;
    
// //     switch (alertType) {
// //       case 'login_attempt':
// //         subject = 'Alerte de sécurité: Tentative de connexion suspecte - EasyRent';
// //         break;
// //       case 'password_changed':
// //         subject = 'Alerte de sécurité: Modification de votre mot de passe - EasyRent';
// //         break;
// //       case 'account_accessed':
// //         subject = 'Alerte de sécurité: Accès à votre compte - EasyRent';
// //         break;
// //       case 'information_changed':
// //         subject = 'Alerte de sécurité: Modification de vos informations - EasyRent';
// //         break;
// //       default:
// //         subject = 'Alerte de sécurité sur votre compte - EasyRent';
// //     }
    
// //     const mailOptions = {
// //       from: {
// //         name: 'Équipe Sécurité - EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject,
// //       html: this.getSecurityAlertEmailTemplate(firstName, alertType, comment)
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   async sendAccountDeactivationEmail(email: string, firstName: string): Promise<boolean> {
// //     const mailOptions = {
// //       from: {
// //         name: 'EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject: 'Votre compte a été désactivé - EasyRent',
// //       html: this.getAccountDeactivationTemplate(firstName)
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   async sendAccountLockedEmail(
// //     email: string, 
// //     firstName: string, 
// //     reason?: string,
// //     lockDuration?: string
// //   ): Promise<boolean> {
// //     const mailOptions = {
// //       from: {
// //         name: 'Équipe Sécurité - EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject: '🔒 Votre compte a été temporairement verrouillé - EasyRent',
// //       html: this.getAccountLockedEmailTemplate(firstName, reason, lockDuration)
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   async sendAccountDeletedEmail(email: string, firstName: string, comment?: string): Promise<boolean> {
// //     const mailOptions = {
// //       from: {
// //         name: 'EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject: 'Confirmation de suppression de votre compte - EasyRent',
// //       html: this.getAccountDeletedTemplate(firstName, comment)
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   async sendAccountRestoredEmail(
// //     email: string, 
// //     firstName: string, 
// //     comment?: string
// //   ): Promise<boolean> {
// //     const mailOptions = {
// //       from: {
// //         name: 'Équipe Support - EasyRent',
// //         address: this.fromEmail
// //       },
// //       to: email,
// //       subject: '✅ Votre compte a été restauré - EasyRent',
// //       html: this.getAccountRestoredEmailTemplate(firstName, comment)
// //     };

// //     return this.sendEmailSafely(mailOptions);
// //   }

// //   /**
// //    * Méthode pour tester la configuration email
// //    */
// //   async testEmailConfiguration(): Promise<boolean> {
// //     if (!this.isEmailEnabled) {
// //       logger.info('Email service is disabled');
// //       return false;
// //     }

// //     try {
// //       await Promise.race([
// //         this.transporter.verify(),
// //         new Promise((_, reject) => 
// //           setTimeout(() => reject(new Error('Test timeout')), 10000)
// //         )
// //       ]);
// //       logger.info('Email configuration test successful');
// //       return true;
// //     } catch (error) {
// //       logger.error('Email configuration test failed', { 
// //         error: error instanceof Error ? error.message : 'Erreur inconnue' 
// //       });
// //       return false;
// //     }
// //   }

// //   // ✅ Templates d'emails optimisés

// //   private getAccountReactivationTemplate(firstName: string): string {
// //     return `
// //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
// //           <h1 style="color: #28a745;">✅ Compte Réactivé</h1>
// //           <p>Bonjour ${firstName},</p>
// //           <p>Votre compte EasyRent a été réactivé avec succès.</p>
// //           <p>Vous pouvez maintenant vous connecter et utiliser à nouveau tous nos services.</p>
          
// //           <div style="text-align: center; margin: 30px 0;">
// //             <a href="${config.app.frontendUrl}/login" 
// //                style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; 
// //                       border-radius: 5px; display: inline-block; font-weight: bold;">
// //               Se connecter
// //             </a>
// //           </div>
// //         </div>
// //       </div>
// //     `;
// //   }

// //   private getAccountDeactivationTemplate(firstName: string): string {
// //     return `
// //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107;">
// //           <h1 style="color: #ffc107;">⚠️ Compte Désactivé</h1>
// //           <p>Bonjour ${firstName},</p>
// //           <p style="font-size: 16px; font-weight: bold; color: #856404;">
// //             Votre compte EasyRent a été temporairement désactivé.
// //           </p>
          
// //           <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
// //             <p style="margin: 0; color: #856404;">
// //               <strong>Que signifie cela ?</strong>
// //             </p>
// //             <ul style="color: #856404; margin: 10px 0;">
// //               <li>Vous ne pouvez plus vous connecter à votre compte</li>
// //               <li>Vos annonces ne sont plus visibles</li>
// //               <li>Vous ne pouvez pas effectuer de nouvelles actions</li>
// //             </ul>
// //           </div>
          
// //           <p style="color: #333;">
// //             Cette mesure est généralement temporaire. Pour réactiver votre compte ou obtenir plus d'informations, 
// //             veuillez contacter notre équipe de support.
// //           </p>
          
// //           <div style="text-align: center; margin: 30px 0;">
// //             <a href="${config.app.frontendUrl}/contact-support" 
// //                style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; 
// //                       border-radius: 4px; display: inline-block; margin: 5px;">
// //               Contacter le support
// //             </a>
// //           </div>
          
// //           <p style="font-size: 14px; color: #666;">
// //             Nous nous efforçons de maintenir un environnement sûr pour tous nos utilisateurs.
// //           </p>
// //           <p style="font-weight: bold;">L'équipe EasyRent</p>
// //         </div>
// //       </div>
// //     `;
// //   }

// //   private getAccountDeletedTemplate(firstName: string, comment?: string): string {
// //     return `
// //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
// //           <h1 style="color: #dc3545;">❌ Compte Supprimé</h1>
// //           <p>Bonjour ${firstName},</p>
// //           <p style="font-size: 16px; font-weight: bold; color: #dc3545;">
// //             Votre compte EasyRent a été définitivement supprimé.
// //           </p>
          
// //           ${comment ? `
// //             <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 20px 0;">
// //               <p style="margin: 0; color: #721c24;">
// //                 <strong>Raison :</strong> ${comment}
// //               </p>
// //             </div>
// //           ` : ''}
          
// //           <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0;">
// //             <p style="margin: 0; color: #0c5460;">
// //               <strong>Conséquences de la suppression :</strong>
// //             </p>
// //             <ul style="color: #0c5460; margin: 10px 0;">
// //               <li>Toutes vos données personnelles ont été supprimées</li>
// //               <li>Vos annonces ne sont plus accessibles</li>
// //               <li>Votre historique de transactions est archivé selon nos obligations légales</li>
// //               <li>Vous ne pouvez plus accéder à votre compte</li>
// //             </ul>
// //           </div>
          
// //           <p style="color: #333;">
// //             Si vous pensez que cette suppression est une erreur, ou si vous souhaitez créer un nouveau compte, 
// //             vous pouvez contacter notre équipe de support.
// //           </p>
          
// //           <div style="text-align: center; margin: 30px 0;">
// //             <a href="${config.app.frontendUrl}/contact-support" 
// //                style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; 
// //                       border-radius: 4px; display: inline-block; margin: 5px;">
// //               Contacter le support
// //             </a>
// //             <a href="${config.app.frontendUrl}/register" 
// //                style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; 
// //                       border-radius: 4px; display: inline-block; margin: 5px;">
// //               Créer un nouveau compte
// //             </a>
// //           </div>
          
// //           <p style="font-size: 14px; color: #666;">
// //             Merci d'avoir utilisé EasyRent. Nous espérons vous revoir bientôt.
// //           </p>
// //           <p style="font-weight: bold;">L'équipe EasyRent</p>
// //         </div>
// //       </div>
// //     `;
// //   }

// //   private getAccountLockedEmailTemplate(firstName: string, reason?: string, lockDuration?: string): string {
// //     return `
// //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
// //           <h1 style="color: #dc3545;">🔒 Compte Temporairement Verrouillé</h1>
// //           <p>Bonjour ${firstName},</p>
// //           <p style="font-size: 16px; font-weight: bold; color: #dc3545;">
// //             Votre compte a été temporairement verrouillé pour des raisons de sécurité.
// //           </p>
          
// //           ${reason ? `
// //             <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
// //               <p style="margin: 0; color: #856404;">
// //                 <strong>Raison :</strong> ${reason}
// //               </p>
// //             </div>
// //           ` : ''}
          
// //           ${lockDuration ? `
// //             <p style="color: #333;">
// //               <strong>Durée du verrouillage :</strong> ${lockDuration}
// //             </p>
// //           ` : ''}
          
// //           <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0;">
// //             <p style="margin: 0; color: #0c5460;">
// //               <strong>Que faire maintenant ?</strong>
// //             </p>
// //             <ul style="color: #0c5460; margin: 10px 0;">
// //               <li>Attendez la fin de la période de verrouillage</li>
// //               <li>Contactez notre support si vous pensez qu'il s'agit d'une erreur</li>
// //               <li>Vérifiez la sécurité de votre compte</li>
// //             </ul>
// //           </div>
          
// //           <div style="text-align: center; margin: 30px 0;">
// //             <a href="${config.app.frontendUrl}/contact-support" 
// //                style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; 
// //                       border-radius: 4px; display: inline-block; margin: 5px;">
// //               Contacter le support
// //             </a>
// //           </div>
          
// //           <p style="font-size: 14px; color: #666;">
// //             Cette mesure de sécurité nous aide à protéger votre compte et nos services.
// //           </p>
// //           <p style="font-weight: bold;">L'équipe de sécurité</p>
// //         </div>
// //       </div>
// //     `;
// //   }

// //   private getAccountRestoredEmailTemplate(firstName: string, comment?: string): string {
// //     return `
// //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
// //           <h1 style="color: #28a745;">✅ Compte Restauré avec Succès</h1>
// //           <p>Bonjour ${firstName},</p>
// //           <p style="font-size: 16px; font-weight: bold; color: #28a745;">
// //             Bonne nouvelle ! Votre compte a été restauré et est maintenant accessible.
// //           </p>
          
// //           ${comment ? `
// //             <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 4px; margin: 20px 0;">
// //               <p style="margin: 0; color: #155724;">
// //                 <strong>Note :</strong> ${comment}
// //               </p>
// //             </div>
// //           ` : ''}
          
// //           <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0;">
// //             <p style="margin: 0; color: #0c5460;">
// //               <strong>Recommandations de sécurité :</strong>
// //             </p>
// //             <ul style="color: #0c5460; margin: 10px 0;">
// //               <li>Changez votre mot de passe si nécessaire</li>
// //               <li>Activez l'authentification à deux facteurs</li>
// //               <li>Vérifiez vos paramètres de sécurité</li>
// //               <li>Surveillez l'activité de votre compte</li>
// //             </ul>
// //           </div>
          
// //           <div style="text-align: center; margin: 30px 0;">
// //             <a href="${config.app.frontendUrl}/login" 
// //                style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; 
// //                       border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">
// //               Se connecter
// //             </a>
// //             <a href="${config.app.frontendUrl}/security-settings" 
// //                style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; 
// //                       border-radius: 4px; display: inline-block; margin: 5px;">
// //               Paramètres sécurité
// //             </a>
// //           </div>
          
// //           <p style="font-size: 14px; color: #666;">
// //             Merci pour votre patience. Nous nous efforçons de maintenir la sécurité de tous nos utilisateurs.
// //           </p>
// //           <p style="font-weight: bold;">L'équipe de support</p>
// //         </div>
// //       </div>
// //     `;
// //   }

// //   private getVerificationEmailTemplate(firstName: string, verificationUrl: string): string {
// //     return `
// //       <!DOCTYPE html>
// //       <html>
// //       <head>
// //         <meta charset="utf-8">
// //         <meta name="viewport" content="width=device-width, initial-scale=1.0">
// //         <title>Vérification de compte - EasyRent</title>
// //       </head>
// //       <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
// //           <h1 style="color: #007bff; text-align: center; margin-bottom: 30px;">Bienvenue sur EasyRent, ${firstName}!</h1>
          
// //           <p style="font-size: 16px; margin-bottom: 20px;">
// //             Merci de vous être inscrit sur EasyRent. Pour finaliser votre inscription et activer votre compte, 
// //             veuillez cliquer sur le bouton ci-dessous :
// //           </p>
          
// //           <div style="text-align: center; margin: 30px 0;">
// //             <a href="${verificationUrl}" 
// //                style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; 
// //                       border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
// //               ✅ Vérifier mon compte
// //             </a>
// //           </div>
          
// //           <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
// //             <p style="margin: 0; color: #856404;">
// //               <strong>⏰ Important :</strong> Ce lien est valide pendant 24 heures seulement.
// //             </p>
// //           </div>
          
// //           <p style="color: #666; font-size: 14px; margin-top: 30px;">
// //             Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
// //           </p>
          
// //           <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
// //           <div style="font-size: 12px; color: #999;">
// //             <p><strong>Problème avec le bouton ?</strong></p>
// //             <p>Copiez et collez ce lien dans votre navigateur :</p>
// //             <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
// //               ${verificationUrl}
// //             </p>
// //           </div>
// //         </div>
// //       </body>
// //       </html>
// //     `;
// //   }

// //   private getWelcomeEmailTemplate(firstName: string): string {
// //     return `
// //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
// //           <h1 style="color: #28a745; margin-bottom: 20px;">🎉 Bienvenue sur EasyRent, ${firstName}!</h1>
// //           <p style="font-size: 16px; margin-bottom: 20px;">
// //             Votre compte a été vérifié avec succès. Vous pouvez maintenant profiter de tous les services de notre plateforme de location.
// //           </p>
// //           <div style="margin: 30px 0;">
// //             <a href="${config.app.frontendUrl}/dashboard" 
// //                style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; 
// //                       border-radius: 5px; display: inline-block; font-weight: bold;">
// //               🚀 Accéder à mon tableau de bord
// //             </a>
// //           </div>
// //         </div>
// //       </div>
// //     `;
// //   }

// //   private getPasswordResetEmailTemplate(firstName: string, resetUrl: string): string {
// //     return `
// //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
// //           <h1 style="color: #dc3545;">Réinitialisation de mot de passe</h1>
// //           <p>Bonjour ${firstName},</p>
// //           <p>Vous avez demandé la réinitialisation de votre mot de passe EasyRent. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
          
// //           <div style="text-align: center; margin: 30px 0;">
// //             <a href="${resetUrl}" 
// //                style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; 
// //                       border-radius: 5px; display: inline-block; font-weight: bold;">
// //               🔑 Réinitialiser mon mot de passe
// //             </a>
// //           </div>
          
// //           <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px;">
// //             <p style="margin: 0; color: #856404;">
// //               <strong>⏰ Important :</strong> Ce lien expire dans 1 heure.
// //             </p>
// //           </div>
          
// //           <p style="margin-top: 20px;">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
// //         </div>
// //       </div>
// //     `;
// //   }

// //   private getPasswordChangeConfirmationTemplate(firstName: string): string {
// //     return `
// //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
// //           <h1 style="color: #28a745;">Confirmation de changement de mot de passe</h1>
// //           <p>Bonjour ${firstName},</p>
// //           <p>Votre mot de passe EasyRent a été modifié avec succès.</p>
// //           <p>Si vous n'avez pas effectué cette modification, veuillez contacter immédiatement notre support.</p>
          
// //           <div style="text-align: center; margin: 20px 0;">
// //             <a href="${config.app.frontendUrl}/contact-support" 
// //                style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
// //               Contacter le support
// //             </a>
// //           </div>
// //         </div>
// //       </div>
// //     `;
// //   }

// //   private getAgentVerificationStatusTemplate(firstName: string, status: VerificationStatus, comment?: string): string {
// //     let statusMessage: string;
// //     let statusColor: string;
    
// //     switch (status) {
// //       case VerificationStatus.VERIFIED:
// //         statusMessage = 'Votre compte agent a été vérifié avec succès. Vous pouvez maintenant accéder à toutes les fonctionnalités d\'agent sur EasyRent.';
// //         statusColor = '#28a745';
// //         break;
// //       case VerificationStatus.REJECTED:
// //         statusMessage = 'Nous sommes désolés de vous informer que votre demande de vérification d\'agent a été rejetée.';
// //         statusColor = '#dc3545';
// //         break;
// //       case VerificationStatus.PENDING:
// //         statusMessage = 'Votre demande de vérification d\'agent est en cours d\'examen par notre équipe.';
// //         statusColor = '#ffc107';
// //         break;
// //       default:
// //         statusMessage = 'Le statut de votre compte agent a été mis à jour.';
// //         statusColor = '#007bff';
// //     }
    
// //     return `
// //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <h1 style="color: ${statusColor};">Bonjour ${firstName},</h1>
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor};">
// //           <p style="margin: 0; font-size: 16px;">${statusMessage}</p>
// //           ${comment ? `<p style="margin-top: 15px; font-style: italic; color: #666;">Commentaire: ${comment}</p>` : ''}
// //         </div>
// //         <p style="margin-top: 20px;">Si vous avez des questions, n'hésitez pas à contacter notre support.</p>
// //         <div style="text-align: center; margin: 20px 0;">
// //           <a href="${config.app.frontendUrl}/contact-support" 
// //              style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
// //             Contacter le support
// //           </a>
// //         </div>
// //       </div>
// //     `;
// //   }

// //     private getSecurityAlertEmailTemplate(firstName: string, alertMessage: string, comment?: string): string {
// //     return `
// //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
// //         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
// //           <h1 style="color: #dc3545;">🚨 Alerte de Sécurité</h1>
// //           <p>Bonjour ${firstName},</p>
// //           <p style="font-size: 16px; font-weight: bold; color: #dc3545;">${alertMessage}</p>
// //           ${comment ? `<p style="font-style: italic; color: #666;">Détails: ${comment}</p>` : ''}
          
// //           <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
// //             <p style="margin: 0; color: #856404;">
// //               <strong>Si cette activité ne provient pas de vous, veuillez immédiatement :</strong>
// //             </p>
// //           </div>
          
// //           <ol style="color: #333;">
// //             <li>Changer votre mot de passe</li>
// //             <li>Activer l'authentification à deux facteurs si ce n'est pas déjà fait</li>
// //             <li>Contacter notre équipe de support</li>
// //           </ol>
          
// //           <div style="text-align: center; margin: 30px 0;">
// //             <a href="${config.app.frontendUrl}/change-password" 
// //                style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; 
// //                       border-radius: 4px; display: inline-block; margin: 5px;">
// //               Changer mot de passe
// //             </a>
// //             <a href="${config.app.frontendUrl}/security-settings" 
// //                style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; 
// //                       border-radius: 4px; display: inline-block; margin: 5px;">
// //               Paramètres sécurité
// //             </a>
// //           </div>
          
// //           <p style="font-size: 14px; color: #666;">
// //             Si cette activité provient de vous, vous pouvez ignorer cet email.
// //           </p>
// //           <p style="font-weight: bold;">L'équipe de sécurité</p>
// //         </div>
// //       </div>
// //     `;
// //   }
// // }
// import nodemailer, { Transporter } from 'nodemailer';
// import sgMail from '@sendgrid/mail';
// import { createLogger } from '../utils/logger/logger';
// import { VerificationStatus } from '../users/types/userTypes';
// import config from '../../config';

// const logger = createLogger('NotificationService');

// interface EmailOptions {
//   to: string;
//   subject: string;
//   html: string;
//   text?: string;
// }

// export class NotificationService {
//   private transporter!: Transporter;
//   private fromEmail: string;
//   private isSendGridEnabled: boolean;
//   private isSMTPEnabled: boolean;
//   private emailStrategy: 'sendgrid-first' | 'smtp-first';

//   constructor() {
//     this.fromEmail = config.sendgrid.fromAddress || config.email.fromAddress || 'noreply@easyrent.com';
//     this.emailStrategy = config.email.strategy || 'sendgrid-first';

//     // Initialize services
//     this.isSendGridEnabled = this.initializeSendGrid();
//     this.isSMTPEnabled = this.initializeSMTP();
    
//     // Check that at least one service is available
//     if (!this.isSendGridEnabled && !this.isSMTPEnabled) {
//       logger.error('No email service configured! Check your environment variables.');
//     } else {
//       logger.info('Email services initialized', {
//         sendgrid: this.isSendGridEnabled,
//         smtp: this.isSMTPEnabled,
//         strategy: this.emailStrategy,
//         primaryService: this.getPrimaryService()
//       });
//     }
//   }

//   private getPrimaryService(): string {
//     if (this.emailStrategy === 'smtp-first' && this.isSMTPEnabled) return 'SMTP';
//     if (this.emailStrategy === 'sendgrid-first' && this.isSendGridEnabled) return 'SendGrid';
//     if (this.isSendGridEnabled) return 'SendGrid';
//     if (this.isSMTPEnabled) return 'SMTP';
//     return 'None';
//   }

//   /**
//    * Initialize SendGrid
//    */
//   private initializeSendGrid(): boolean {
//     if (!config.sendgrid.enabled || !config.sendgrid.apiKey) {
//       logger.warn('SendGrid not configured', {
//         enabled: config.sendgrid.enabled,
//         hasApiKey: !!config.sendgrid.apiKey
//       });
//       return false;
//     }

//     try {
//       sgMail.setApiKey(config.sendgrid.apiKey);
//       logger.info('SendGrid initialized successfully');
//       return true;
//     } catch (error) {
//       logger.error('Error initializing SendGrid', {
//         error: error instanceof Error ? error.message : 'Unknown error'
//       });
//       return false;
//     }
//   }

//   /**
//    * Initialize SMTP
//    */
//   private initializeSMTP(): boolean {
//     if (!config.email.enabled || !config.email.host || !config.email.user || !config.email.password) {
//       logger.warn('SMTP not configured - missing required settings', {
//         enabled: config.email.enabled,
//         hasHost: !!config.email.host,
//         hasUser: !!config.email.user,
//         hasPassword: !!config.email.password
//       });
//       return false;
//     }

//     try {
//       this.transporter = nodemailer.createTransport({
//         host: config.email.host,
//         port: config.email.port || 587,
//         secure: config.email.secure || false,
//         auth: {
//           user: config.email.user,
//           pass: config.email.password
//         },
//         // Improved reliability options
//         pool: config.email.pool ?? true,
//         maxConnections: config.email.maxConnections || 5,
//         maxMessages: 100,
//         rateDelta: 20000,
//         rateLimit: 5,
//         // Timeout options
//         connectionTimeout: config.email.timeout || 30000,
//         greetingTimeout: 15000,
//         socketTimeout: 45000,
//         // TLS options
//         tls: {
//           rejectUnauthorized: config.app.env === 'production',
//           minVersion: 'TLSv1.2'
//         },
//         // Debug in development
//         debug: config.app.env === 'development',
//         logger: config.app.env === 'development'
//       });

//       // Async connection verification
//       this.verifyConnectionAsync();
      
//       logger.info('SMTP initialized successfully', {
//         host: config.email.host,
//         port: config.email.port || 587,
//         secure: config.email.secure || false
//       });
      
//       return true;
//     } catch (error) {
//       logger.error('Error initializing SMTP', {
//         error: error instanceof Error ? error.message : 'Unknown error'
//       });
//       return false;
//     }
//   }

//   /**
//    * Async SMTP connection verification
//    */
//   private async verifyConnectionAsync(): Promise<void> {
//     if (!this.transporter) return;

//     try {
//       await Promise.race([
//         this.transporter.verify(),
//         new Promise((_, reject) => 
//           setTimeout(() => reject(new Error('Connection verification timeout')), 15000)
//         )
//       ]);
//       logger.info('SMTP connection verified successfully');
//     } catch (error) {
//       logger.error('SMTP verification failed', {
//         error: error instanceof Error ? error.message : 'Unknown error',
//         host: config.email.host,
//         port: config.email.port || 587
//       });
//       // Don't disable SMTP completely, just log the warning
//       logger.warn('SMTP verification failed but service remains enabled for sending attempts');
//     }
//   }

//   /**
//    * Validate email address format
//    */
//   private isValidEmail(email: string): boolean {
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     return emailRegex.test(email);
//   }

//   /**
//    * Send email via SendGrid
//    */
//   private async sendWithSendGrid(mailOptions: EmailOptions): Promise<boolean> {
//     if (!this.isSendGridEnabled) {
//       logger.debug('SendGrid not enabled, skipping');
//       return false;
//     }

//     if (!this.isValidEmail(mailOptions.to)) {
//       logger.error('Invalid email address for SendGrid', { to: this.maskEmail(mailOptions.to) });
//       return false;
//     }

//     try {
//       const msg = {
//         to: mailOptions.to.trim(),
//         from: {
//           email: this.fromEmail,
//           name: 'EasyRent'
//         },
//         subject: mailOptions.subject,
//         html: mailOptions.html,
//         text: mailOptions.text || this.stripHtml(mailOptions.html)
//       };

//       logger.debug('Sending email via SendGrid', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         fromEmail: this.fromEmail
//       });

//       const response = await sgMail.send(msg);

//       logger.info('Email sent successfully via SendGrid', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         messageId: response[0].headers['x-message-id'],
//         statusCode: response[0].statusCode
//       });

//       return true;
//     } catch (error: any) {
//       logger.error('SendGrid error', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         error: error.message || 'Unknown error',
//         code: error.code,
//         statusCode: error.response?.status,
//         body: error.response?.body
//       });

//       return false;
//     }
//   }

//   /**
//    * Send email via SMTP
//    */
//   private async sendWithSMTP(mailOptions: EmailOptions): Promise<boolean> {
//     if (!this.isSMTPEnabled || !this.transporter) {
//       logger.debug('SMTP not enabled or transporter not available, skipping');
//       return false;
//     }

//     if (!this.isValidEmail(mailOptions.to)) {
//       logger.error('Invalid email address for SMTP', { to: this.maskEmail(mailOptions.to) });
//       return false;
//     }

//     try {
//       const smtpOptions = {
//         from: {
//           name: 'EasyRent',
//           address: this.fromEmail
//         },
//         to: mailOptions.to.trim(),
//         subject: mailOptions.subject,
//         html: mailOptions.html,
//         text: mailOptions.text || this.stripHtml(mailOptions.html)
//       };

//       logger.debug('Sending email via SMTP', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         fromEmail: this.fromEmail
//       });

//       const result = await Promise.race([
//         this.transporter.sendMail(smtpOptions),
//         new Promise((_, reject) =>
//           setTimeout(() => reject(new Error('Email send timeout after 45 seconds')), 45000)
//         )
//       ]) as any;

//       logger.info('Email sent successfully via SMTP', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         messageId: result.messageId
//       });

//       return true;
//     } catch (error) {
//       logger.error('SMTP error', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         error: error instanceof Error ? error.message : 'Unknown error'
//       });

//       return false;
//     }
//   }

//   /**
//    * Main email sending method with automatic fallback
//    */
//   private async sendEmailSafely(mailOptions: EmailOptions): Promise<boolean> {
//     // Validate email address
//     if (!this.isValidEmail(mailOptions.to)) {
//       logger.error('Invalid email address', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject
//       });
//       return false;
//     }

//     // Check that at least one service is available
//     if (!this.isSendGridEnabled && !this.isSMTPEnabled) {
//       logger.error('No email service available', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject
//       });
//       return false;
//     }

//     // Try services based on strategy
//     if (this.emailStrategy === 'smtp-first') {
//       // Try SMTP first
//       if (this.isSMTPEnabled) {
//         logger.debug('Attempting to send via SMTP (primary)...');
//         const smtpSuccess = await this.sendWithSMTP(mailOptions);
        
//         if (smtpSuccess) {
//           return true;
//         }
        
//         logger.warn('SMTP failed, trying SendGrid fallback...');
//       }

//       // Fallback to SendGrid
//       if (this.isSendGridEnabled) {
//         logger.debug('Attempting to send via SendGrid (fallback)...');
//         const sendGridSuccess = await this.sendWithSendGrid(mailOptions);
        
//         if (sendGridSuccess) {
//           return true;
//         }
//       }
//     } else {
//       // SendGrid first (default)
//       if (this.isSendGridEnabled) {
//         logger.debug('Attempting to send via SendGrid (primary)...');
//         const sendGridSuccess = await this.sendWithSendGrid(mailOptions);
        
//         if (sendGridSuccess) {
//           return true;
//         }
        
//         logger.warn('SendGrid failed, trying SMTP fallback...');
//       }

//       // Fallback to SMTP
//       if (this.isSMTPEnabled) {
//         logger.debug('Attempting to send via SMTP (fallback)...');
//         const smtpSuccess = await this.sendWithSMTP(mailOptions);
        
//         if (smtpSuccess) {
//           return true;
//         }
//       }
//     }

//     // All services failed
//     logger.error('All email services failed', {
//       to: this.maskEmail(mailOptions.to),
//       subject: mailOptions.subject,
//       strategy: this.emailStrategy,
//       sendgridEnabled: this.isSendGridEnabled,
//       smtpEnabled: this.isSMTPEnabled
//     });

//     return false;
//   }

//   /**
//    * Strip HTML tags for plain text version
//    */
//   private stripHtml(html: string): string {
//     return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
//   }

//   /**
//    * Mask email for logs
//    */
//   private maskEmail(email: string): string {
//     if (!email || email.length < 3) return '***';
//     const [local, domain] = email.split('@');
//     if (!domain) return email.substring(0, 3) + '***';
//     return local.substring(0, Math.min(3, local.length)) + '***@' + domain;
//   }

//   /**
//    * Test email configuration
//    */
//   async testEmailConfiguration(): Promise<{
//     sendgrid: boolean;
//     smtp: boolean;
//     overall: boolean;
//   }> {
//     const testResults = {
//       sendgrid: false,
//       smtp: false,
//       overall: false
//     };

//     // Test SendGrid
//     if (this.isSendGridEnabled) {
//       try {
//         // SendGrid doesn't have a verify method, so we assume it's ready if configured
//         testResults.sendgrid = true;
//         logger.info('SendGrid configured and ready');
//       } catch (error) {
//         logger.error('SendGrid test failed', { error });
//       }
//     }

//     // Test SMTP
//     if (this.isSMTPEnabled && this.transporter) {
//       try {
//         await Promise.race([
//           this.transporter.verify(),
//           new Promise((_, reject) => 
//             setTimeout(() => reject(new Error('SMTP test timeout')), 10000)
//           )
//         ]);
//         testResults.smtp = true;
//         logger.info('SMTP configured and ready');
//       } catch (error) {
//         logger.error('SMTP test failed', { error });
//       }
//     }

//     testResults.overall = testResults.sendgrid || testResults.smtp;

//     logger.info('Email configuration test results', testResults);
//     return testResults;
//   }

//   // ==========================================
//   // Public email sending methods
//   // ==========================================

//   async sendAccountReactivationEmail(email: string, firstName: string): Promise<boolean> {
//     const mailOptions: EmailOptions = {
//       to: email,
//       subject: 'Votre compte a été réactivé - EasyRent',
//       html: this.getAccountReactivationTemplate(firstName)
//     };

//     return this.sendEmailSafely(mailOptions);
//   }
  
//   async debugVerificationEmail(email: string, firstName: string, token?: string): Promise<void> {
//     const verificationUrl = `${config.app.frontendUrl}/verify-account?token=${token}`;
    
//     console.log('🔍 DEBUG EMAIL VERIFICATION:');
//     console.log('Email:', email);
//     console.log('FirstName:', firstName);
//     console.log('Token:', token);
//     console.log('Frontend URL:', config.app.frontendUrl);
//     console.log('Full Verification URL:', verificationUrl);
//     console.log('Token length:', token?.length);
//     console.log('Token type:', typeof token);
//   }

//   async sendVerificationEmail(email: string, firstName: string, token: string): Promise<boolean> {
//     if (!token) {
//       logger.error('Verification token is missing', { email: this.maskEmail(email) });
//       return false;
//     }

//     const verificationUrl = `${config.app.frontendUrl}/verify-account?token=${token}`;
//     this.debugVerificationEmail(email, firstName, token);

//     const mailOptions: EmailOptions = {
//       to: email,
//       subject: 'Vérifiez votre compte - EasyRent',
//       html: this.getVerificationEmailTemplate(firstName, verificationUrl),
//       text: `Bonjour ${firstName}, veuillez vérifier votre compte en visitant : ${verificationUrl}`
//     };

//     return this.sendEmailSafely(mailOptions);
//   }

//   async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
//     this.debugVerificationEmail(email, firstName);

//     const mailOptions: EmailOptions = {
//       to: email,
//       subject: 'Bienvenue sur EasyRent !',
//       html: this.getWelcomeEmailTemplate(firstName)
//     };

//     return this.sendEmailSafely(mailOptions);
//   }

//   async sendPasswordResetEmail(email: string, resetLink: string, firstName: string): Promise<boolean> {
//     if (!resetLink) {
//       logger.error('Reset link is missing', { email: this.maskEmail(email) });
//       return false;
//     }

//     this.debugVerificationEmail(email, firstName);
//     logger.info('Password reset link provided', { 
//       resetLink: resetLink.substring(0, 50) + '...',
//       email: this.maskEmail(email)
//     });

//     const mailOptions: EmailOptions = {
//       to: email,
//       subject: 'Réinitialisation de votre mot de passe - EasyRent',
//       html: this.getPasswordResetEmailTemplate(firstName, resetLink)
//     };
    
//     return this.sendEmailSafely(mailOptions);
//   }

//   async sendPasswordChangeConfirmationEmail(email: string, firstName: string): Promise<boolean> {
//     const mailOptions: EmailOptions = {
//       to: email,
//       subject: 'Confirmation de changement de mot de passe - EasyRent',
//       html: this.getPasswordChangeConfirmationTemplate(firstName)
//     };

//     return this.sendEmailSafely(mailOptions);
//   }
  
//   async sendAgentVerificationStatusEmail(
//     email: string, 
//     firstName: string, 
//     status: VerificationStatus,
//     comment?: string
//   ): Promise<boolean> {
//     let subject: string;
    
//     switch (status) {
//       case VerificationStatus.VERIFIED:
//         subject = 'Votre compte agent a été vérifié - EasyRent';
//         break;
//       case VerificationStatus.REJECTED:
//         subject = 'Votre demande de vérification a été rejetée - EasyRent';
//         break;
//       case VerificationStatus.PENDING:
//         subject = 'Votre demande de vérification est en cours - EasyRent';
//         break;
//       default:
//         subject = 'Mise à jour de votre compte agent - EasyRent';
//     }
    
//     const mailOptions: EmailOptions = {
//       to: email,
//       subject,
//       html: this.getAgentVerificationStatusTemplate(firstName, status, comment)
//     };

//     return this.sendEmailSafely(mailOptions);
//   }

//   async sendSecurityNotification(
//     email: string, 
//     firstName: string, 
//     comment?: string,
//     alertType: 'login_attempt' | 'password_changed' | 'account_accessed' | 'information_changed' | 'other' = 'other'
//   ): Promise<boolean> {
//     let subject: string;
//     let alertMessage: string;
    
//     switch (alertType) {
//       case 'login_attempt':
//         subject = 'Alerte de sécurité: Tentative de connexion suspecte - EasyRent';
//         alertMessage = 'Une tentative de connexion suspecte a été détectée sur votre compte.';
//         break;
//       case 'password_changed':
//         subject = 'Alerte de sécurité: Modification de votre mot de passe - EasyRent';
//         alertMessage = 'Votre mot de passe a été modifié.';
//         break;
//       case 'account_accessed':
//         subject = 'Alerte de sécurité: Accès à votre compte - EasyRent';
//         alertMessage = 'Votre compte a été accédé depuis un nouvel appareil ou une nouvelle localisation.';
//         break;
//       case 'information_changed':
//         subject = 'Alerte de sécurité: Modification de vos informations - EasyRent';
//         alertMessage = 'Les informations de votre compte ont été modifiées.';
//         break;
//       default:
//         subject = 'Alerte de sécurité sur votre compte - EasyRent';
//         alertMessage = 'Une activité de sécurité a été détectée sur votre compte.';
//     }
    
//     const mailOptions: EmailOptions = {
//       to: email,
//       subject,
//       html: this.getSecurityAlertEmailTemplate(firstName, alertMessage, comment)
//     };

//     return this.sendEmailSafely(mailOptions);
//   }

//   async sendAccountDeactivationEmail(email: string, firstName: string): Promise<boolean> {
//     const mailOptions: EmailOptions = {
//       to: email,
//       subject: 'Votre compte a été désactivé - EasyRent',
//       html: this.getAccountDeactivationTemplate(firstName)
//     };

//     return this.sendEmailSafely(mailOptions);
//   }

//   async sendAccountLockedEmail(
//     email: string, 
//     firstName: string, 
//     reason?: string,
//     lockDuration?: string
//   ): Promise<boolean> {
//     const mailOptions: EmailOptions = {
//       to: email,
//       subject: '🔒 Votre compte a été temporairement verrouillé - EasyRent',
//       html: this.getAccountLockedEmailTemplate(firstName, reason, lockDuration)
//     };

//     return this.sendEmailSafely(mailOptions);
//   }

//   async sendAccountDeletedEmail(email: string, firstName: string, comment?: string): Promise<boolean> {
//     const mailOptions: EmailOptions = {
//       to: email,
//       subject: 'Confirmation de suppression de votre compte - EasyRent',
//       html: this.getAccountDeletedTemplate(firstName, comment)
//     };

//     return this.sendEmailSafely(mailOptions);
//   }

//   async sendAccountRestoredEmail(
//     email: string, 
//     firstName: string, 
//     comment?: string
//   ): Promise<boolean> {
//     const mailOptions: EmailOptions = {
//       to: email,
//       subject: '✅ Votre compte a été restauré - EasyRent',
//       html: this.getAccountRestoredEmailTemplate(firstName, comment)
//     };

//     return this.sendEmailSafely(mailOptions);
//   }

//   async sendAccountStatusNotification(
//     email: string, 
//     firstName: string, 
//     status: 'activated' | 'deactivated' | 'locked' | 'unlocked' | 'verified' | 'suspended' | 'restored',
//     comment?: string
//   ): Promise<boolean> {
//     let subject: string;
//     let statusColor: string;
//     let statusMessage: string;
    
//     switch (status) {
//       case 'activated':
//         subject = 'Votre compte a été activé - EasyRent';
//         statusColor = '#28a745';
//         statusMessage = 'Votre compte EasyRent a été activé avec succès. Vous pouvez maintenant accéder à tous nos services.';
//         break;
//       case 'deactivated':
//         subject = 'Votre compte a été désactivé - EasyRent';
//         statusColor = '#ffc107';
//         statusMessage = 'Votre compte EasyRent a été temporairement désactivé.';
//         break;
//       case 'locked':
//         subject = '🔒 Votre compte a été verrouillé - EasyRent';
//         statusColor = '#dc3545';
//         statusMessage = 'Votre compte a été temporairement verrouillé pour des raisons de sécurité.';
//         break;
//       case 'unlocked':
//         subject = '🔓 Votre compte a été déverrouillé - EasyRent';
//         statusColor = '#28a745';
//         statusMessage = 'Votre compte a été déverrouillé et est maintenant accessible.';
//         break;
//       case 'verified':
//         subject = '✅ Votre compte a été vérifié - EasyRent';
//         statusColor = '#28a745';
//         statusMessage = 'Votre compte a été vérifié avec succès. Vous avez maintenant accès à toutes les fonctionnalités.';
//         break;
//       case 'suspended':
//         subject = '⚠️ Votre compte a été suspendu - EasyRent';
//         statusColor = '#dc3545';
//         statusMessage = 'Votre compte a été suspendu en raison d\'une violation de nos conditions d\'utilisation.';
//         break;
//       case 'restored':
//         subject = '✅ Votre compte a été restauré - EasyRent';
//         statusColor = '#28a745';
//         statusMessage = 'Votre compte a été restauré et est maintenant pleinement fonctionnel.';
//         break;
//       default:
//         subject = 'Mise à jour de votre compte - EasyRent';
//         statusColor = '#007bff';
//         statusMessage = 'Le statut de votre compte a été mis à jour.';
//     }
    
//     const mailOptions: EmailOptions = {
//       to: email,
//       subject,
//       html: this.getAccountStatusNotificationTemplate(firstName, status, statusMessage, statusColor, comment)
//     };

//     return this.sendEmailSafely(mailOptions);
//   }

//   // ==========================================
//   // Email Templates
//   // ==========================================

//   private getAccountStatusNotificationTemplate(
//     firstName: string, 
//     status: string, 
//     statusMessage: string, 
//     statusColor: string, 
//     comment?: string
//   ): string {
//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor};">
//           <h1 style="color: ${statusColor};">Bonjour ${firstName},</h1>
          
//           <p style="font-size: 16px; margin-bottom: 20px;">
//             ${statusMessage}
//           </p>
          
//           ${comment ? `
//             <div style="background-color: #e9ecef; border: 1px solid #dee2e6; padding: 15px; border-radius: 4px; margin: 20px 0;">
//               <p style="margin: 0; color: #495057;">
//                 <strong>Information complémentaire :</strong> ${comment}
//               </p>
//             </div>
//           ` : ''}
          
//           <div style="text-align: center; margin: 30px 0;">
//             <a href="${config.app.frontendUrl}/dashboard" 
//                style="background-color: ${statusColor}; color: white; padding: 15px 30px; text-decoration: none; 
//                       border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">
//               Accéder à mon compte
//             </a>
//             <a href="${config.app.frontendUrl}/contact-support" 
//                style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; 
//                       border-radius: 4px; display: inline-block; margin: 5px;">
//               Contacter le support
//             </a>
//           </div>
          
//           <p style="font-size: 14px; color: #666; margin-top: 20px;">
//             Si vous avez des questions concernant cette notification, n'hésitez pas à contacter notre équipe de support.
//           </p>
          
//           <p style="font-weight: bold; margin-top: 20px;">
//             L'équipe EasyRent
//           </p>
//         </div>
//       </div>
//     `;
//   }

//   private getVerificationEmailTemplate(firstName: string, verificationUrl: string): string {
//     return `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="utf-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <title>Vérification de compte - EasyRent</title>
//       </head>
//       <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
//         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
//           <h1 style="color: #007bff; text-align: center; margin-bottom: 30px;">Bienvenue sur EasyRent, ${firstName}!</h1>
          
//           <p style="font-size: 16px; margin-bottom: 20px;">
//             Merci de vous être inscrit sur EasyRent. Pour finaliser votre inscription et activer votre compte, 
//             veuillez cliquer sur le bouton ci-dessous :
//           </p>
          
//           <div style="text-align: center; margin: 30px 0;">
//             <a href="${verificationUrl}" 
//                style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; 
//                       border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
//               ✅ Vérifier mon compte
//             </a>
//           </div>
          
//           <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
//             <p style="margin: 0; color: #856404;">
//               <strong>⏰ Important :</strong> Ce lien est valide pendant 24 heures seulement.
//             </p>
//           </div>
          
//           <p style="color: #666; font-size: 14px; margin-top: 30px;">
//             Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
//           </p>
          
//           <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
//           <div style="font-size: 12px; color: #999;">
//             <p><strong>Problème avec le bouton ?</strong></p>
//             <p>Copiez et collez ce lien dans votre navigateur :</p>
//             <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
//               ${verificationUrl}
//             </p>
//           </div>
//         </div>
//       </body>
//       </html>
//     `;
//   }

//   private getWelcomeEmailTemplate(firstName: string): string {
//     return `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//         <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
//           <h1 style="color: #28a745; margin-bottom: 20px;">🎉 Bienvenue sur EasyRent, ${firstName