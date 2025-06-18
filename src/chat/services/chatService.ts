
import { EventEmitter } from "stream";
import { Server } from "http";
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
import { createLogger } from "../../utils/logger/logger";
import { Queue } from "bullmq";
const  logger = createLogger('chatService')
import { redisForBullMQ} from "../../lib/redisClient";

class ChatService extends EventEmitter {
  private io: IOServer;
  private notificationService: NotificationService;
  private cacheService: typeof appCacheAndPresenceService;
  private messageQueue:Queue;
  // private  messageDeliveryQueue:Queue;

  constructor(io: IOServer) {
    super();
    this.io = io;
    this.notificationService = new NotificationService();
    this.cacheService = appCacheAndPresenceService;
    this.messageQueue = new Queue('message-delivery', {
      connection:redisForBullMQ
    })
    // this.messageDeliveryQueue = new Queue('message-delivery', {
    //   connection: redisForBullMQ
    // });
    // Configuration des événements d'erreur
    this.setupErrorHandling();
  }
 
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      logger.error('ChatService Error:', error);
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
      logger.info('chat succefull created')
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
      await this.messageQueue.add('processMessage', {
        messageId: (message as {_id: Types.ObjectId})._id.toString(),
        conversationId: conversation._id.toString(),
        priority: aiInsights.urgency // utile si tu veux utiliser les "priorités" BullMQ
      });
      // if (scheduleFor) {
      //   return await this.messageDeliveryQueue.add('deliverScheduledMessage', {
      //     messageData
      //   }, {
      //     delay: new Date(scheduleFor).getTime() - Date.now()
      //   });
      // }


    //  await  this.messageQueue.add(() => this.processMessageAsync(message, conversation));
      // Après avoir sauvegardé et peuplé le message
      await this.emitMessageEvents(message, conversation);
      await this.indexMessageForSearch(message);


