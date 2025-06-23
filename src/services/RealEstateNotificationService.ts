// // import mongoose, { Schema, Types, Document, Model } from 'mongoose';

// // // Types de notifications spécifiques à l'immobilier
// // export type NotificationType = 
// //   | 'new_property'      // Nouvelle propriété ajoutée
// //   | 'price_change'      // Changement de prix
// //   | 'property_sold'     // Propriété vendue
// //   | 'property_rented'   // Propriété louée
// //   | 'inquiry_received'  // Demande de renseignement reçue
// //   | 'visit_scheduled'   // Visite programmée
// //   | 'visit_reminder'    // Rappel de visite
// //   | 'favorite_update'   // Mise à jour sur une propriété favorite
// //   | 'message_received'  // Nouveau message
// //   | 'review_received'   // Nouvel avis reçu
// //   | 'contract_update'   // Mise à jour de contrat
// //   | 'payment_reminder'  // Rappel de paiement
// //   | 'document_ready'    // Document prêt
// //   | 'system'            // Notification système
// //   | 'promotion'         // Promotion/Offre spéciale
// //   | 'follow'            // Nouvel abonnement
// //   | 'like';             // Like reçu

// // // Interface pour une notification
// // export interface INotification {
// //   _id: Types.ObjectId;
// //   title: string;
// //   message: string;
// //   type: NotificationType;
// //   link?: string;
// //   metadata?: {
// //     propertyId?: string;
// //     userId?: string;
// //     contractId?: string;
// //     visitId?: string;
// //     messageId?: string;
// //     price?: number;
// //     oldPrice?: number;
// //     location?: string;
// //     propertyType?: string;
// //     action?: string;
// //     [key: string]: any;
// //   };
// //   read: boolean;
// //   createdAt: Date;
// //   readAt?: Date;
// //   priority: 'low' | 'medium' | 'high';
// //   icon?: string;
// //   actionUrl?: string;
// //   actionLabel?: string;
// // }

// // // Interface utilisateur avec notifications
// // export interface IUser extends Document {
// //   notifications: INotification[];
// //   pushToken?: string;
// //   notificationSettings: {
// //     propertyUpdates: boolean;
// //     messages: boolean;
// //     visits: boolean;
// //     payments: boolean;
// //     marketing: boolean;
// //   };
// // }

// // // Schéma de notification
// // const notificationSchema = new Schema<INotification>(
// //   {
// //     _id: { type: Schema.Types.ObjectId, required: true, auto: true },
// //     title: { type: String, required: true },
// //     message: { type: String, required: true },
// //     type: {
// //       type: String,
// //       enum: [
// //         'new_property', 'price_change', 'property_sold', 'property_rented',
// //         'inquiry_received', 'visit_scheduled', 'visit_reminder', 'favorite_update',
// //         'message_received', 'review_received', 'contract_update', 'payment_reminder',
// //         'document_ready', 'system', 'promotion', 'follow', 'like'
// //       ],
// //       required: true
// //     },
// //     link: { type: String },
// //     metadata: Schema.Types.Mixed,
// //     read: { type: Boolean, default: false },
// //     createdAt: { type: Date, default: Date.now },
// //     readAt: { type: Date },
// //     priority: { 
// //       type: String, 
// //       enum: ['low', 'medium', 'high'], 
// //       default: 'medium' 
// //     },
// //     icon: { type: String },
// //     actionUrl: { type: String },
// //     actionLabel: { type: String }
// //   },
// //   { _id: false }
// // );

// // export class RealEstateNotificationService {
// //   private userModel: Model<IUser>;

// //   constructor(userModel: Model<IUser>) {
// //     this.userModel = userModel;
// //   }

// //   // Méthodes génériques
// //   private async addNotification(userId: string, notification: Partial<INotification>) {
// //     const user = await this.userModel.findById(userId);
// //     if (!user) throw new Error("Utilisateur non trouvé");

// //     const newNotification: INotification = {
// //       _id: new mongoose.Types.ObjectId(),
// //       title: notification.title!,
// //       message: notification.message!,
// //       type: notification.type!,
// //       link: notification.link,
// //       metadata: notification.metadata,
// //       read: false,
// //       createdAt: new Date(),
// //       priority: notification.priority || 'medium',
// //       icon: notification.icon,
// //       actionUrl: notification.actionUrl,
// //       actionLabel: notification.actionLabel
// //     };

// //     user.notifications = user.notifications ?? [];
// //     user.notifications.unshift(newNotification); // Ajouter au début
// //     await user.save();

// //     return { success: true, notification: newNotification };
// //   }

// //   // === NOTIFICATIONS SPÉCIFIQUES IMMOBILIER ===

// //   // Nouvelle propriété disponible
// //   async notifyNewProperty(userId: string, propertyData: {
// //     propertyId: string;
// //     title: string;
// //     price: number;
// //     location: string;
// //     type: string;
// //   }) {
// //     return this.addNotification(userId, {
// //       title: "🏠 Nouvelle propriété disponible",
// //       message: `${propertyData.title} à ${propertyData.location} - ${propertyData.price}€`,
// //       type: 'new_property',
// //       priority: 'medium',
// //       icon: '🏠',
// //       metadata: {
// //         propertyId: propertyData.propertyId,
// //         price: propertyData.price,
// //         location: propertyData.location,
// //         propertyType: propertyData.type
// //       },
// //       actionUrl: `/property/${propertyData.propertyId}`,
// //       actionLabel: "Voir la propriété"
// //     });
// //   }

