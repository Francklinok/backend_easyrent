import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import ChatService from "../services/chatService";
import { validationResult } from 'express-validator';
import { asyncHandler } from "../../auth/utils/handlerError";
import { Server as IOServer } from 'socket.io';
import RateLimiter from "../../utils/RateLimits";
// import { getRedisClient } from "../../lib/redisClient";
import { CustomRequest } from "../types/chatTypes";
import { Request,Response } from "express";
import { MessageType } from "../types/chatTypes";
import { SendMessageRequest,MediaFile,ReactionRequest,DeleteRequest } from "../types/chatTypes";
import { mediaValidationConfig } from "../constant/messageTypeValidationConfig";
import appCacheAndPresenceService from "../../services/redisInstance";

class ChatController {
  // private io: IOServer;
  private chatService: ChatService;
  // private rateLimiter: RateLimiter;
  // private appCacheAndPresenceService:appCacheAndPresenceService

  constructor(io: IOServer) {
    // this.io = io;
    this.chatService = new ChatService(io);
    // const redisClient = appCacheAndPresenceService.getRedisClient(); 
      // if (!redisClient) {
      //   throw new Error("Redis client is not initialized");
      // }
    // this.rateLimiter = new RateLimiter(redisClient);

    this.setupServiceEventListeners();
  }

  setupServiceEventListeners() {
    this.chatService.on('conversationCreated', (conversation) => {
      console.log(`Nouvelle conversation créée: ${conversation._id}`);
    });

    this.chatService.on('error', (error) => {
      console.error('Erreur du service de chat:', error);
    });
  }
  /**
   * Crée ou récupère une conversation
   */
  createOrGetConversation = asyncHandler(async (req:CustomRequest, res:Response) => {
    // Validation des erreurs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Données de validation invalides', errors.array());
    }

    const { participantId, type = 'direct', propertyId } = req.body;
    const  userId = req.user.userId

    // Vérifier les permissions
    if (type === 'direct') {
      if (!participantId) {
        throw new ApiError(400, 'participantId requis pour les conversations directes');
      }
      if (participantId === userId) {
        throw new ApiError(400, 'Impossible de créer une conversation avec soi-même');
      }
    }

    const conversation = await this.chatService.createOrGetConversation({
      participantId,
      type: type as 'direct' | 'group' | 'property_discussion', 
      propertyId,
      userId
    });

    res.status(200).json(
      new ApiResponse(200, conversation, 'Conversation récupérée avec succès')
    );
  });

  /**
   * Récupère les conversations de l'utilisateur
   */
  
  getStringFromQuery = (value: any, defaultValue: string): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') return value[0];
    return defaultValue;
    };

  getUserConversations = asyncHandler(async (req: CustomRequest, res: Response) => {
    const userId = req.user.userId;
    
    // Safely extract query parameters
    const pageStr = this.getStringFromQuery(req.query.page, '1');
    const limitStr = this.getStringFromQuery(req.query.limit, '20');
    const filter = this.getStringFromQuery(req.query.filter, 'all');
    const sortBy = this.getStringFromQuery(req.query.sortBy, 'updatedAt');
    const sortOrder = this.getStringFromQuery(req.query.sortOrder, 'desc');

    // Validation des paramètres
    const validFilters = ['all', 'unread', 'groups', 'direct', 'archived'] as const;
    const validSortOrders = ['asc', 'desc'] as const;
    
    // Type-safe filter validation
    if (!validFilters.includes(filter as any)) {
      throw new ApiError(400, 'Filtre invalide');
    }
    
    if (!validSortOrders.includes(sortOrder as any)) {
      throw new ApiError(400, 'Ordre de tri invalide');
    }

    // Parse query parameters safely
    const pageNum = parseInt(pageStr, 10);
    const limitNum = parseInt(limitStr, 10);
    
    if (isNaN(pageNum) || pageNum < 1) {
      throw new ApiError(400, 'Page invalide');
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new ApiError(400, 'Limite invalide');
    }

    const conversations = await this.chatService.getUserConversations({
      userId,
      page: pageNum,
      limit: limitNum,
      filter: filter as 'all' | 'unread' | 'groups' | 'direct' | 'archived',
      sortBy: sortBy,
      sortOrder: sortOrder as 'asc' | 'desc'
    });

    res.status(200).json(
      new ApiResponse(200, {
        conversations,
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          total: conversations.length
        }
      }, 'Conversations récupérées avec succès')
    );
  });
    /**
     * Envoie un message
     */
  sendMessage = asyncHandler(async (req: SendMessageRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Données de validation invalides', errors.array());
    }

    const {
      conversationId,
      content,
      messageType = 'text',
      replyTo,
      scheduleFor,
      priority = 'normal',
      mentions = [],
      

    } = req.body;

    const userId = req.user.userId;
    const mediaFile = req.file as MediaFile | undefined;


    // Validation spécifique au type de message
    // await this.validateMessageByType(messageType, content, req.file);
      await this.validateMessageByType(messageType, content, mediaFile);


    const message = await this.chatService.sendMessage(
      {
        conversationId,
        content,
        messageType,
        replyTo,
        scheduleFor,
        userId,
        priority,
        mentions
      },
      req.file as MediaFile | undefined // passé comme second param
    );

    res.status(201).json(
      new ApiResponse(201, message, 'Message envoyé avec succès')
    );
  });
    /**
     * Récupère les messages d'une conversation
     */

