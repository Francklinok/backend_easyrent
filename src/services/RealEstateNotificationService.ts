// import mongoose, { Schema, Types, Document, Model } from 'mongoose';

// // Types de notifications spécifiques à l'immobilier
// export type NotificationType = 
//   | 'new_property'      // Nouvelle propriété ajoutée
//   | 'price_change'      // Changement de prix
//   | 'property_sold'     // Propriété vendue
//   | 'property_rented'   // Propriété louée
//   | 'inquiry_received'  // Demande de renseignement reçue
//   | 'visit_scheduled'   // Visite programmée
//   | 'visit_reminder'    // Rappel de visite
//   | 'favorite_update'   // Mise à jour sur une propriété favorite
//   | 'message_received'  // Nouveau message
//   | 'review_received'   // Nouvel avis reçu
//   | 'contract_update'   // Mise à jour de contrat
//   | 'payment_reminder'  // Rappel de paiement
//   | 'document_ready'    // Document prêt
//   | 'system'            // Notification système
//   | 'promotion'         // Promotion/Offre spéciale
//   | 'follow'            // Nouvel abonnement
//   | 'like';             // Like reçu

// // Interface pour une notification
// export interface INotification {
//   _id: Types.ObjectId;
//   title: string;
//   message: string;
//   type: NotificationType;
//   link?: string;
//   metadata?: {
//     propertyId?: string;
//     userId?: string;
//     contractId?: string;
//     visitId?: string;
//     messageId?: string;
//     price?: number;
//     oldPrice?: number;
//     location?: string;
//     propertyType?: string;
//     action?: string;
//     [key: string]: any;
//   };
//   read: boolean;
//   createdAt: Date;
//   readAt?: Date;
//   priority: 'low' | 'medium' | 'high';
//   icon?: string;
//   actionUrl?: string;
//   actionLabel?: string;
// }

// // Interface utilisateur avec notifications
// export interface IUser extends Document {
//   notifications: INotification[];
//   pushToken?: string;
//   notificationSettings: {
//     propertyUpdates: boolean;
//     messages: boolean;
//     visits: boolean;
//     payments: boolean;
//     marketing: boolean;
//   };
// }

// // Schéma de notification
// const notificationSchema = new Schema<INotification>(
//   {
//     _id: { type: Schema.Types.ObjectId, required: true, auto: true },
//     title: { type: String, required: true },
//     message: { type: String, required: true },
//     type: {
//       type: String,
//       enum: [
//         'new_property', 'price_change', 'property_sold', 'property_rented',
//         'inquiry_received', 'visit_scheduled', 'visit_reminder', 'favorite_update',
//         'message_received', 'review_received', 'contract_update', 'payment_reminder',
//         'document_ready', 'system', 'promotion', 'follow', 'like'
//       ],
//       required: true
//     },
//     link: { type: String },
//     metadata: Schema.Types.Mixed,
//     read: { type: Boolean, default: false },
//     createdAt: { type: Date, default: Date.now },
//     readAt: { type: Date },
//     priority: { 
//       type: String, 
//       enum: ['low', 'medium', 'high'], 
//       default: 'medium' 
//     },
//     icon: { type: String },
//     actionUrl: { type: String },
//     actionLabel: { type: String }
//   },
//   { _id: false }
// );

// export class RealEstateNotificationService {
//   private userModel: Model<IUser>;

//   constructor(userModel: Model<IUser>) {
//     this.userModel = userModel;
//   }

//   // Méthodes génériques
//   private async addNotification(userId: string, notification: Partial<INotification>) {
//     const user = await this.userModel.findById(userId);
//     if (!user) throw new Error("Utilisateur non trouvé");

//     const newNotification: INotification = {
//       _id: new mongoose.Types.ObjectId(),
//       title: notification.title!,
//       message: notification.message!,
//       type: notification.type!,
//       link: notification.link,
//       metadata: notification.metadata,
//       read: false,
//       createdAt: new Date(),
//       priority: notification.priority || 'medium',
//       icon: notification.icon,
//       actionUrl: notification.actionUrl,
//       actionLabel: notification.actionLabel
//     };

//     user.notifications = user.notifications ?? [];
//     user.notifications.unshift(newNotification); // Ajouter au début
//     await user.save();

