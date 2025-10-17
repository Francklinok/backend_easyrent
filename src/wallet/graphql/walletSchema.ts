import gql from 'graphql-tag';

export const walletTypeDefs = gql`
  enum TransactionType {
    payment
    received
    crypto
    deposit
    withdrawal
  }

  enum TransactionStatus {
    completed
    pending
    failed
    cancelled
  }

  enum PaymentMethodType {
    card
    bank
    paypal
    mobile_money
    crypto
  }

  enum CryptoCurrency {
    BTC
    ETH
    LTC
    BCH
    XRP
    ADA
    DOT
  }

  enum NotificationType {
    wallet
    property
    service
    general
    security
    reminder
  }

  enum NotificationCategory {
    transaction
    payment
    transfer
    rent
    reservation
    maintenance
    message
    alert
  }

  enum NotificationPriority {
    low
    medium
    high
    urgent
  }

  enum DeliveryStatus {
    pending
    delivered
    failed
    not_sent
  }

  type Wallet {
    id: ID!
    userId: ID!
    balance: Float!
    pendingBalance: Float!
    currency: String!
    cryptoBalances: [CryptoBalance!]!
    createdAt: String!
    updatedAt: String!

    # Relations
    user: User
    transactions(type: TransactionType, limit: Int = 50): [Transaction!]!
    paymentMethods: [PaymentMethod!]!

    # Computed fields
    totalBalance: Float!
    formattedBalance: String!
    recentTransactions(limit: Int = 10): [Transaction!]!
  }

  type CryptoBalance {
    currency: CryptoCurrency!
    amount: Float!
    value: Float!
    formattedValue: String!
  }

  type Transaction {
    id: ID!
    userId: ID!
    type: TransactionType!
    amount: Float!
    currency: String!
    description: String!
    status: TransactionStatus!
    paymentMethodId: ID
    cryptoCurrency: CryptoCurrency
    recipientId: ID
    metadata: TransactionMetadata
    createdAt: String!
    updatedAt: String!

    # Relations
    user: User
    recipient: User
    paymentMethod: PaymentMethod
    relatedProperty: Property
    relatedService: Service

    # Computed fields
    formattedAmount: String!
    isIncoming: Boolean!
    statusColor: String!
  }

  type TransactionMetadata {
    propertyId: ID
    serviceId: ID
    subscriptionId: ID
    reservationId: ID
    contractId: ID
    fees: TransactionFees
    exchangeRate: Float
    originalAmount: Float
    originalCurrency: String
    reference: String
    notes: String
  }

  type TransactionFees {
    platform: Float
    payment: Float
    conversion: Float
    total: Float
  }

  type PaymentMethod {
    id: ID!
    userId: ID!
    type: PaymentMethodType!
    name: String!
    details: PaymentMethodDetails!
    isDefault: Boolean!
    isActive: Boolean!
    createdAt: String!

    # Relations
    user: User

    # Computed fields
    displayName: String!
    maskedDetails: String!
  }

  type PaymentMethodDetails {
    last4: String
    expiry: String
    iban: String
    email: String
    phoneNumber: String
    cryptoAddress: String
    brand: String
    country: String
  }

  # Types pour les notifications
  type Notification {
    id: ID!
    userId: ID!
    type: NotificationType!
    category: NotificationCategory!
    title: String!
    message: String!
    isRead: Boolean!
    priority: NotificationPriority!
    channels: NotificationChannels!
    metadata: NotificationMetadata
    scheduledFor: String
    sentAt: NotificationSentAt
    deliveryStatus: NotificationDeliveryStatus!
    createdAt: String!
    updatedAt: String!

    # Relations
    user: User
  }

  type NotificationChannels {
    inApp: Boolean!
    push: Boolean!
    email: Boolean!
    sms: Boolean!
  }

  type NotificationSentAt {
    inApp: String
    push: String
    email: String
    sms: String
  }

  type NotificationDeliveryStatus {
    inApp: DeliveryStatus!
    push: DeliveryStatus!
    email: DeliveryStatus!
    sms: DeliveryStatus!
  }

  type NotificationMetadata {
    transactionId: ID
    propertyId: ID
    serviceId: ID
    amount: Float
    currency: String
    actionUrl: String
    imageUrl: String
    data: JSON
  }

  type NotificationPreference {
    id: ID!
    userId: ID!
    preferences: UserNotificationPreferences!
    quietHours: QuietHours!
    pushToken: String
    deviceInfo: DeviceInfo
    createdAt: String!
    updatedAt: String!
  }

  type UserNotificationPreferences {
    wallet: ChannelPreferences!
    property: ChannelPreferences!
    service: ChannelPreferences!
    general: ChannelPreferences!
    security: ChannelPreferences!
    reminder: ChannelPreferences!
  }

  type ChannelPreferences {
    inApp: Boolean!
    push: Boolean!
    email: Boolean!
    sms: Boolean!
  }

  type QuietHours {
    enabled: Boolean!
    startTime: String!
    endTime: String!
    timezone: String!
  }

  type DeviceInfo {
    platform: String!
    deviceId: String!
    appVersion: String!
  }

  # Types pour les statistiques
  type WalletStats {
    totalTransactions: Int!
    totalVolume: Float!
    averageTransaction: Float!
    transactionsByType: [TransactionTypeStat!]!
    transactionsByStatus: [TransactionStatusStat!]!
    monthlyVolume: [MonthlyVolumeStat!]!
    topPaymentMethods: [PaymentMethodStat!]!
  }

  type TransactionTypeStat {
    type: TransactionType!
    count: Int!
    volume: Float!
    percentage: Float!
  }

  type TransactionStatusStat {
    status: TransactionStatus!
    count: Int!
    percentage: Float!
  }

  type MonthlyVolumeStat {
    month: String!
    volume: Float!
    transactions: Int!
  }

  type PaymentMethodStat {
    method: String!
    count: Int!
    volume: Float!
    percentage: Float!
  }

  type NotificationsConnection {
    edges: [NotificationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
    unreadCount: Int!
  }

  type NotificationEdge {
    node: Notification!
    cursor: String!
  }

  type TransactionConnection {
    edges: [TransactionEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type TransactionEdge {
    node: Transaction!
    cursor: String!
  }

  # Enhanced Wallet Types
  type EnhancedWallet {
    id: ID!
    userId: ID!
    fiatCurrencies: [FiatCurrency!]!
    cryptoCurrencies: [EnhancedCryptoBalance!]!
    paymentMethods: [PaymentMethod!]!
    transactions: [Transaction!]!
    createdAt: String!
    updatedAt: String!
  }

  type FiatCurrency {
    code: String!
    name: String!
    balance: Float!
    isDefault: Boolean!
    lastUpdated: String!
  }

  type EnhancedCryptoBalance {
    symbol: String!
    name: String!
    balance: Float!
    balanceUSD: Float!
    balanceEUR: Float!
    lastUpdated: String!
  }

  # Currency & Validation Types
  type CurrencyConversion {
    fromCurrency: String!
    toCurrency: String!
    amount: Float!
    convertedAmount: Float!
    rate: Float!
    timestamp: String!
  }

  type TransactionValidation {
    isValid: Boolean!
    riskLevel: String!
    warnings: [String!]!
    recommendations: [String!]!
  }

  # Mobile Money Types
  type MobileMoneyProvider {
    id: ID!
    name: String!
    code: String!
    countryCode: String!
    supportedOperations: [String!]!
    fees: ProviderFees!
  }

  type ProviderFees {
    deposit: Float!
    withdrawal: Float!
    transfer: Float!
  }

  type PhoneValidation {
    isValid: Boolean!
    formatted: String!
    country: String!
    carrier: String
  }

  type MobileMoneyFees {
    amount: Float!
    fee: Float!
    total: Float!
    currency: String!
  }

  type Country {
    code: String!
    name: String!
    currency: String!
    supportedProviders: [String!]!
  }

  type CountryInfo {
    code: String!
    name: String!
    currency: String!
    providers: [MobileMoneyProvider!]!
    regulations: CountryRegulations
  }

  type CountryRegulations {
    maxTransactionAmount: Float!
    dailyLimit: Float!
    monthlyLimit: Float!
    requiresKYC: Boolean!
  }

  type UnifiedPaymentResponse {
    success: Boolean!
    transactionId: String!
    status: TransactionStatus!
    message: String
    error: String
  }

  # Inputs
  input UnifiedPaymentInput {
    amount: Float!
    currency: String!
    paymentMethodId: ID!
    type: TransactionType
    description: String
    recipientId: ID
    cryptoData: CryptoDataInput
  }

  input CryptoDataInput {
    network: String!
    toAddress: String!
  }

  input PurchaseCryptoUnifiedInput {
    amount: Float!
    currency: String!
    cryptoCurrency: String!
    paymentMethod: ID!
  }

  # Inputs
  input CreateTransactionInput {
    type: TransactionType!
    amount: Float!
    currency: String = "EUR"
    description: String!
    paymentMethodId: ID
    cryptoCurrency: CryptoCurrency
    recipientId: ID
    metadata: TransactionMetadataInput
  }

  input TransactionMetadataInput {
    propertyId: ID
    serviceId: ID
    subscriptionId: ID
    reservationId: ID
    contractId: ID
    reference: String
    notes: String
  }

  input TransferMoneyInput {
    recipientId: ID!
    amount: Float!
    currency: String = "EUR"
    description: String!
    paymentMethodId: ID
  }

  input CreatePaymentMethodInput {
    type: PaymentMethodType!
    name: String!
    details: PaymentMethodDetailsInput!
    isDefault: Boolean = false
  }

  input PaymentMethodDetailsInput {
    last4: String
    expiry: String
    iban: String
    email: String
    phoneNumber: String
    cryptoAddress: String
    brand: String
    country: String
  }

  input BuyCryptoInput {
    currency: CryptoCurrency!
    amount: Float!
    paymentMethodId: ID!
  }

  input SellCryptoInput {
    currency: CryptoCurrency!
    amount: Float!
    paymentMethodId: ID
  }

  input CreateNotificationInput {
    type: NotificationType!
    category: NotificationCategory!
    title: String!
    message: String!
    priority: NotificationPriority = medium
    metadata: NotificationMetadataInput
    scheduledFor: String
    forceChannels: NotificationChannelsInput
  }

  input NotificationMetadataInput {
    transactionId: ID
    propertyId: ID
    serviceId: ID
    amount: Float
    currency: String
    actionUrl: String
    imageUrl: String
    data: JSON
  }

  input NotificationChannelsInput {
    inApp: Boolean
    push: Boolean
    email: Boolean
    sms: Boolean
  }

  input UpdateNotificationPreferencesInput {
    wallet: ChannelPreferencesInput
    property: ChannelPreferencesInput
    service: ChannelPreferencesInput
    general: ChannelPreferencesInput
    security: ChannelPreferencesInput
    reminder: ChannelPreferencesInput
    quietHours: QuietHoursInput
  }

  input ChannelPreferencesInput {
    inApp: Boolean
    push: Boolean
    email: Boolean
    sms: Boolean
  }

  input QuietHoursInput {
    enabled: Boolean
    startTime: String
    endTime: String
    timezone: String
  }

  input RegisterPushTokenInput {
    token: String!
    platform: String!
    deviceId: String!
    appVersion: String!
  }

  input NotificationFilters {
    type: NotificationType
    category: NotificationCategory
    isRead: Boolean
    priority: NotificationPriority
    dateFrom: String
    dateTo: String
  }

  input TransactionFilters {
    type: TransactionType
    status: TransactionStatus
    minAmount: Float
    maxAmount: Float
    currency: String
    dateFrom: String
    dateTo: String
    paymentMethodId: ID
  }

  extend type Query {
    # Wallet queries
    wallet: Wallet!
    enhancedWallet: EnhancedWallet
    transaction(id: ID!): Transaction
    transactions(filters: TransactionFilters, pagination: PaginationInput): TransactionConnection!
    paymentMethods: [PaymentMethod!]!
    walletStats(dateFrom: String, dateTo: String): WalletStats!

    # Notification queries
    notifications(filters: NotificationFilters, pagination: PaginationInput): NotificationsConnection!
    notificationPreferences: NotificationPreference!
    unreadNotificationsCount: Int!

    # Crypto queries
    cryptoPrices(currencies: [CryptoCurrency!]): [CryptoPrice!]!
    cryptoPortfolio: [CryptoBalance!]!
    cryptoConfig: CryptoConfig!

    # Currency & validation
    convertCurrency(fromCurrency: String!, toCurrency: String!, amount: Float!): CurrencyConversion
    validateTransaction(amount: Float!, currency: String!, paymentMethod: String!): TransactionValidation

    # Mobile Money queries
    getMobileMoneyProviders(countryCode: String): [MobileMoneyProvider!]!
    validatePhoneNumber(phoneNumber: String!, countryCode: String!): PhoneValidation
    calculateMobileMoneyFees(providerId: String!, amount: Float!, type: String!): MobileMoneyFees
    getSupportedCountries: [Country!]!
    getCountryInfo(countryCode: String!): CountryInfo
  }

  extend type Mutation {
    # Wallet mutations
    createTransaction(input: CreateTransactionInput!): Transaction!
    transferMoney(input: TransferMoneyInput!): Transaction!

    # Payment methods
    addPaymentMethod(input: CreatePaymentMethodInput!): PaymentMethod!
    updatePaymentMethod(id: ID!, input: CreatePaymentMethodInput!): PaymentMethod!
    deletePaymentMethod(id: ID!): Boolean!
    setDefaultPaymentMethod(id: ID!): PaymentMethod!

    # Crypto operations
    buyCrypto(input: BuyCryptoInput!): Transaction!
    sellCrypto(input: SellCryptoInput!): Transaction!

    # Unified payment operations
    processUnifiedPayment(request: UnifiedPaymentInput!): UnifiedPaymentResponse!
    purchaseCryptoUnified(input: PurchaseCryptoUnifiedInput!): UnifiedPaymentResponse!

    # Notification mutations
    createNotification(input: CreateNotificationInput!): Notification!
    markNotificationAsRead(id: ID!): Notification!
    markAllNotificationsAsRead: Int!
    deleteNotification(id: ID!): Boolean!
    updateNotificationPreferences(input: UpdateNotificationPreferencesInput!): NotificationPreference!
    registerPushToken(input: RegisterPushTokenInput!): Boolean!

    # Test mutations
    testPushNotification: Boolean!
  }

  extend type Subscription {
    # Wallet subscriptions
    walletUpdated: Wallet!
    transactionCreated: Transaction!
    transactionStatusChanged(transactionId: ID!): Transaction!

    # Notification subscriptions
    notificationReceived: Notification!
    notificationStatusChanged: Notification!

    # Real-time balance updates
    balanceUpdated: Wallet!
  }

  type CryptoPrice {
    currency: CryptoCurrency!
    priceEUR: Float!
    priceUSD: Float!
    change24h: Float!
    lastUpdated: String!
  }

  type CryptoConfig {
    enabled: Boolean!
    supportedCurrencies: [String!]!
    minimumBuyAmount: Float!
    maximumBuyAmount: Float!
    transactionFeePercentage: Float!
  }

  scalar JSON
`;