// presenceWebSocket.ts
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { UserPresence, PresenceStatus } from '../../users/types/presenceType';
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
}

/**
 * Gère les connexions WebSocket pour la présence en ligne
 */
export class PresenceWebSocketHandler {
  private io: SocketIOServer;
  private presenceService: UserPresenceService;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  /**
   * Crée une nouvelle instance du gestionnaire WebSocket
   * @param server - Serveur HTTP Express
   * @param presenceService - Service de présence utilisateur
   */
  constructor(server: HttpServer, presenceService?: UserPresenceService) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.cors.origin|| '*',
        methods: config.cors.methods
      }
    });
    
    this.presenceService = presenceService || new UserPresenceService();
    this.setupSocketHandlers();
    
    logger.info('WebSocket server for presence tracking initialized');
  }

  /**
   * Configure les gestionnaires d'événements pour les sockets
   */
  private setupSocketHandlers(): void {
    // Middleware d'authentification pour les connexions WebSocket
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          logger.warn('WebSocket connection attempt without token');
          return next(new Error('Authentication error'));
        }
        
        // Vérifier le token
        const userData = jwt.verify(token, config.auth.jwtSecret) as UserData;
        
        if (!userData || !userData.userId) {
          logger.warn('Invalid token provided for WebSocket connection');
          return next(new Error('Authentication error'));
        }
        
        // Attacher les données utilisateur au socket
        socket.data.user = userData;
        next();
      } catch (error) {
        logger.error('WebSocket authentication error', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          socketId: socket.id
        });
        next(new Error('Authentication error'));
      }
    });

    // Gestionnaire de connexion
    this.io.on('connection', (socket: Socket) => {
      const userData = socket.data.user as UserData;
      
      if (!userData) {
        logger.warn('Socket connected without user data', { socketId: socket.id });
        socket.disconnect();
        return;
      }
      
      this.handleSocketConnection(socket, userData);
    });
  }

  /**
   * Gère une nouvelle connexion socket
   * @param socket - Socket connecté
   * @param userData - Données de l'utilisateur
   */
  private handleSocketConnection(socket: Socket, userData: UserData): void {
    const { userId } = userData;
    
    logger.info('User connected via WebSocket', { userId, socketId: socket.id });
    
    // Ajouter le socketId à la liste des sockets connectés pour cet utilisateur
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socket.id);
    
    // Mettre à jour le statut de présence
    this.updateUserPresence(userId, socket);
    
    // Rejoindre la room pour les mises à jour de présence
    socket.join('presence-updates');
    
    // Informer les autres utilisateurs concernés
    this.broadcastUserStatus(userId, PresenceStatus.ONLINE);
    
    // Événement de changement manuel de statut
    socket.on('status:change', async (newStatus: PresenceStatus) => {
      if (Object.values(PresenceStatus).includes(newStatus)) {
        await this.presenceService.updatePresence(userId, newStatus, {
          deviceId: socket.handshake.headers['x-device-id'] as string || undefined,
          userAgent: socket.handshake.headers['user-agent'] as string || undefined,
          ip: socket.handshake.address
        });
        
        this.broadcastUserStatus(userId, newStatus);
        logger.info('User changed status', { userId, newStatus });
      }
    });
    
    // Événement de ping pour garder actif
    socket.on('presence:ping', async () => {
      await this.updateUserPresence(userId, socket);
    });
    
    // Événement de déconnexion
    socket.on('disconnect', async () => {
      logger.info('User disconnected from WebSocket', { userId, socketId: socket.id });
      
      // Supprimer ce socketId de la liste
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        
        // Si c'était le dernier socket pour cet utilisateur, le marquer comme hors ligne
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
          await this.presenceService.setUserOffline(userId);
          this.broadcastUserStatus(userId, PresenceStatus.OFFLINE);
        }
      }
    });
    
    // Envoyer la liste initiale des utilisateurs en ligne à ce client
    this.sendOnlineUsersList(socket);
  }

  /**
   * Met à jour la présence d'un utilisateur
   * @param userId - ID de l'utilisateur
   * @param socket - Socket de l'utilisateur
   */
  private async updateUserPresence(userId: string, socket: Socket): Promise<void> {
    await this.presenceService.updatePresence(userId, PresenceStatus.ONLINE, {
      deviceId: socket.handshake.headers['x-device-id'] as string || undefined,
      userAgent: socket.handshake.headers['user-agent'] as string || undefined,
      ip: socket.handshake.address
    });
  }

  /**
   * Diffuse le changement de statut d'un utilisateur
   * @param userId - ID de l'utilisateur
   * @param status - Nouveau statut
   */
  private broadcastUserStatus(userId: string, status: PresenceStatus): void {
    this.io.to('presence-updates').emit('user:status', { userId, status });
  }

  /**
   * Envoie la liste des utilisateurs en ligne à un socket spécifique
   * @param socket - Socket destinataire
   */
  private async sendOnlineUsersList(socket: Socket): Promise<void> {
    try {
      const onlineUsers = await this.presenceService.getOnlineUsers();
      
      // Convertir la Map en tableau pour faciliter l'envoi
      const usersList = Array.from(onlineUsers.values()).map(user => ({
        userId: user.userId,
        status: user.status,
        lastActive: user.lastActive
      }));
      
      socket.emit('online:users', usersList);
    } catch (error) {
      logger.error('Error sending online users list', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id
      });
    }
  }

  /**
   * Force la déconnexion d'un utilisateur
   * @param userId - ID de l'utilisateur
   */
  public disconnectUser(userId: string): void {
    const userSockets = this.connectedUsers.get(userId);
    
    if (userSockets) {
      // Déconnecter tous les sockets de cet utilisateur
      userSockets.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      });
      
      this.connectedUsers.delete(userId);
    }
  }

  /**
   * Envoie une notification à un utilisateur spécifique
   * @param userId - ID de l'utilisateur
   * @param eventName - Nom de l'événement
   * @param data - Données à envoyer
   */
  public sendToUser(userId: string, eventName: string, data: any): void {
    const userSockets = this.connectedUsers.get(userId);
    
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io.to(socketId).emit(eventName, data);
      });
    }
  }
}
