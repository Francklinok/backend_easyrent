import gql from 'graphql-tag';

export const walletTypeDefs = gql`
  scalar Date
  scalar Upload

  type FiatCurrency {
    code: String!
    name: String!
    balance: Float!
    isDefault: Boolean!
    lastUpdated: Date!
  }

  type CryptoCurrency {
    symbol: String!
    name: String!
    balance: Float!
    balanceUSD: Float!
    balanceEUR: Float!
    walletAddress: String
    privateKeyEncrypted: String
    lastUpdated: Date!
    priceData: CryptoPriceData
  }

  type CryptoPriceData {
    symbol: String!
    name: String!
    price: Float!
    change24h: Float!
    marketCap: Float!
    volume24h: Float!
    lastUpdated: Date!
  }

  type PaymentMethod {
    id: String!
    type: PaymentMethodType!
    provider: String!
    accountInfo: String!
    isDefault: Boolean!
    isVerified: Boolean!
    createdAt: Date!
    lastUsed: Date
  }

  enum PaymentMethodType {
    BANK_TRANSFER
    CREDIT_CARD
    DEBIT_CARD
    PAYPAL
    STRIPE
    CRYPTO_WALLET
  }

  type WalletTransaction {
    id: String!
    type: TransactionType!
    amount: Float!
    currency: String!
    status: TransactionStatus!
    description: String
    fromAddress: String
    toAddress: String
    externalTransactionId: String
    paymentMethod: String
    fees: Float!
    exchangeRate: Float
    originalAmount: Float
    originalCurrency: String
    timestamp: Date!
    confirmations: Int
    blockHash: String
    metadata: TransactionMetadata
    riskScore: Int
    securityChecks: SecurityCheck
  }

  enum TransactionType {
    DEPOSIT
    WITHDRAWAL
    CRYPTO_PURCHASE
    CRYPTO_SALE
    PROPERTY_PAYMENT
    RENT_PAYMENT
    REFUND
    TRANSFER_IN
    TRANSFER_OUT
    FEE_PAYMENT
    EXCHANGE
  }

  enum TransactionStatus {
    PENDING
    PROCESSING
    COMPLETED
    FAILED
    CANCELLED
    REFUNDED
    UNDER_REVIEW
  }

  type TransactionMetadata {
    propertyId: String
    bookingId: String
    contractId: String
    userAgent: String
    ipAddress: String
    deviceFingerprint: String
    geolocation: String
  }

  type SecurityCheck {
    passed: Boolean!
    riskLevel: RiskLevel!
    reasons: [String!]!
    recommendations: [String!]!
    blockTransaction: Boolean!
  }

  enum RiskLevel {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  type WalletStats {
    totalBalance: Float!
    totalBalanceUSD: Float!
    totalBalanceEUR: Float!
    monthlyVolume: Float!
    yearlyVolume: Float!
    transactionCount: Int!
    averageTransactionAmount: Float!
    topCurrency: String!
    profitLoss: Float!
    profitLossPercent: Float!
  }

  type EnhancedWallet {
    id: String!
    userId: String!
    fiatCurrencies: [FiatCurrency!]!
    cryptoCurrencies: [CryptoCurrency!]!
    paymentMethods: [PaymentMethod!]!
    transactions: [WalletTransaction!]!
    stats: WalletStats!
    settings: WalletSettings!
    security: WalletSecurity!
    compliance: ComplianceInfo!
    createdAt: Date!
    updatedAt: Date!
  }

  type WalletSettings {
    defaultCurrency: String!
    enableNotifications: Boolean!
    autoConvertSmallAmounts: Boolean!
    preferredPaymentMethod: String
    maxDailyLimit: Float!
    enableTwoFactor: Boolean!
    language: String!
    timezone: String!
  }

  type WalletSecurity {
    isKYCVerified: Boolean!
    verificationLevel: VerificationLevel!
    lastSecurityCheck: Date
    suspiciousActivityCount: Int!
    isLocked: Boolean!
    lockReason: String
    trustedDevices: [String!]!
    loginAttempts: Int!
    lastLogin: Date
  }

  enum VerificationLevel {
    UNVERIFIED
    EMAIL_VERIFIED
    PHONE_VERIFIED
    ID_VERIFIED
    FULLY_VERIFIED
  }

  type ComplianceInfo {
    kycStatus: KYCStatus!
    amlChecks: [AMLCheck!]!
    sanctionScreening: SanctionScreening
    riskProfile: RiskProfile!
    reportingThreshold: Float!
    lastComplianceCheck: Date
  }

  enum KYCStatus {
    NOT_STARTED
    IN_PROGRESS
    COMPLETED
    REJECTED
    EXPIRED
  }

  type AMLCheck {
    id: String!
    type: String!
    status: String!
    result: String!
    timestamp: Date!
    details: String
  }

  type SanctionScreening {
    isClean: Boolean!
    lastCheck: Date!
    sources: [String!]!
    alerts: [String!]!
  }

  enum RiskProfile {
    LOW_RISK
    MEDIUM_RISK
    HIGH_RISK
    PROHIBITED
  }

  type PaymentResponse {
    success: Boolean!
    transactionId: String
    status: TransactionStatus!
    amount: Float!
    currency: String!
    fees: Float!
    estimatedCompletion: Date
    confirmationRequired: Boolean!
    confirmationUrl: String
    error: String
    securityCheck: SecurityCheck
  }

  type PriceConversion {
    fromCurrency: String!
    toCurrency: String!
    fromAmount: Float!
    toAmount: Float!
    rate: Float!
    timestamp: Date!
    provider: String!
  }

  input PaymentRequest {
    amount: Float!
    currency: String!
    paymentMethod: String!
    description: String
    propertyId: String
    bookingId: String
    toAddress: String
    metadata: PaymentMetadataInput
  }

  input PaymentMetadataInput {
    propertyId: String
    bookingId: String
    contractId: String
    userAgent: String
    ipAddress: String
    deviceFingerprint: String
    geolocation: String
  }

  input WalletSettingsInput {
    defaultCurrency: String
    enableNotifications: Boolean
    autoConvertSmallAmounts: Boolean
    preferredPaymentMethod: String
    maxDailyLimit: Float
    enableTwoFactor: Boolean
    language: String
    timezone: String
  }

  input AddPaymentMethodInput {
    type: PaymentMethodType!
    provider: String!
    accountInfo: String!
    isDefault: Boolean
  }

  input CryptoPurchaseInput {
    amount: Float!
    currency: String!
    cryptoCurrency: String!
    paymentMethod: String!
  }

  input TransferInput {
    amount: Float!
    currency: String!
    toUserId: String!
    description: String
  }

  type Query {
    getWallet: EnhancedWallet!
    getWalletBalance(currency: String): Float!
    getTransactionHistory(
      limit: Int = 50
      offset: Int = 0
      currency: String
      type: TransactionType
      status: TransactionStatus
      startDate: Date
      endDate: Date
    ): [WalletTransaction!]!
    getTransaction(id: String!): WalletTransaction
    getCryptoPrices(symbols: [String!]!): [CryptoPriceData!]!
    getCryptoPrice(symbol: String!, vsCurrency: String = "EUR"): Float!
    convertCurrency(
      fromCurrency: String!
      toCurrency: String!
      amount: Float!
    ): PriceConversion!
    getExchangeRates(baseCurrency: String = "EUR"): String! # JSON string
    getWalletStats: WalletStats!
    getPaymentMethods: [PaymentMethod!]!
    validateTransaction(
      amount: Float!
      currency: String!
      paymentMethod: String!
    ): SecurityCheck!
  }

  type Mutation {
    createWallet: EnhancedWallet!

    # Payment operations
    processPayment(request: PaymentRequest!): PaymentResponse!

    # Crypto operations
    purchaseCrypto(input: CryptoPurchaseInput!): PaymentResponse!
    sellCrypto(
      amount: Float!
      cryptoCurrency: String!
      toCurrency: String!
    ): PaymentResponse!

    # Transfer operations
    transferFunds(input: TransferInput!): PaymentResponse!

    # Deposit/Withdrawal
    depositFunds(
      amount: Float!
      currency: String!
      paymentMethod: String!
    ): PaymentResponse!

    withdrawFunds(
      amount: Float!
      currency: String!
      paymentMethod: String!
      toAddress: String
    ): PaymentResponse!

    # Payment method management
    addPaymentMethod(input: AddPaymentMethodInput!): PaymentMethod!
    removePaymentMethod(id: String!): Boolean!
    setDefaultPaymentMethod(id: String!): Boolean!

    # Settings
    updateWalletSettings(input: WalletSettingsInput!): EnhancedWallet!

    # Security
    lockWallet(reason: String!): Boolean!
    unlockWallet: Boolean!
    enableTwoFactor: Boolean!
    disableTwoFactor: Boolean!

    # Verification
    submitKYCDocuments(documents: [Upload!]!): Boolean!

    # Compliance
    generateComplianceReport(
      startDate: Date!
      endDate: Date!
    ): String! # Returns download URL
  }

  type Subscription {
    transactionUpdate(userId: String!): WalletTransaction!
    priceUpdate(symbols: [String!]!): [CryptoPriceData!]!
    walletUpdate(userId: String!): EnhancedWallet!
    securityAlert(userId: String!): SecurityCheck!
  }
`;