// //   // Changement de prix
// //   async notifyPriceChange(userId: string, propertyData: {
// //     propertyId: string;
// //     title: string;
// //     oldPrice: number;
// //     newPrice: number;
// //     location: string;
// //   }) {
// //     const priceDirection = propertyData.newPrice < propertyData.oldPrice ? "📉 Baisse" : "📈 Hausse";
    
// //     return this.addNotification(userId, {
// //       title: `${priceDirection} de prix`,
// //       message: `${propertyData.title} : ${propertyData.oldPrice}€ → ${propertyData.newPrice}€`,
// //       type: 'price_change',
// //       priority: 'high',
// //       icon: propertyData.newPrice < propertyData.oldPrice ? '📉' : '📈',
// //       metadata: {
// //         propertyId: propertyData.propertyId,
// //         oldPrice: propertyData.oldPrice,
// //         price: propertyData.newPrice,
// //         location: propertyData.location
// //       },
// //       actionUrl: `/property/${propertyData.propertyId}`,
// //       actionLabel: "Voir la propriété"
// //     });
// //   }

// //   // Demande de renseignement reçue
// //   async notifyInquiryReceived(userId: string, inquiryData: {
// //     propertyId: string;
// //     propertyTitle: string;
// //     inquirerName: string;
// //     inquirerEmail: string;
// //     message: string;
// //   }) {
// //     return this.addNotification(userId, {
// //       title: "📧 Nouvelle demande de renseignement",
// //       message: `${inquiryData.inquirerName} s'intéresse à "${inquiryData.propertyTitle}"`,
// //       type: 'inquiry_received',
// //       priority: 'high',
// //       icon: '📧',
// //       metadata: {
// //         propertyId: inquiryData.propertyId,
// //         inquirerName: inquiryData.inquirerName,
// //         inquirerEmail: inquiryData.inquirerEmail,
// //         message: inquiryData.message
// //       },
// //       actionUrl: `/inquiries`,
// //       actionLabel: "Voir la demande"
// //     });
// //   }

// //   // Visite programmée
// //   async notifyVisitScheduled(userId: string, visitData: {
// //     propertyId: string;
// //     propertyTitle: string;
// //     visitDate: Date;
// //     visitorName: string;
// //     visitId: string;
// //   }) {
// //     const dateStr = visitData.visitDate.toLocaleDateString('fr-FR', {
// //       day: 'numeric',
// //       month: 'long',
// //       hour: '2-digit',
// //       minute: '2-digit'
// //     });

// //     return this.addNotification(userId, {
// //       title: "📅 Visite programmée",
// //       message: `Visite de "${visitData.propertyTitle}" le ${dateStr} avec ${visitData.visitorName}`,
// //       type: 'visit_scheduled',
// //       priority: 'high',
// //       icon: '📅',
// //       metadata: {
// //         propertyId: visitData.propertyId,
// //         visitId: visitData.visitId,
// //         visitDate: visitData.visitDate,
// //         visitorName: visitData.visitorName
// //       },
// //       actionUrl: `/visits/${visitData.visitId}`,
// //       actionLabel: "Voir la visite"
// //     });
// //   }

// //   // Rappel de visite (1h avant)
// //   async notifyVisitReminder(userId: string, visitData: {
// //     propertyId: string;
// //     propertyTitle: string;
// //     visitDate: Date;
// //     address: string;
// //     visitId: string;
// //   }) {
// //     return this.addNotification(userId, {
// //       title: "⏰ Rappel de visite",
// //       message: `N'oubliez pas votre visite de "${visitData.propertyTitle}" dans 1 heure`,
// //       type: 'visit_reminder',
// //       priority: 'high',
// //       icon: '⏰',
// //       metadata: {
// //         propertyId: visitData.propertyId,
// //         visitId: visitData.visitId,
// //         visitDate: visitData.visitDate,
// //         address: visitData.address
// //       },
// //       actionUrl: `/visits/${visitData.visitId}`,
// //       actionLabel: "Voir les détails"
// //     });
// //   }

// //   // Propriété vendue/louée
// //   async notifyPropertySoldRented(userId: string, propertyData: {
// //     propertyId: string;
// //     title: string;
// //     price: number;
// //     type: 'sold' | 'rented';
// //   }) {
// //     const action = propertyData.type === 'sold' ? 'vendue' : 'louée';
// //     const icon = propertyData.type === 'sold' ? '💰' : '🤝';

// //     return this.addNotification(userId, {
// //       title: `${icon} Propriété ${action}`,
// //       message: `"${propertyData.title}" a été ${action} pour ${propertyData.price}€`,
// //       type: propertyData.type === 'sold' ? 'property_sold' : 'property_rented',
// //       priority: 'medium',
// //       icon,
// //       metadata: {
// //         propertyId: propertyData.propertyId,
// //         price: propertyData.price,
// //         action: propertyData.type
// //       },
// //       actionUrl: `/property/${propertyData.propertyId}`,
// //       actionLabel: "Voir la propriété"
// //     });
// //   }

