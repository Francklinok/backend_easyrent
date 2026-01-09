import { gql } from 'graphql-tag';

export const kycTypeDefs = gql`
  # ================================
  # ENUMS
  # ================================

  enum KYCVerificationStatus {
    unverified
    pending
    under_review
    verified
    rejected
    expired
    suspended
  }

  enum KYCDocumentType {
    national_id
    passport
    drivers_license
    residence_permit
    voter_id
    birth_certificate
    utility_bill
    bank_statement
    tax_certificate
    other
  }

  enum KYCDocumentStatus {
    pending
    approved
    rejected
    expired
    requires_resubmission
  }

  enum KYCRiskLevel {
    low
    medium
    high
    critical
  }

  enum KYCVerificationLevel {
    basic
    standard
    enhanced
    premium
  }

  enum KYCReviewAction {
    approved
    rejected
    request_more_info
    escalated
  }

  enum Gender {
    male
    female
    other
    prefer_not_to_say
  }

  enum AddressType {
    residential
    mailing
    business
  }

  enum AddressProofType {
    utility_bill
    bank_statement
    tax_document
    lease_agreement
    other
  }

  # ================================
  # TYPES
  # ================================

  type AuthenticityCheck {
    checkType: String!
    passed: Boolean!
    confidence: Float
    details: String
  }

  type DocumentAuthenticityResult {
    passed: Boolean
    checks: [AuthenticityCheck!]
  }

  type ExtractedDocumentData {
    fullName: String
    dateOfBirth: String
    nationality: String
    gender: String
    address: String
    documentNumber: String
    mrz: String
  }

  type KYCDocument {
    id: ID!
    type: KYCDocumentType!
    status: KYCDocumentStatus!
    documentNumber: String
    issuingCountry: String!
    issuingAuthority: String
    issueDate: String
    expiryDate: String
    frontImageUrl: String!
    backImageUrl: String
    selfieImageUrl: String
    extractedData: ExtractedDocumentData
    verificationScore: Float
    matchConfidence: Float
    authenticityCheck: DocumentAuthenticityResult
    uploadedAt: String!
    reviewedAt: String
    rejectionReason: String
    notes: String
  }

  type KYCPersonalInfo {
    firstName: String!
    middleName: String
    lastName: String!
    dateOfBirth: String!
    placeOfBirth: String
    nationality: String!
    secondNationality: String
    gender: Gender!
    phoneNumber: String!
    alternativePhone: String
    occupation: String
    employer: String
  }

  type AddressProofDocument {
    type: AddressProofType!
    documentUrl: String!
    issueDate: String!
    verificationStatus: KYCDocumentStatus!
  }

  type Coordinates {
    latitude: Float!
    longitude: Float!
  }

  type KYCAddress {
    id: ID!
    type: AddressType!
    isPrimary: Boolean!
    streetAddress: String!
    streetAddress2: String
    city: String!
    state: String
    postalCode: String
    country: String!
    coordinates: Coordinates
    proofDocument: AddressProofDocument
    verified: Boolean!
    verifiedAt: String
    residenceDuration: String
  }

  type KYCProgress {
    emailVerified: Boolean!
    phoneVerified: Boolean!
    identityVerified: Boolean!
    addressVerified: Boolean!
    livenessVerified: Boolean!
    overallProgress: Int!
  }

  type KYCReview {
    id: ID!
    reviewerId: ID!
    reviewerName: String
    reviewerRole: String
    action: KYCReviewAction!
    previousStatus: KYCVerificationStatus!
    newStatus: KYCVerificationStatus!
    notes: String
    rejectionReasons: [String!]
    requiredActions: [String!]
    createdAt: String!
  }

  type KYCAuditLog {
    id: ID!
    action: String!
    performedBy: String!
    performedByName: String
    previousValue: String
    newValue: String
    ipAddress: String
    userAgent: String
    createdAt: String!
  }

  type KYCSettings {
    notifyOnStatusChange: Boolean!
    notifyOnExpiry: Boolean!
    expiryReminderDays: Int!
    autoResubmitOnExpiry: Boolean!
    shareVerificationWithAgents: Boolean!
    shareVerificationWithLandlords: Boolean!
  }

  type RiskFactor {
    factor: String!
    impact: String!
    weight: Float!
    details: String
  }

  type RiskAssessment {
    score: Float
    factors: [RiskFactor!]
    lastAssessedAt: String
  }

  type KYCVerification {
    id: ID!
    userId: ID!
    status: KYCVerificationStatus!
    verificationLevel: KYCVerificationLevel!
    riskLevel: KYCRiskLevel!
    personalInfo: KYCPersonalInfo
    addresses: [KYCAddress!]!
    documents: [KYCDocument!]!
    progress: KYCProgress!
    submittedAt: String
    verifiedAt: String
    expiresAt: String
    lastUpdatedAt: String!
    reviews: [KYCReview!]!
    auditLogs: [KYCAuditLog!]!
    settings: KYCSettings!
    riskAssessment: RiskAssessment
    isPEP: Boolean
    isSanctioned: Boolean
    requiresEnhancedDueDiligence: Boolean
    createdAt: String!
    updatedAt: String!
    version: Int!
    # Virtual fields
    isExpired: Boolean
    daysUntilExpiry: Int
  }

  type KYCStatusResponse {
    status: KYCVerificationStatus!
    verificationLevel: KYCVerificationLevel!
    progress: KYCProgress!
    nextSteps: [String!]!
    estimatedReviewTime: String
    expiresAt: String
  }

  type KYCDocumentUploadResponse {
    documentId: ID!
    status: KYCDocumentStatus!
    message: String!
    extractedData: ExtractedDocumentData
  }

  type KYCVerificationResult {
    success: Boolean!
    status: KYCVerificationStatus!
    verificationLevel: KYCVerificationLevel!
    message: String!
    errors: [String!]
    nextSteps: [String!]
  }

  type KYCStatistics {
    total: Int!
    byStatus: KYCStatusCounts!
    byLevel: KYCLevelCounts!
    pendingCount: Int!
    averageReviewTime: Int!
    expiringSoon: Int!
  }

  type KYCStatusCounts {
    unverified: Int
    pending: Int
    under_review: Int
    verified: Int
    rejected: Int
    expired: Int
    suspended: Int
  }

  type KYCLevelCounts {
    basic: Int
    standard: Int
    enhanced: Int
    premium: Int
  }

  type KYCPaginatedResponse {
    data: [KYCVerification!]!
    total: Int!
    page: Int!
    totalPages: Int!
  }

  type SimpleVerificationStatus {
    status: KYCVerificationStatus!
    level: KYCVerificationLevel!
    isVerified: Boolean!
  }

  # ================================
  # INPUTS
  # ================================

  input SubmitKYCPersonalInfoInput {
    firstName: String!
    middleName: String
    lastName: String!
    dateOfBirth: String!
    placeOfBirth: String
    nationality: String!
    secondNationality: String
    gender: Gender!
    phoneNumber: String!
    alternativePhone: String
    occupation: String
    employer: String
  }

  input CoordinatesInput {
    latitude: Float!
    longitude: Float!
  }

  input SubmitKYCAddressInput {
    type: AddressType!
    isPrimary: Boolean
    streetAddress: String!
    streetAddress2: String
    city: String!
    state: String
    postalCode: String
    country: String!
    coordinates: CoordinatesInput
    residenceDuration: String
  }

  input UpdateKYCAddressInput {
    type: AddressType
    isPrimary: Boolean
    streetAddress: String
    streetAddress2: String
    city: String
    state: String
    postalCode: String
    country: String
    coordinates: CoordinatesInput
    residenceDuration: String
  }

  input SubmitKYCDocumentInput {
    type: KYCDocumentType!
    documentNumber: String
    issuingCountry: String!
    issuingAuthority: String
    issueDate: String
    expiryDate: String
    frontImageUrl: String!
    backImageUrl: String
    selfieImageUrl: String
  }

  input SubmitAddressProofInput {
    addressId: ID!
    proofType: AddressProofType!
    documentUrl: String!
    issueDate: String!
  }

  input UpdateKYCSettingsInput {
    notifyOnStatusChange: Boolean
    notifyOnExpiry: Boolean
    expiryReminderDays: Int
    autoResubmitOnExpiry: Boolean
    shareVerificationWithAgents: Boolean
    shareVerificationWithLandlords: Boolean
  }

  input AdminReviewKYCInput {
    action: KYCReviewAction!
    notes: String
    rejectionReasons: [String!]
    requiredActions: [String!]
    riskLevel: KYCRiskLevel
  }

  input AdminReviewDocumentInput {
    documentId: ID!
    status: KYCDocumentStatus!
    rejectionReason: String
    notes: String
    verificationScore: Float
  }

  input KYCPendingFilters {
    status: [KYCVerificationStatus!]
    riskLevel: [KYCRiskLevel!]
    verificationLevel: [KYCVerificationLevel!]
  }

  # ================================
  # QUERIES
  # ================================

  extend type Query {
    # User queries
    myKYCStatus: KYCStatusResponse!
    myKYCVerification: KYCVerification!
    mySimpleVerificationStatus: SimpleVerificationStatus!

    # Public query (for other users to check if someone is verified)
    isUserVerified(userId: ID!): Boolean!

    # Admin queries
    kycVerification(userId: ID!): KYCVerification
    pendingKYCReviews(
      page: Int
      limit: Int
      filters: KYCPendingFilters
    ): KYCPaginatedResponse!
    kycStatistics: KYCStatistics!
  }

  # ================================
  # MUTATIONS
  # ================================

  extend type Mutation {
    # Personal info
    submitKYCPersonalInfo(input: SubmitKYCPersonalInfoInput!): KYCVerificationResult!

    # Address management
    submitKYCAddress(input: SubmitKYCAddressInput!): KYCVerificationResult!
    updateKYCAddress(addressId: ID!, input: UpdateKYCAddressInput!): KYCVerificationResult!
    deleteKYCAddress(addressId: ID!): KYCVerificationResult!
    submitAddressProof(input: SubmitAddressProofInput!): KYCVerificationResult!

    # Document management
    submitKYCDocument(input: SubmitKYCDocumentInput!): KYCDocumentUploadResponse!
    deleteKYCDocument(documentId: ID!): KYCVerificationResult!

    # Settings
    updateKYCSettings(input: UpdateKYCSettingsInput!): KYCVerificationResult!

    # Admin mutations
    adminReviewKYC(userId: ID!, input: AdminReviewKYCInput!): KYCVerificationResult!
    adminReviewKYCDocument(userId: ID!, input: AdminReviewDocumentInput!): KYCVerificationResult!
  }
`;

export default kycTypeDefs;