getMessages = asyncHandler(async (req: CustomRequest, res: Response) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;

  const allowedMessageTypes = ['text', 'image', 'video', 'audio', 'document','location',
    'contact','property','voice_note','ar_preview','virtual_tour'] as const;

  const pageStr = this.getStringFromQuery(req.query.page, '1');
  const limitStr = this.getStringFromQuery(req.query.limit, '50');
  const rawMessageType = this.getStringFromQuery(req.query.messageType, '');
  const searchQuery = this.getStringFromQuery(req.query.searchQuery, '');
  const dateRangeRaw = this.getStringFromQuery(req.query.dateRange, '');
  const messageType = allowedMessageTypes.includes(rawMessageType as any)
  ? (rawMessageType as typeof allowedMessageTypes[number])
  : undefined;
  const page = parseInt(pageStr, 10);
  const limit = parseInt(limitStr, 10);

  if (isNaN(page) || page < 1) throw new ApiError(400, 'Page invalide');
  if (isNaN(limit) || limit < 1 || limit > 100) throw new ApiError(400, 'Limite invalide');

  // Vérifier l'accès à la conversation
  await this.verifyConversationAccess(conversationId, userId);

  let parsedDateRange: any = null;
  if (dateRangeRaw) {
    try {
      parsedDateRange = JSON.parse(dateRangeRaw);
    } catch (error) {
      throw new ApiError(400, 'Format de plage de dates invalide');
    }
  }

  const messages = await this.chatService.getMessages({
    conversationId,
    page,
    limit,
    messageType,
    dateRange: parsedDateRange,
    searchQuery,
    userId,

  });

  res.status(200).json(
    new ApiResponse(200, {
      messages,
      pagination: {
        currentPage: page,
        limit
      }
    }, 'Messages récupérés avec succès')
  );
});

  /**
   * Réagit à un message
   */
  reactToMessage = asyncHandler(async (req:ReactionRequest, res:Response) => {
    const { messageId,conversationId} = req.params;
    const { emoji, customReaction } = req.body;
    const userId = req.user.userId;
    // Validation
    if (!emoji && !customReaction) {
      throw new ApiError(400, 'Emoji ou réaction personnalisée requis');
    }

    const result = await this.chatService.reactToMessage({
      messageId,
      emoji,
      userId,
      customReaction,
      conversationId,
      reactionType: emoji ? 'emoji' : 'custom'
    });

    res.status(200).json(
      new ApiResponse(200, result, 'Réaction ajoutée avec succès')
    );
  });

  /**
   * Supprime un message
   */
  deleteMessage = asyncHandler(async (req:DeleteRequest, res:Response) => {
    const { messageId ,conversationId} = req.params;
    const { deleteFor = 'me' } = req.body;
    const userId = req.user.userId;

    // Validation
    const validDeleteOptions = ['me', 'everyone'];
    if (!validDeleteOptions.includes(deleteFor)) {
      throw new ApiError(400, 'Option de suppression invalide');
    }

    const result = await this.chatService.deleteMessage({
      messageId,
      userId,
      deleteType: 'soft',
      deleteFor,
      conversationId
    });

    res.status(200).json(
      new ApiResponse(200, result, 'Message supprimé avec succès')
    );
  });

  /**
   * Restaure un message supprimé
   */
  restoreMessage = asyncHandler(async (req:CustomRequest, res:Response) => {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await this.chatService.restoreMessage(messageId, userId);

    res.status(200).json(
      new ApiResponse(200, message, 'Message restauré avec succès')
    );
  });

  /**
   * Recherche dans les messages
   */

