// presenceWebSocket.ts
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PresenceStatus } from '../../users/types/presenceType';
import { createLogger } from '../logger/logger';
import { UserPresenceService } from '../../users/services/userPresence';
import config from '../../../config';

const logger = createLogger('PresenceWebSocket');

/**
 * Interface pour les données utilisateur extraites du token
 */
interface UserData {
  userId: string;
  email: string;
  role: string;
  sessionId?: string;
  deviceId?: string;
}

/**
 * Interface pour les informations de connexion socket
 */
interface SocketConnectionInfo {
  socketId: string;
  connectedAt: Date;
  lastPing: Date;
  deviceId?: string;
  userAgent?: string;
  ip: string;
}

/**
 * Interface pour les métriques de performance
 */
interface ConnectionMetrics {
  totalConnections: number;
  uniqueUsers: number;
  averageConnectionsPerUser: number;
  uptimeSeconds: number;
}

/**
 * Configuration pour les options du WebSocket
 */
interface WebSocketOptions {
  pingInterval?: number;
  pingTimeout?: number;
  maxConnections?: number;
  rateLimitPerMinute?: number;
}

/**
 * Gère les connexions WebSocket pour la présence en ligne avec des améliorations
 */
export class PresenceWebSocketHandler {
  private io: SocketIOServer;
  private presenceService: UserPresenceService;
  private connectedUsers: Map<string, Map<string, SocketConnectionInfo>> = new Map(); // userId -> Map<socketId, info>
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId
  private startTime: Date = new Date();
  
  // Rate limiting
  private userRateLimit: Map<string, { count: number; resetTime: number }> = new Map();
  
  // Options de configuration
  private options: Required<WebSocketOptions>;
  
  // Intervalle de nettoyage
  private cleanupInterval?: NodeJS.Timeout;
  private pingCheckInterval?: NodeJS.Timeout;