// //   // Nouveau message reçu
// //   async notifyMessageReceived(userId: string, messageData: {
// //     senderName: string;
// //     senderId: string;
// //     subject?: string;
// //     preview: string;
// //     messageId: string;
// //   }) {
// //     return this.addNotification(userId, {
// //       title: "💬 Nouveau message",
// //       message: `Message de ${messageData.senderName}: ${messageData.preview}`,
// //       type: 'message_received',
// //       priority: 'medium',
// //       icon: '💬',
// //       metadata: {
// //         senderId: messageData.senderId,
// //         senderName: messageData.senderName,
// //         messageId: messageData.messageId,
// //         subject: messageData.subject
// //       },
// //       actionUrl: `/messages/${messageData.messageId}`,
// //       actionLabel: "Lire le message"
// //     });
// //   }

// //   // Nouveau suivi/abonnement
// //   async notifyNewFollower(userId: string, followerData: {
// //     followerId: string;
// //     followerName: string;
// //     followerType: 'user' | 'agent';
// //   }) {
// //     const type = followerData.followerType === 'agent' ? 'agent' : 'utilisateur';
    
// //     return this.addNotification(userId, {
// //       title: "👤 Nouvel abonnement",
// //       message: `${followerData.followerName} (${type}) vous suit maintenant`,
// //       type: 'follow',
// //       priority: 'low',
// //       icon: '👤',
// //       metadata: {
// //         followerId: followerData.followerId,
// //         followerName: followerData.followerName,
// //         followerType: followerData.followerType
// //       },
// //       actionUrl: `/profile/${followerData.followerId}`,
// //       actionLabel: "Voir le profil"
// //     });
// //   }

// //   // Mise à jour de propriété favorite
// //   async notifyFavoriteUpdate(userId: string, propertyData: {
// //     propertyId: string;
// //     title: string;
// //     updateType: 'price' | 'status' | 'photos' | 'description';
// //     details: string;
// //   }) {
// //     const updateTypes = {
// //       'price': '💰 Prix mis à jour',
// //       'status': '📋 Statut modifié',
// //       'photos': '📸 Nouvelles photos',
// //       'description': '📝 Description mise à jour'
// //     };

// //     return this.addNotification(userId, {
// //       title: "⭐ Propriété favorite mise à jour",
// //       message: `${updateTypes[propertyData.updateType]} pour "${propertyData.title}"`,
// //       type: 'favorite_update',
// //       priority: 'medium',
// //       icon: '⭐',
// //       metadata: {
// //         propertyId: propertyData.propertyId,
// //         updateType: propertyData.updateType,
// //         details: propertyData.details
// //       },
// //       actionUrl: `/property/${propertyData.propertyId}`,
// //       actionLabel: "Voir les changements"
// //     });
// //   }

// //   // === MÉTHODES DE GESTION ===

// //   async markAsRead(userId: string, notificationId: string) {
// //     const user = await this.userModel.findById(userId);
// //     if (!user || !user.notifications) throw new Error("Utilisateur ou notifications non trouvés");

// //     const notification = user.notifications.find(
// //       n => n._id.toString() === notificationId
// //     );

// //     if (notification && !notification.read) {
// //       notification.read = true;
// //       notification.readAt = new Date();
// //       await user.save();
// //       return { success: true, notification };
// //     }

// //     return { success: false, message: "Notification déjà lue ou non trouvée" };
// //   }

// //   async markAllAsRead(userId: string) {
// //     const user = await this.userModel.findById(userId);
// //     if (!user || !user.notifications) throw new Error("Utilisateur non trouvé");

// //     let updatedCount = 0;
// //     user.notifications.forEach(notification => {
// //       if (!notification.read) {
// //         notification.read = true;
// //         notification.readAt = new Date();
// //         updatedCount++;
// //       }
// //     });

// //     if (updatedCount > 0) await user.save();
// //     return { success: true, updatedCount };
// //   }

// //   async getNotifications(userId: string, options: {
// //     type?: NotificationType;
// //     priority?: 'low' | 'medium' | 'high';
// //     unreadOnly?: boolean;
// //     skip?: number;
// //     limit?: number;
// //   } = {}) {
// //     const user = await this.userModel.findById(userId);
// //     if (!user || !user.notifications) {
// //       return { 
// //         success: true, 
// //         notifications: [], 
// //         unreadCount: 0,
// //         summary: { high: 0, medium: 0, low: 0 }
// //       };
// //     }

// //     let notifications = [...user.notifications];

// //     // Filtres
// //     if (options.type) notifications = notifications.filter(n => n.type === options.type);
// //     if (options.priority) notifications = notifications.filter(n => n.priority === options.priority);
// //     if (options.unreadOnly) notifications = notifications.filter(n => !n.read);

// //     // Tri par priorité puis par date
// //     notifications.sort((a, b) => {
// //       const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
// //       const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
// //       if (priorityDiff !== 0) return priorityDiff;
// //       return +new Date(b.createdAt) - +new Date(a.createdAt);
// //     });

// //     // Pagination
// //     const skip = options.skip ?? 0;
// //     const limit = options.limit ?? 20;
// //     const paginated = notifications.slice(skip, skip + limit);

// //     // Statistiques
// //     const unreadNotifications = user.notifications.filter(n => !n.read);
// //     const unreadCount = unreadNotifications.length;
// //     const summary = {
// //       high: unreadNotifications.filter(n => n.priority === 'high').length,
// //       medium: unreadNotifications.filter(n => n.priority === 'medium').length,
// //       low: unreadNotifications.filter(n => n.priority === 'low').length
// //     };

// //     return {
// //       success: true,
// //       notifications: paginated,
// //       total: notifications.length,
// //       unreadCount,
// //       summary,
// //       hasMore: skip + limit < notifications.length
// //     };
// //   }