searchMessages = asyncHandler(async (req: CustomRequest, res: Response) => {
  const userId = req.user.userId;
    const allowedTypes = ['text', 'image', 'video', 'audio', 'document','location',
    'contact','property','voice_note','ar_preview','virtual_tour'] as const;
  type AllowedMessageType = typeof allowedTypes[number];
  const rawMessageType = this.getStringFromQuery(req.query.messageType, '');
  const messageType: AllowedMessageType | undefined = allowedTypes.includes(rawMessageType as AllowedMessageType)
  ? (rawMessageType as AllowedMessageType)
  : undefined;

  const rawQuery = this.getStringFromQuery(req.query.query, '');
  const rawConversationId = this.getStringFromQuery(req.query.conversationId, '');
  // const rawMessageType = this.getStringFromQuery(req.query.messageType, '');
  const rawDateRange = this.getStringFromQuery(req.query.dateRange, '');
  const rawPage = this.getStringFromQuery(req.query.page, '1');
  const rawLimit = this.getStringFromQuery(req.query.limit, '20');

  if (!rawQuery || rawQuery.length < 2) {
    throw new ApiError(400, 'La requête de recherche doit contenir au moins 2 caractères');
  }

  let parsedDateRange = null;
  if (rawDateRange) {
    try {
      parsedDateRange = JSON.parse(rawDateRange);
    } catch (error) {
      throw new ApiError(400, 'Format de plage de dates invalide');
    }
  }

  const messages = await this.chatService.searchMessages({
    userId,
    query: rawQuery,
    content: rawQuery,
    conversationId: rawConversationId || null,
    messageType,
    dateRange: parsedDateRange,
    page: parseInt(rawPage),
    limit: parseInt(rawLimit),
  });

  res.status(200).json(
    new ApiResponse(200, {
      messages,
      query: rawQuery,
      pagination: {
        currentPage: parseInt(rawPage),
        limit: parseInt(rawLimit)
      }
    }, 'Recherche effectuée avec succès')
  );
});

  /**
   * Marque une conversation comme lue
   */
  markConversationAsRead = asyncHandler(async (req:CustomRequest, res:Response) => {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    await this.verifyConversationAccess(conversationId, userId);
    await this.chatService.markMessagesAsRead(conversationId, userId);

    res.status(200).json(
      new ApiResponse(200, {}, 'Conversation marquée comme lue')
    );
  });

  /**
   * Gère le statut de frappe
   */
  handleTyping = asyncHandler(async (req:CustomRequest, res:Response) => {
     if (!req.user) {
    throw new ApiError(401, 'Utilisateur non authentifié');
  }
    const { conversationId } = req.body;
    if(!conversationId)return 
    const { isTyping = true } = req.body;
    const userId = req.user.userId;

    await this.verifyConversationAccess(conversationId, userId);
    await this.chatService.handleTypingStatus(conversationId, userId, isTyping);

    res.status(200).json(
      new ApiResponse(200, {}, 'Statut de frappe mis à jour')
    );
  });

  /**
   * Archive une conversation
   */
  archiveConversation = asyncHandler(async (req:CustomRequest, res:Response) => {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    await this.verifyConversationAccess(conversationId, userId);
    const conversation = await this.chatService.archivedConversation(conversationId, userId);

    res.status(200).json(
      new ApiResponse(200, conversation, 'Conversation archivée avec succès')
    );
  });

  /**
   * Épingle un message
   */
  // pinMessage = asyncHandler(async (req:CustomRequest, res:Response) => {
  //   const { messageId } = req.params;
  //   const userId = req.user.userId;

  //   const result = await this.chatService.pinMessage(messageId, userId);

  //   res.status(200).json(
  //     new ApiResponse(200, result, 'Message épinglé avec succès')
  //   );
  // });

  /**
   * Obtient les statistiques de conversation
   */
  getConversationStats = asyncHandler(async (req:CustomRequest, res:Response) => {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    await this.verifyConversationAccess(conversationId, userId);
    const stats = await this.chatService.getConversationStats(conversationId);

    res.status(200).json(
      new ApiResponse(200, stats, 'Statistiques récupérées avec succès')
    );
  });

  // Méthodes utilitaires privées

async validateMessageByType(messageType: MessageType, content: string, file?: MediaFile) {
  const rule = mediaValidationConfig[messageType];

  if (!rule) {
    throw new ApiError(400, 'Type de message non supporté');
  }

  if (rule.requiredContent) {
    if (!content) {
      throw new ApiError(400, 'Le contenu est requis');
    }
    try {
      rule.contentValidator?.(content);
    } catch (err:any) {
      throw new ApiError(400, err.message);
    }
  }

  if (rule.requiredFile) {
    if (!file) {
      throw new ApiError(400, 'Fichier requis');
    }

    if (rule.mimetypePrefix && !file.mimetype.startsWith(rule.mimetypePrefix)) {
      throw new ApiError(400, `Le fichier doit être de type ${rule.mimetypePrefix}`);
    }

    if (rule.allowedMimetypes && !rule.allowedMimetypes.includes(file.mimetype)) {
      throw new ApiError(400, 'Type de fichier non supporté');
    }

    if (file.size > rule.maxSizeMB * 1024 * 1024) {
      throw new ApiError(400, `Fichier trop volumineux (max ${rule.maxSizeMB}MB)`);
    }
  }
}
  
  async verifyConversationAccess(conversationId:string, userId:string) {
    const  conversation = Conversation.findById(conversationId)
    if (!conversation) {
      throw new ApiError(404, 'Conversation non trouvée');
    }
    
    const hasAccess = conversation.participants.some(
      (participant:any) => participant.toString() === userId
    );
    
    if (!hasAccess) {
      throw new ApiError(403, 'Accès à la conversation non autorisé');
    }
    
    return conversation;
  }
}
export default ChatController;