//     return { success: true, notification: newNotification };
//   }

//   // === NOTIFICATIONS SPÉCIFIQUES IMMOBILIER ===

//   // Nouvelle propriété disponible
//   async notifyNewProperty(userId: string, propertyData: {
//     propertyId: string;
//     title: string;
//     price: number;
//     location: string;
//     type: string;
//   }) {
//     return this.addNotification(userId, {
//       title: "🏠 Nouvelle propriété disponible",
//       message: `${propertyData.title} à ${propertyData.location} - ${propertyData.price}€`,
//       type: 'new_property',
//       priority: 'medium',
//       icon: '🏠',
//       metadata: {
//         propertyId: propertyData.propertyId,
//         price: propertyData.price,
//         location: propertyData.location,
//         propertyType: propertyData.type
//       },
//       actionUrl: `/property/${propertyData.propertyId}`,
//       actionLabel: "Voir la propriété"
//     });
//   }

//   // Changement de prix
//   async notifyPriceChange(userId: string, propertyData: {
//     propertyId: string;
//     title: string;
//     oldPrice: number;
//     newPrice: number;
//     location: string;
//   }) {
//     const priceDirection = propertyData.newPrice < propertyData.oldPrice ? "📉 Baisse" : "📈 Hausse";
    
//     return this.addNotification(userId, {
//       title: `${priceDirection} de prix`,
//       message: `${propertyData.title} : ${propertyData.oldPrice}€ → ${propertyData.newPrice}€`,
//       type: 'price_change',
//       priority: 'high',
//       icon: propertyData.newPrice < propertyData.oldPrice ? '📉' : '📈',
//       metadata: {
//         propertyId: propertyData.propertyId,
//         oldPrice: propertyData.oldPrice,
//         price: propertyData.newPrice,
//         location: propertyData.location
//       },
//       actionUrl: `/property/${propertyData.propertyId}`,
//       actionLabel: "Voir la propriété"
//     });
//   }

//   // Demande de renseignement reçue
//   async notifyInquiryReceived(userId: string, inquiryData: {
//     propertyId: string;
//     propertyTitle: string;
//     inquirerName: string;
//     inquirerEmail: string;
//     message: string;
//   }) {
//     return this.addNotification(userId, {
//       title: "📧 Nouvelle demande de renseignement",
//       message: `${inquiryData.inquirerName} s'intéresse à "${inquiryData.propertyTitle}"`,
//       type: 'inquiry_received',
//       priority: 'high',
//       icon: '📧',
//       metadata: {
//         propertyId: inquiryData.propertyId,
//         inquirerName: inquiryData.inquirerName,
//         inquirerEmail: inquiryData.inquirerEmail,
//         message: inquiryData.message
//       },
//       actionUrl: `/inquiries`,
//       actionLabel: "Voir la demande"
//     });
//   }

//   // Visite programmée
//   async notifyVisitScheduled(userId: string, visitData: {
//     propertyId: string;
//     propertyTitle: string;
//     visitDate: Date;
//     visitorName: string;
//     visitId: string;
//   }) {
//     const dateStr = visitData.visitDate.toLocaleDateString('fr-FR', {
//       day: 'numeric',
//       month: 'long',
//       hour: '2-digit',
//       minute: '2-digit'
//     });

//     return this.addNotification(userId, {
//       title: "📅 Visite programmée",
//       message: `Visite de "${visitData.propertyTitle}" le ${dateStr} avec ${visitData.visitorName}`,
//       type: 'visit_scheduled',
//       priority: 'high',
//       icon: '📅',
//       metadata: {
//         propertyId: visitData.propertyId,
//         visitId: visitData.visitId,
//         visitDate: visitData.visitDate,
//         visitorName: visitData.visitorName
//       },
//       actionUrl: `/visits/${visitData.visitId}`,
//       actionLabel: "Voir la visite"
//     });
//   }

