import gql from 'graphql-tag';

export const invoiceTypeDefs = gql`
  # ============= ENUMS =============

  enum InvoiceType {
    reservation
    rent
    service
    purchase
    deposit
    commission
  }

  enum InvoiceStatus {
    unpaid
    pending
    paid
    partially_paid
    cancelled
    refunded
  }

  enum PaymentIntentStatus {
    created
    initiated
    processing
    requires_action
    succeeded
    failed
    cancelled
    expired
  }

  enum PaymentMethodTypeNew {
    mobile_money
    card
    paypal
    stripe
    bank_transfer
    crypto
    wallet_balance
  }

  enum MobileMoneyProvider {
    mtn
    moov
    wave
    orange
    airtel
  }

  enum WalletTypeEnum {
    user
    owner
    platform
    escrow
  }

  enum WalletCurrency {
    XOF
    EUR
    USD
    GBP
  }

  # ============= INVOICE TYPES =============

  type InvoiceItem {
    description: String!
    quantity: Int!
    unitPrice: Float!
    total: Float!
    taxRate: Float
    taxAmount: Float
  }

  type Invoice {
    id: ID!
    invoiceNumber: String!
    type: InvoiceType!

    referenceId: String!
    referenceType: String!
    propertyId: ID

    clientId: ID!
    clientName: String
    clientEmail: String

    ownerId: ID!
    ownerName: String
    ownerEmail: String

    subtotal: Float!
    taxAmount: Float!
    taxRate: Float!
    commission: Float!
    commissionRate: Float!
    platformFee: Float!
    total: Float!
    currency: WalletCurrency!

    items: [InvoiceItem!]!
    description: String
    notes: String

    amountPaid: Float!
    amountDue: Float!
    paymentIntentId: String

    issueDate: String!
    dueDate: String!
    paidAt: String

    status: InvoiceStatus!
    metadata: JSON

    createdAt: String!
    updatedAt: String!

    # Relations
    client: User
    owner: User
    property: Property
    paymentIntent: PaymentIntent
  }

  type InvoiceConnection {
    invoices: [Invoice!]!
    total: Int!
    pages: Int!
  }

  type InvoiceStats {
    totalInvoices: Int!
    totalPaid: Int!
    totalPending: Int!
    totalUnpaid: Int!
    totalAmount: Float!
    paidAmount: Float!
    pendingAmount: Float!
  }

  # ============= PAYMENT INTENT TYPES =============

  type MobileMoneyDetails {
    provider: MobileMoneyProvider!
    phoneNumber: String!
    countryCode: String!
    accountName: String
    transactionRef: String
  }

  type CardDetails {
    brand: String
    last4: String
    expiryMonth: Int
    expiryYear: Int
    cardholderName: String
  }

  type PayPalDetails {
    email: String
    payerId: String
    orderId: String
  }

  type BankTransferDetails {
    bankName: String
    accountNumber: String
    iban: String
    bic: String
    reference: String
  }

  type CryptoPaymentDetails {
    currency: String!
    network: String!
    walletAddress: String!
    txHash: String
    confirmations: Int
  }

  type DisbursementDetails {
    bankName: String
    accountNumber: String
    iban: String
    paypalEmail: String
    mobileMoneyNumber: String
    mobileMoneyProvider: String
  }

  type PaymentNextAction {
    type: String!
    redirectUrl: String
    confirmationCode: String
    instructions: String
  }

  type StatusHistoryItem {
    status: String!
    timestamp: String!
    reason: String
  }

  type PaymentIntent {
    id: ID!
    intentId: String!
    invoiceId: ID!

    amount: Float!
    currency: WalletCurrency!
    feeAmount: Float!
    netAmount: Float!

    paymentMethod: PaymentMethodTypeNew!
    provider: String!

    mobileMoneyDetails: MobileMoneyDetails
    cardDetails: CardDetails
    payPalDetails: PayPalDetails
    bankTransferDetails: BankTransferDetails
    cryptoDetails: CryptoPaymentDetails

    disbursementMethod: PaymentMethodTypeNew
    disbursementDetails: DisbursementDetails

    providerReference: String

    status: PaymentIntentStatus!
    statusHistory: [StatusHistoryItem!]!

    clientId: ID!
    ownerId: ID!

    successUrl: String
    cancelUrl: String

    nextAction: PaymentNextAction

    expiresAt: String!
    confirmedAt: String
    completedAt: String
    cancelledAt: String

    metadata: JSON

    createdAt: String!
    updatedAt: String!

    # Relations
    invoice: Invoice
    client: User
    owner: User
  }

  # ============= ENHANCED WALLET TYPES =============

  type WalletV2 {
    id: ID!
    userId: ID!
    walletType: WalletTypeEnum!

    balance: Float!
    lockedBalance: Float!
    pendingBalance: Float!
    availableBalance: Float!

    currency: WalletCurrency!

    paymentMethods: [PaymentMethodLink!]!
    disbursementPreferences: [DisbursementPreference!]!

    dailyLimit: Float!
    monthlyLimit: Float!
    maxTransactionLimit: Float!

    totalReceived: Float!
    totalSent: Float!
    totalCommissionPaid: Float!

    isVerified: Boolean!
    verificationLevel: String!
    kycStatus: String

    isActive: Boolean!
    isFrozen: Boolean!
    frozenReason: String

    createdAt: String!
    updatedAt: String!

    # Relations
    user: User
    transactions(limit: Int): [TransactionV2!]!
    invoices(status: InvoiceStatus, limit: Int): [Invoice!]!
  }

  type PaymentMethodLink {
    methodId: String!
    type: String!
    isDefault: Boolean!
    isActive: Boolean!
    provider: String
    label: String
  }

  type DisbursementPreference {
    method: String!
    isDefault: Boolean!
    details: DisbursementDetails
  }

  # ============= TRANSACTION V2 TYPES =============

  type TransactionV2 {
    id: ID!
    transactionId: String!
    walletId: ID!
    userId: ID!

    type: String!
    referenceType: String
    referenceId: String

    amount: Float!
    currency: WalletCurrency!
    feeAmount: Float!
    netAmount: Float!

    sourceMethod: String
    destinationMethod: String

    fromWalletId: ID
    toWalletId: ID
    counterpartyId: ID
    counterpartyName: String

    description: String!
    notes: String

    cryptoCurrency: String
    cryptoAmount: Float
    exchangeRate: Float
    txHash: String

    externalProvider: String
    externalTransactionId: String

    status: String!
    statusHistory: [StatusHistoryItem!]!

    invoiceId: ID
    paymentIntentId: String

    balanceAfter: Float!
    lockedBalanceAfter: Float

    processedAt: String
    completedAt: String
    failedAt: String

    metadata: JSON

    createdAt: String!
    updatedAt: String!

    # Relations
    wallet: WalletV2
    user: User
    invoice: Invoice
    counterparty: User
  }

  type TransactionV2Connection {
    transactions: [TransactionV2!]!
    total: Int!
    pages: Int!
  }

  # ============= PAYMENT RESULT =============

  type PaymentResult {
    success: Boolean!
    paymentIntentId: String
    status: PaymentIntentStatus!
    nextAction: PaymentNextAction
    error: String
  }

  # ============= INPUTS =============

  input InvoiceItemInput {
    description: String!
    quantity: Int!
    unitPrice: Float!
    total: Float!
    taxRate: Float
  }

  input CreateInvoiceInput {
    type: InvoiceType!
    referenceId: String!
    referenceType: String!
    propertyId: ID

    clientId: ID!
    clientName: String
    clientEmail: String

    ownerId: ID!
    ownerName: String
    ownerEmail: String

    items: [InvoiceItemInput!]!
    currency: WalletCurrency
    taxRate: Float
    commissionRate: Float

    dueDate: String!
    description: String
    notes: String
    metadata: JSON
  }

  input InitiatePaymentInput {
    invoiceId: ID!
    paymentMethod: PaymentMethodTypeNew!

    mobileMoneyData: MobileMoneyDataInput
    cardData: CardDataInput
    paypalData: PaypalDataInput
    cryptoData: CryptoDataInputV2

    successUrl: String
    cancelUrl: String
    metadata: JSON
  }

  input MobileMoneyDataInput {
    provider: MobileMoneyProvider!
    phoneNumber: String!
    countryCode: String!
  }

  input CardDataInput {
    stripePaymentMethodId: String!
  }

  input PaypalDataInput {
    email: String
  }

  input CryptoDataInputV2 {
    currency: String!
    network: String!
  }

  input DisbursementInput {
    amount: Float!
    currency: WalletCurrency!
    method: String!
    details: DisbursementDetailsInput!
    description: String
  }

  input DisbursementDetailsInput {
    bankName: String
    accountNumber: String
    iban: String
    paypalEmail: String
    mobileMoneyNumber: String
    mobileMoneyProvider: String
  }

  input InvoiceFiltersInput {
    type: InvoiceType
    status: InvoiceStatus
    startDate: String
    endDate: String
    minAmount: Float
    maxAmount: Float
  }

  input TransactionFiltersV2Input {
    type: String
    status: String
    startDate: String
    endDate: String
    minAmount: Float
    maxAmount: Float
  }

  input AddDisbursementPreferenceInput {
    method: String!
    isDefault: Boolean
    details: DisbursementDetailsInput!
  }

  # ============= ONGOING ACTIVITIES TYPES =============

  enum OngoingActivityType {
    service
    reservation
    rent
    all
  }

  type OngoingActivity {
    id: ID!
    type: String!
    title: String!
    description: String
    amount: Float!
    currency: String!
    status: String!
    paymentStatus: String!
    startDate: String
    endDate: String
    referenceId: ID!
    referenceType: String!
    invoiceId: ID
    invoice: Invoice
    service: Service
    property: Property
    createdAt: String!
    updatedAt: String!
  }

  type OngoingActivitiesByType {
    services: Int!
    reservations: Int!
    rents: Int!
  }

  type OngoingActivitiesResponse {
    activities: [OngoingActivity!]!
    total: Int!
    byType: OngoingActivitiesByType!
  }

  # ============= QUERIES =============

  extend type Query {
    # Invoice queries
    invoice(id: ID!): Invoice
    invoiceByNumber(invoiceNumber: String!): Invoice
    myInvoices(filters: InvoiceFiltersInput, page: Int, limit: Int): InvoiceConnection!
    myReceivedInvoices(filters: InvoiceFiltersInput, page: Int, limit: Int): InvoiceConnection!
    overdueInvoices(daysOverdue: Int): [Invoice!]!
    invoiceStats(isOwner: Boolean): InvoiceStats!

    # Payment Intent queries
    paymentIntent(intentId: String!): PaymentIntent
    myPaymentIntents(status: PaymentIntentStatus, limit: Int): [PaymentIntent!]!

    # Wallet V2 queries
    walletV2: WalletV2!
    transactionV2(transactionId: String!): TransactionV2
    transactionsV2(filters: TransactionFiltersV2Input, page: Int, limit: Int): TransactionV2Connection!

    # Ongoing activities query (services, reservations, rents to pay)
    ongoingActivities(type: OngoingActivityType): OngoingActivitiesResponse!
  }

  # ============= MUTATIONS =============

  extend type Mutation {
    # Invoice mutations
    createInvoice(input: CreateInvoiceInput!): Invoice!
    cancelInvoice(invoiceId: ID!, reason: String): Invoice!
    refundInvoice(invoiceId: ID!, amount: Float, reason: String): Invoice!

    # Payment mutations
    initiatePayment(input: InitiatePaymentInput!): PaymentResult!
    confirmPayment(paymentIntentId: String!, providerReference: String!, providerResponse: JSON): PaymentResult!
    cancelPaymentIntent(paymentIntentId: String!, reason: String): PaymentResult!

    # Wallet V2 mutations
    addDisbursementPreference(input: AddDisbursementPreferenceInput!): WalletV2!
    removeDisbursementPreference(method: String!): WalletV2!
    setDefaultDisbursementPreference(method: String!): WalletV2!

    # Disbursement
    requestDisbursement(input: DisbursementInput!): PaymentResult!

    # Escrow
    lockFundsForEscrow(invoiceId: ID!, amount: Float!): PaymentResult!
    releaseWalletEscrow(invoiceId: ID!, ownerId: ID!, amount: Float!): PaymentResult!

    # Quick payment helpers
    createReservationInvoice(
      reservationId: ID!
      propertyId: ID!
      clientId: ID!
      ownerId: ID!
      amount: Float!
      currency: WalletCurrency!
      checkIn: String!
      checkOut: String!
      deposit: Float
    ): Invoice!

    createRentInvoice(
      rentalId: ID!
      propertyId: ID!
      clientId: ID!
      ownerId: ID!
      monthlyRent: Float!
      currency: WalletCurrency!
      periodStart: String!
      periodEnd: String!
    ): Invoice!

    createServiceInvoice(
      subscriptionId: ID!
      clientId: ID!
      providerId: ID!
      serviceName: String!
      amount: Float!
      currency: WalletCurrency!
      description: String
      serviceId: ID
      propertyId: ID
    ): Invoice!
  }

  # ============= SUBSCRIPTIONS =============

  extend type Subscription {
    invoiceStatusChanged(invoiceId: ID!): Invoice!
    paymentIntentStatusChanged(intentId: String!): PaymentIntent!
    walletBalanceUpdated: WalletV2!
    newTransactionReceived: TransactionV2!
  }
`;