// //   async deleteNotification(userId: string, notificationId: string) {
// //     const user = await this.userModel.findById(userId);
// //     if (!user || !user.notifications) throw new Error("Utilisateur non trouvé");

// //     const initialLength = user.notifications.length;
// //     user.notifications = user.notifications.filter(
// //       n => n._id.toString() !== notificationId
// //     );

// //     if (user.notifications.length < initialLength) {
// //       await user.save();
// //       return { success: true, message: "Notification supprimée" };
// //     }

// //     return { success: false, message: "Notification non trouvée" };
// //   }

// //   async deleteReadNotifications(userId: string) {
// //     const user = await this.userModel.findById(userId);
// //     if (!user || !user.notifications) throw new Error("Utilisateur non trouvé");

// //     const initialLength = user.notifications.length;
// //     user.notifications = user.notifications.filter(n => !n.read);
// //     const deletedCount = initialLength - user.notifications.length;

// //     if (deletedCount > 0) await user.save();
// //     return { success: true, deletedCount };
// //   }

// //   // Nettoyer les anciennes notifications (garder seulement les 100 plus récentes)
// //   async cleanOldNotifications(userId: string, maxNotifications = 100) {
// //     const user = await this.userModel.findById(userId);
// //     if (!user || !user.notifications) return { success: true, deletedCount: 0 };

// //     if (user.notifications.length <= maxNotifications) {
// //       return { success: true, deletedCount: 0 };
// //     }

// //     // Trier par date et garder les plus récentes
// //     user.notifications.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
// //     const deletedCount = user.notifications.length - maxNotifications;
// //     user.notifications = user.notifications.slice(0, maxNotifications);

// //     await user.save();
// //     return { success: true, deletedCount };
// //   }
// // }

// import nodemailer, { Transporter } from 'nodemailer';
// import sgMail from '@sendgrid/mail';
// import { createLogger } from '../utils/logger/logger';
// import { VerificationStatus } from '../users/types/userTypes';
// import config from '../../config';
// import webpush from 'web-push';
// import admin from 'firebase-admin';
// import { EmailOptions, QueuedEmail, PushNotificationOptions, WebPushOptions } from '../type/notificationType';

// const logger = createLogger('NotificationService');

// export class NotificationService {
//   private transporter!: Transporter;
//   private fromEmail: string;
  
//   // Configuration des services Email
//   private isSendGridEnabled: boolean;
//   private isSMTPEnabled: boolean;
//   private emailStrategy: 'sendgrid-first' | 'smtp-first';
  
//   // Configuration des services Push
//   private isWebPushEnabled: boolean;
//   private isFirebaseEnabled: boolean;
//   private webPushVapidKeys: {
//     subject?: string;
//     publicKey?: string;
//     privateKey?: string;
//   } = {};
  
//   // Queues et rate limiting
//   private emailQueue: QueuedEmail[] = [];
//   private isProcessingQueue = false;
  
//   private rateLimiter = {
//     sendgrid: {
//       requests: 0,
//       resetTime: Date.now() + 60000,
//       limit: 100
//     },
//     smtp: {
//       requests: 0,
//       resetTime: Date.now() + 60000,
//       limit: 60
//     },
//     firebase: {
//       requests: 0,
//       resetTime: Date.now() + 60000,
//       limit: 1000 // Firebase permet plus de notifications
//     }
//   };

//   constructor() {
//     this.fromEmail = config.sendgrid.fromAddress || config.email.fromAddress || 'noreply@easyrent.com';
//     this.emailStrategy = config.email.strategy || 'sendgrid-first';
    
//     // Initialiser tous les services
//     this.initializeServices();
    
//     // Log de l'état des services
//     this.logServiceStatus();
//   }

//   /**
//    * Initialise tous les services de notification
//    */
//   private initializeServices(): void {
//     // Services Email
//     this.isSendGridEnabled = this.initializeSendGrid();
//     this.isSMTPEnabled = this.initializeSMTP();
    
//     // Services Push
//     this.isWebPushEnabled = this.initializeWebPush();
//     this.isFirebaseEnabled = this.initializeFirebase();
    
//     // Vérifier qu'au moins un service est disponible
//     if (!this.hasAnyServiceEnabled()) {
//       logger.error('Aucun service de notification configuré !');
//     }
//   }

//   /**
//    * Vérifie si au moins un service est activé
//    */
//   private hasAnyServiceEnabled(): boolean {
//     return this.isSendGridEnabled || this.isSMTPEnabled || this.isWebPushEnabled || this.isFirebaseEnabled;
//   }

//   /**
//    * Log l'état de tous les services
//    */
//   private logServiceStatus(): void {
//     logger.info('État des services de notification', {
//       email: {
//         sendgrid: this.isSendGridEnabled,
//         smtp: this.isSMTPEnabled,
//         strategy: this.emailStrategy,
//         primaryService: this.getPrimaryEmailService()
//       },
//       push: {
//         webPush: this.isWebPushEnabled,
//         firebase: this.isFirebaseEnabled,
//         vapidConfigured: !!(this.webPushVapidKeys.publicKey && this.webPushVapidKeys.privateKey)
//       }
//     });
//   }

//   /**
//    * Initialise Web Push
//    */
//   private initializeWebPush(): boolean {
//     const vapidSubject = process.env.VAPID_SUBJECT || config.webPush?.vapidSubject;
//     const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || config.webPush?.vapidPublicKey;
//     const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || config.webPush?.vapidPrivateKey;