  /**
   * Crée une nouvelle instance du gestionnaire WebSocket
   */
  constructor(
    server: HttpServer, 
    presenceService?: UserPresenceService,
    options: WebSocketOptions = {}
  ) {
    // Configuration par défaut
    this.options = {
      pingInterval: options.pingInterval || 25000, // 25 secondes
      pingTimeout: options.pingTimeout || 30000,   // 30 secondes
      maxConnections: options.maxConnections || 10000,
      rateLimitPerMinute: options.rateLimitPerMinute || 100
    };

    // Configuration du serveur Socket.IO avec options avancées
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.cors?.origin || '*',
        methods: config.cors?.methods || ['GET', 'POST'],
        credentials: true
      },
      pingInterval: this.options.pingInterval,
      pingTimeout: this.options.pingTimeout,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: true,
      transports: ['websocket', 'polling'],
      upgradeTimeout: 30000,
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true
      }
    });
    
    this.presenceService = presenceService || new UserPresenceService();
    this.setupSocketHandlers();
    this.startMaintenanceTasks();
    
    logger.info('WebSocket server for presence tracking initialized', {
      maxConnections: this.options.maxConnections,
      pingInterval: this.options.pingInterval,
      rateLimitPerMinute: this.options.rateLimitPerMinute
    });
  }

  /**
   * Configure les gestionnaires d'événements pour les sockets
   */
  private setupSocketHandlers(): void {
    // Middleware d'authentification renforcé
    this.io.use(async (socket, next) => {
      try {
        // Vérification du rate limiting
        const clientIp = socket.handshake.address;
        if (this.isRateLimited(clientIp)) {
          logger.warn('Rate limit exceeded for WebSocket connection', { ip: clientIp });
          return next(new Error('Rate limit exceeded'));
        }

        // Vérification du nombre maximum de connexions
        if (this.io.engine.clientsCount >= this.options.maxConnections) {
          logger.warn('Maximum connections reached', { 
            current: this.io.engine.clientsCount,
            max: this.options.maxConnections
          });
          return next(new Error('Server at capacity'));
        }

        // Extraction et validation du token
        const token = this.extractToken(socket);
        if (!token) {
          logger.warn('WebSocket connection attempt without token', { 
            ip: clientIp,
            userAgent: socket.handshake.headers['user-agent']
          });
          return next(new Error('Authentication required'));
        }

        // Vérification du token JWT
        const userData = await this.verifyToken(token);
        if (!userData) {
          logger.warn('Invalid token provided for WebSocket connection', { ip: clientIp });
          return next(new Error('Invalid authentication'));
        }

        // Attacher les données utilisateur au socket
        socket.data.user = userData;
        socket.data.connectedAt = new Date();
        socket.data.ip = clientIp;
        
        next();
      } catch (error) {
        logger.error('WebSocket authentication error', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          socketId: socket.id,
          ip: socket.handshake.address
        });
        next(new Error('Authentication failed'));
      }
    });

    // Gestionnaire de connexion principal
    this.io.on('connection', (socket: Socket) => {
      this.handleSocketConnection(socket);
    });

    // Gestion des erreurs globales
    this.io.engine.on('connection_error', (err) => {
      logger.error('Socket.IO connection error', { error: err.message });
    });
  }

  /**
   * Extrait le token d'authentification des headers
   */
  private extractToken(socket: Socket): string | null {
    // Essayer différentes sources pour le token
    const authHeader = socket.handshake.headers.authorization;
    const authQuery = socket.handshake.auth.token;
    const authCookie = socket.handshake.headers.cookie;

    if (authQuery) return authQuery as string;
    if (authHeader?.startsWith('Bearer ')) return authHeader.split(' ')[1];
    if (authCookie) {
      const match = authCookie.match(/token=([^;]+)/);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Vérifie et décode le token JWT
   */
  private async verifyToken(token: string): Promise<UserData | null> {
    try {
      if (!config.auth?.jwtSecret) {
        logger.error('JWT secret not configured');
        return null;
      }

      const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
      
      if (!decoded?.userId || !decoded?.email) {
        logger.warn('Invalid token structure');
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user',
        sessionId: decoded.sessionId,
        deviceId: decoded.deviceId
      };
    } catch (error) {
      logger.warn('Token verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Vérifie si une IP est rate limitée
   */
  private isRateLimited(ip: string): boolean {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute

    const limitInfo = this.userRateLimit.get(ip);
    if (!limitInfo || limitInfo.resetTime < windowStart) {
      this.userRateLimit.set(ip, { count: 1, resetTime: now });
      return false;
    }

    if (limitInfo.count >= this.options.rateLimitPerMinute) {
      return true;
    }

    limitInfo.count++;
    return false;
  }

  /**
   * Gère une nouvelle connexion socket avec robustesse
   */
  private handleSocketConnection(socket: Socket): void {
    try {
      const userData = socket.data.user as UserData;
      const { userId } = userData;
      const connectionInfo: SocketConnectionInfo = {
        socketId: socket.id,
        connectedAt: socket.data.connectedAt,
        lastPing: new Date(),
        deviceId: userData.deviceId || socket.handshake.headers['x-device-id'] as string,
        userAgent: socket.handshake.headers['user-agent'] as string,
        ip: socket.data.ip
      };

      logger.info('User connected via WebSocket', { 
        userId, 
        socketId: socket.id,
        deviceId: connectionInfo.deviceId,
        totalConnections: this.io.engine.clientsCount
      });

      // Gérer les connexions multiples par utilisateur
      this.addUserConnection(userId, connectionInfo);
      
      // Mettre à jour la présence
      this.updateUserPresenceStatus(userId, socket, PresenceStatus.ONLINE);
      
      // Configuration des événements du socket
      this.setupSocketEvents(socket, userData);
      
      // Envoyer les données initiales
      this.sendInitialData(socket, userId);

    } catch (error) {
      logger.error('Error handling socket connection', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id
      });
      socket.disconnect(true);
    }
  }

  /**
   * Configure tous les événements d'un socket
   */
  private setupSocketEvents(socket: Socket, userData: UserData): void {
    const { userId } = userData;

    // Changement de statut
    socket.on('status:change', async (data: { status: PresenceStatus }) => {
      try {
        if (!Object.values(PresenceStatus).includes(data.status)) {
          socket.emit('error', { message: 'Invalid status' });
          return;
        }

        await this.updateUserPresenceStatus(userId, socket, data.status);
        logger.info('User changed status', { userId, newStatus: data.status });
        
        socket.emit('status:changed', { status: data.status, timestamp: new Date() });
      } catch (error) {
        logger.error('Error changing user status', { userId, error });
        socket.emit('error', { message: 'Failed to change status' });
      }
    });

    // Ping pour maintenir la connexion active
    socket.on('presence:ping', async () => {
      try {
        this.updateConnectionPing(userId, socket.id);
        await this.updateUserPresenceStatus(userId, socket, PresenceStatus.ONLINE);
        socket.emit('presence:pong', { timestamp: new Date() });
      } catch (error) {
        logger.error('Error handling ping', { userId, socketId: socket.id, error });
      }
    });

    // Demande de liste des utilisateurs en ligne
    socket.on('users:request', async () => {
      try {
        await this.sendOnlineUsersList(socket);
      } catch (error) {
        logger.error('Error sending users list', { userId, error });
      }
    });

    // Rejoindre/quitter des rooms spécifiques
    socket.on('room:join', (data: { roomId: string }) => {
      if (this.isValidRoomId(data.roomId)) {
        socket.join(data.roomId);
        logger.info('User joined room', { userId, roomId: data.roomId });
      }
    });

    socket.on('room:leave', (data: { roomId: string }) => {
      socket.leave(data.roomId);
      logger.info('User left room', { userId, roomId: data.roomId });
    });

    // Gestion de la déconnexion
    socket.on('disconnect', async (reason) => {
      await this.handleSocketDisconnection(socket, userData, reason);
    });

    // Gestion des erreurs
    socket.on('error', (error) => {
      logger.error('Socket error', { userId, socketId: socket.id, error });
    });

    // Rejoindre la room globale de présence
    socket.join('presence-updates');
  }

  /**
   * Valide un ID de room
   */
  private isValidRoomId(roomId: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(roomId) && roomId.length <= 50;
  }

  /**
   * Ajoute une connexion utilisateur
   */
  private addUserConnection(userId: string, connectionInfo: SocketConnectionInfo): void {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Map());
    }
    
    this.connectedUsers.get(userId)!.set(connectionInfo.socketId, connectionInfo);
    this.socketToUser.set(connectionInfo.socketId, userId);
  }

  /**
   * Met à jour le ping d'une connexion
   */
  private updateConnectionPing(userId: string, socketId: string): void {
    const userConnections = this.connectedUsers.get(userId);
    const connection = userConnections?.get(socketId);
    if (connection) {
      connection.lastPing = new Date();
    }
  }

  /**
   * Met à jour le statut de présence d'un utilisateur
   */
  private async updateUserPresenceStatus(
    userId: string, 
    socket: Socket, 
    status: PresenceStatus
  ): Promise<void> {
    try {
      const connectionInfo = this.connectedUsers.get(userId)?.get(socket.id);
      
      await this.presenceService.updatePresence(userId, status, {
        deviceId: connectionInfo?.deviceId,
        userAgent: connectionInfo?.userAgent,
        ip: connectionInfo?.ip || socket.handshake.address
      });

      // Diffuser le changement aux autres utilisateurs
      this.broadcastUserStatus(userId, status, socket.id);
    } catch (error) {
      logger.error('Error updating user presence', { userId, status, error });
    }
  }

  /**
   * Diffuse le changement de statut (exclut l'expéditeur)
   */
  private broadcastUserStatus(userId: string, status: PresenceStatus, excludeSocketId?: string): void {
    const eventData = { 
      userId, 
      status, 
      timestamp: new Date(),
      connectionCount: this.connectedUsers.get(userId)?.size || 0
    };

    if (excludeSocketId) {
      this.io.to('presence-updates').except(excludeSocketId).emit('user:status', eventData);
    } else {
      this.io.to('presence-updates').emit('user:status', eventData);
    }
  }

  /**
   * Envoie les données initiales à un socket
   */
  private async sendInitialData(socket: Socket, userId: string): Promise<void> {
    try {
      // Envoyer la liste des utilisateurs en ligne
      await this.sendOnlineUsersList(socket);
      
      // Envoyer les métriques de connexion
      socket.emit('connection:info', {
        connectedAt: new Date(),
        serverMetrics: this.getConnectionMetrics()
      });
    } catch (error) {
      logger.error('Error sending initial data', { userId, error });
    }
  }

  /**
   * Envoie la liste des utilisateurs en ligne
   */
  private async sendOnlineUsersList(socket: Socket): Promise<void> {
    try {
      const onlineUsers = await this.presenceService.getOnlineUsers();
      
      const usersList = Array.from(onlineUsers.values()).map(user => ({
        userId: user.userId,
        status: user.status,
        lastActive: user.lastActive,
        connectionCount: this.connectedUsers.get(user.userId)?.size || 0
      }));
      
      socket.emit('online:users', {
        users: usersList,
        totalCount: usersList.length,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error sending online users list', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id
      });
    }
  }

  /**
   * Gère la déconnexion d'un socket
   */
  private async handleSocketDisconnection(
    socket: Socket, 
    userData: UserData, 
    reason: string
  ): Promise<void> {
    const { userId } = userData;
    
    logger.info('User disconnected from WebSocket', { 
      userId, 
      socketId: socket.id, 
      reason,
      duration: Date.now() - socket.data.connectedAt?.getTime()
    });

    try {
      // Supprimer cette connexion
      const userConnections = this.connectedUsers.get(userId);
      if (userConnections) {
        userConnections.delete(socket.id);
        
        // Si c'était la dernière connexion, marquer comme hors ligne
        if (userConnections.size === 0) {
          this.connectedUsers.delete(userId);
          await this.presenceService.setUserOffline(userId);
          this.broadcastUserStatus(userId, PresenceStatus.OFFLINE);
        }
      }
      
      this.socketToUser.delete(socket.id);
    } catch (error) {
      logger.error('Error handling socket disconnection', { userId, socketId: socket.id, error });
    }
  }

  /**
   * Démarre les tâches de maintenance
   */
  private startMaintenanceTasks(): void {
    // Nettoyage périodique des connexions inactives
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConnections();
      this.cleanupRateLimit();
    }, 60000); // Toutes les minutes

    // Vérification des pings
    this.pingCheckInterval = setInterval(() => {
      this.checkStaleConnections();
    }, 30000); // Toutes les 30 secondes
  }

  /**
   * Nettoie les connexions inactives
   */
  private cleanupInactiveConnections(): void {
    const now = new Date();
    const timeout = this.options.pingTimeout;
    let cleanedCount = 0;

    for (const [userId, connections] of this.connectedUsers.entries()) {
      const socketsToRemove: string[] = [];
      
      for (const [socketId, connection] of connections.entries()) {
        if (now.getTime() - connection.lastPing.getTime() > timeout) {
          socketsToRemove.push(socketId);
        }
      }
      
      socketsToRemove.forEach(socketId => {
        connections.delete(socketId);
        this.socketToUser.delete(socketId);
        cleanedCount++;
      });
      
      if (connections.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up inactive connections', { count: cleanedCount });
    }
  }

  /**
   * Vérifie les connexions obsolètes
   */
  private checkStaleConnections(): void {
    const now = new Date();
    const staleThreshold = 60000; // 1 minute

    for (const [userId, connections] of this.connectedUsers.entries()) {
      for (const [socketId, connection] of connections.entries()) {
        if (now.getTime() - connection.lastPing.getTime() > staleThreshold) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('ping'); // Forcer un ping
          } else {
            // Socket n'existe plus, nettoyer
            connections.delete(socketId);
            this.socketToUser.delete(socketId);
          }
        }
      }
    }
  }

  /**
   * Nettoie les données de rate limiting
   */
  private cleanupRateLimit(): void {
    const now = Date.now();
    const windowStart = now - 60000;

    for (const [ip, limitInfo] of this.userRateLimit.entries()) {
      if (limitInfo.resetTime < windowStart) {
        this.userRateLimit.delete(ip);
      }
    }
  }

  /**
   * Obtient les métriques de connexion
   */
  public getConnectionMetrics(): ConnectionMetrics {
    const totalConnections = this.io.engine.clientsCount;
    const uniqueUsers = this.connectedUsers.size;
    const averageConnectionsPerUser = uniqueUsers > 0 ? totalConnections / uniqueUsers : 0;
    const uptimeSeconds = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

    return {
      totalConnections,
      uniqueUsers,
      averageConnectionsPerUser: Math.round(averageConnectionsPerUser * 100) / 100,
      uptimeSeconds
    };
  }

  /**
   * Force la déconnexion d'un utilisateur (API publique)
   */
  public async disconnectUser(userId: string, reason = 'forced_disconnect'): Promise<boolean> {
    try {
      const userConnections = this.connectedUsers.get(userId);
      
      if (!userConnections || userConnections.size === 0) {
        return false;
      }

      // Déconnecter tous les sockets de cet utilisateur
      const disconnectPromises = Array.from(userConnections.keys()).map(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('force:disconnect', { reason });
          socket.disconnect(true);
        }
      });

      await Promise.all(disconnectPromises);
      
      // Nettoyer les données
      this.connectedUsers.delete(userId);
      await this.presenceService.setUserOffline(userId);
      this.broadcastUserStatus(userId, PresenceStatus.OFFLINE);

      logger.info('User forcibly disconnected', { userId, reason });
      return true;
    } catch (error) {
      logger.error('Error force disconnecting user', { userId, error });
      return false;
    }
  }

  /**
   * Envoie une notification à un utilisateur spécifique
   */
  public sendToUser(userId: string, eventName: string, data: any): boolean {
    try {
      const userConnections = this.connectedUsers.get(userId);
      
      if (!userConnections || userConnections.size === 0) {
        return false;
      }

      let sentCount = 0;
      userConnections.forEach((_, socketId) => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(eventName, { ...data, timestamp: new Date() });
          sentCount++;
        }
      });

      logger.debug('Message sent to user', { userId, eventName, socketCount: sentCount });
      return sentCount > 0;
    } catch (error) {
      logger.error('Error sending message to user', { userId, eventName, error });
      return false;
    }
  }

  /**
   * Diffuse un message à tous les utilisateurs connectés
   */
  public broadcast(eventName: string, data: any, excludeUserId?: string): void {
    try {
      const eventData = { ...data, timestamp: new Date() };
      
      if (excludeUserId) {
        const excludeConnections = this.connectedUsers.get(excludeUserId);
        const excludeSocketIds = excludeConnections ? Array.from(excludeConnections.keys()) : [];
        
        this.io.except(excludeSocketIds).emit(eventName, eventData);
      } else {
        this.io.emit(eventName, eventData);
      }
    } catch (error) {
      logger.error('Error broadcasting message', { eventName, error });
    }
  }

  /**
   * Obtient les utilisateurs connectés
   */
  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  /**
   * Vérifie si un utilisateur est connecté
   */
  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
  }

  /**
   * Ferme proprement le serveur WebSocket
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket server');
    
    // Arrêter les tâches de maintenance
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.pingCheckInterval) {
      clearInterval(this.pingCheckInterval);
    }

    // Déconnecter tous les clients
    this.io.emit('server:shutdown', { message: 'Server is shutting down' });
    
    // Fermer le serveur
    await new Promise<void>((resolve) => {
      this.io.close(() => {
        logger.info('WebSocket server shut down successfully');
        resolve();
      });
    });
  }
}