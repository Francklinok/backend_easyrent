import { Types } from 'mongoose';
import { Server } from 'socket.io';
import { EventEmitter } from 'events';
import sharp from 'sharp';
import Conversation from '../model/conversationModel';
import Message from '../model/chatModel';
import { NotificationService } from '../../services/notificationServices';
import { appCacheAndPresenceService } from '../../services/appCacheAndPresence';
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

class MessageQueue {
  // Implémentation de base
}

class ChatService extends EventEmitter {
  private io: Server;
  private notificationService: NotificationService;
  private cacheService: typeof appCacheAndPresenceService;
  private messageQueue: MessageQueue;

  constructor(io: Server) {
    super();
    this.io = io;
    this.notificationService = new NotificationService();
    this.cacheService = appCacheAndPresenceService; 
    this.messageQueue = new MessageQueue(); 
  }

  /**
   * Crée ou récupère une conversation existante
   */
async createOrGetConversation({
    participantId,
    type = "direct",
    propertyId,
    userId
  }: CreateConversationParams): Promise<IConversation> {
    try {
      const cacheKey = `conversation:${userId}:${participantId}:${type}`;
     
      // Check cache
      let conversation = await this.cacheService.get<IConversation>(cacheKey);
     
      if (!conversation) {
        if (type === 'direct') {
          conversation = await Conversation.findOne({
            participants: { $all: [userId, participantId], $size: 2 },
            type: 'direct'
          }).populate('participants', 'name avatar email isOnline lastSeen') as IConversation;
        }
       
        if (!conversation) {
          const newConversation = new Conversation({
            participants: type === 'direct' ? [userId, participantId] : [userId],
            type,
            propertyId,
            createdAt: new Date(),
            settings: {
              encryption: true,
              disappearingMessages: {
                enabled: false,
                duration: 30 // days
              },
              smartReply: true,
              translation: true,
              voiceTranscription: true
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
          });
         
          await newConversation.save();
          conversation = await newConversation.populate('participants', 'name avatar email isOnline lastSeen') as IConversation;
         
          // Emit new conversation event
          this.emit('conversationCreated', conversation);
        }
       
        // Cache the result
        await this.cacheService.set(cacheKey, conversation, 3600);
      }
     
      return conversation;
    } catch (error) {
      this.emit('error', { operation: 'createOrGetConversation', error });
      throw error;
    }
  }
  /**
   * Récupérer les conversations d'un utilisateur avec pagination et filtres
   */
  // async getUserConversations({
  //   userId,
  //   page = 1,
  //   limit = 20,
  //   filter = 'all'
  // }: GetUserConversationsParams): Promise<any[]> {
  //   try {
  //     const cacheKey = `user_conversations:${userId}:${page}:${limit}:${filter}`;
      
  //     // Vérifier le cache
  //     let cachedResult = await this.cacheService.get(cacheKey);
  //     if (cachedResult) return cachedResult;

  //     let query: any = { participants: userId };

  //     switch (filter) {
  //       case 'unread':
  //         break;
  //       case 'groups':
  //         query.type = 'group';
  //         break;
  //       case 'direct':
  //         query.type = 'direct';
  //         break;
  //     }

  //     const conversations = await Conversation.find(query)
  //       .populate('participants', 'name avatar email isOnline lastSeen')
  //       .populate('propertyId', 'title price images location')
  //       .sort({ updatedAt: -1 })
  //       .limit(limit)
  //       .skip((page - 1) * limit);

  //     const enrichedConversations = await Promise.all(
  //       conversations.map(async (conv) => {
  //           const conversationId = conv._id as Types.ObjectId;

  //         const [lastMessage, unreadCount, typingUsers] = await Promise.all([
  //           this.getLastMessage(conversationId),
  //           this.getUnreadCount(conversationId, userId),
  //           this.getTypingUsers(conversationId, userId)
  //         ]);

  //         return {
  //           ...conv.toObject(),
  //           lastMessage,
  //           unreadCount,
  //           typingUsers,
  //           isOnline: this.getConversationOnlineStatus(conv.participants),
  //           encryptionStatus: conv.settings?.encryption ? 'enabled' : 'disabled' // Corrigé
  //         };
  //       })
  //     );

  //     // Filtrer les conversations non lues
  //     const result = filter === 'unread'
  //       ? enrichedConversations.filter(conv => conv.unreadCount > 0)
  //       : enrichedConversations;

  //     await this.cacheService.set(cacheKey, result, 300);
  //     return result;
  //   } catch (error) {
  //     this.emit('error', {
  //       operation: 'getUserConversations',
  //       error
  //     });
  //     throw error;
  //   }
  // }
  
  async getUserConversations({
    userId,
    page = 1,
    limit = 20,
    filter = 'all'
  }: GetUserConversationsParams): Promise<any[]> {
    try {
      const cacheKey = `user_conversations:${userId}:${page}:${limit}:${filter}`;
     
      // Check cache - ensure it's an array
      let cachedResult = await this.cacheService.get<any[]>(cacheKey);
      if (cachedResult && Array.isArray(cachedResult)) {
        return cachedResult;
      }

      let query: any = { participants: userId };
      switch (filter) {
        case 'unread':
          break;
        case 'groups':
          query.type = 'group';
          break;
        case 'direct':
          query.type = 'direct';
          break;
      }

      const conversations = await Conversation.find(query)
        .populate('participants', 'name avatar email isOnline lastSeen')
        .populate('propertyId', 'title price images location')
        .sort({ updatedAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const conversationId = conv._id as Types.ObjectId;
          const [lastMessage, unreadCount, typingUsers] = await Promise.all([
            this.getLastMessage(conversationId),
            this.getUnreadCount(conversationId, userId),
            this.getTypingUsers(conversationId, userId)
          ]);

          return {
            ...conv.toObject(),
            lastMessage,
            unreadCount,
            typingUsers,
            isOnline: this.getConversationOnlineStatus(conv.participants),
            encryptionStatus: conv.settings?.encryption ? 'enabled' : 'disabled'
          };
        })
      );

      // Filter unread conversations
      const result = filter === 'unread'
        ? enrichedConversations.filter(conv => conv.unreadCount > 0)
        : enrichedConversations;

      await this.cacheService.set(cacheKey, result, 300);
      return result;
    } catch (error) {
      this.emit('error', {
        operation: 'getUserConversations',
        error
      });
      throw error;
    }
  }
  /**
   * Envoie un message avec traitement avancé
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
      await this.validateMessageInput({
        conversationId,
        content,
        messageType,
        userId
      });

      let mediaData = null;
      let processedContent = content;

      if (file) {
        mediaData = await this.processMediaFile(file);
      }

      // Traitement du contenu avec l'IA
      const aiInsights = await this.analyzeMessageContent(content, messageType, userId);
      
      // Traiter les mentions
      const processedMentions = await this.processMentions(
        content,
        mentions,
        conversationId
      );

      // Chiffrement du contenu
      const conversation = await Conversation.findById(conversationId);
      if (conversation?.settings?.encryption) {
        processedContent = await this.encryptMessage(content);
      }

      const messageData = {
        conversationId: new Types.ObjectId(conversationId), 
        senderId: new Types.ObjectId(userId), 
        content: processedContent, 
        mediaData,
        replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
        scheduledFor: scheduleFor ? new Date(scheduleFor) : undefined,
        isScheduled: !!scheduleFor,
        aiInsights: {
          priority: priority as 'low' | 'medium' | 'high' | 'urgent', 
          sentiment: aiInsights.sentiment,
          intentDetection: aiInsights.intent,
          autoSuggestions: aiInsights.suggestions || []
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

      if (scheduleFor) {
        return await this.scheduleMessage(messageData);
      }

      const message = new Message(messageData);
      await message.save();
      await this.populateMessage(message);

      // Mettre à jour la conversation
      await this.processMessageAsync(message, conversation);

      return message;
    } catch (error) {
      this.emit('error', {
        operation: 'sendMessage',
        error
      });
      throw error;
    }
  }

async buildNotificationPayloadFromMessage(message: IMessage): Promise<NotificationPayload> {
  return {
    type: 'push',
    push: {
      notification: {
        title: 'Nouveau message',
        body: message.content === 'text' ? '[Texte]' : `[${message.content}]`,
        data: {
          messageId: message.id.toString(),
          conversationId: message.conversationId.toString()
        }
      },
      fcmTokens: [], // à compléter selon ton système
      webpushSubscriptions: []
    },
    priority: message.aiInsights?.priority || 'normal'
  };
}
  /**
   * Traitement asynchrone du message
   */
  async processMessageAsync(message: IMessage, conversation: IConversation | null): Promise<void> {
    try {
      if (!conversation) return;
      const payload = await this.buildNotificationPayloadFromMessage(message);

      await this.notificationService.sendNotification(payload);
      // await this.notificationService.sendNotification(message, conversation);

      
      // Émettre via websocket
      this.emitMessageToParticipants(message, conversation);

      await this.indexMessageForSearch(message);
      
      // Analyser les patterns de conversation
      await this.analyzeConversationPatterns(conversation._id as Types.ObjectId );
      
      // Nettoyer le cache
      await this.invalidateConversationCache(conversation._id as Types.ObjectId);
    } catch (error) {
      this.emit('error', {
        operation: 'processMessageAsync',
        error
      });
    }
  }
  /**
   * Récupère les messages avec pagination et filtres avancés
   */
  async getMessages({
    conversationId,
    userId,
    page = 1,
    limit = 50,
    messageType = null,
    dateRange = null,
    searchQuery = null
  }: GetMessagesParams): Promise<IMessage[]> {
    try {
      let query: any = {
        conversationId,
        $or: [
          { isDeleted: false },
          { isDeleted: true, deletedFor: { $ne: userId } }
        ]
      };

      // Filtres supplémentaires
      if (messageType) query.messageType = messageType;
      if (dateRange) {
        query.createdAt = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }
      if (searchQuery) {
        query.$text = { $search: searchQuery };
      }

      const messages = await Message.find(query)
        .populate('senderId', 'name avatar isOnline')
        .populate('replyTo')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      // Marquer comme lus
      await this.markMessagesAsRead(conversationId, userId);
      
      // Déchiffrer si nécessaire
      const decryptedMessages = await Promise.all(
        messages.map(msg => this.decryptMessageIfNeeded(msg))
      );

      return decryptedMessages.reverse();
    } catch (error) {
      this.emit('error', { operation: 'getMessages', error });
      throw error;
    }
  }