//     if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
//       logger.warn('Web Push non configuré - clés VAPID manquantes', {
//         hasSubject: !!vapidSubject,
//         hasPublicKey: !!vapidPublicKey,
//         hasPrivateKey: !!vapidPrivateKey
//       });
//       return false;
//     }

//     try {
//       // Stocker les clés pour usage ultérieur
//       this.webPushVapidKeys = {
//         subject: vapidSubject,
//         publicKey: vapidPublicKey,
//         privateKey: vapidPrivateKey
//       };

//       // Configurer Web Push
//       webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      
//       logger.info('Web Push initialisé avec succès', {
//         subject: vapidSubject,
//         publicKeyLength: vapidPublicKey.length
//       });
      
//       return true;
//     } catch (error) {
//       logger.error('Erreur lors de l\'initialisation de Web Push', {
//         error: error instanceof Error ? error.message : 'Erreur inconnue'
//       });
//       return false;
//     }
//   }

//   /**
//    * Initialise Firebase Admin
//    */
//   private initializeFirebase(): boolean {
//     const projectId = process.env.FIREBASE_PROJECT_ID || config.firebase?.projectId;
//     const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || config.firebase?.clientEmail;
//     const privateKey = (process.env.FIREBASE_PRIVATE_KEY || config.firebase?.privateKey)?.replace(/\\n/g, '\n');

//     if (!projectId || !clientEmail || !privateKey) {
//       logger.warn('Firebase non configuré - identifiants manquants', {
//         hasProjectId: !!projectId,
//         hasClientEmail: !!clientEmail,
//         hasPrivateKey: !!privateKey
//       });
//       return false;
//     }

//     try {
//       // Vérifier si Firebase est déjà initialisé
//       if (!admin.apps.length) {
//         admin.initializeApp({
//           credential: admin.credential.cert({
//             projectId,
//             clientEmail,
//             privateKey
//           })
//         });
//       }

//       logger.info('Firebase Admin initialisé avec succès', {
//         projectId,
//         clientEmail: clientEmail.substring(0, 20) + '...'
//       });
      
//       return true;
//     } catch (error) {
//       logger.error('Erreur lors de l\'initialisation de Firebase', {
//         error: error instanceof Error ? error.message : 'Erreur inconnue'
//       });
//       return false;
//     }
//   }

//   /**
//    * Initialise SendGrid (existant)
//    */
//   private initializeSendGrid(): boolean {
//     if (!config.sendgrid.enabled || !config.sendgrid.apiKey) {
//       logger.warn('SendGrid non configuré', {
//         enabled: config.sendgrid.enabled,
//         hasApiKey: !!config.sendgrid.apiKey
//       });
//       return false;
//     }

//     try {
//       sgMail.setApiKey(config.sendgrid.apiKey);
//       logger.info('SendGrid initialisé avec succès');
//       return true;
//     } catch (error) {
//       logger.error('Erreur lors de l\'initialisation de SendGrid', {
//         error: error instanceof Error ? error.message : 'Erreur inconnue'
//       });
//       return false;
//     }
//   }

//   /**
//    * Initialise SMTP (existant)
//    */
//   private initializeSMTP(): boolean {
//     if (!config.email.enabled || !config.email.host || !config.email.user || !config.email.password) {
//       logger.warn('SMTP non configuré', {
//         enabled: config.email.enabled,
//         hasHost: !!config.email.host,
//         hasUser: !!config.email.user,
//         hasPassword: !!config.email.password
//       });
//       return false;
//     }

//     try {
//       this.transporter = nodemailer.createTransporter({
//         host: config.email.host,
//         port: config.email.port,
//         secure: config.email.secure,
//         auth: {
//           user: config.email.user,
//           pass: config.email.password
//         },
//         pool: config.email.pool || true,
//         maxConnections: config.email.maxConnections || 5,
//         maxMessages: 100,
//         rateDelta: 20000,
//         rateLimit: 5,
//         connectionTimeout: config.email.timeout || 15000,
//         greetingTimeout: 10000,
//         socketTimeout: 30000,
//         tls: {
//           rejectUnauthorized: config.app.env === 'production',
//           minVersion: 'TLSv1.2'
//         },
//         debug: config.app.env === 'development',
//         logger: config.app.env === 'development'
//       });

//       this.verifyConnectionAsync();
      
//       logger.info('SMTP initialisé avec succès', {
//         host: config.email.host,
//         port: config.email.port,
//         secure: config.email.secure
//       });
      
//       return true;
//     } catch (error) {
//       logger.error('Erreur lors de l\'initialisation SMTP', {
//         error: error instanceof Error ? error.message : 'Erreur inconnue'
//       });
//       return false;
//     }
//   }

//   // === MÉTHODES EMAIL (existantes) ===

//   private getPrimaryEmailService(): string {
//     if (this.emailStrategy === 'smtp-first' && this.isSMTPEnabled) return 'SMTP';
//     if (this.emailStrategy === 'sendgrid-first' && this.isSendGridEnabled) return 'SendGrid';
//     if (this.isSendGridEnabled) return 'SendGrid';
//     if (this.isSMTPEnabled) return 'SMTP';
//     return 'None';
//   }

//   private async verifyConnectionAsync(): Promise<void> {
//     if (!this.transporter) return;

