import { body, param, query, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { MessageType } from '../types/chatTypes';

// ============ CONSTANTES DE VALIDATION ============
const MESSAGE_CONTENT_MAX_LENGTH = 10000;
const SEARCH_QUERY_MIN_LENGTH = 2;
const SEARCH_QUERY_MAX_LENGTH = 100;
const EMOJI_REGEX = /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u;
const CONVERSATION_TYPES = ['direct', 'group', 'property_discussion'] as const;
const MESSAGE_TYPES: MessageType[] = ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'property', 'voice_note', 'ar_preview', 'virtual_tour'];
const PRIORITY_LEVELS = ['low', 'medium', 'normal', 'high', 'urgent'] as const;
const FILTER_OPTIONS = ['all', 'unread', 'groups', 'direct', 'archived'] as const;
const SORT_ORDERS = ['asc', 'desc'] as const;
const DELETE_OPTIONS = ['me', 'everyone'] as const;

// ============ MIDDLEWARE DE GESTION DES ERREURS ============
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : undefined,
        message: error.msg
      }))
    });
    return;
  }
  
  next();
};

// ============ VALIDATEURS RÉUTILISABLES ============
export const validate = {
  // Validation ObjectId MongoDB
  mongoId: (fieldName: string = 'id'): ValidationChain =>
    param(fieldName)
      .isMongoId()
      .withMessage(`${fieldName} invalide`),

  // Validation ObjectId dans le body
  mongoIdBody: (fieldName: string): ValidationChain =>
    body(fieldName)
      .optional()
      .isMongoId()
      .withMessage(`${fieldName} invalide`),

  // Validation du contenu de message
  messageContent: (): ValidationChain =>
    body('content')
      .trim()
      .isLength({ min: 1, max: MESSAGE_CONTENT_MAX_LENGTH })
      .withMessage(`Le contenu doit contenir entre 1 et ${MESSAGE_CONTENT_MAX_LENGTH} caractères`),

  // Validation du type de message
  messageType: (): ValidationChain =>
    body('messageType')
      .optional()
      .isIn(MESSAGE_TYPES)
      .withMessage('Type de message invalide'),

  // Validation de la priorité
  priority: (): ValidationChain =>
    body('priority')
      .optional()
      .isIn(PRIORITY_LEVELS)
      .withMessage('Niveau de priorité invalide'),

  // Validation du type de conversation
  conversationType: (): ValidationChain =>
    body('type')
      .optional()
      .isIn(CONVERSATION_TYPES)
      .withMessage('Type de conversation invalide'),

  // Validation de l'emoji
  emoji: (): ValidationChain =>
    body('emoji')
      .optional()
      .isString()
      .isLength({ min: 1, max: 10 })
      // .matches(EMOJI_REGEX)
      .withMessage('Format d\'emoji invalide'),

  // Validation de la recherche
  searchQuery: (): ValidationChain =>
    query('query')
      .trim()
      .isLength({ min: SEARCH_QUERY_MIN_LENGTH, max: SEARCH_QUERY_MAX_LENGTH })
      .withMessage(`La requête de recherche doit contenir entre ${SEARCH_QUERY_MIN_LENGTH} et ${SEARCH_QUERY_MAX_LENGTH} caractères`),

  // Validation de la pagination
  pagination: {
    page: (): ValidationChain =>
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Le numéro de page doit être un entier positif'),
    
    limit: (): ValidationChain =>
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('La limite doit être entre 1 et 100')
  },

  // Validation des filtres
  filter: (): ValidationChain =>
    query('filter')
      .optional()
      .isIn(FILTER_OPTIONS)
      .withMessage('Option de filtre invalide'),

  // Validation de l'ordre de tri
  sortOrder: (): ValidationChain =>
    query('sortOrder')
      .optional()
      .isIn(SORT_ORDERS)
      .withMessage('Ordre de tri invalide'),

  // Validation de la plage de dates
  dateRange: (): ValidationChain =>
    query('dateRange')
      .optional()
      .custom((value) => {
        if (!value) return true;
        
        try {
          const parsed = JSON.parse(value);
          if (!parsed.start || !parsed.end) {
            throw new Error('Les dates de début et de fin sont requises');
          }
          
          const startDate = new Date(parsed.start);
          const endDate = new Date(parsed.end);
          
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Format de date invalide');
          }
          
          if (startDate > endDate) {
            throw new Error('La date de début doit être antérieure à la date de fin');
          }
          
          return true;
        } catch (error) {
          throw new Error('Format de plage de dates invalide');
        }
      }),

  // Validation des données de localisation
  location: (): ValidationChain =>
    body('content')
      .custom((value) => {
        try {
          const locationData = JSON.parse(value);
          
          if (typeof locationData.latitude !== 'number' || 
              typeof locationData.longitude !== 'number') {
            throw new Error('Latitude et longitude doivent être des nombres');
          }
          
          if (locationData.latitude < -90 || locationData.latitude > 90) {
            throw new Error('Latitude invalide (doit être entre -90 et 90)');
          }
          
          if (locationData.longitude < -180 || locationData.longitude > 180) {
            throw new Error('Longitude invalide (doit être entre -180 et 180)');
          }
          
          return true;
        } catch (error) {
          throw new Error('Format de localisation invalide');
        }
      }),

  // Validation de l'option de suppression
  deleteOption: (): ValidationChain =>
    body('deleteFor')
      .optional()
      .isIn(DELETE_OPTIONS)
      .withMessage('Option de suppression invalide'),

  // Validation du statut de frappe
  typingStatus: (): ValidationChain =>
    body('isTyping')
      .optional()
      .isBoolean()
      .withMessage('Le statut de frappe doit être un booléen'),

  // Validation des mentions
  mentions: (): ValidationChain =>
    body('mentions')
      .optional()
      .isArray()
      .withMessage('Les mentions doivent être un tableau')
      .custom((mentions) => {
        if (!Array.isArray(mentions)) return false;
        
        return mentions.every((mention: any) => 
          typeof mention === 'string' && 
          /^[0-9a-fA-F]{24}$/.test(mention)
        );
      })
      .withMessage('Format des mentions invalide'),

  // Validation de la programmation d'envoi
  scheduleFor: (): ValidationChain =>
    body('scheduleFor')
      .optional()
      .isISO8601()
      .withMessage('Format de date de programmation invalide')
      .custom((value) => {
        const scheduledDate = new Date(value);
        const now = new Date();
        
        if (scheduledDate <= now) {
          throw new Error('La date de programmation doit être dans le futur');
        }
        
        return true;
      }),

  // Validation participant ID pour conversations directes
  participantId: (): ValidationChain =>
    body('participantId')
      .optional()
      .isMongoId()
      .withMessage('ID du participant invalide')
      .custom((value, { req }) => {
        // Vérifier que l'utilisateur ne crée pas une conversation avec lui-même
        if (req.user && value === req.user.userId) {
          throw new Error('Impossible de créer une conversation avec soi-même');
        }
        return true;
      }),

  // Validation conditionelle pour les conversations directes
  directConversationRequired: (): ValidationChain =>
    body('participantId')
      .if(body('type').equals('direct'))
      .notEmpty()
      .withMessage('participantId requis pour les conversations directes')
      .isMongoId()
      .withMessage('ID du participant invalide'),

  // Validation des données de propriété
  propertyId: (): ValidationChain =>
    body('propertyId')
      .optional()
      .isMongoId()
      .withMessage('ID de propriété invalide'),

  // Validation du type de réaction
  reactionType: (): ValidationChain =>
    body('reactionType')
      .notEmpty()
      .withMessage('Type de réaction requis')
      .isIn(['emoji', 'custom', 'like', 'love', 'haha', 'wow', 'sad', 'angry'])
      .withMessage('Type de réaction invalide'),

  // Validation de la réaction personnalisée
  customReaction: (): ValidationChain =>
    body('customReaction')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Réaction personnalisée invalide'),
};

