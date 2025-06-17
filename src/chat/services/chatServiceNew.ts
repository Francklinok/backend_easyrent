
import { EventEmitter } from "stream";
import { Server } from "http";
import MessageQueue from "./messageQueue";
import { NotificationService } from "../../services/notificationServices";
import { appCacheAndPresenceService } from "../../services/appCacheAndPresence"; 
import { IMessage,
  IConversation,
  CreateConversationParams,
  GetUserConversationsParams,
  SendMessageParams,
  ReactToMessageParams,
  DeleteMessageParams,
  NotificationPayload,
  UserPermissions,
  ReactionAnalytics,
  SearchMessagesParams} from '../types/chatTypes';
import { GetMessagesParams } from '../types/chatTypes';
import { MediaFile } from '../types/chatTypes';
import  config from  '../../../config'
import ValidationService from "./validationService";
import { Types } from "mongoose";
import EncryptionService from "./encryptionService";
import Message from '../model/chatModel';
import sharp from 'sharp';
import { Server as IOServer } from 'socket.io';


class ChatService extends EventEmitter {
  private io: IOServer;
  private notificationService: NotificationService;
  private cacheService: typeof appCacheAndPresenceService;
  private messageQueue: MessageQueue;
  private validationService : ValidationService
  private encryptionService : EncryptionService