  /**
   * Système de réactions avancé
   */
  async reactToMessage({
    messageId,
    emoji,
    userId,
    customReaction = null
  }: ReactToMessageParams): Promise<{ success: boolean; reactions: any[] }> {
    try {
      const message = await Message.findById(messageId);
      if (!message) throw new Error('Message non trouvé');

      message.reactions = message.reactions.filter(
        r => r.userId.toString() !== userId
      );

      if (emoji || customReaction) {
        const reaction = {
          userId: new Types.ObjectId(userId), 
          emoji: emoji || customReaction.emoji,
          timestamp: new Date()
        };

        message.reactions.push(reaction);

        // Analytics des réactions
        await this.trackReactionAnalytics(
          messageId,
          userId,
          emoji || customReaction.emoji
        );
      }

      await message.save();
      
      // Émettre en temps réel
      const conversation = await Conversation.findById(message.conversationId);
      this.emitReactionToParticipants(messageId, message.reactions, conversation);

      return {
        success: true,
        reactions: message.reactions
      };
    } catch (error) {
      this.emit('error', { operation: 'reactToMessage', error });
      throw error;
    }
  }

  /**
   * Système de suppression intelligent
   */
  async deleteMessage({
    messageId,
    deleteFor = 'me',
    userId,
    reason = null
  }: DeleteMessageParams): Promise<{ success: boolean }> {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        console.log('Message non trouvé');
        return { success: false };
      }