//     try {
//       await Promise.race([
//         this.transporter.verify(),
//         new Promise((_, reject) => 
//           setTimeout(() => reject(new Error('Connection verification timeout')), 10000)
//         )
//       ]);
//       logger.info('Connexion SMTP vérifiée avec succès');
//     } catch (error) {
//       logger.error('Échec de la vérification SMTP', {
//         error: error instanceof Error ? error.message : 'Erreur inconnue',
//         host: config.email.host,
//         port: config.email.port
//       });
//     }
//   }

//   private isValidEmail(email: string): boolean {
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     return emailRegex.test(email);
//   }

//   private maskEmail(email: string): string {
//     const [local, domain] = email.split('@');
//     const maskedLocal = local.length > 2 ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] : local;
//     return `${maskedLocal}@${domain}`;
//   }

//   // === NOUVELLES MÉTHODES PUSH NOTIFICATIONS ===

//   /**
//    * Envoie une notification push Firebase
//    */
//   async sendFirebasePushNotification(options: PushNotificationOptions): Promise<boolean> {
//     if (!this.isFirebaseEnabled) {
//       logger.debug('Firebase non activé, impossible d\'envoyer la notification');
//       return false;
//     }

//     if (!options.tokens || options.tokens.length === 0) {
//       logger.warn('Aucun token FCM fourni');
//       return false;
//     }

//     try {
//       const message = {
//         notification: {
//           title: options.title,
//           body: options.body,
//           imageUrl: options.icon
//         },
//         data: options.data || {},
//         android: {
//           notification: {
//             channelId: options.channelId || 'default',
//             priority: 'high' as const,
//             defaultSound: true,
//             defaultVibrateTimings: true,
//             icon: 'ic_notification',
//             color: options.color || '#4A90E2'
//           }
//         },
//         apns: {
//           payload: {
//             aps: {
//               alert: {
//                 title: options.title,
//                 body: options.body
//               },
//               badge: options.badge || 1,
//               sound: 'default',
//               category: options.category || 'DEFAULT'
//             }
//           }
//         },
//         tokens: options.tokens.filter(token => token && token.trim() !== '')
//       };

//       const response = await admin.messaging().sendMulticast(message);
      
//       // Nettoyer les tokens invalides
//       if (response.failureCount > 0) {
//         await this.cleanupInvalidTokens(options.tokens, response.responses);
//       }

//       logger.info('Notification Firebase envoyée', {
//         successCount: response.successCount,
//         failureCount: response.failureCount,
//         title: options.title
//       });

//       this.updateRateLimit('firebase');
//       return response.successCount > 0;
      
//     } catch (error) {
//       logger.error('Erreur Firebase Push', {
//         error: error instanceof Error ? error.message : 'Erreur inconnue',
//         title: options.title,
//         tokenCount: options.tokens.length
//       });
//       return false;
//     }
//   }

//   /**
//    * Envoie une notification Web Push
//    */
//   async sendWebPushNotification(options: WebPushOptions): Promise<boolean> {
//     if (!this.isWebPushEnabled) {
//       logger.debug('Web Push non activé, impossible d\'envoyer la notification');
//       return false;
//     }

//     if (!options.subscriptions || options.subscriptions.length === 0) {
//       logger.warn('Aucune souscription Web Push fournie');
//       return false;
//     }

//     try {
//       const payload = JSON.stringify({
//         title: options.title,
//         body: options.body,
//         icon: options.icon,
//         badge: options.badge,
//         data: options.data || {},
//         actions: options.actions || [],
//         requireInteraction: options.requireInteraction || false,
//         silent: options.silent || false,
//         tag: options.tag,
//         renotify: options.renotify || false
//       });

//       const promises = options.subscriptions.map(async (subscription) => {
//         try {
//           return await webpush.sendNotification(subscription, payload);
//         } catch (error: any) {
//           if (error.statusCode === 410 || error.statusCode === 404) {
//             // Subscription expirée
//             await this.removeExpiredSubscription(subscription);
//           }
//           throw error;
//         }
//       });

//       const results = await Promise.allSettled(promises);
//       const successCount = results.filter(r => r.status === 'fulfilled').length;

//       logger.info('Notification Web Push envoyée', {
//         successCount,
//         totalCount: options.subscriptions.length,
//         title: options.title
//       });

//       return successCount > 0;
      
//     } catch (error) {
//       logger.error('Erreur Web Push', {
//         error: error instanceof Error ? error.message : 'Erreur inconnue',
//         title: options.title,
//         subscriptionCount: options.subscriptions.length
//       });
//       return false;
//     }
//   }

//   // === MÉTHODES UTILITAIRES ===

//   /**
//    * Nettoie les tokens FCM invalides
//    */
//   private async cleanupInvalidTokens(tokens: string[], responses: any[]): Promise<void> {
//     const invalidTokens: string[] = [];
    
//     responses.forEach((response, index) => {
//       if (!response.success) {
//         const error = response.error;
//         if (error.code === 'messaging/invalid-registration-token' || 
//             error.code === 'messaging/registration-token-not-registered') {
//           invalidTokens.push(tokens[index]);
//         }
//       }
//     });

//     if (invalidTokens.length > 0) {
//       logger.info('Nettoyage des tokens FCM invalides', { count: invalidTokens.length });
//       // Ici vous devriez appeler votre méthode pour supprimer les tokens de la base de données
//       // await this.removeInvalidTokensFromDatabase(invalidTokens);
//     }
//   }

