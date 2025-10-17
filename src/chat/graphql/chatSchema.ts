import gql from 'graphql-tag';

export const chatTypeDefs = gql`
  # ==================== TYPES ====================

  type User {
    id: ID!
    firstName: String!
    lastName: String!
    profilePicture: String
    email: String!
    presenceStatus: PresenceStatus
    lastActive: String
    isOnline: Boolean
  }

  type Property {
    id: ID!
    title: String!
    address: String
    images: [String!]
    price: Float
    location: Location
  }

  type Location {
    type: String!
    coordinates: [Float!]!
    address: String
  }

  type Conversation {
    id: ID!
    participants: [User!]!
    type: ConversationType!
    propertyId: Property
    lastMessage: Message
    unreadCount(userId: ID!): Int
    messages(limit: Int = 50, offset: Int = 0, filters: MessageFilters): [Message!]
    createdAt: String!
    updatedAt: String!
    property: Property
    stats: ConversationStats
    onlineParticipants: [User!]
    isArchivedFor(userId: ID!): Boolean
    settings: ConversationSettings
  }

  type ConversationSettings {
    encryption: Boolean
    disappearingMessages: DisappearingMessagesSettings
    smartReply: Boolean
    translation: Boolean
    voiceTranscription: Boolean
    readReceipts: Boolean
    typingIndicators: Boolean
  }

  type DisappearingMessagesSettings {
    enabled: Boolean
    duration: Int
  }

  type ConversationStats {
    conversationId: ID!
    participantsCount: Int!
    messageCount: Int!
    totalReactions: Int!
    lastActivity: String!
  }

  type Message {
    id: ID!
    conversationId: ID!
    sender: User!
    content: String
    messageType: MessageType!
    mediaData: MediaData
    mentions: [User!]
    replyTo: Message
    reactions: [Reaction!]
    aiInsights: AIInsight
    status: MessageStatus!
    createdAt: String!
    updatedAt: String!
    isEdited: Boolean
    editHistory: [MessageEdit!]
    readStatus(userId: ID!): String
    sentimentAnalysis: SentimentAnalysis
    property: Property
    conversation: Conversation
    isDeleted: Boolean
    deletedAt: String
    deletedBy: ID
  }

  type MediaData {
    filename: String!
    originalName: String!
    size: Int!
    mimetype: String!
    uploadedAt: String!
    dimensions: MediaDimensions
    variants: [MediaVariant!]
  }

  type MediaDimensions {
    width: Int!
    height: Int!
  }

  type MediaVariant {
    size: String!
    path: String!
  }

  type MessageStatus {
    sent: String
    delivered: [DeliveryStatus!]
    read: [ReadStatus!]
  }

  type DeliveryStatus {
    userId: ID!
    deliveredAt: String!
  }

  type ReadStatus {
    userId: ID!
    readAt: String!
  }

  type Reaction {
    userId: ID!
    emoji: String!
    timestamp: String!
  }

  type AIInsight {
    sentiment: SentimentAnalysis
    intentDetection: String
    autoSuggestions: [String!]
    priority: MessagePriority!
    confidence: Float!
    language: String!
    topics: [String!]
    entities: [String!]
  }

  type SentimentAnalysis {
    score: Float!
    label: SentimentLabel!
  }

  type MessageEdit {
    content: String!
    editedAt: String!
    reason: String
  }

  # ==================== INPUTS ====================

  input ConversationInput {
    participantId: ID
    type: ConversationType = DIRECT
    propertyId: ID
  }

  input SendMessageInput {
    conversationId: ID!
    content: String!
    messageType: MessageType = TEXT
    replyToId: ID
    mentions: [ID!] = []
    scheduleFor: String
    priority: MessagePriority = NORMAL
  }

  input MessageFilters {
    messageType: MessageType
    senderId: ID
    dateRange: DateRangeInput
  }

  input DateRangeInput {
    start: String
    end: String
  }

  input ReactionInput {
    messageId: ID!
    conversationId: ID!
    reactionType: String!
  }

  input DeleteMessageInput {
    messageId: ID!
    conversationId: ID!
    deleteType: DeleteType = SOFT
    deleteFor: DeleteScope = ME
  }

  input PaginationInput {
    first: Int
    after: String
  }

  input ConversationSearchFilters {
    type: ConversationType
  }

  # ==================== ENUMS ====================

  enum ConversationType {
    DIRECT
    GROUP
    PROPERTY_DISCUSSION
  }

  enum MessageType {
    TEXT
    IMAGE
    VIDEO
    AUDIO
    DOCUMENT
    LOCATION
    CONTACT
    PROPERTY
    VOICE_NOTE
    AR_PREVIEW
    VIRTUAL_TOUR
  }

  enum MessagePriority {
    LOW
    NORMAL
    HIGH
    URGENT
  }

  enum SentimentLabel {
    POSITIVE
    NEGATIVE
    NEUTRAL
  }

  enum PresenceStatus {
    ONLINE
    OFFLINE
    AWAY
    BUSY
  }

  enum DeleteType {
    SOFT
    HARD
  }

  enum DeleteScope {
    ME
    EVERYONE
  }

  # ==================== CONNECTION TYPES ====================

  type ConversationConnection {
    edges: [ConversationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ConversationEdge {
    node: Conversation!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # ==================== QUERIES ====================

  type Query {
    # Récupérer une conversation spécifique
    conversation(id: ID!): Conversation

    # Lister toutes les conversations de l'utilisateur
    conversations(pagination: PaginationInput): ConversationConnection!

    # Rechercher dans les conversations
    searchConversations(
      query: String!
      filters: ConversationSearchFilters
    ): [Conversation!]!

    # Statistiques d'une conversation
    conversationAnalytics(conversationId: ID!): ConversationStats

    # Rechercher dans les messages
    searchMessages(
      query: String!
      conversationId: ID
      messageType: MessageType
      dateRange: DateRangeInput
      limit: Int = 20
    ): [Message!]!

    # Obtenir les messages d'une conversation
    getMessages(
      conversationId: ID!
      limit: Int = 50
      offset: Int = 0
      filters: MessageFilters
    ): [Message!]!
  }

  # ==================== MUTATIONS ====================

  type Mutation {
    # Envoyer un message
    sendMessage(input: SendMessageInput!): Message!

    # Créer ou récupérer une conversation
    createOrGetConversation(input: ConversationInput!): Conversation!

    # Réagir à un message
    reactToMessage(input: ReactionInput!): Message!

    # Marquer les messages comme lus
    markMessagesAsRead(conversationId: ID!, messageIds: [ID!]): Boolean!

    # Supprimer un message
    deleteMessage(input: DeleteMessageInput!): Boolean!

    # Restaurer un message supprimé
    restoreMessage(messageId: ID!): Boolean!

    # Archiver une conversation
    archiveConversation(conversationId: ID!): Conversation!

    # Désarchiver une conversation
    unarchiveConversation(conversationId: ID!): Conversation!

    # Mettre à jour le statut de frappe
    updateTypingStatus(conversationId: ID!, isTyping: Boolean!): Boolean!

    # Épingler/Désépingler un message
    togglePinMessage(messageId: ID!): Boolean!

    # Éditer un message
    editMessage(messageId: ID!, newContent: String!, reason: String): Message!

    # Transférer un message
    forwardMessage(messageId: ID!, targetConversationIds: [ID!]!): Boolean!
  }

  # ==================== SUBSCRIPTIONS ====================

  type Subscription {
    # Nouveau message dans une conversation
    messageAdded(conversationId: ID!): Message!

    # Réaction ajoutée à un message
    messageReaction(conversationId: ID!): MessageReactionEvent!

    # Message supprimé
    messageDeleted(conversationId: ID!): MessageDeletedEvent!

    # Message restauré
    messageRestored(conversationId: ID!): MessageRestoredEvent!

    # Conversation mise à jour
    conversationUpdated(userId: ID!): Conversation!

    # Statut de frappe
    typingStatus(conversationId: ID!): TypingStatusEvent!

    # Utilisateur en ligne/hors ligne
    presenceStatus(userId: ID!): PresenceStatusEvent!

    # Messages marqués comme lus
    messagesMarkedAsRead(conversationId: ID!): MessagesReadEvent!
  }

  # ==================== SUBSCRIPTION EVENT TYPES ====================

  type MessageReactionEvent {
    messageId: ID!
    userId: ID!
    reactionType: String!
    reactions: [Reaction!]!
    timestamp: String!
  }

  type MessageDeletedEvent {
    messageId: ID!
    deleteFor: DeleteScope!
    deletedBy: ID!
    timestamp: String!
  }

  type MessageRestoredEvent {
    messageId: ID!
    restoredBy: ID!
    timestamp: String!
  }

  type TypingStatusEvent {
    userId: ID!
    isTyping: Boolean!
    typingUsers: [ID!]!
    timestamp: String!
  }

  type PresenceStatusEvent {
    userId: ID!
    status: PresenceStatus!
    lastSeen: String
    timestamp: String!
  }

  type MessagesReadEvent {
    userId: ID!
    messageIds: [ID!]!
    timestamp: String!
  }
`;