      const canDeleteForEveryone = message.senderId.toString() === userId ||
        await this.userHasDeletePermission(userId, message.conversationId);

      if (deleteFor === 'everyone' && !canDeleteForEveryone) {
        throw new Error('Non autorisé à supprimer pour tous');
      }

      // Sauvegarder pour audit
      await this.createDeleteAuditLog(message, userId, deleteFor, reason);

      if (deleteFor === 'everyone') {
        message.isDeleted = true;
        message.deletedAt = new Date();
        message.content = 'text'; 
        message.mediaData = undefined;
      } else {
        message.deletedFor.push(new Types.ObjectId(userId));
      }

      await message.save();

      // Émettre la suppression
      const conversation = await Conversation.findById(message.conversationId);
      this.emitMessageDeletion(messageId, deleteFor, userId, conversation);
      
      return { success: true };
    } catch (error) {
      this.emit('error', { operation: 'deleteMessage', error });
      throw error;
    }
  }

  /**
   * Recherche avancée dans les messages
   */
  async searchMessages({
    userId,
    query,
    conversationId = null,
    messageType = null,
    dateRange = null,
    page = 1,
    limit = 20
  }: SearchMessagesParams): Promise<IMessage[]> {
    try {
      let searchQuery: any = {
        $text: { $search: query },
        $or: [
          { isDeleted: false },
          { isDeleted: true, deletedFor: { $ne: userId } }
        ]
      };

      // Filtrer par conversation si spécifié
      if (conversationId) {
        searchQuery.conversationId = conversationId;
      } else {
        // Récupérer les conversations de l'utilisateur
        const userConversations = await Conversation.find(
          { participants: userId }
        ).select('_id');

        searchQuery.conversationId = {
          $in: userConversations.map(c => c._id)
        };
      }

      if (messageType) searchQuery.messageType = messageType;
      if (dateRange) {
        searchQuery.createdAt = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const messages = await Message.find(searchQuery)
        .populate('senderId', 'name avatar')
        .populate('conversationId', 'type participants')
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      return messages;
    } catch (error) {
      this.emit('error', { operation: 'searchMessages', error });
      throw error;
    }
  }

  // Méthodes privées utilitaires

  private async processMediaFile(file: MediaFile): Promise<any> {
    const mediaData = {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    };

    if (file.mimetype.startsWith('image/')) {
      const imagePath = file.path;
      const metadata = await sharp(imagePath).metadata();
      (mediaData as any).dimensions = { 
        width: metadata.width, 
        height: metadata.height 
      };

      // Créer plusieurs tailles
      const sizes = ['thumbnail', 'medium', 'large'];
      (mediaData as any).variants = {};

      for (const size of sizes) {
        const { width, height, quality } = this.getImageSizeConfig(size);
        const variantPath = `uploads/${size}_${file.filename}`;

        await sharp(imagePath)
          .resize(width, height, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality })
          .toFile(variantPath);

        (mediaData as any).variants[size] = variantPath;
      }
    }

    return mediaData;
  }

  private async analyzeMessageContent(
    content: string,
    messageType: string,
    userId: string
  ): Promise<any> {
    try {
      const analysis = await this.analyzeMessageWithAI(content, messageType);

      return {
        ...analysis,
        timestamp: new Date(),
        userId,
        language: await this.detectLanguage(content),
        topics: await this.extractTopics(content),
        urgency: this.assessUrgency(content, analysis.sentiment)
      };
    } catch (error) {
      return { error: 'Analysis failed', timestamp: new Date() };
    }
  }

  private async processMentions(
    content: string,
    mentions: any[],
    conversationId: string
  ): Promise<any[]> {
    const mentionPattern = /@(\w+)/g;
    const extractedMentions = [];
    let match;

    while ((match = mentionPattern.exec(content)) !== null) {
      const username = match[1];
      // Trouver l'utilisateur dans la conversation
      const user = await this.findUserInConversation(username, conversationId);
      if (user) {
        extractedMentions.push({
          userId: user._id,
          username: user.username,
          position: match.index,
          length: match[0].length
        });
      }
    }

    return [...extractedMentions, ...mentions];
  }

  private emitMessageToParticipants(message: IMessage, conversation: IConversation): void {
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== message.senderId.toString()) {
        this.io.to(participantId.toString()).emit('newMessage', {
          ...message.toObject(),
          conversationId: conversation._id,
          conversationType: conversation.type
        });
      }
    });
  }

  private async invalidateConversationCache(conversationId: Types.ObjectId): Promise<void> {
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      for (const participantId of conversation.participants) {
        await this.cacheService.deletePattern(`user_conversations:${participantId}:*`);
      }
    }
  }

  private getImageSizeConfig(size: string): { width: number; height: number; quality: number } {
    const configs = {
      thumbnail: { width: 150, height: 150, quality: 60 },
      medium: { width: 800, height: 600, quality: 80 },
      large: { width: 1920, height: 1080, quality: 90 }
    };
    return configs[size as keyof typeof configs] || configs.medium;
  }

  private async validateMessageInput(params: {
    conversationId: string;
    content: string;
    messageType: string;
    userId: string;
  }): Promise<void> {
    const { conversationId, content, messageType, userId } = params;

    if (!conversationId) {
      throw new Error('ID de conversation requis');
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Contenu du message requis');
    }

    if (content.length > 10000) {
      throw new Error('Message trop long (maximum 10000 caractères)');
    }

    const validMessageTypes = ['text', 'image', 'video', 'audio', 'file'];
    if (!validMessageTypes.includes(messageType)) {
      throw new Error('Type de message invalide');
    }

    if (!userId) {
      throw new Error('ID utilisateur requis');
    }

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation non trouvée');
    }

    if (!conversation.participants.includes(new Types.ObjectId(userId))) {
      throw new Error('Utilisateur non autorisé dans cette conversation');
    }
  }

  private async encryptMessage(content: string): Promise<string> {
    try {
      const crypto = require('crypto');
      const algorithm = 'aes-256-gcm';
      const secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production';
      
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, secretKey);
      
      let encrypted = cipher.update(content, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag ? cipher.getAuthTag().toString('hex') : '';
      
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      console.error('Erreur de chiffrement:', error);
      return content;
    }
  }

  private async scheduleMessage(messageData: any): Promise<IMessage> {
    const scheduledMessage = new Message({
      ...messageData,
      isScheduled: true,
      status: {
        ...messageData.status,
        sent: new Date()
      }
    });

    await scheduledMessage.save();

    const delay = new Date(messageData.scheduledFor).getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(async () => {
        try {
          scheduledMessage.isScheduled = false;
          scheduledMessage.status.sent = new Date();
          await scheduledMessage.save();
          
          const conversation = await Conversation.findById(scheduledMessage.conversationId);
          await this.processMessageAsync(scheduledMessage, conversation);
        } catch (error) {
          this.emit('error', { operation: 'scheduleMessage', error });
        }
      }, delay);
    }

    return scheduledMessage;
  }

  private async populateMessage(message: IMessage): Promise<void> {
    await message.populate([
      {
        path: 'senderId',
        select: 'name avatar email isOnline lastSeen'
      },
      {
        path: 'replyTo',
        select: 'content senderId createdAt'
      }
    ]);
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

  private async analyzeConversationPatterns(conversationId: Types.ObjectId): Promise<void> {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentMessages = await Message.find({
        conversationId,
        createdAt: { $gte: dayAgo },
        isDeleted: false
      });

      const patterns = {
        messageCount: recentMessages.length,
        activeUsers: [...new Set(recentMessages.map(m => m.senderId.toString()))],
        averageResponseTime: this.calculateAverageResponseTime(recentMessages),
        peakHours: this.findPeakHours(recentMessages),
        sentimentTrend: await this.analyzeSentimentTrend(recentMessages)
      };

      await this.cacheService.set(
        `conversation_patterns:${conversationId}`,
        patterns,
        3600 * 12
      );

      if (patterns.messageCount > 100) {
        this.emit('conversationInsight', {
          conversationId,
          type: 'high_activity',
          data: patterns
        });
      }
    } catch (error) {
      console.error('Erreur d\'analyse des patterns:', error);
    }
  }

  private async getLastMessage(conversationId: Types.ObjectId): Promise<any> {
    try {
      const lastMessage = await Message.findOne({
        conversationId,
        isDeleted: false
      })
      .sort({ createdAt: -1 })
      .populate('senderId', 'name avatar')
      .lean();

      if (!lastMessage) return null;

      return {
        _id: lastMessage._id,
        content: lastMessage.content?.substring(0, 100) + (lastMessage.content?.length > 100 ? '...' : ''),
        senderId: lastMessage.senderId,
        createdAt: lastMessage.createdAt
      };
    } catch (error) {
      console.error('Erreur récupération dernier message:', error);
      return null;
    }
  }

  private async getUnreadCount(conversationId: Types.ObjectId, userId: string): Promise<number> {
    try {
      const count = await Message.countDocuments({
        conversationId,
        isDeleted: false,
        senderId: { $ne: userId },
        'status.read': { $not: { $elemMatch: { userId: new Types.ObjectId(userId) } } } 
      });

      return count;
    } catch (error) {
      console.error('Erreur comptage messages non lus:', error);
      return 0;
    }
  }

  private async getTypingUsers(conversationId: Types.ObjectId, userId: string): Promise<any[]> {
    try {
      const typingKey = `typing:${conversationId}`;
      const typingData = await this.cacheService.get(typingKey) || {};
      
      const typingUsers = Object.entries(typingData)
        .filter(([id, data]: [string, any]) => {
          return id !== userId && 
                 data.isTyping && 
                 (Date.now() - data.lastTyping) < 10000;
        })
        .map(([id]) => ({ userId: id }));

      return typingUsers;
    } catch (error) {
      console.error('Erreur récupération utilisateurs qui tapent:', error);
      return [];
    }
  }

    private getConversationOnlineStatus(participants: Types.ObjectId[]): boolean {
    try {
      return participants.some(participantId => {
        if (this.cacheService.isUserOnline) {
          return this.cacheService.isUserOnline(participantId.toString());
        }
        return false;
      });
    } catch (error) {
      console.error('Error checking online status:', error);
      return false;
    }
  }

  private async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      await Message.updateMany(
        {
          conversationId,
          senderId: { $ne: userId },
          'status.read.userId': { $ne: new Types.ObjectId(userId) } 
        },
        {
          $addToSet: {
            'status.read': {
              userId: new Types.ObjectId(userId),
              timestamp: new Date()
            }
          }
        }
      );

      this.io.to(conversationId).emit('messagesRead', {
        conversationId,
        userId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Erreur marquage messages lus:', error);
    }
  }

  private async decryptMessageIfNeeded(message: IMessage): Promise<IMessage> {
    if (!message.content || typeof message.content !== 'string') {
      return message;
    }

    try {
      const parts = message.content.split(':');
      if (parts.length !== 3) {
        return message;
      }

      const crypto = require('crypto');
      const algorithm = 'aes-256-gcm';
      const secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production';
      
      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipher(algorithm, secretKey);
      if (decipher.setAuthTag) {
        decipher.setAuthTag(authTag);
      }
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      message.content = decrypted;
      return message;
    } catch (error) {
      console.error('Erreur de déchiffrement:', error);
      return message;
    }
  }

  

  // private async trackReactionAnalytics(
  //   messageId: string,
  //   userId: string,
  //   emoji: string
  // ): Promise<void> {
  //   try {
  //     const analyticsKey = `reaction_analytics:${messageId}`;
  //     const existing = await this.cacheService.get(analyticsKey) || {
  //       messageId,
  //       reactions: {},
  //       totalReactions: 0,
  //       uniqueUsers: new Set(),
  //       timeline: []
  //     };

  //     existing.reactions[emoji] = (existing.reactions[emoji] || 0) + 1;
  //     existing.totalReactions += 1;
  //     existing.uniqueUsers.add(userId);
  //     existing.timeline.push({
  //       userId,
  //       emoji,
  //       timestamp: new Date()
  //     });

  //     await this.cacheService.set(analyticsKey, {
  //       ...existing,
  //       uniqueUsers: Array.from(existing.uniqueUsers)
  //     }, 3600 * 24 * 30); // 30 jours
  //   } catch (error) {
  //     console.error('Erreur analytics réactions:', error);
  //   }
  // }

  private async trackReactionAnalytics(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<void> {
    try {
      const analyticsKey = `reaction_analytics:${messageId}`;
      const existing = await this.cacheService.get<ReactionAnalytics>(analyticsKey);
      
      const analytics: ReactionAnalytics = existing || {
        messageId,
        reactions: {},
        totalReactions: 0,
        uniqueUsers: [],
        timeline: []
      };

      analytics.reactions[emoji] = (analytics.reactions[emoji] || 0) + 1;
      analytics.totalReactions += 1;
      
      if (!analytics.uniqueUsers.includes(userId)) {
        analytics.uniqueUsers.push(userId);
      }
      
      analytics.timeline.push({
        userId,
        emoji,
        timestamp: new Date()
      });

      await this.cacheService.set(analyticsKey, analytics, 3600 * 24 * 30); // 30 days
    } catch (error) {
      console.error('Error tracking reaction analytics:', error);
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

  // private async userHasDeletePermission(
  //   userId: string,
  //   conversationId: Types.ObjectId
  // ): Promise<boolean> {
  //   try {
  //     const conversation = await Conversation.findById(conversationId);
  //     if (!conversation) return false;

  //     // Vérifier si l'utilisateur est admin de la conversation
  //     if (conversation.type === 'group') {
  //       // Pour les groupes, vérifier les permissions spéciales
  //       const userPermissions = await this.cacheService.get(`permissions:${userId}:${conversationId}`);
  //       return userPermissions?.canDeleteMessages || false;
  //     }

  //     // Pour les conversations directes, seuls les participants peuvent supprimer
  //     return conversation.participants.includes(new Types.ObjectId(userId));
  //   } catch (error) {
  //     console.error('Erreur vérification permissions:', error);
  //     return false;
  //   }
  // }

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

  private async analyzeMessageWithAI(content: string, messageType: string): Promise<any> {
    try {
      const analysis = {
        sentiment: this.analyzeSentiment(content),
        language: await this.detectLanguage(content),
        topics: await this.extractTopics(content),
        entities: this.extractEntities(content),
        intent: this.detectIntent(content),
        confidence: Math.random() * 0.3 + 0.7, 
        processingTime: Date.now()
      };

      return analysis;
    } catch (error:any) {
      console.error('Erreur analyse IA:', error);
      return {
        sentiment: 'neutral',
        language: 'unknown',
        topics: [],
        entities: [],
        intent: 'unknown',
        confidence: 0,
        error: error.message
      };
    }
  }

  private async detectLanguage(content: string): Promise<string> {
    // Détection simple basée sur des mots-clés
    const frenchKeywords = ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'ou', 'dans', 'avec', 'pour', 'sur'];
    const englishKeywords = ['the', 'and', 'or', 'in', 'with', 'for', 'on', 'at', 'by', 'from'];
    
    const words = content.toLowerCase().split(/\s+/);
    const frenchCount = words.filter(word => frenchKeywords.includes(word)).length;
    const englishCount = words.filter(word => englishKeywords.includes(word)).length;
    
    if (frenchCount > englishCount) return 'fr';
    if (englishCount > frenchCount) return 'en';
    return 'unknown';
  }

  private async extractTopics(content: string): Promise<string[]> {
    const topics: string[] = [];
    const topicKeywords = {
      'technologie': ['code', 'app', 'web', 'mobile', 'tech', 'software', 'développement'],
      'immobilier': ['maison', 'appartement', 'vente', 'achat', 'location', 'propriété'],
      'travail': ['job', 'travail', 'emploi', 'bureau', 'meeting', 'réunion'],
      'personnel': ['famille', 'ami', 'personnel', 'privé', 'vie']
    };

    const contentLower = content.toLowerCase();
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        topics.push(topic);
      }
    });

    return topics;
  }

  private assessUrgency(content: string, sentiment: any): string {
    const urgentKeywords = ['urgent', 'emergency', 'asap', 'immédiat', 'maintenant', 'vite', 'rapidement'];
    const contentLower = content.toLowerCase();
    
    if (urgentKeywords.some(keyword => contentLower.includes(keyword))) {
      return 'high';
    }
    
    if (sentiment?.score < -0.5) {
      return 'medium';
    }
    
    return 'normal';
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

  // Méthodes utilitaires privées
  private extractKeywords(content: string): string[] {
    return content
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !/^(le|la|les|de|du|des|et|ou|dans|avec|pour|sur|the|and|or|in|with|for|on|at|by|from)$/.test(word))
      .slice(0, 10);
  }

  private countMessageTypes(messages: IMessage[]): Record<string, number> {
    return messages.reduce((acc, msg) => {
      acc[msg.content] = (acc[msg.content] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
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

  private async analyzeSentimentTrend(messages: IMessage[]): Promise<any> {
    const sentiments = messages.map(msg => this.analyzeSentiment(msg.content || ''));
    const avgSentiment = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;
    
    return {
      average: avgSentiment,
      trend: avgSentiment > 0 ? 'positive' : avgSentiment < 0 ? 'negative' : 'neutral',
      samples: sentiments.length
    };
  }

  private analyzeSentiment(content: string): { score: number; label: string } {
    const positiveWords = ['bon', 'bien', 'super', 'génial', 'parfait', 'excellent', 'good', 'great', 'awesome'];
    const negativeWords = ['mauvais', 'mal', 'terrible', 'horrible', 'nul', 'bad', 'terrible', 'awful'];
    
    const contentLower = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => contentLower.includes(word)).length;
    const negativeCount = negativeWords.filter(word => contentLower.includes(word)).length;
    
    const score = (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1);
    
    return {
      score,
      label: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral'
    };
  }

  private extractEntities(content: string): any[] {
    const entities:{ type: string; value: string }[]  = [];
    
    // Email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailRegex);
    if (emails) {
      emails.forEach(email => entities.push({ type: 'email', value: email }));
    }
    
    // URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlRegex);
    if (urls) {
      urls.forEach(url => entities.push({ type: 'url', value: url }));
    }
    
    // Numéros de téléphone (simple)
    const phoneRegex = /\b\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}\b/g;
    const phones = content.match(phoneRegex);
    if (phones) {
      phones.forEach(phone => entities.push({ type: 'phone', value: phone }));
    }
    
    return entities;
  }

  private detectIntent(content: string): string {
    const contentLower = content.toLowerCase();
    
    if (/\?/.test(content)) return 'question';
    if (/merci|thanks/i.test(content)) return 'gratitude';
    if (/salut|hello|bonjour/i.test(content)) return 'greeting';
    if (/au revoir|bye|goodbye/i.test(content)) return 'goodbye';
    if (/aide|help/i.test(content)) return 'help_request';
    if (/oui|yes|d'accord|ok/i.test(content)) return 'agreement';
    if (/non|no|pas d'accord/i.test(content)) return 'disagreement';
    
    return 'statement';
  }
}

export default ChatService;