//   /**
//    * Supprime une souscription Web Push expirée
//    */
//   private async removeExpiredSubscription(subscription: any): Promise<void> {
//     try {
//       logger.info('Suppression d\'une souscription Web Push expirée', {
//         endpoint: subscription.endpoint?.substring(0, 50) + '...'
//       });
//       // Ici vous devriez appeler votre méthode pour supprimer la souscription de la base de données
//       // await this.removeSubscriptionFromDatabase(subscription);
//     } catch (error) {
//       logger.error('Erreur lors de la suppression de la souscription', {
//         error: error instanceof Error ? error.message : 'Erreur inconnue'
//       });
//     }
//   }

//   // === MÉTHODES PUBLIQUES ===

//   /**
//    * Envoie un email (utilise la logique existante)
//    */
//   async sendEmail(mailOptions: EmailOptions): Promise<boolean> {
//     return this.sendEmailSafely(mailOptions);
//   }

//   /**
//    * Envoie une notification push mobile (Firebase par défaut)
//    */
//   async sendMobilePushNotification(options: PushNotificationOptions): Promise<boolean> {
//     return this.sendFirebasePushNotification(options);
//   }

//   /**
//    * Envoie une notification push web
//    */
//   async sendWebNotification(options: WebPushOptions): Promise<boolean> {
//     return this.sendWebPushNotification(options);
//   }

//   /**
//    * Envoie une notification multi-canal (email + push)
//    */
//   async sendMultiChannelNotification(
//     emailOptions?: EmailOptions,
//     pushOptions?: PushNotificationOptions,
//     webPushOptions?: WebPushOptions
//   ): Promise<{ email: boolean; mobilePush: boolean; webPush: boolean }> {
//     const results = {
//       email: false,
//       mobilePush: false,
//       webPush: false
//     };

//     const promises: Promise<void>[] = [];

//     if (emailOptions) {
//       promises.push(
//         this.sendEmail(emailOptions).then(success => {
//           results.email = success;
//         }).catch(error => {
//           logger.error('Erreur envoi email multi-canal', { error: error.message });
//         })
//       );
//     }

//     if (pushOptions) {
//       promises.push(
//         this.sendMobilePushNotification(pushOptions).then(success => {
//           results.mobilePush = success;
//         }).catch(error => {
//           logger.error('Erreur envoi push mobile multi-canal', { error: error.message });
//         })
//       );
//     }

//     if (webPushOptions) {
//       promises.push(
//         this.sendWebNotification(webPushOptions).then(success => {
//           results.webPush = success;
//         }).catch(error => {
//           logger.error('Erreur envoi web push multi-canal', { error: error.message });
//         })
//       );
//     }

//     await Promise.allSettled(promises);

//     logger.info('Notification multi-canal envoyée', results);
//     return results;
//   }

//   /**
//    * Obtient l'état des services
//    */
//   getServiceStatus() {
//     return {
//       email: {
//         sendgrid: this.isSendGridEnabled,
//         smtp: this.isSMTPEnabled,
//         strategy: this.emailStrategy
//       },
//       push: {
//         firebase: this.isFirebaseEnabled,
//         webPush: this.isWebPushEnabled
//       },
//       rateLimits: {
//         sendgrid: this.rateLimiter.sendgrid,
//         smtp: this.rateLimiter.smtp,
//         firebase: this.rateLimiter.firebase
//       }
//     };
//   }

//   // === MÉTHODES EMAIL EXISTANTES (conservées) ===

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
//         to: mailOptions.to,
//         from: {
//           email: this.fromEmail,
//           name: 'EasyRent'
//         },
//         subject: mailOptions.subject,
//         html: mailOptions.html,
//         text: mailOptions.text || this.stripHtml(mailOptions.html),
//         tracking_settings: {
//           click_tracking: { enable: false },
//           open_tracking: { enable: false }
//         },
//       };

//       logger.debug('Sending email via SendGrid', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         fromEmail: this.fromEmail
//       });

//       const response = await sgMail.send(msg);

//       logger.info('Email envoyé avec SendGrid', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         messageId: response[0].headers['x-message-id'],
//         statusCode: response[0].statusCode
//       });

//       this.updateRateLimit('sendgrid');
//       return true;
//     } catch (error: any) {
//       logger.error('Erreur SendGrid', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         error: error.message || 'Erreur inconnue',
//         code: error.code,
//         statusCode: error.response?.status
//       });

//       return false;
//     }
//   }

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
//         to: mailOptions.to,
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
//           setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
//         )
//       ]) as any;

//       logger.info('Email envoyé avec SMTP', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         messageId: result.messageId
//       });

//       this.updateRateLimit('smtp');
//       return true;
//     } catch (error) {
//       logger.error('Erreur SMTP', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject,
//         error: error instanceof Error ? error.message : 'Erreur inconnue'
//       });

//       return false;
//     }
//   }

//   private async sendEmailSafely(mailOptions: EmailOptions): Promise<boolean> {
//     if (!this.isSendGridEnabled && !this.isSMTPEnabled) {
//       logger.error('Aucun service email disponible', {
//         to: this.maskEmail(mailOptions.to),
//         subject: mailOptions.subject
//       });
//       return false;
//     }

//     const services = this.getServicesInOrder();
    
//     for (const service of services) {
//       try {
//         let success = false;
        
//         if (service === 'sendgrid' && this.isSendGridEnabled) {
//           logger.debug('Tentative d\'envoi via SendGrid...');
//           success = await this.sendWithSendGrid(mailOptions);
//         } else if (service === 'smtp' && this.isSMTPEnabled) {
//           logger.debug('Tentative d\'envoi via SMTP...');
//           success = await this.sendWithSMTP(mailOptions);
//         }
        
