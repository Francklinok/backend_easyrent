// import mongoose, { Schema, Types, Document, Model } from 'mongoose';

// // Interface pour une notification
// export interface INotification {
//   _id: Types.ObjectId;
//   title: string;
//   message: string;
//   type: 'info' | 'success' | 'warning' | 'error' | 'push';
//   link?: string;
//   metadata?: any;
//   read: boolean;
//   createdAt: Date;
//   readAt?: Date;
// }

// // Interface utilisateur avec notifications
// export interface IUser extends Document {
//   notifications: INotification[];
//   pushToken?: string;
// }

// // Schéma de notification
// const notificationSchema = new Schema<INotification>(
//   {
//     _id: { type: Schema.Types.ObjectId, required: true, auto: true },
//     title: { type: String, required: true },
//     message: { type: String, required: true },
//     type: {
//       type: String,
//       enum: ['info', 'success', 'warning', 'error', 'push'],
//       default: 'info'
//     },
//     link: { type: String },
//     metadata: Schema.Types.Mixed,
//     read: { type: Boolean, default: false },
//     createdAt: { type: Date, default: Date.now },
//     readAt: { type: Date }
//   },
//   { _id: false } // Car nous allons créer l'ID nous-mêmes
// );

// // Classe de service
// export class NotificationService {
//   private userModel: Model<IUser>;

//   constructor(userModel: Model<IUser>) {
//     this.userModel = userModel;
//   }

//   async addNotification(userId: string, notification: Partial<INotification>) {
//     const user = await this.userModel.findById(userId);
//     if (!user) throw new Error("Utilisateur non trouvé");

//     const newNotification: INotification = {
//       _id: new mongoose.Types.ObjectId(),
//       title: notification.title!,
//       message: notification.message!,
//       type: notification.type ?? 'info',
//       link: notification.link,
//       metadata: notification.metadata,
//       read: false,
//       createdAt: new Date()
//     };

//     user.notifications = user.notifications ?? [];
//     user.notifications.push(newNotification);
//     await user.save();

//     return {
//       success: true,
//       notification: newNotification,
//       user
//     };
//   }

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
//     type?: INotification["type"];
//     unreadOnly?: boolean;
//     skip?: number;
//     limit?: number;
//   } = {}) {
//     const user = await this.userModel.findById(userId);
//     if (!user || !user.notifications) {
//       return { success: true, notifications: [], unreadCount: 0 };
//     }

//     let notifications = [...user.notifications];

//     if (options.type) notifications = notifications.filter(n => n.type === options.type);
//     if (options.unreadOnly) notifications = notifications.filter(n => !n.read);

//     notifications.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

//     const skip = options.skip ?? 0;
//     const limit = options.limit ?? 50;
//     const paginated = notifications.slice(skip, skip + limit);
//     const unreadCount = user.notifications.filter(n => !n.read).length;

//     return {
//       success: true,
//       notifications: paginated,
//       total: notifications.length,
//       unreadCount,
//       hasMore: skip + limit < notifications.length
//     };
//   }

//   async getUnreadCount(userId: string) {
//     const user = await this.userModel.findById(userId);
//     if (!user || !user.notifications) return { success: true, count: 0 };

//     const count = user.notifications.filter(n => !n.read).length;
//     return { success: true, count };
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

//   async sendPushNotification(
//     userId: string,
//     notification: Partial<INotification>,
//     pushService?: {
//       send: (data: { to: string; title: string; body: string; data: any }) => Promise<void>
//     }
//   ) {
//     const result = await this.addNotification(userId, {
//       ...notification,
//       type: 'push'
//     });

//     if (pushService && typeof pushService.send === 'function') {
//       const user = await this.userModel.findById(userId);
//       if (user?.pushToken) {
//         await pushService.send({
//           to: user.pushToken,
//           title: notification.title!,
//           body: notification.message!,
//           data: notification.metadata ?? {}
//         });
//       }
//     }

//     return result;
//   }

//   async cleanOldNotifications(userId: string, daysOld = 30) {
//     const user = await this.userModel.findById(userId);
//     if (!user || !user.notifications) return { success: true, deletedCount: 0 };

//     const cutoff = new Date();
//     cutoff.setDate(cutoff.getDate() - daysOld);

//     const initialLength = user.notifications.length;
//     user.notifications = user.notifications.filter(n => new Date(n.createdAt) > cutoff);
//     const deletedCount = initialLength - user.notifications.length;

//     if (deletedCount > 0) await user.save();
//     return { success: true, deletedCount };
//   }
// }