      return message;
    } catch (error) {
      this.emit('error', { operation: 'sendMessage', error, conversationId, userId });
      throw error;
    }
  }
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
    const  conversation = await Conversation.findById(conversationId)
    if(!conversation) return false
    if(!conversation.isArchived) return true;
    const isAdmin  =  Conversation.admins?.includes(userId)
    if(isAdmin) return  true
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
    
    // un système de jobs (bull)
    const delay = new Date(messageData.scheduledFor).getTime() - Date.now();
    
    if (delay > 0) {
      await this.messageQueue.add(
        'deliverScheduledMessage',
          {
        messageId: (message as  {_id:Types.ObjectId})._id.toString()
      },
      { delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
      )
      // setTimeout(async () => {
      //   try {
      //     await this.executeScheduledMessage(message._id as Types.ObjectId);
      //   } catch (error) {
      //     console.error('Erreur exécution message programmé:', error);
      //   }
      // }, delay)
    }

    return message;
  }

  /**
   * Exécution d'un message programmé
   */
  public async executeScheduledMessage(messageId: Types.ObjectId): Promise<void> {
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
          emoji: reactionType,
          timestamp: new Date()
        });
      }
       const conversation = await Conversation.findById(conversationId);
        if (!conversation) throw new Error('Conversation non trouvée');


      await message.save();

      // Notification de réaction
      if (message.senderId.toString() !== userId) {
      const notificationPayload: NotificationPayload = {
          userId: message.senderId.toString(),
          type: 'push',
          push: {
            notification: {
              title: 'Nouvelle réaction',
              body: `Quelqu'un a réagi ${reactionType} à votre message`,
              data: {
                conversationId,
                messageId,
                reactionType,
                reactorId: userId
              }
            },
            fcmTokens: undefined, // optionnel
            webpushSubscriptions: undefined // optionnel
          },
          priority: 'normal'
        };
        await this.notificationService.sendNotification(notificationPayload);
      }

      // Émission de l'événement
      // this.io.to(conversationId).emit('messageReaction', {
      //   messageId,
      //   userId,
      //   reactionType,
      //   reactions: message.reactions
      // });
      this.emitReactionToParticipants(messageId, message.reactions, conversation);

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

      const hasPermission = await this.userHasDeletePermission(userId,  new Types.ObjectId(conversationId));
      if (!hasPermission) {
        throw new Error('Utilisateur non autorisé à supprimer ce message');
      }

      const message = await Message.findById(messageId);
      if (!message) {
        throw new Error('Message non trouvé');
      }
      const conversation = await Conversation.findById(conversationId)
      if(!conversation) return false;

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

   
      this.emitMessageDeletion(messageId,'everyone',userId, conversation)
        await this.createDeleteAuditLog(
            message,
            userId,
            'everyone',    
             null
          ); 
             // Invalidation du cache
      await this.invalidateRelatedCaches(conversationId, userId);

      // Émission de l'événement
      // this.io.to(conversationId).emit('messageDeleted', {
      //   messageId,
      //   deletedBy: userId,
      //   deleteType
      // });
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
          $in: userConversations.map((c:any) => c._id) 
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
  
  // private emitMessageToParticipants(message: IMessage, conversation: IConversation): void {
  //     conversation.participants.forEach(participantId => {
  //       if (participantId.toString() !== message.senderId.toString()) {
  //         this.io.to(participantId.toString()).emit('newMessage', {
  //           ...message.toObject(),
  //           conversationId: conversation._id,
  //           conversationType: conversation.type
  //         });
  //       }
  //     });
  //   }
  
  private async invalidateConversationCache(conversationId: Types.ObjectId): Promise<void> {
      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        for (const participantId of conversation.participants) {
          await this.cacheService.deletePattern(`user_conversations:${participantId}:*`);
        }
      }
    }
    
  private async indexMessageForSearch(message: IMessage): Promise<void> {
    try {
      const searchIndex = {
        messageId: message._id,
        conversationId: message.conversationId,
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt,
        keywords: this.extractKeywords(message.content || ''),
        searchText: `${message.content}`.toLowerCase() 
      };

      await this.cacheService.set(
        `search_index:${message._id}`,
        searchIndex,
        3600 * 24 * 7
      );
    } catch (error) {
      console.error('Erreur d\'indexation:', error);
    }
  }

  private emitReactionToParticipants(
    messageId: string,
    reactions: any[],
    conversation: IConversation | null
  ): void {
    if (!conversation) return;

    conversation.participants.forEach(participantId => {
      this.io.to(participantId.toString()).emit('messageReaction', {
        messageId,
        reactions,
        conversationId: conversation._id,
        timestamp: new Date()
      });
    });
  }

  private async userHasDeletePermission(
    userId: string,
    conversationId: Types.ObjectId
  ): Promise<boolean> {
    try {
      const conversation = await Conversation.findById(conversationId) as IConversation | null;
      if (!conversation) return false;

      // Check if user is conversation admin
      if (conversation.type === 'group') {
        // For groups, check special permissions
        const userPermissions = await this.cacheService.get<UserPermissions>(
          `permissions:${userId}:${conversationId}`
        );
        return userPermissions?.canDeleteMessages || false;
      }

      // For direct conversations, only participants can delete
      return conversation.participants.some(
        participant => participant.toString() === userId
      );
    } catch (error) {
      console.error('Error checking delete permissions:', error);
      return false;
    }
  }
  
  private async createDeleteAuditLog(
      message: IMessage,
      userId: string,
      deleteFor: string,
      reason: string | null
    ): Promise<void> {
      try {
        const auditLog = {
          messageId: message._id,
          conversationId: message.conversationId,
          originalSenderId: message.senderId,
          deletedBy: userId,
          deleteFor,
          reason,
          // originalContent: message.originalContent || message.content,
          messageType: message.content,
          deletedAt: new Date(),
          metadata: {
            userAgent: 'ChatService',
            ipAddress: 'server'
          }
        };
  
        // Sauvegarder dans un système d'audit (base de données, fichier, etc.)
        await this.cacheService.set(
          `audit:delete:${message._id}:${Date.now()}`,
          auditLog,
          3600 * 24 * 365 // 1 an
        );
  
        this.emit('auditLog', {
          type: 'message_deletion',
          data: auditLog
        });
      } catch (error) {
        console.error('Erreur création log audit:', error);
      }
    }

  private emitMessageDeletion(
    messageId: string,
    deleteFor: string,
    userId: string,
    conversation: IConversation | null
  ): void {
    if (!conversation) return;

    const deletionEvent = {
      messageId,
      deleteFor,
      deletedBy: userId,
      conversationId: conversation._id,
      timestamp: new Date()
    };

    if (deleteFor === 'everyone') {
      // Notifier tous les participants
      conversation.participants.forEach(participantId => {
        this.io.to(participantId.toString()).emit('messageDeleted', deletionEvent);
      });
    } else {
      // Notifier seulement l'utilisateur qui a supprimé
      this.io.to(userId).emit('messageDeleted', deletionEvent);
    }
  }

  private extractKeywords(content: string): string[] {
    return content
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !/^(le|la|les|de|du|des|et|ou|dans|avec|pour|sur|the|and|or|in|with|for|on|at|by|from)$/.test(word))
      .slice(0, 10);
  }
    
  private async findUserInConversation(username: string, conversationId: string): Promise<any> {
      try {
        const conversation = await Conversation.findById(conversationId)
          .populate('participants', 'username name email avatar');
        
        if (!conversation) return null;
        
        return conversation.participants.find((user: any) => 
          user.username?.toLowerCase() === username.toLowerCase()
        );
      } catch (error) {
        console.error('Erreur recherche utilisateur:', error);
        return null;
      }
    }
      
  private calculateAverageResponseTime(messages: IMessage[]): number {
      if (messages.length < 2) return 0;
      
      const times = messages
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(1)
        .map((msg, index) => 
          msg.createdAt.getTime() - messages[index].createdAt.getTime()
        );
      
      return times.reduce((sum, time) => sum + time, 0) / times.length;
    }
  
    private findPeakHours(messages: IMessage[]): number[] {
      const hourCounts = new Array(24).fill(0);
      
      messages.forEach(msg => {
        const hour = msg.createdAt.getHours();
        hourCounts[hour]++;
      });
      
      const maxCount = Math.max(...hourCounts);
      return hourCounts
        .map((count, hour) => ({ hour, count }))
        .filter(({ count }) => count === maxCount)
        .map(({ hour }) => hour);
    }
    

}

export default ChatService;