//   // Rappel de visite (1h avant)
//   async notifyVisitReminder(userId: string, visitData: {
//     propertyId: string;
//     propertyTitle: string;
//     visitDate: Date;
//     address: string;
//     visitId: string;
//   }) {
//     return this.addNotification(userId, {
//       title: "⏰ Rappel de visite",
//       message: `N'oubliez pas votre visite de "${visitData.propertyTitle}" dans 1 heure`,
//       type: 'visit_reminder',
//       priority: 'high',
//       icon: '⏰',
//       metadata: {
//         propertyId: visitData.propertyId,
//         visitId: visitData.visitId,
//         visitDate: visitData.visitDate,
//         address: visitData.address
//       },
//       actionUrl: `/visits/${visitData.visitId}`,
//       actionLabel: "Voir les détails"
//     });
//   }

//   // Propriété vendue/louée
//   async notifyPropertySoldRented(userId: string, propertyData: {
//     propertyId: string;
//     title: string;
//     price: number;
//     type: 'sold' | 'rented';
//   }) {
//     const action = propertyData.type === 'sold' ? 'vendue' : 'louée';
//     const icon = propertyData.type === 'sold' ? '💰' : '🤝';

//     return this.addNotification(userId, {
//       title: `${icon} Propriété ${action}`,
//       message: `"${propertyData.title}" a été ${action} pour ${propertyData.price}€`,
//       type: propertyData.type === 'sold' ? 'property_sold' : 'property_rented',
//       priority: 'medium',
//       icon,
//       metadata: {
//         propertyId: propertyData.propertyId,
//         price: propertyData.price,
//         action: propertyData.type
//       },
//       actionUrl: `/property/${propertyData.propertyId}`,
//       actionLabel: "Voir la propriété"
//     });
//   }

//   // Nouveau message reçu
//   async notifyMessageReceived(userId: string, messageData: {
//     senderName: string;
//     senderId: string;
//     subject?: string;
//     preview: string;
//     messageId: string;
//   }) {
//     return this.addNotification(userId, {
//       title: "💬 Nouveau message",
//       message: `Message de ${messageData.senderName}: ${messageData.preview}`,
//       type: 'message_received',
//       priority: 'medium',
//       icon: '💬',
//       metadata: {
//         senderId: messageData.senderId,
//         senderName: messageData.senderName,
//         messageId: messageData.messageId,
//         subject: messageData.subject
//       },
//       actionUrl: `/messages/${messageData.messageId}`,
//       actionLabel: "Lire le message"
//     });
//   }

//   // Nouveau suivi/abonnement
//   async notifyNewFollower(userId: string, followerData: {
//     followerId: string;
//     followerName: string;
//     followerType: 'user' | 'agent';
//   }) {
//     const type = followerData.followerType === 'agent' ? 'agent' : 'utilisateur';
    
//     return this.addNotification(userId, {
//       title: "👤 Nouvel abonnement",
//       message: `${followerData.followerName} (${type}) vous suit maintenant`,
//       type: 'follow',
//       priority: 'low',
//       icon: '👤',
//       metadata: {
//         followerId: followerData.followerId,
//         followerName: followerData.followerName,
//         followerType: followerData.followerType
//       },
//       actionUrl: `/profile/${followerData.followerId}`,
//       actionLabel: "Voir le profil"
//     });
//   }

//   // Mise à jour de propriété favorite
//   async notifyFavoriteUpdate(userId: string, propertyData: {
//     propertyId: string;
//     title: string;
//     updateType: 'price' | 'status' | 'photos' | 'description';
//     details: string;
//   }) {
//     const updateTypes = {
//       'price': '💰 Prix mis à jour',
//       'status': '📋 Statut modifié',
//       'photos': '📸 Nouvelles photos',
//       'description': '📝 Description mise à jour'
//     };

//     return this.addNotification(userId, {
//       title: "⭐ Propriété favorite mise à jour",
//       message: `${updateTypes[propertyData.updateType]} pour "${propertyData.title}"`,
//       type: 'favorite_update',
//       priority: 'medium',
//       icon: '⭐',
//       metadata: {
//         propertyId: propertyData.propertyId,
//         updateType: propertyData.updateType,
//         details: propertyData.details
//       },
//       actionUrl: `/property/${propertyData.propertyId}`,
//       actionLabel: "Voir les changements"
//     });
//   }

//   // === MÉTHODES DE GESTION ===

//   async markAsRead(userId: string, notificationId: string) {
//     const user = await this.userModel.findById(userId);
//     if (!user || !user.notifications) throw new Error("Utilisateur ou notifications non trouvés");

