import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import ChatService from "../services/chatService";
import { validationResult } from 'express-validator';
import { asyncHandler } from "../../auth/utils/handlerError";
import { Server as IOServer } from 'socket.io';
import RateLimiter from "../../utils/RateLimits";
import { getRedisClient } from "../../lib/redisClient";

class ChatController {
   private io: IOServer;
  private chatService: ChatService;
  private rateLimiter: RateLimiter;
  private redisClient;

  constructor(io: IOServer) {
    this.io = io;
    this.chatService = new ChatService(io);
    this.redisClient = getRedisClient(); 
    this.rateLimiter = new RateLimiter(this.redisClient);

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
  createOrGetConversation = asyncHandler(async (req:Request, res:Response) => {
    // Validation des erreurs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Données de validation invalides', errors.array());
    }

    const { participantId, type = 'direct', propertyId } = req.body;
    const userId = req.user.id;

    // Vérifier les permissions
    if (type === 'direct' && !participantId) {
      throw new ApiError(400, 'participantId requis pour les conversations directes');
    }

    const conversation = await this.chatService.createOrGetConversation({
      participantId,
      type,
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
  getUserConversations = asyncHandler(async (req:Request, res:Response) => {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      filter = 'all',
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query;

    // Validation des paramètres
    const validFilters = ['all', 'unread', 'groups', 'direct', 'archived'];
    if (!validFilters.includes(filter)) {
      throw new ApiError(400, 'Filtre invalide');
    }

    const conversations = await this.chatService.getUserConversations({
      userId,
      page: parseInt(page),
      limit: parseInt(limit),
      filter,
      sortBy,
      sortOrder
    });

    res.status(200).json(
      new ApiResponse(200, {
        conversations,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          total: conversations.length
        }
      }, 'Conversations récupérées avec succès')
    );
  });

  /**
   * Envoie un message
   */
  sendMessage = asyncHandler(async (req:Request, res:Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Données de validation invalides', errors.array());
    }

    // Appliquer la limitation de débit
    await this.rateLimiter.checkLimit(req.user.id, 'sendMessage', 60, 100); // 100 messages par minute

    const { 
      conversationId, 
      content, 
      messageType = 'text', 
      replyTo, 
      scheduledFor,
      priority = 'normal',
      mentions = []
    } = req.body;
    
    const userId = req.user.id;

    // Validation spécifique au type de message
    await this.validateMessageByType(messageType, content, req.file);

    const message = await this.chatService.sendMessage({
      conversationId,
      content,
      messageType,
      replyTo,
      scheduledFor,
      userId,
      file: req.file,
      priority,
      mentions
    });

    res.status(201).json(
      new ApiResponse(201, message, 'Message envoyé avec succès')
    );
  });

  /**
   * Récupère les messages d'une conversation
   */
  getMessages = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { 
      page = 1, 
      limit = 50,
      messageType,
      dateRange,
      searchQuery
    } = req.query;
    
    const userId = req.user.id;

    // Vérifier l'accès à la conversation
    await this.verifyConversationAccess(conversationId, userId);

    let parsedDateRange = null;
    if (dateRange) {
      try {
        parsedDateRange = JSON.parse(dateRange);
      } catch (error) {
        throw new ApiError(400, 'Format de plage de dates invalide');
      }
    }

    const messages = await this.chatService.getMessages({
      conversationId,
      userId,
      page: parseInt(page),
      limit: parseInt(limit),
      messageType,
      dateRange: parsedDateRange,
      searchQuery
    });

    res.status(200).json(
      new ApiResponse(200, {
        messages,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit)
        }
      }, 'Messages récupérés avec succès')
    );
  });

  /**
   * Réagit à un message
   */
  reactToMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { emoji, customReaction } = req.body;
    const userId = req.user.id;

    // Validation
    if (!emoji && !customReaction) {
      throw new ApiError(400, 'Emoji ou réaction personnalisée requis');
    }

    const result = await this.chatService.reactToMessage({
      messageId,
      emoji,
      userId,
      customReaction
    });

    res.status(200).json(
      new ApiResponse(200, result, 'Réaction ajoutée avec succès')
    );
  });

  /**
   * Supprime un message
   */
  deleteMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { deleteFor = 'me', reason } = req.body;
    const userId = req.user.id;

    // Validation
    const validDeleteOptions = ['me', 'everyone'];
    if (!validDeleteOptions.includes(deleteFor)) {
      throw new ApiError(400, 'Option de suppression invalide');
    }

    const result = await this.chatService.deleteMessage({
      messageId,
      deleteFor,
      userId,
      reason
    });

    res.status(200).json(
      new ApiResponse(200, result, 'Message supprimé avec succès')
    );
  });

  /**
   * Restaure un message supprimé
   */
  restoreMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await this.chatService.restoreMessage(messageId, userId);

    res.status(200).json(
      new ApiResponse(200, message, 'Message restauré avec succès')
    );
  });

  /**
   * Recherche dans les messages
   */
  searchMessages = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      query,
      conversationId,
      messageType,
      dateRange,
      page = 1,
      limit = 20
    } = req.query;

    if (!query || query.trim().length < 2) {
      throw new ApiError(400, 'La requête de recherche doit contenir au moins 2 caractères');
    }

    let parsedDateRange = null;
    if (dateRange) {
      try {
        parsedDateRange = JSON.parse(dateRange);
      } catch (error) {
        throw new ApiError(400, 'Format de plage de dates invalide');
      }
    }

    const messages = await this.chatService.searchMessages({
      userId,
      query: query.trim(),
      conversationId,
      messageType,
      dateRange: parsedDateRange,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.status(200).json(
      new ApiResponse(200, {
        messages,
        query: query.trim(),
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit)
        }
      }, 'Recherche effectuée avec succès')
    );
  });

  /**
   * Marque une conversation comme lue
   */
  markConversationAsRead = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    await this.verifyConversationAccess(conversationId, userId);
    await this.chatService.markConversationAsRead(conversationId, userId);

    res.status(200).json(
      new ApiResponse(200, {}, 'Conversation marquée comme lue')
    );
  });

  /**
   * Gère le statut de frappe
   */
  handleTyping = asyncHandler(async (req, res) => {
    const { conversationId } = req.body;
    const { isTyping = true } = req.body;
    const userId = req.user.id;

    await this.verifyConversationAccess(conversationId, userId);
    await this.chatService.handleTypingStatus(conversationId, userId, isTyping);

    res.status(200).json(
      new ApiResponse(200, {}, 'Statut de frappe mis à jour')
    );
  });

  /**
   * Archive une conversation
   */
  archiveConversation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    await this.verifyConversationAccess(conversationId, userId);
    const conversation = await this.chatService.archiveConversation(conversationId, userId);

    res.status(200).json(
      new ApiResponse(200, conversation, 'Conversation archivée avec succès')
    );
  });

  /**
   * Épingle un message
   */
  pinMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;

    const result = await this.chatService.pinMessage(messageId, userId);

    res.status(200).json(
      new ApiResponse(200, result, 'Message épinglé avec succès')
    );
  });

  /**
   * Obtient les statistiques de conversation
   */
  getConversationStats = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;

    await this.verifyConversationAccess(conversationId, userId);
    const stats = await this.chatService.getConversationStats(conversationId);

    res.status(200).json(
      new ApiResponse(200, stats, 'Statistiques récupérées avec succès')
    );
  });

  // Méthodes utilitaires privées

  async validateMessageByType(messageType, content, file) {
    switch (messageType) {
      case 'text':
        if (!content || content.trim().length === 0) {
          throw new ApiError(400, 'Le contenu est requis pour les messages texte');
        }
        if (content.length > 10000) {
          throw new ApiError(400, 'Le message est trop long (max 10000 caractères)');
        }
        break;
      
      case 'image':
        if (!file) {
          throw new ApiError(400, 'Fichier requis pour les messages image');
        }
        if (!file.mimetype.startsWith('image/')) {
          throw new ApiError(400, 'Le fichier doit être une image');
        }
        if (file.size > 10 * 1024 * 1024) { // 10MB
          throw new ApiError(400, 'L\'image est trop volumineuse (max 10MB)');
        }
        break;
      
      case 'video':
        if (!file) {
          throw new ApiError(400, 'Fichier requis pour les messages vidéo');
        }
        if (!file.mimetype.startsWith('video/')) {
          throw new ApiError(400, 'Le fichier doit être une vidéo');
        }
        if (file.size > 100 * 1024 * 1024) { // 100MB
          throw new ApiError(400, 'La vidéo est trop volumineuse (max 100MB)');
        }
        break;
      
      case 'audio':
        if (!file) {
          throw new ApiError(400, 'Fichier requis pour les messages audio');
        }
        if (!file.mimetype.startsWith('audio/')) {
          throw new ApiError(400, 'Le fichier doit être un audio');
        }
        if (file.size > 25 * 1024 * 1024) { // 25MB
          throw new ApiError(400, 'L\'audio est trop volumineux (max 25MB)');
        }
        break;
      
      case 'document':
        if (!file) {
          throw new ApiError(400, 'Fichier requis pour les messages document');
        }
        const allowedDocTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (!allowedDocTypes.includes(file.mimetype)) {
          throw new ApiError(400, 'Type de document non supporté');
        }
        if (file.size > 50 * 1024 * 1024) { // 50MB
          throw new ApiError(400, 'Le document est trop volumineux (max 50MB)');
        }
        break;
      
      case 'location':
        if (!content) {
          throw new ApiError(400, 'Les données de localisation sont requises');
        }
        try {
          const locationData = JSON.parse(content);
          if (!locationData.latitude || !locationData.longitude) {
            throw new ApiError(400, 'Latitude et longitude requises');
          }
        } catch (error) {
          throw new ApiError(400, 'Format de localisation invalide');
        }
        break;
      
      default:
        throw new ApiError(400, 'Type de message non supporté');
    }
  }

  async verifyConversationAccess(conversationId, userId) {
    const conversation = await this.chatService.getConversationById(conversationId);
    if (!conversation) {
      throw new ApiError(404, 'Conversation non trouvée');
    }
    
    const hasAccess = conversation.participants.some(
      participant => participant.toString() === userId
    );
    
    if (!hasAccess) {
      throw new ApiError(403, 'Accès à la conversation non autorisé');
    }
    
    return conversation;
  }
}
export default ChatController;
