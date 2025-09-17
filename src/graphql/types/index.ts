export const typeDefs = `#graphql
  scalar Date
  scalar Upload

  type Query {
    # Property Queries
    property(id: ID!): Property
    properties(filters: PropertyFilters, pagination: PaginationInput): PropertyConnection!
    
    # Service Queries  
    service(id: ID!): Service
    services(filters: ServiceFilters, pagination: PaginationInput): ServiceConnection!
    serviceRecommendations(input: RecommendationInput!): [ServiceRecommendation!]!
    
    # User Queries
    user(id: ID!): User
    me: User
    
    # Wallet Queries
    wallet: Wallet
    transaction(id: ID!): Transaction
    
    # Chat Queries
    conversation(id: ID!): Conversation
    conversations(pagination: PaginationInput): ConversationConnection!
    
    # Activity Queries
    activities(propertyId: ID, userId: ID, pagination: PaginationInput): ActivityConnection!
  }

  type Mutation {
    # Property Mutations
    createProperty(input: CreatePropertyInput!): Property!
    updateProperty(id: ID!, input: UpdatePropertyInput!): Property!
    
    # Service Mutations
    createService(input: CreateServiceInput!): Service!
    subscribeToService(input: SubscribeServiceInput!): ServiceSubscription!
    
    # Wallet Mutations
    createTransaction(input: CreateTransactionInput!): Transaction!
    transferMoney(input: TransferMoneyInput!): Transaction!
    
    # Chat Mutations
    sendMessage(input: SendMessageInput!): Message!
    
    # Activity Mutations
    createActivity(input: CreateActivityInput!): Activity!
    updateActivityStatus(id: ID!, status: ActivityStatus!): Activity!
  }

  type Subscription {
    messageAdded(conversationId: ID!): Message!
    activityUpdated(propertyId: ID!): Activity!
    walletUpdated(userId: ID!): WalletUpdate!
    serviceRecommendationUpdated(userId: ID!): ServiceRecommendation!
  }

  # Core Types
  type User {
    id: ID!
    firstName: String!
    lastName: String!
    fullName: String!
    email: String!
    username: String!
    profilePicture: String
    role: UserRole!
    isActive: Boolean!
    lastActive: Date
    presenceStatus: PresenceStatus!
    
    # Relations
    properties: [Property!]!
    activities: [Activity!]!
    wallet: Wallet
    conversations: [Conversation!]!
    serviceSubscriptions: [ServiceSubscription!]!
    serviceProvider: ServiceProvider
  }

  type Property {
    id: ID!
    title: String!
    description: String!
    address: String!
    propertyType: PropertyType!
    actionType: ActionType!
    status: PropertyStatus!
    images: [String!]!
    availableFrom: Date!
    
    # Nested Objects
    generalHInfo: GeneralHouseInfo!
    ownerCriteria: OwnerCriteria!
    
    # Relations
    owner: User!
    activities: [Activity!]!
    services: [Service!]!
    conversations: [Conversation!]!
    
    # Computed Fields
    pricePerSquareMeter: Float!
    isAvailable: Boolean!
    recommendedServices: [ServiceRecommendation!]!
  }

  type Service {
    id: ID!
    title: String!
    description: String!
    category: ServiceCategory!
    contractTypes: [ContractType!]!
    pricing: ServicePricing!
    requirements: ServiceRequirements!
    availability: ServiceAvailability!
    media: ServiceMedia!
    tags: [String!]!
    status: ServiceStatus!
    rating: Float!
    totalReviews: Int!
    
    # Relations
    provider: ServiceProvider!
    subscriptions: [ServiceSubscription!]!
    reviews: [ServiceReview!]!
    
    # Computed Fields
    isAvailableForProperty(propertyId: ID!): Boolean!
    estimatedPrice(propertyType: PropertyType!): Float!
  }

  type ServiceProvider {
    id: ID!
    user: User!
    companyName: String
    description: String!
    certifications: [String!]!
    rating: Float!
    totalReviews: Int!
    isVerified: Boolean!
    availableZones: [String!]!
    
    # Relations
    services: [Service!]!
  }

  type ServiceSubscription {
    id: ID!
    contractType: ContractType!
    status: SubscriptionStatus!
    startDate: Date!
    endDate: Date
    pricing: SubscriptionPricing!
    autoRenewal: Boolean!
    sharedWith: [User!]!
    
    # Relations
    user: User!
    property: Property!
    service: Service!
    paymentHistory: [Payment!]!
  }

  type ServiceRecommendation {
    service: Service!
    score: Float!
    reason: String!
    urgency: RecommendationUrgency!
    category: ServiceCategory!
    estimatedPrice: Float!
    neighborhoodData: NeighborhoodInsight
  }

  type Wallet {
    id: ID!
    balance: Float!
    pendingBalance: Float!
    currency: String!
    cryptoBalances: [CryptoBalance!]!
    
    # Relations
    user: User!
    transactions(type: TransactionType, limit: Int): [Transaction!]!
    paymentMethods: [PaymentMethod!]!
  }

  type Transaction {
    id: ID!
    type: TransactionType!
    amount: Float!
    currency: String!
    description: String!
    status: TransactionStatus!
    createdAt: Date!
    
    # Relations
    user: User!
    recipient: User
    relatedProperty: Property
    relatedService: Service
    paymentMethod: PaymentMethod
  }

  type Conversation {
    id: ID!
    participants: [User!]!
    lastMessage: Message
    unreadCount(userId: ID!): Int!
    
    # Relations
    messages(limit: Int, offset: Int): [Message!]!
    property: Property
  }

  type Message {
    id: ID!
    content: String!
    messageType: MessageType!
    status: MessageStatus!
    createdAt: Date!
    
    # Relations
    sender: User!
    conversation: Conversation!
    replyTo: Message
    property: Property
    
    # AI Features
    aiInsights: AIInsight
  }

  type Activity {
    id: ID!
    isVisited: Boolean!
    visitDate: Date
    isVisiteAcccepted: Boolean!
    isReservation: Boolean!
    message: String!
    reservationDate: Date
    isReservationAccepted: Boolean!
    booking: Boolean!
    isBookingAccepted: Boolean!
    isPayment: Boolean!
    amount: Float!
    
    # Relations
    property: Property!
    client: User!
    uploadedFiles: [UploadedFile!]!
  }

  # Input Types
  input PropertyFilters {
    propertyType: PropertyType
    actionType: ActionType
    minPrice: Float
    maxPrice: Float
    minBedrooms: Int
    maxBedrooms: Int
    area: String
    status: PropertyStatus
  }

  input ServiceFilters {
    category: ServiceCategory
    location: String
    propertyType: PropertyType
    priceRange: PriceRangeInput
    contractType: ContractType
  }

  input RecommendationInput {
    propertyType: PropertyType!
    location: LocationInput!
    userProfile: UserProfileInput!
    servicesAlreadySubscribed: [ID!]!
    seasonalContext: String
  }

  input CreatePropertyInput {
    title: String!
    description: String!
    address: String!
    propertyType: PropertyType!
    actionType: ActionType!
    images: [String!]!
    generalHInfo: GeneralHouseInfoInput!
    ownerCriteria: OwnerCriteriaInput!
  }

  input CreateServiceInput {
    title: String!
    description: String!
    category: ServiceCategory!
    contractTypes: [ContractType!]!
    pricing: ServicePricingInput!
    requirements: ServiceRequirementsInput!
    availability: ServiceAvailabilityInput!
    tags: [String!]!
  }

  input CreateTransactionInput {
    type: TransactionType!
    amount: Float!
    description: String!
    recipientId: ID
    paymentMethodId: ID
  }

  input SendMessageInput {
    conversationId: ID!
    content: String!
    messageType: MessageType!
    replyToId: ID
    propertyId: ID
  }

  input CreateActivityInput {
    propertyId: ID!
    message: String!
    isVisited: Boolean
    visitDate: Date
    isReservation: Boolean
  }

  # Enums
  enum UserRole {
    CLIENT
    AGENT
    ADMIN
    OWNER
  }

  enum PropertyType {
    VILLA
    APARTMENT
    HOME
    PENTHOUSE
    STUDIO
    LOFT
    BUREAU
    CHALET
    HOTEL
    TERRAIN
    COMMERCIAL
  }

  enum ActionType {
    RENT
    SELL
  }

  enum PropertyStatus {
    AVAILABLE
    RENTED
    SOLD
    MAINTENANCE
    DRAFT
  }

  enum ServiceCategory {
    MAINTENANCE
    CLEANING
    SECURITY
    GARDENING
    INSURANCE
    UTILITIES
    WELLNESS
    EMERGENCY
    ECO
    TECH
    COLLABORATIVE
  }

  enum ContractType {
    SHORT_TERM
    LONG_TERM
    SEASONAL
    ON_DEMAND
    EMERGENCY
  }

  enum ServiceStatus {
    ACTIVE
    INACTIVE
    PENDING
    SUSPENDED
  }

  enum SubscriptionStatus {
    ACTIVE
    PAUSED
    CANCELLED
    COMPLETED
  }

  enum TransactionType {
    PAYMENT
    RECEIVED
    CRYPTO
    DEPOSIT
    WITHDRAWAL
  }

  enum TransactionStatus {
    COMPLETED
    PENDING
    FAILED
    CANCELLED
  }

  enum MessageType {
    TEXT
    IMAGE
    VIDEO
    AUDIO
    DOCUMENT
    LOCATION
    PROPERTY
    VOICE_NOTE
  }

  enum ActivityStatus {
    PENDING
    ACCEPTED
    REFUSED
    COMPLETED
  }

  enum PresenceStatus {
    ONLINE
    AWAY
    OFFLINE
  }

  enum RecommendationUrgency {
    LOW
    MEDIUM
    HIGH
  }

  # Complex Types
  type GeneralHouseInfo {
    rooms: Int!
    bedrooms: Int!
    bathrooms: Int!
    toilets: Int!
    surface: Float!
    area: String!
    furnished: Boolean!
    pets: Boolean!
    smoking: Boolean!
    maxOccupants: Int!
  }

  type OwnerCriteria {
    monthlyRent: Float!
    isGarantRequired: Boolean!
    depositAmount: Float!
    minimumDuration: Int!
    guarantorRequired: Boolean!
    acceptedSituations: [String!]!
  }

  type ServicePricing {
    basePrice: Float!
    currency: String!
    billingPeriod: String!
    discounts: ServiceDiscounts
  }

  type ServiceDiscounts {
    longTerm: Float
    seasonal: Float
    bulk: Float
  }

  type ServiceRequirements {
    propertyTypes: [PropertyType!]!
    minContractDuration: Int
    maxContractDuration: Int
    isMandatory: Boolean!
    isOptional: Boolean!
  }

  type ServiceAvailability {
    zones: [String!]!
    schedule: ServiceSchedule!
    isEmergency: Boolean!
  }

  type ServiceSchedule {
    days: [String!]!
    hours: String!
  }

  type ServiceMedia {
    photos: [String!]!
    videos: [String!]!
    documents: [String!]!
  }

  type SubscriptionPricing {
    amount: Float!
    currency: String!
    billingPeriod: String!
  }

  type CryptoBalance {
    currency: String!
    amount: Float!
    value: Float!
  }

  type PaymentMethod {
    id: ID!
    type: String!
    name: String!
    isDefault: Boolean!
    isActive: Boolean!
  }

  type Payment {
    id: ID!
    amount: Float!
    date: Date!
    status: String!
  }

  type MessageStatus {
    sent: Date!
    delivered: [DeliveryStatus!]!
    read: [ReadStatus!]!
  }

  type DeliveryStatus {
    user: User!
    timestamp: Date!
  }

  type ReadStatus {
    user: User!
    timestamp: Date!
  }

  type AIInsight {
    sentiment: SentimentAnalysis
    intentDetection: String
    autoSuggestions: [String!]!
    priority: String!
  }

  type SentimentAnalysis {
    score: Float!
    label: String!
  }

  type UploadedFile {
    fileName: String!
    fileUrl: String!
    uploadedAt: Date!
  }

  type NeighborhoodInsight {
    popularServices: [String!]!
    averageRating: Float!
    totalUsers: Int!
  }

  # Connection Types for Pagination
  type PropertyConnection {
    edges: [PropertyEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PropertyEdge {
    node: Property!
    cursor: String!
  }

  type ServiceConnection {
    edges: [ServiceEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ServiceEdge {
    node: Service!
    cursor: String!
  }

  type ConversationConnection {
    edges: [ConversationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ConversationEdge {
    node: Conversation!
    cursor: String!
  }

  type ActivityConnection {
    edges: [ActivityEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ActivityEdge {
    node: Activity!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Subscription Types
  type WalletUpdate {
    wallet: Wallet!
    transaction: Transaction
    type: String!
  }

  # Additional Input Types
  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  input PriceRangeInput {
    min: Float!
    max: Float!
  }

  input LocationInput {
    city: String!
    district: String!
    coordinates: [Float!]
  }

  input UserProfileInput {
    preferences: [String!]!
    budget: Float!
    lifestyle: [String!]!
  }

  input GeneralHouseInfoInput {
    rooms: Int!
    bedrooms: Int!
    bathrooms: Int!
    toilets: Int!
    surface: Float!
    area: String!
    furnished: Boolean!
    pets: Boolean!
    smoking: Boolean!
    maxOccupants: Int!
  }

  input OwnerCriteriaInput {
    monthlyRent: Float!
    isGarantRequired: Boolean!
    depositAmount: Float!
    minimumDuration: Int!
    guarantorRequired: Boolean!
    acceptedSituations: [String!]!
  }

  input ServicePricingInput {
    basePrice: Float!
    currency: String!
    billingPeriod: String!
    discounts: ServiceDiscountsInput
  }

  input ServiceDiscountsInput {
    longTerm: Float
    seasonal: Float
    bulk: Float
  }

  input ServiceRequirementsInput {
    propertyTypes: [PropertyType!]!
    minContractDuration: Int
    maxContractDuration: Int
    isMandatory: Boolean!
    isOptional: Boolean!
  }

  input ServiceAvailabilityInput {
    zones: [String!]!
    schedule: ServiceScheduleInput!
    isEmergency: Boolean!
  }

  input ServiceScheduleInput {
    days: [String!]!
    hours: String!
  }

  input SubscribeServiceInput {
    serviceId: ID!
    propertyId: ID!
    contractType: ContractType!
    startDate: Date!
    endDate: Date
    autoRenewal: Boolean!
    sharedWith: [ID!]
  }

  input TransferMoneyInput {
    recipientId: ID!
    amount: Float!
    description: String!
    paymentMethodId: ID
  }

  input UpdatePropertyInput {
    title: String
    description: String
    address: String
    status: PropertyStatus
    generalHInfo: GeneralHouseInfoInput
    ownerCriteria: OwnerCriteriaInput
  }
`;