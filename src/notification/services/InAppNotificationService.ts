import { Server as SocketIOServer } from 'socket.io';
import { Notification, NotificationHistory, INotification } from '../models/Notification';
import {
  InAppNotificationData,
  NotificationProvider,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  NotificationPriority,
  NotificationRequest
} from '../types/notificationTypes';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('InAppNotificationService');

export class InAppNotificationService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private userSockets: Map<string, string> = new Map(); // socketId -> userId

  constructor(io?: SocketIOServer) {
    if (io) {
      this.initializeSocketIO(io);
    }
  }

  initializeSocketIO(io: SocketIOServer): void {
    this.io = io;

    this.io.on('connection', (socket) => {
      logger.debug('Nouvelle connexion socket', { socketId: socket.id });

      // Authentification de l'utilisateur
      socket.on('authenticate', async (data: { userId: string; token?: string }) => {
        try {
          // Vérifier le token si nécessaire
          if (data.token) {
            // Validation du token JWT ici si nécessaire
            // await this.validateToken(data.token);
          }

          const userId = data.userId;

          // Enregistrer la connexion
          this.registerUserConnection(userId, socket.id);

          // Rejoindre la room de l'utilisateur
          socket.join(`user_${userId}`);

          logger.info('Utilisateur authentifié', { userId, socketId: socket.id });

          // Envoyer les notifications non lues
          await this.sendUnreadNotifications(userId, socket.id);

          socket.emit('authenticated', { success: true, userId });
        } catch (error) {
          logger.error('Erreur d\'authentification socket', {
            error: error instanceof Error ? error.message : 'Erreur inconnue',
            socketId: socket.id
          });
          socket.emit('authentication_error', { message: 'Échec de l\'authentification' });
        }
      });

      // Marquer une notification comme lue
      socket.on('mark_as_read', async (data: { notificationId: string }) => {
        try {
          const userId = this.userSockets.get(socket.id);
          if (!userId) {
            socket.emit('error', { message: 'Non authentifié' });
            return;
          }

          await this.markAsRead(data.notificationId, userId);
          socket.emit('notification_read', { notificationId: data.notificationId });

          // Mettre à jour le compteur de notifications non lues
          const unreadCount = await this.getUnreadCount(userId);
          socket.emit('unread_count_updated', { count: unreadCount });
        } catch (error) {
          logger.error('Erreur lors du marquage comme lu', {
            error: error instanceof Error ? error.message : 'Erreur inconnue',
            notificationId: data.notificationId
          });
          socket.emit('error', { message: 'Erreur lors du marquage' });
        }
      });

      // Marquer toutes les notifications comme lues
      socket.on('mark_all_as_read', async () => {
        try {
          const userId = this.userSockets.get(socket.id);
          if (!userId) {
            socket.emit('error', { message: 'Non authentifié' });
            return;
          }

          await this.markAllAsRead(userId);
          socket.emit('all_notifications_read');
          socket.emit('unread_count_updated', { count: 0 });
        } catch (error) {
          logger.error('Erreur lors du marquage de toutes les notifications', {
            error: error instanceof Error ? error.message : 'Erreur inconnue'
          });
          socket.emit('error', { message: 'Erreur lors du marquage' });
        }
      });

      // Obtenir les notifications paginées
      socket.on('get_notifications', async (data: { page?: number; limit?: number; type?: NotificationType }) => {
        try {
          const userId = this.userSockets.get(socket.id);
          if (!userId) {
            socket.emit('error', { message: 'Non authentifié' });
            return;
          }

          const notifications = await this.getNotifications(userId, {
            page: data.page || 1,
            limit: data.limit || 20,
            type: data.type
          });

          socket.emit('notifications_list', notifications);
        } catch (error) {
          logger.error('Erreur lors de la récupération des notifications', {
            error: error instanceof Error ? error.message : 'Erreur inconnue'
          });
          socket.emit('error', { message: 'Erreur lors de la récupération' });
        }
      });

      // Déconnexion
      socket.on('disconnect', () => {
        this.unregisterUserConnection(socket.id);
        logger.debug('Déconnexion socket', { socketId: socket.id });
      });
    });

    logger.info('Service de notifications in-app initialisé avec Socket.IO');
  }

  async sendNotification(data: InAppNotificationData, notificationId?: string): Promise<boolean> {
    try {
      const userIds = Array.isArray(data.userId) ? data.userId : [data.userId];
      let successCount = 0;

      for (const userId of userIds) {
        // Créer la notification en base de données
        const notification = new Notification({
          userId,
          type: NotificationType.CUSTOM,
          title: data.title,
          message: data.message,
          data: {
            icon: data.icon,
            image: data.image,
            actionUrl: data.actionUrl,
            actionLabel: data.actionLabel,
            category: data.category
          },
          priority: NotificationPriority.NORMAL,
          isRead: false,
          ...(data.persistent === false && { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }) // 24h par défaut
        });

        const savedNotification = await notification.save();

        // Envoyer via Socket.IO si l'utilisateur est connecté
        const delivered = await this.sendRealTimeNotification(userId, {
          id: savedNotification._id.toString(),
          title: data.title,
          message: data.message,
          type: NotificationType.CUSTOM,
          icon: data.icon, 
          image: data.image,
          actionUrl: data.actionUrl,
          actionLabel: data.actionLabel,
          category: data.category,
          createdAt: savedNotification.createdAt,
          isRead: false
        });

        // Enregistrer dans l'historique
        await this.recordDeliveryHistory(
          savedNotification._id.toString(),
          userId,
          delivered ? NotificationStatus.DELIVERED : NotificationStatus.SENT
        );

        if (delivered) {
          successCount++;
        }
      }

      return successCount > 0;
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de notification in-app', {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        notificationId
      });
      return false;
    }
  }

  async sendRealTimeNotification(userId: string, notificationData: any): Promise<boolean> {
    if (!this.io) {
      logger.warn('Socket.IO non initialisé');
      return false;
    }

    try {
      // Envoyer à la room de l'utilisateur
      this.io.to(`user_${userId}`).emit('new_notification', notificationData);

      // Mettre à jour le compteur de notifications non lues
      const unreadCount = await this.getUnreadCount(userId);
      this.io.to(`user_${userId}`).emit('unread_count_updated', { count: unreadCount });

      // Vérifier si l'utilisateur est connecté
      const userConnections = this.connectedUsers.get(userId);
      const isConnected = userConnections && userConnections.size > 0;

      logger.info('Notification temps réel envoyée', {
        userId,
        connected: isConnected,
        connections: userConnections?.size || 0,
        title: notificationData.title
      });

      return isConnected || false;
    } catch (error) {
      logger.error('Erreur lors de l\'envoi en temps réel', {
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  async sendSystemNotification(
    userIds: string[],
    title: string,
    message: string,
    priority: NotificationPriority = NotificationPriority.HIGH
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        const result = await this.sendNotification({
          userId,
          title,
          message,
          category: 'system',
          persistent: true
        });

        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        logger.error('Erreur lors de l\'envoi de notification système', {
          userId,
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
    }

    logger.info('Notification système envoyée', {
      total: userIds.length,
      success,
      failed,
      title
    });

    return { success, failed };
  }

  async sendBroadcastNotification(
    title: string,
    message: string,
    excludeUserIds: string[] = []
  ): Promise<boolean> {
    if (!this.io) {
      return false;
    }

    try {
      const notificationData = {
        id: `broadcast_${Date.now()}`,
        title,
        message,
        type: NotificationType.SYSTEM_ALERT,
        category: 'broadcast',
        createdAt: new Date(),
        isRead: false
      };

      // Envoyer à tous les utilisateurs connectés sauf ceux exclus
      for (const [userId, socketIds] of this.connectedUsers.entries()) {
        if (!excludeUserIds.includes(userId)) {
          this.io.to(`user_${userId}`).emit('broadcast_notification', notificationData);
        }
      }

      logger.info('Notification broadcast envoyée', {
        title,
        connectedUsers: this.connectedUsers.size,
        excludedUsers: excludeUserIds.length
      });

      return true;
    } catch (error) {
      logger.error('Erreur lors du broadcast', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  private async sendUnreadNotifications(userId: string, socketId: string): Promise<void> {
    try {
      const notifications = await Notification.findUnread(userId, 50);
      const unreadCount = await this.getUnreadCount(userId);

      if (this.io) {
        this.io.to(socketId).emit('unread_notifications', {
          notifications: notifications.map(n => ({
            id: n._id.toString(),
            title: n.title,
            message: n.message,
            type: n.type,
            createdAt: n.createdAt,
            data: n.data,
            priority: n.priority
          })),
          count: unreadCount
        });
      }
    } catch (error) {
      logger.error('Erreur lors de l\'envoi des notifications non lues', {
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }

  private registerUserConnection(userId: string, socketId: string): void {
    // Ajouter à la map des utilisateurs connectés
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);

    // Ajouter à la map des sockets utilisateurs
    this.userSockets.set(socketId, userId);

    logger.debug('Connexion utilisateur enregistrée', {
      userId,
      socketId,
      totalConnections: this.connectedUsers.get(userId)!.size
    });
  }

  private unregisterUserConnection(socketId: string): void {
    const userId = this.userSockets.get(socketId);
    if (userId) {
      const userConnections = this.connectedUsers.get(userId);
      if (userConnections) {
        userConnections.delete(socketId);
        if (userConnections.size === 0) {
          this.connectedUsers.delete(userId);
        }
      }
      this.userSockets.delete(socketId);

      logger.debug('Connexion utilisateur supprimée', {
        userId,
        socketId,
        remainingConnections: userConnections?.size || 0
      });
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const notification = await Notification.findOne({ _id: notificationId, userId });
      if (!notification) {
        return false;
      }

      await notification.markAsRead();

      // Enregistrer dans l'historique
      await this.recordDeliveryHistory(notificationId, userId, NotificationStatus.READ);

      return true;
    } catch (error) {
      logger.error('Erreur lors du marquage comme lu', {
        notificationId,
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      await Notification.markAllAsRead(userId);
      return true;
    } catch (error) {
      logger.error('Erreur lors du marquage de toutes les notifications', {
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  async getNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      type?: NotificationType;
      isRead?: boolean;
    } = {}
  ): Promise<{
    notifications: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { userId };
    if (options.type) query.type = options.type;
    if (options.isRead !== undefined) query.isRead = options.isRead;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query)
    ]);

    return {
      notifications: notifications.map(n => ({
        id: n._id.toString(),
        title: n.title,
        message: n.message,
        type: n.type,
        data: n.data,
        priority: n.priority,
        isRead: n.isRead,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await Notification.getUnreadCount(userId);
    } catch (error) {
      logger.error('Erreur lors du comptage des notifications non lues', {
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return 0;
    }
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await Notification.deleteOne({ _id: notificationId, userId });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Erreur lors de la suppression de notification', {
        notificationId,
        userId,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return false;
    }
  }

  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const result = await Notification.cleanupExpired();
      logger.info('Notifications expirées nettoyées', { count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error('Erreur lors du nettoyage des notifications expirées', {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      return 0;
    }
  }

  private async recordDeliveryHistory(
    notificationId: string,
    userId: string,
    status: NotificationStatus
  ): Promise<void> {
    try {
      const history = new NotificationHistory({
        notificationId,
        userId,
        channel: NotificationChannel.IN_APP,
        status,
        attempts: 1,
        lastAttemptAt: new Date(),
        deliveredAt: status === NotificationStatus.DELIVERED ? new Date() : undefined,
        readAt: status === NotificationStatus.READ ? new Date() : undefined,
        metadata: {
          realTime: true,
          socketConnections: this.connectedUsers.get(userId)?.size || 0
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

  getConnectedUsers(): { userId: string; connections: number }[] {
    return Array.from(this.connectedUsers.entries()).map(([userId, connections]) => ({
      userId,
      connections: connections.size
    }));
  }

  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
  }

  async getProviderStatus(): Promise<NotificationProvider> {
    return {
      name: 'In-App Notifications',
      type: NotificationChannel.IN_APP,
      isEnabled: this.io !== null,
      config: {
        socketIOEnabled: this.io !== null,
        connectedUsers: this.connectedUsers.size,
        totalConnections: Array.from(this.connectedUsers.values()).reduce((sum, connections) => sum + connections.size, 0)
      }
    };
  }
}