// ============ VALIDATIONS COMPOSÉES ============
const chatValidationRules = {
  // Création de conversation
  createConversation: [
    validate.conversationType(),
    validate.participantId(),
    validate.directConversationRequired(),
    validate.propertyId(),
    handleValidationErrors
  ],

  // Récupération des conversations
  getUserConversations: [
    validate.pagination.page(),
    validate.pagination.limit(),
    validate.filter(),
    validate.sortOrder(),
    handleValidationErrors
  ],

  // Envoi de message
  sendMessage: [
    validate.mongoIdBody('conversationId'),
    validate.messageContent(),
    validate.messageType(),
    validate.priority(),
    validate.mongoIdBody('replyTo'),
    validate.scheduleFor(),
    validate.mentions(),
    handleValidationErrors
  ],

  // Envoi de message avec localisation
  sendLocationMessage: [
    validate.mongoId('conversationId'),
    validate.location(),
    validate.messageType(),
    validate.priority(),
    handleValidationErrors
  ],

  // Récupération des messages
  getMessages: [
    validate.mongoId('conversationId'),
    validate.pagination.page(),
    validate.pagination.limit(),
    query('messageType').optional().isIn(MESSAGE_TYPES).withMessage('Type de message invalide'),
    validate.dateRange(),
    query('searchQuery').optional().trim().isLength({ min: 2 }).withMessage('Requête de recherche trop courte'),
    handleValidationErrors
  ],

  // Réaction à un message
  reactToMessage: [
    validate.mongoId('messageId'),
    validate.mongoId('conversationId'),
    // validate.reactionType(),
    validate.emoji(),
    validate.customReaction(),
    body().custom((_, { req }) => {
      const { emoji, customReaction } = req.body;
      if (!emoji && !customReaction) {
        throw new Error('Emoji ou réaction personnalisée requis');
      }
      return true;
    }),
    handleValidationErrors
  ],

  // Suppression de message
  deleteMessage: [
    validate.mongoId('messageId'),
    validate.mongoId('conversationId'),
    validate.deleteOption(),
    body('reason').optional().isLength({ max: 500 }).withMessage('Raison de suppression trop longue'),
    handleValidationErrors
  ],

  // Restauration de message
  restoreMessage: [
    validate.mongoId('messageId'),
    handleValidationErrors
  ],

  // Recherche de messages
  searchMessages: [
    validate.searchQuery(),
    query('conversationId').optional().isMongoId().withMessage('ID de conversation invalide'),
    query('messageType').optional().isIn(MESSAGE_TYPES).withMessage('Type de message invalide'),
    validate.dateRange(),
    validate.pagination.page(),
    validate.pagination.limit(),
    handleValidationErrors
  ],

  // Marquer comme lu
  markAsRead: [
    validate.mongoId('conversationId'),
    handleValidationErrors
  ],

  // Gestion du statut de frappe
  handleTyping: [
    body('conversationId').notEmpty().isMongoId().withMessage('ID de conversation requis'),
    validate.typingStatus(),
    handleValidationErrors
  ],

  // Archivage de conversation
  archiveConversation: [
    validate.mongoId('conversationId'),
    handleValidationErrors
  ],

  // Statistiques de conversation
  getConversationStats: [
    validate.mongoId('conversationId'),
    handleValidationErrors
  ],

  // Validation générale des paramètres
  validateParams: [
    validate.mongoId('conversationId'),
    handleValidationErrors
  ],

  // Validation pour les uploads de fichiers
  validateFileUpload: [
    validate.mongoId('conversationId'),
    validate.messageType(),
    body('content').optional().trim(),
    handleValidationErrors
  ]
};

export default chatValidationRules;