//     const notification = user.notifications.find(
//       n => n._id.toString() === notificationId
//     );

//     if (notification && !notification.read) {
//       notification.read = true;
//       notification.readAt = new Date();
//       await user.save();
//       return { success: true, notification };
//     }

//     return { success: false, message: "Notification déjà lue ou non trouvée" };
//   }

//   async markAllAsRead(userId: string) {
//     const user = await this.userModel.findById(userId);
//     if (!user || !user.notifications) throw new Error("Utilisateur non trouvé");

//     let updatedCount = 0;
//     user.notifications.forEach(notification => {
//       if (!notification.read) {
//         notification.read = true;
//         notification.readAt = new Date();
//         updatedCount++;
//       }
//     });

//     if (updatedCount > 0) await user.save();
//     return { success: true, updatedCount };
//   }

//   async getNotifications(userId: string, options: {
//     type?: NotificationType;
//     priority?: 'low' | 'medium' | 'high';
//     unreadOnly?: boolean;
//     skip?: number;
//     limit?: number;
//   } = {}) {
//     const user = await this.userModel.findById(userId);
//     if (!user || !user.notifications) {
//       return { 
//         success: true, 
//         notifications: [], 
//         unreadCount: 0,
//         summary: { high: 0, medium: 0, low: 0 }
//       };
//     }

//     let notifications = [...user.notifications];

//     // Filtres
//     if (options.type) notifications = notifications.filter(n => n.type === options.type);
//     if (options.priority) notifications = notifications.filter(n => n.priority === options.priority);
//     if (options.unreadOnly) notifications = notifications.filter(n => !n.read);

//     // Tri par priorité puis par date
//     notifications.sort((a, b) => {
//       const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
//       const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
//       if (priorityDiff !== 0) return priorityDiff;
//       return +new Date(b.createdAt) - +new Date(a.createdAt);
//     });

//     // Pagination
//     const skip = options.skip ?? 0;
//     const limit = options.limit ?? 20;
//     const paginated = notifications.slice(skip, skip + limit);

//     // Statistiques
//     const unreadNotifications = user.notifications.filter(n => !n.read);
//     const unreadCount = unreadNotifications.length;
//     const summary = {
//       high: unreadNotifications.filter(n => n.priority === 'high').length,
//       medium: unreadNotifications.filter(n => n.priority === 'medium').length,
//       low: unreadNotifications.filter(n => n.priority === 'low').length
//     };

//     return {
//       success: true,
//       notifications: paginated,
//       total: notifications.length,
//       unreadCount,
//       summary,
//       hasMore: skip + limit < notifications.length
//     };
//   }

//   async deleteNotification(userId: string, notificationId: string) {
//     const user = await this.userModel.findById(userId);
//     if (!user || !user.notifications) throw new Error("Utilisateur non trouvé");

//     const initialLength = user.notifications.length;
//     user.notifications = user.notifications.filter(
//       n => n._id.toString() !== notificationId
//     );

//     if (user.notifications.length < initialLength) {
//       await user.save();
//       return { success: true, message: "Notification supprimée" };
//     }

//     return { success: false, message: "Notification non trouvée" };
//   }

//   async deleteReadNotifications(userId: string) {
//     const user = await this.userModel.findById(userId);
//     if (!user || !user.notifications) throw new Error("Utilisateur non trouvé");

//     const initialLength = user.notifications.length;
//     user.notifications = user.notifications.filter(n => !n.read);
//     const deletedCount = initialLength - user.notifications.length;

//     if (deletedCount > 0) await user.save();
//     return { success: true, deletedCount };
//   }

//   // Nettoyer les anciennes notifications (garder seulement les 100 plus récentes)
//   async cleanOldNotifications(userId: string, maxNotifications = 100) {
//     const user = await this.userModel.findById(userId);
//     if (!user || !user.notifications) return { success: true, deletedCount: 0 };

//     if (user.notifications.length <= maxNotifications) {
//       return { success: true, deletedCount: 0 };
//     }

//     // Trier par date et garder les plus récentes
//     user.notifications.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
//     const deletedCount = user.notifications.length - maxNotifications;
//     user.notifications = user.notifications.slice(0, maxNotifications);

//     await user.save();
//     return { success: true, deletedCount };
//   }
// }