//         if (success) {
//           return true;
//         }
        
//         logger.warn(`${service.toUpperCase()} a échoué, tentative avec le service suivant...`);
//       } catch (error) {
//         logger.error(`Erreur lors de l'envoi avec ${service}`, {
//           error: error instanceof Error ? error.message : 'Erreur inconnue',
//           to: this.maskEmail(mailOptions.to)
//         });
//       }
//     }

//     logger.error('Échec de tous les services email', {
//       to: this.maskEmail(mailOptions.to),
//       subject: mailOptions.subject,
//       strategy: this.emailStrategy,
//       sendgridEnabled: this.isSendGridEnabled,
//       smtpEnabled: this.isSMTPEnabled
//     });

//     return false;
//   }

//   private stripHtml(html: string): string {
//     return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
//   }

//   private getServicesInOrder(): ('sendgrid' | 'smtp')[] {
//     switch (this.emailStrategy) {
//       case 'sendgrid-first':
//         return ['sendgrid', 'smtp'];
//       case 'smtp-first':
//         return ['smtp', 'sendgrid'];
//       default:
//         return this.isSendGridEnabled ? ['sendgrid', 'smtp'] : ['smtp', 'sendgrid'];
//     }
//   }

//   private updateRateLimit(service: 'sendgrid' | 'smtp' | 'firebase'): void {
//     this.rateLimiter[service].requests++;
//   }

//   // Queue management methods (conservées de votre code existant)
//   private async queueEmail(
//     mailOptions: EmailOptions, 
//     priority: 'high' | 'normal' | 'low' = 'normal',
//     maxAttempts: number = 3
//   ): Promise<string> {
//     const queuedEmail: QueuedEmail = {
//       ...mailOptions,
//       id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
//       priority,
//       attempts: 0,
//       maxAttempts,
//       scheduledAt: new Date()
//     };

//     if (priority === 'high') {
//       this.emailQueue.unshift(queuedEmail);
//     } else {
//       this.emailQueue.push(queuedEmail);
//     }

//     logger.info('Email ajouté à la queue', {
//       id: queuedEmail.id,
//       to: this.maskEmail(mailOptions.to),
//       priority,
//       queueLength: this.emailQueue.length
//     });

//     if (!this.isProcessingQueue) {
//       this.processEmailQueue();
//     }

//     return queuedEmail.id;
//   }

//   private async processEmailQueue(): Promise<void> {
//     if (this.isProcessingQueue || this.emailQueue.length === 0) {
//       return;
//     }

//     this.isProcessingQueue = true;
//     logger.debug('Début du traitement de la queue email');

//     while (this.emailQueue.length > 0) {
//       const email = this.emailQueue.shift()!;
      
//       try {
//         if (!this.canSendEmail()) {
//           this.emailQueue.unshift(email);
//           logger.debug('Rate limit atteint, pause de 10 secondes');
//           await this.delay(10000);
//           continue;
//         }

//         const success = await this.sendEmailSafely(email);
        
//         if (success) {
//           logger.info('Email envoyé avec succès depuis la queue', {
//             id: email.id,
//             to: this.maskEmail(email.to),
//             attempts: email.attempts + 1
//           });
//         } else {
//           email.attempts++;
          
//           if (email.attempts < email.maxAttempts) {
//             email.scheduledAt = new Date(Date.now() + (email.attempts * 30000));
//             this.emailQueue.push(email);
            
//             logger.warn('Email échoué, re-ajouté à la queue', {
//               id: email.id,
//               attempts: email.attempts,
//               maxAttempts: email.maxAttempts
//             });
//           } else {
//             logger.error('Email définitivement échoué après tous les essais', {
//               id: email.id,
//               to: this.maskEmail(email.to),
//               attempts: email.attempts
//             });
//           }
//         }
        
//         await this.delay(1000);
        
//       } catch (error) {
//         logger.error('Erreur lors du traitement de la queue', {
//           emailId: email.id,
//           error: error instanceof Error ? error.message : 'Erreur inconnue'
//         });
        
//         if (email.attempts < email.maxAttempts) {
//           email.attempts++;
//           this.emailQueue.push(email);
//         }
//       }
//     }

//     this.isProcessingQueue = false;
//     logger.debug('Fin du traitement de la queue email');
//   }

//   private canSendEmail(): boolean {
//     const now = Date.now();
    
//     if (now > this.rateLimiter.sendgrid.resetTime) {
//       this.rateLimiter.sendgrid.requests = 0;
//       this.rateLimiter.sendgrid.resetTime = now + 60000;
//     }
    
//     if (now > this.rateLimiter.smtp.resetTime) {
//       this.rateLimiter.smtp.requests = 0;
//       this.rateLimiter.smtp.resetTime = now + 60000;
//     }

//     const canUseSendGrid = this.isSendGridEnabled && 
//       this.rateLimiter.sendgrid.requests < this.rateLimiter.sendgrid.limit;
    
//     const canUseSMTP = this.isSMTPEnabled && 
//       this.rateLimiter.smtp.requests < this.rateLimiter.smtp.limit;

//     return canUseSendGrid || canUseSMTP;
//   }

//   private delay(ms: number): Promise<void> {
//     return new Promise(resolve => setTimeout(resolve, ms));
//   }

//   async sendUrgentEmail(mailOptions: EmailOptions): Promise<boolean> {
//     const success = await this.sendEmail