  constructor(io: Server) {
    super();
    this.io = io;
    this.notificationService = new NotificationService();
    this.cacheService = appCacheAndPresenceService; 
    this.messageQueue = new MessageQueue();
    this.validationService = new ValidationService()
    this.encryptionService = new  EncryptionService()
    
    // Configuration des événements d'erreur
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('ChatService Error:', error);
      // Ici vous pouvez ajouter une logique de monitoring
    });
  }
  /**
   * Crée ou récupère une conversation existante (version améliorée)
   */
  async createOrGetConversation({
    participantId,
    type = "direct",
    propertyId,
    userId
  }: CreateConversationParams): Promise<IConversation> {
    try {
      // Validation des entrées
      if (!userId || !participantId) {
        throw new Error('UserId et participantId sont requis');
      }

      if (userId === participantId) {
        throw new Error('Impossible de créer une conversation avec soi-même');
      }

      const cacheKey = `conversation:${userId}:${participantId}:${type}`;
     
      // Vérification du cache avec type safety
      let conversation = await this.cacheService.get<IConversation>(cacheKey);
     
      if (!conversation) {
        if (type === 'direct') {
          conversation = await Conversation.findOne({
            participants: { $all: [userId, participantId], $size: 2 },
            type: 'direct'
          }).populate('participants', 'name avatar email isOnline lastSeen') as IConversation;
        }
       
        if (!conversation) {
          const conversationData = {
            participants: type === 'direct' ? [userId, participantId] : [userId],
            type,
            propertyId,
            createdAt: new Date(),
            settings: {
              encryption: true,
              disappearingMessages: {
                enabled: false,
                duration: 30
              },
              smartReply: true,
              translation: true,
              voiceTranscription: true,
              readReceipts: true,
              typingIndicators: true
            },
            analytics: {
              messageCount: 0,
              averageResponseTime: 0,
              mostActiveHours: [],
              engagement: {
                reactionsCount: 0,
                mediaSharedCount: 0
              }
            }
          };
         
          const newConversation = new Conversation(conversationData);
          await newConversation.save();
          
          conversation = await newConversation.populate('participants', 'name avatar email isOnline lastSeen') as IConversation;
         
          // Émettre l'événement de création
          this.emit('conversationCreated', conversation);
          
          // Notifier les participants
          this.notifyParticipants(conversation, 'conversationCreated', {
            conversationId: conversation._id,
            createdBy: userId
          });
        }
       
        // Cache avec TTL approprié
        await this.cacheService.set(cacheKey, conversation,config.cacheTTL.conversation);
      }
     
      return conversation;
    } catch (error) {
      this.emit('error', { operation: 'createOrGetConversation', error, userId, participantId });
      throw error;
    }
  }
  /**
   * Récupère les conversations d'un utilisateur (version optimisée)
   */
  async getUserConversations({
    userId,
    page = 1,
    limit = 20,
    filter = 'all'
  }: GetUserConversationsParams): Promise<any[]> {
    try {
      // Validation et normalisation des paramètres
      const { page: validPage, limit: validLimit } = ValidationService.validatePagination(page, limit);
      
      const cacheKey = `user_conversations:${userId}:${validPage}:${validLimit}:${filter}`;
     
      // Vérification du cache
      let cachedResult = await this.cacheService.get<any[]>(cacheKey);
      if (cachedResult && Array.isArray(cachedResult)) {
        return cachedResult;
      }

      // Construction de la requête avec optimisations
      let query: any = { participants: userId };
      
      switch (filter) {
        case 'groups':
          query.type = 'group';
          break;
        case 'direct':
          query.type = 'direct';
          break;
        // case 'archived':
        //   query.isArchived = true;
        //   break;
        case 'unread':
          // Le filtrage des non-lus se fera après enrichissement
          break;
      }

      // Requête optimisée avec indexes
      const conversations = await Conversation.find(query)
        .populate('participants', 'name avatar email isOnline lastSeen')
        .populate('propertyId', 'title price images location')
        .sort({ updatedAt: -1 })
        .limit(validLimit)
        .skip((validPage - 1) * validLimit)
        .lean(); // Utilisation de lean() pour de meilleures performances

      // Enrichissement en parallèle avec gestion d'erreurs
      const enrichedConversations = await Promise.allSettled(
        conversations.map(async (conv:any) => {
          try {
            const conversationId = conv._id as Types.ObjectId;
            const [lastMessage, unreadCount, typingUsers] = await Promise.all([
              this.getLastMessage(conversationId),
              this.getUnreadCount(conversationId, userId),
              this.getTypingUsers(conversationId, userId)
            ]);

            return {
              ...conv,
              lastMessage,
              unreadCount,
              typingUsers,
              isOnline: this.getConversationOnlineStatus(conv.participants),
              encryptionStatus: conv.settings?.encryption ? 'enabled' : 'disabled'
            };
          } catch (error) {
            console.error(`Erreur enrichissement conversation ${conv._id}:`, error);
            return {
              ...conv,
              lastMessage: null,
              unreadCount: 0,
              typingUsers: [],
              isOnline: false,
              encryptionStatus: 'disabled',
              error: 'Enrichment failed'
            };
          }
        })
      );

      // Extraction des résultats réussis
      const validConversations = enrichedConversations
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      // Filtrage des conversations non lues
      const result = filter === 'unread'
        ? validConversations.filter(conv => conv.unreadCount > 0)
        : validConversations;

      // Cache avec TTL plus court pour les données dynamiques
      await this.cacheService.set(cacheKey, result, config.cacheTTL.userConversations);
      
      return result;
    } catch (error) {
      this.emit('error', { operation: 'getUserConversations', error, userId });
      throw error;
    }
  }

  /**
   * Envoie un message avec traitement avancé (version améliorée)
   */
  async sendMessage({
    conversationId,
    content,
    messageType = 'text',
    replyTo,
    scheduleFor,
    userId,
    file,
    priority = 'normal',
    mentions = []
  }: SendMessageParams): Promise<IMessage> {
    try {
      // Validation d'entrée renforcée
      ValidationService.validateMessageInput({
        conversationId,
        content,
        messageType,
        userId
      });

      // Vérification des permissions utilisateur
      await this.validateUserPermissions(conversationId, userId);

      let mediaData = null;
      let processedContent = content;

      // Traitement des médias en parallèle si nécessaire
      if (file) {
        mediaData = await this.processMediaFile(file);
      }

      // Traitement du contenu avec l'IA (asynchrone)
      const aiInsightsPromise = AIAnalysisService.analyzeMessage(content, messageType, userId);
      
      // Traitement des mentions
      const processedMentions = await this.processMentions(content, mentions, conversationId);

      // Récupération de la conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }

      // Chiffrement du contenu si activé
      if (conversation.settings?.encryption) {
        processedContent = await EncryptionService.encrypt(content);
      }

      // Attendre l'analyse IA
      const aiInsights = await aiInsightsPromise;

      const messageData = {
        conversationId: new Types.ObjectId(conversationId),
        senderId: new Types.ObjectId(userId),
        content: processedContent,
        messageType,
        mediaData,
        mentions: processedMentions,
        replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
        scheduledFor: scheduleFor ? new Date(scheduleFor) : undefined,
        isScheduled: !!scheduleFor,
        aiInsights: {
          priority: aiInsights.urgency as 'low' | 'normal' | 'high' | 'urgent',
          sentiment: aiInsights.sentiment,
          intentDetection: aiInsights.intent,
          autoSuggestions: aiInsights.suggestions || [],
          language: aiInsights.language,
          topics: aiInsights.topics,
          confidence: aiInsights.confidence
        },
        reactions: [],
        status: {
          sent: new Date(),
          delivered: [],
          read: []
        },
        isDeleted: false,
        deletedFor: [],
        canRestore: true,
        isEdited: false,
        editHistory: []
      };

      // Gestion des messages programmés
      if (scheduleFor) {
        return await this.scheduleMessage(messageData);
      }

      // Création et sauvegarde du message
      const message = new Message(messageData);
      await message.save();
      await this.populateMessage(message);

      // Traitement asynchrone dans la queue
      this.messageQueue.add(() => this.processMessageAsync(message, conversation));

      return message;
    } catch (error) {
      this.emit('error', { operation: 'sendMessage', error, conversationId, userId });
      throw error;
    }
  }

  // ... (autres méthodes similaires avec améliorations)

  /**
   * Validation des permissions utilisateur
   */
  private async validateUserPermissions(conversationId: string, userId: string): Promise<void> {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation non trouvée');
    }

    if (!conversation.participants.some((p:any) => p.toString() === userId)) {
      throw new Error('Utilisateur non autorisé dans cette conversation');
    }

    // Vérifications supplémentaires (utilisateur banni, conversation archivée, etc.)
    if (conversation.isArchived && !await this.userCanWriteToArchivedConversation(userId, conversationId)) {
      throw new Error('Impossible d\'écrire dans une conversation archivée');
    }
  }

  private async userCanWriteToArchivedConversation(userId: string, conversationId: string): Promise<boolean> {
    // Logique pour déterminer si un utilisateur peut écrire dans une conversation archivée
    //  vérifier les rôles d'admin
    return false;
  }

  /**
   * Notification optimisée des participants
   */
  private notifyParticipants(conversation: IConversation, event: string, data: any): void {
    conversation.participants.forEach(participantId => {
      this.io.to(participantId.toString()).emit(event, {
        ...data,
        timestamp: new Date()
      });
    });
  }

  // ... (toutes les autres méthodes privées restent similaires mais avec les améliorations de validation et de gestion d'erreurs)

  // Méthodes utilitaires inchangées mais optimisées
  private async processMediaFile(file: MediaFile): Promise<any> {
    try {
      const mediaData = {
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date()
      };

      if (file.mimetype.startsWith('image/')) {
        const imagePath = file.path;
        const metadata = await sharp(imagePath).metadata();
        
        (mediaData as any).dimensions = { 
          width: metadata.width, 
          height: metadata.height 
        };

        // Création des variantes en parallèle
        const variantPromises = Object.entries(config.imageVariants).map(async ([size, config]) => {
          const variantPath = `uploads/${size}_${file.filename}`;

          await sharp(imagePath)
            .resize(config.width, config.height, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: config.quality })
            .toFile(variantPath);
          
          return { size, path: variantPath };
        });

        (mediaData as any).variants = await Promise.all(variantPromises);
      }

      return mediaData;
    } catch (error) {
      console.error('Erreur traitement média:', error);
      throw new Error('Échec du traitement du fichier média');
    }
  }

  /**
   * Traitement des mentions dans le message
   */
  private async processMentions(content: string, mentions: string[], conversationId: string): Promise<Array<{ userId: string; username: string; position: number }>> {
    const processedMentions: Array<{ userId: string; username: string; position: number }> = [];
    
    // Regex pour détecter les mentions @username
    const mentionRegex = /@(\w+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1];
      const position = match.index;
      
      // Vérifier si l'utilisateur mentionné fait partie de la conversation
      const conversation = await Conversation.findById(conversationId).populate('participants', 'username');
      const mentionedUser = conversation?.participants.find((p: any) => p.username === username);
      
      if (mentionedUser) {
        processedMentions.push({
          userId: mentionedUser._id.toString(),
          username: username,
          position: position
        });
      }
    }

    return processedMentions;
  }

  /**
   * Planification d'un message pour envoi différé
   */
  private async scheduleMessage(messageData: any): Promise<IMessage> {
    const message = new Message({
      ...messageData,
      isScheduled: true,
      status: {
        scheduled: new Date(),
        delivered: [],
        read: []
      }
    });

    await message.save();
    
    // Ici vous pourriez utiliser un système de jobs (Bull, Agenda, etc.)
    // Pour cet exemple, on utilise setTimeout (non recommandé en production)
    const delay = new Date(messageData.scheduledFor).getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(async () => {
        try {
          await this.executeScheduledMessage(message._id as Types.ObjectId);
        } catch (error) {
          console.error('Erreur exécution message programmé:', error);
        }
      }, delay);
    }

    return message;
  }

  /**
   * Exécution d'un message programmé
   */
  private async executeScheduledMessage(messageId: Types.ObjectId): Promise<void> {
    const message = await Message.findById(messageId).populate('conversationId');
    if (!message || !message.isScheduled) return;

    message.isScheduled = false;
    message.status.sent = new Date();
    await message.save();

    // Traitement normal du message
    await this.processMessageAsync(message, message.conversationId as any);
  }

  
  /**
   * Traitement asynchrone du message après envoi
   */
  private async processMessageAsync(message: IMessage, conversation: IConversation): Promise<void> {
    try {
      // Mise à jour de la conversation
      await this.updateConversationAfterMessage(conversation._id, message);

      // Envoi des notifications
      await this.sendMessageNotifications(message, conversation);

      // Mise à jour du cache
      await this.invalidateRelatedCaches(conversation._id.toString(), message.senderId.toString());

      // Émission des événements WebSocket
      this.emitMessageEvents(message, conversation);

      // Analytics et métriques
      await this.updateMessageAnalytics(message, conversation);

    } catch (error) {
      console.error('Erreur traitement asynchrone message:', error);
      this.emit('error', { operation: 'processMessageAsync', error, messageId: message._id });
    }
  }

  /**
   * Mise à jour de la conversation après envoi d'un message
   */
  private async updateConversationAfterMessage(conversationId: Types.ObjectId, message: IMessage): Promise<void> {
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
      $inc: { 'analytics.messageCount': 1 }
    });
  }

  /**
   * Envoi des notifications pour un nouveau message
   */
  private async sendMessageNotifications(message: IMessage, conversation: IConversation): Promise<void> {
  const participants = conversation.participants.filter(
    (p) => p._id.toString() !== message.senderId.toString()
  );

  for (const participant of participants) {
    try {
      const notificationPayload: NotificationPayload = {
        userId: participant._id.toString(),
        type: 'push',
        priority: 'normal', 
        push: {
          notification: {
            title: `Nouveau message de ${message.senderId}`,
            body: typeof message.content === 'string'
              ? message.content.substring(0, 100)
              : `${message.content} partagé`,
            data: {
              conversationId: conversation._id.toString(),
              messageId:(message._id as Types.ObjectId).toString(),
              senderId: message.senderId.toString(),
              targetUserId: participant._id.toString()
            },
          },
          // Tu peux ajouter ici fcmTokens et webpushSubscriptions si nécessaire
        },
      };

      await this.notificationService.sendNotification(notificationPayload);
    } catch (error) {
      console.error(`Erreur notification participant ${participant._id}:`, error);
    }
  }
}
  /**
   * Invalidation des caches liés
   */
  private async invalidateRelatedCaches(conversationId: string, userId: string): Promise<void> {
    const cacheKeys = [
      `conversation:${conversationId}`,
      `user_conversations:${userId}:*`,
      `messages:${conversationId}:*`,
      `unread_count:${conversationId}:*`
    ];

    await Promise.all(
      cacheKeys.map(key => this.cacheService.delete(key))
    );
  }
  /**
   * Émission des événements WebSocket
   */
  private emitMessageEvents(message: IMessage, conversation: IConversation): void {
    // Événement pour la conversation
    this.io.to(conversation._id.toString()).emit('newMessage', {
      message,
      conversationId: conversation._id,
      timestamp: new Date()
    });

    // Événement pour chaque participant
    conversation.participants.forEach(participant => {
      if (participant._id.toString() !== message.senderId.toString()) {
        this.io.to(participant._id.toString()).emit('messageReceived', {
          message,
          conversationId: conversation._id,
          from: message.senderId
        });
      }
    });
  }
  /**
   * Mise à jour des analytics du message
   */
  private async updateMessageAnalytics(message: IMessage, conversation: IConversation): Promise<void> {
    try {
      const analytics = {
        messageId: message._id,
        conversationId: conversation._id,
        senderId: message.senderId,
        messageType: message.content,
        timestamp: new Date(),
        aiInsights: message.aiInsights,
        engagementScore: this.calculateEngagementScore(message),
        responseTime: await this.calculateResponseTime(conversation._id, message.senderId)
      };

      // Ici vous pourriez envoyer à un service d'analytics
      this.emit('messageAnalytics', analytics);
    } catch (error) {
      console.error('Erreur analytics message:', error);
    }
  }
  /**
   * Calcul du score d'engagement
   */
  private calculateEngagementScore(message: IMessage): number {
    let score = 1; // Score de base

    // Facteurs d'engagement
    if (message.mentions && message.mentions.length > 0) score += 0.5;
    if (message.mediaData) score += 0.3;
    if (message.replyTo) score += 0.2;
    if (
        message.aiInsights?.sentiment?.score !== undefined &&
        message.aiInsights.sentiment.score > 0.5
        ) {
        score += 0.3;
        }



    return Math.min(5, score); // Score maximum de 5
  }

  /**
   * Calcul du temps de réponse
   */
  private async calculateResponseTime(conversationId: Types.ObjectId, senderId: Types.ObjectId): Promise<number | null> {
    try {
      const lastMessage = await Message.findOne({
        conversationId,
        senderId: { $ne: senderId }
      }).sort({ createdAt: -1 });

      if (lastMessage) {
        return Date.now() - lastMessage.createdAt.getTime();
      }
      return null;
    } catch (error) {
      console.error('Erreur calcul temps de réponse:', error);
      return null;
    }
  }

  /**
   * Récupération des messages avec pagination et filtres avancés
   */
  async getMessages({
    conversationId,
    page = 1,
    limit = 20,
    messageType,
    dateRange,
    searchQuery,
    userId
  }: GetMessagesParams): Promise<{ messages: IMessage[]; pagination: any; analytics: any }> {
    try {
      // Validation des permissions
      await this.validateUserPermissions(conversationId, userId);

      const { page: validPage, limit: validLimit } = ValidationService.validatePagination(page, limit);

      // Construction de la requête
      let query: any = { 
        conversationId: new Types.ObjectId(conversationId),
        isDeleted: false
      };

      if (messageType) query.messageType = messageType;
     if (dateRange) {
        query.createdAt = {};
        if (dateRange.start) query.createdAt.$gte = new Date(dateRange.start);
        if (dateRange.end) query.createdAt.$lte = new Date(dateRange.end);
        }


      // Recherche textuelle
      if (searchQuery) {
        query.$text = { $search: searchQuery };
      }

      // Récupération des messages
      const messages = await Message.find(query)
        .populate('senderId', 'name avatar')
        .populate('replyTo')
        .sort({ createdAt: -1 })
        .limit(validLimit)
        .skip((validPage - 1) * validLimit);

      // Déchiffrement si nécessaire
      const decryptedMessages = await Promise.all(
        messages.map(async (msg) => {
          if (msg.content.includes(':')) {
            try {
              msg.content = await EncryptionService.decrypt(msg.content);
            } catch (error) {
              console.error('Erreur déchiffrement message:', error);
            }
          }
          return msg;
        })
      );

      // Analytics des messages
      const analytics = await this.generateMessageAnalytics(conversationId, query);

      // Métadonnées de pagination
      const totalMessages = await Message.countDocuments(query);
      const pagination = {
        currentPage: validPage,
        totalPages: Math.ceil(totalMessages / validLimit),
        totalMessages,
        hasNext: validPage * validLimit < totalMessages,
        hasPrev: validPage > 1
      };

      return {
        messages: decryptedMessages,
        pagination,
        analytics
      };

    } catch (error) {
      this.emit('error', { operation: 'getMessages', error, conversationId });
      throw error;
    }
  }

  /**
   * Génération d'analytics pour les messages
   */
  private async generateMessageAnalytics(conversationId: string, query: any): Promise<any> {
    try {
      const [
        messageTypeDistribution,
        sentimentAnalysis,
        activityPattern,
        topSenders
      ] = await Promise.all([
        this.getMessageTypeDistribution(conversationId),
        this.getSentimentAnalysis(conversationId),
        this.getActivityPattern(conversationId),
        this.getTopSenders(conversationId)
      ]);

      return {
        messageTypeDistribution,
        sentimentAnalysis,
        activityPattern,
        topSenders,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Erreur génération analytics:', error);
      return {};
    }
  }

  /**
   * Distribution des types de messages
   */
  private async getMessageTypeDistribution(conversationId: string): Promise<any> {
    return await Message.aggregate([
      { $match: { conversationId: new Types.ObjectId(conversationId), isDeleted: false } },
      { $group: { _id: '$messageType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * Analyse de sentiment
   */
  private async getSentimentAnalysis(conversationId: string): Promise<any> {
    return await Message.aggregate([
      { $match: { conversationId: new Types.ObjectId(conversationId), isDeleted: false } },
      { $group: {
        _id: '$aiInsights.sentiment.label',
        count: { $sum: 1 },
        avgScore: { $avg: '$aiInsights.sentiment.score' }
      }},
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * Modèle d'activité
   */
  private async getActivityPattern(conversationId: string): Promise<any> {
    return await Message.aggregate([
      { $match: { conversationId: new Types.ObjectId(conversationId), isDeleted: false } },
      { $group: {
        _id: { 
          hour: { $hour: '$createdAt' },
          dayOfWeek: { $dayOfWeek: '$createdAt' }
        },
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * Top expéditeurs
   */
  private async getTopSenders(conversationId: string): Promise<any> {
    return await Message.aggregate([
      { $match: { conversationId: new Types.ObjectId(conversationId), isDeleted: false } },
      { $group: { _id: '$senderId', count: { $sum: 1 } } },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'sender'
      }},
      { $unwind: '$sender' },
      { $project: {
        senderId: '$_id',
        senderName: '$sender.name',
        messageCount: '$count'
      }},
      { $sort: { messageCount: -1 } },
      { $limit: 10 }
    ]);
  }

  /**
   * Réaction à un message
   */
  async reactToMessage({
    messageId,
    userId,
    reactionType,
    conversationId
  }: ReactToMessageParams): Promise<IMessage> {
    try {
      // Validation des permissions
      await this.validateUserPermissions(conversationId, userId);

      const message = await Message.findById(messageId);
      if (!message) {
        throw new Error('Message non trouvé');
      }

      // Vérifier si l'utilisateur a déjà réagi
      const existingReactionIndex = message.reactions.findIndex(
        (reaction: any) => reaction.userId.toString() === userId && reaction.type === reactionType
      );

      if (existingReactionIndex > -1) {
        // Supprimer la réaction existante
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        // Ajouter la nouvelle réaction
        message.reactions.push({
          userId: new Types.ObjectId(userId),
          type: reactionType,
          createdAt: new Date()
        });
      }

      await message.save();

      // Notification de réaction
      if (message.senderId.toString() !== userId) {
        const notificationPayload: NotificationPayload = {
          userId: message.senderId.toString(),
          type: 'reaction',
          title: 'Nouvelle réaction',
          body: `Quelqu'un a réagi ${reactionType} à votre message`,
          data: {
            conversationId,
            messageId: messageId,
            reactionType,
            reactorId: userId
          }
        };

        await this.notificationService.sendNotification(notificationPayload);
      }

      // Émission de l'événement
      this.io.to(conversationId).emit('messageReaction', {
        messageId,
        userId,
        reactionType,
        reactions: message.reactions
      });

      return message;
    } catch (error) {
      this.emit('error', { operation: 'reactToMessage', error, messageId, userId });
      throw error;
    }
  }

  /**
   * Suppression d'un message
   */
  async deleteMessage({
    messageId,
    userId,
    deleteType = 'soft',
    conversationId
  }: DeleteMessageParams): Promise<boolean> {
    try {
      // Validation des permissions
      await this.validateUserPermissions(conversationId, userId);

      const message = await Message.findById(messageId);
      if (!message) {
        throw new Error('Message non trouvé');
      }

      // Vérifier si l'utilisateur peut supprimer ce message
      if (message.senderId.toString() !== userId) {
        throw new Error('Pas autorisé à supprimer ce message');
      }

      if (deleteType === 'soft') {
        // Suppression douce - marquer comme supprimé
        message.isDeleted = true;
        message.deletedAt = new Date();
        message.deletedBy = new Types.ObjectId(userId);
        await message.save();
      } else {
        // Suppression définitive
        await Message.findByIdAndDelete(messageId);
      }

      // Invalidation du cache
      await this.invalidateRelatedCaches(conversationId, userId);

      // Émission de l'événement
      this.io.to(conversationId).emit('messageDeleted', {
        messageId,
        deletedBy: userId,
        deleteType
      });

      return true;
    } catch (error) {
      this.emit('error', { operation: 'deleteMessage', error, messageId, userId });
      throw error;
    }
  }

  /**
   * Recherche de messages avec indexation full-text
   */
  async searchMessages({
    userId,
    query,
    conversationId,
    messageType,
    dateRange,
    limit = 10
  }: SearchMessagesParams): Promise<IMessage[]> {
    try {
      let searchQuery: any = {
        isDeleted: false,
        $text: { $search: query }
      };

      // Filtrer par conversation si spécifié
      if (conversationId) {
        await this.validateUserPermissions(conversationId, userId);
        searchQuery.conversationId = new Types.ObjectId(conversationId);
      } else {
        // Rechercher seulement dans les conversations de l'utilisateur
        const userConversations = await Conversation.find({ 
          participants: userId 
        }).select('_id');
        
        searchQuery.conversationId = { 
          $in: userConversations.map(c => c._id) 
        };
      }

      if (messageType) searchQuery.messageType = messageType;
      
      if (dateRange) {
        searchQuery.createdAt = {};
        if (dateRange.start) searchQuery.createdAt.$gte = new Date(dateRange.start);
        if (dateRange.end) searchQuery.createdAt.$lte = new Date(dateRange.end);
      }

      const messages = await Message.find(searchQuery)
        .populate('senderId', 'name avatar')
        .populate('conversationId', 'participants type')
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit);

      // Déchiffrement si nécessaire
      const decryptedMessages = await Promise.all(
        messages.map(async (msg) => {
          if (msg.content.includes(':')) {
            try {
              msg.content = await EncryptionService.decrypt(msg.content);
            } catch (error) {
              console.error('Erreur déchiffrement message recherche:', error);
            }
          }
          return msg;
        })
      );

      return decryptedMessages;
    } catch (error) {
      this.emit('error', { operation: 'searchMessages', error, userId });
      throw error;
    }
  }

  /**
   * Marquage des messages comme lus
   */
  async markMessagesAsRead(conversationId: string, userId: string, messageIds?: string[]): Promise<void> {
    try {
      // Validation des permissions
      await this.validateUserPermissions(conversationId, userId);

      let query: any = {
        conversationId: new Types.ObjectId(conversationId),
        senderId: { $ne: new Types.ObjectId(userId) },
        'status.read': { $not: { $elemMatch: { userId: new Types.ObjectId(userId) } } }
      };

      if (messageIds && messageIds.length > 0) {
        query._id = { $in: messageIds.map(id => new Types.ObjectId(id)) };
      }

      await Message.updateMany(query, {
        $push: {
          'status.read': {
            userId: new Types.ObjectId(userId),
            readAt: new Date()
          }
        }
      });

      // Invalidation du cache des messages non lus
      await this.cacheService.delete(`unread_count:${conversationId}:${userId}`);

      // Émission de l'événement
      this.io.to(conversationId).emit('messagesRead', {
        userId,
        conversationId,
        readAt: new Date()
      });

    } catch (error) {
      this.emit('error', { operation: 'markMessagesAsRead', error, conversationId, userId });
      throw error;
    }
  }

  /**
   * Gestion des indicateurs de frappe
   */
  async setTypingStatus(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    try {
      const cacheKey = `typing:${conversationId}`;
      let typingUsers = await this.cacheService.get<string[]>(cacheKey) || [];

      if (isTyping) {
        if (!typingUsers.includes(userId)) {
          typingUsers.push(userId);
        }
        
        // Auto-suppression après timeout
        setTimeout(async () => {
          await this.setTypingStatus(conversationId, userId, false);
        },config.typingTimeout);
      } else {
        typingUsers = typingUsers.filter(id => id !== userId);
      }

      await this.cacheService.set(cacheKey, typingUsers, 30); // 30 secondes TTL

      // Émission aux autres participants
      this.io.to(conversationId).emit('typingStatus', {
        conversationId,
        userId,
        isTyping,
        typingUsers: typingUsers.filter(id => id !== userId) // Exclure l'utilisateur actuel
      });

    } catch (error) {
      console.error('Erreur gestion typing status:', error);
    }
  }

  // Méthodes utilitaires privées

  private async getLastMessage(conversationId: Types.ObjectId): Promise<IMessage | null> {
    return await Message.findOne({ 
      conversationId, 
      isDeleted: false 
    })
    .populate('senderId', 'name avatar')
    .sort({ createdAt: -1 });
  }

  private async getUnreadCount(conversationId: Types.ObjectId, userId: string): Promise<number> {
    const cacheKey = `unread_count:${conversationId}:${userId}`;
    let count = await this.cacheService.get<number>(cacheKey);
    
    if (count === null) {
      count = await Message.countDocuments({
        conversationId,
        senderId: { $ne: new Types.ObjectId(userId) },
        'status.read': { $not: { $elemMatch: { userId: new Types.ObjectId(userId) } } },
        isDeleted: false
      });
      
      await this.cacheService.set(cacheKey, count, 300); // 5 minutes TTL
    }
    
    return count;
  }

  private async getTypingUsers(conversationId: Types.ObjectId, userId: string): Promise<string[]> {
    const cacheKey = `typing:${conversationId}`;
    const typingUsers = await this.cacheService.get<string[]>(cacheKey) || [];
    return typingUsers.filter(id => id !== userId);
  }

  private getConversationOnlineStatus(participants: any[]): boolean {
    return participants.some((p: any) => p.isOnline);
  }

  private async populateMessage(message: IMessage): Promise<void> {
    await message.populate([
      { path: 'senderId', select: 'name avatar email' },
      { path: 'replyTo', populate: { path: 'senderId', select: 'name avatar' } },
      { path: 'mentions.userId', select: 'name username avatar' }
    ]);
  }
}

export default ChatService;