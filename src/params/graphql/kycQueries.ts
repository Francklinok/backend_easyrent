import { gql } from 'graphql-tag';

// ================================
// FRAGMENTS
// ================================

export const KYC_PROGRESS_FRAGMENT = gql`
  fragment KYCProgressFields on KYCProgress {
    emailVerified
    phoneVerified
    identityVerified
    addressVerified
    livenessVerified
    overallProgress
  }
`;

export const KYC_PERSONAL_INFO_FRAGMENT = gql`
  fragment KYCPersonalInfoFields on KYCPersonalInfo {
    firstName
    middleName
    lastName
    dateOfBirth
    placeOfBirth
    nationality
    secondNationality
    gender
    phoneNumber
    alternativePhone
    occupation
    employer
  }
`;

export const KYC_ADDRESS_FRAGMENT = gql`
  fragment KYCAddressFields on KYCAddress {
    id
    type
    isPrimary
    streetAddress
    streetAddress2
    city
    state
    postalCode
    country
    coordinates {
      latitude
      longitude
    }
    proofDocument {
      type
      documentUrl
      issueDate
      verificationStatus
    }
    verified
    verifiedAt
    residenceDuration
  }
`;

export const KYC_DOCUMENT_FRAGMENT = gql`
  fragment KYCDocumentFields on KYCDocument {
    id
    type
    status
    documentNumber
    issuingCountry
    issuingAuthority
    issueDate
    expiryDate
    frontImageUrl
    backImageUrl
    selfieImageUrl
    extractedData {
      fullName
      dateOfBirth
      nationality
      gender
      address
      documentNumber
      mrz
    }
    verificationScore
    matchConfidence
    authenticityCheck {
      passed
      checks {
        checkType
        passed
        confidence
        details
      }
    }
    uploadedAt
    reviewedAt
    rejectionReason
    notes
  }
`;

export const KYC_SETTINGS_FRAGMENT = gql`
  fragment KYCSettingsFields on KYCSettings {
    notifyOnStatusChange
    notifyOnExpiry
    expiryReminderDays
    autoResubmitOnExpiry
    shareVerificationWithAgents
    shareVerificationWithLandlords
  }
`;

export const KYC_REVIEW_FRAGMENT = gql`
  fragment KYCReviewFields on KYCReview {
    id
    reviewerId
    reviewerName
    reviewerRole
    action
    previousStatus
    newStatus
    notes
    rejectionReasons
    requiredActions
    createdAt
  }
`;

// ================================
// QUERIES
// ================================

export const GET_MY_KYC_STATUS = gql`
  query GetMyKYCStatus {
    myKYCStatus {
      status
      verificationLevel
      progress {
        ...KYCProgressFields
      }
      nextSteps
      estimatedReviewTime
      expiresAt
    }
  }
  ${KYC_PROGRESS_FRAGMENT}
`;

export const GET_MY_KYC_VERIFICATION = gql`
  query GetMyKYCVerification {
    myKYCVerification {
      id
      userId
      status
      verificationLevel
      riskLevel
      personalInfo {
        ...KYCPersonalInfoFields
      }
      addresses {
        ...KYCAddressFields
      }
      documents {
        ...KYCDocumentFields
      }
      progress {
        ...KYCProgressFields
      }
      submittedAt
      verifiedAt
      expiresAt
      lastUpdatedAt
      reviews {
        ...KYCReviewFields
      }
      settings {
        ...KYCSettingsFields
      }
      isPEP
      isSanctioned
      requiresEnhancedDueDiligence
      createdAt
      updatedAt
      version
      isExpired
      daysUntilExpiry
    }
  }
  ${KYC_PERSONAL_INFO_FRAGMENT}
  ${KYC_ADDRESS_FRAGMENT}
  ${KYC_DOCUMENT_FRAGMENT}
  ${KYC_PROGRESS_FRAGMENT}
  ${KYC_REVIEW_FRAGMENT}
  ${KYC_SETTINGS_FRAGMENT}
`;

export const GET_SIMPLE_VERIFICATION_STATUS = gql`
  query GetSimpleVerificationStatus {
    mySimpleVerificationStatus {
      status
      level
      isVerified
    }
  }
`;

export const CHECK_USER_VERIFIED = gql`
  query CheckUserVerified($userId: ID!) {
    isUserVerified(userId: $userId)
  }
`;

// Admin Queries
export const GET_KYC_VERIFICATION_ADMIN = gql`
  query GetKYCVerificationAdmin($userId: ID!) {
    kycVerification(userId: $userId) {
      id
      userId
      status
      verificationLevel
      riskLevel
      personalInfo {
        ...KYCPersonalInfoFields
      }
      addresses {
        ...KYCAddressFields
      }
      documents {
        ...KYCDocumentFields
      }
      progress {
        ...KYCProgressFields
      }
      submittedAt
      verifiedAt
      expiresAt
      lastUpdatedAt
      reviews {
        ...KYCReviewFields
      }
      auditLogs {
        id
        action
        performedBy
        performedByName
        previousValue
        newValue
        ipAddress
        userAgent
        createdAt
      }
      settings {
        ...KYCSettingsFields
      }
      riskAssessment {
        score
        factors {
          factor
          impact
          weight
          details
        }
        lastAssessedAt
      }
      isPEP
      isSanctioned
      requiresEnhancedDueDiligence
      createdAt
      updatedAt
      version
      isExpired
      daysUntilExpiry
    }
  }
  ${KYC_PERSONAL_INFO_FRAGMENT}
  ${KYC_ADDRESS_FRAGMENT}
  ${KYC_DOCUMENT_FRAGMENT}
  ${KYC_PROGRESS_FRAGMENT}
  ${KYC_REVIEW_FRAGMENT}
  ${KYC_SETTINGS_FRAGMENT}
`;

export const GET_PENDING_KYC_REVIEWS = gql`
  query GetPendingKYCReviews($page: Int, $limit: Int, $filters: KYCPendingFilters) {
    pendingKYCReviews(page: $page, limit: $limit, filters: $filters) {
      data {
        id
        userId
        status
        verificationLevel
        riskLevel
        personalInfo {
          firstName
          lastName
          nationality
        }
        progress {
          ...KYCProgressFields
        }
        submittedAt
        documents {
          id
          type
          status
        }
      }
      total
      page
      totalPages
    }
  }
  ${KYC_PROGRESS_FRAGMENT}
`;

export const GET_KYC_STATISTICS = gql`
  query GetKYCStatistics {
    kycStatistics {
      total
      byStatus {
        unverified
        pending
        under_review
        verified
        rejected
        expired
        suspended
      }
      byLevel {
        basic
        standard
        enhanced
        premium
      }
      pendingCount
      averageReviewTime
      expiringSoon
    }
  }
`;

// ================================
// MUTATIONS
// ================================

export const SUBMIT_KYC_PERSONAL_INFO = gql`
  mutation SubmitKYCPersonalInfo($input: SubmitKYCPersonalInfoInput!) {
    submitKYCPersonalInfo(input: $input) {
      success
      status
      verificationLevel
      message
      errors
      nextSteps
    }
  }
`;

export const SUBMIT_KYC_ADDRESS = gql`
  mutation SubmitKYCAddress($input: SubmitKYCAddressInput!) {
    submitKYCAddress(input: $input) {
      success
      status
      verificationLevel
      message
      errors
      nextSteps
    }
  }
`;

export const UPDATE_KYC_ADDRESS = gql`
  mutation UpdateKYCAddress($addressId: ID!, $input: UpdateKYCAddressInput!) {
    updateKYCAddress(addressId: $addressId, input: $input) {
      success
      status
      verificationLevel
      message
      errors
      nextSteps
    }
  }
`;

export const DELETE_KYC_ADDRESS = gql`
  mutation DeleteKYCAddress($addressId: ID!) {
    deleteKYCAddress(addressId: $addressId) {
      success
      status
      verificationLevel
      message
      errors
      nextSteps
    }
  }
`;

export const SUBMIT_ADDRESS_PROOF = gql`
  mutation SubmitAddressProof($input: SubmitAddressProofInput!) {
    submitAddressProof(input: $input) {
      success
      status
      verificationLevel
      message
      errors
      nextSteps
    }
  }
`;

export const SUBMIT_KYC_DOCUMENT = gql`
  mutation SubmitKYCDocument($input: SubmitKYCDocumentInput!) {
    submitKYCDocument(input: $input) {
      documentId
      status
      message
      extractedData {
        fullName
        dateOfBirth
        nationality
        gender
        address
        documentNumber
        mrz
      }
    }
  }
`;

export const DELETE_KYC_DOCUMENT = gql`
  mutation DeleteKYCDocument($documentId: ID!) {
    deleteKYCDocument(documentId: $documentId) {
      success
      status
      verificationLevel
      message
      errors
      nextSteps
    }
  }
`;

export const UPDATE_KYC_SETTINGS = gql`
  mutation UpdateKYCSettings($input: UpdateKYCSettingsInput!) {
    updateKYCSettings(input: $input) {
      success
      status
      verificationLevel
      message
      errors
      nextSteps
    }
  }
`;

// Admin Mutations
export const ADMIN_REVIEW_KYC = gql`
  mutation AdminReviewKYC($userId: ID!, $input: AdminReviewKYCInput!) {
    adminReviewKYC(userId: $userId, input: $input) {
      success
      status
      verificationLevel
      message
      errors
      nextSteps
    }
  }
`;

export const ADMIN_REVIEW_KYC_DOCUMENT = gql`
  mutation AdminReviewKYCDocument($userId: ID!, $input: AdminReviewDocumentInput!) {
    adminReviewKYCDocument(userId: $userId, input: $input) {
      success
      status
      verificationLevel
      message
      errors
      nextSteps
    }
  }
`;

// ================================
// GROUPED EXPORTS
// ================================

export const KYCQueries = {
  GET_MY_KYC_STATUS,
  GET_MY_KYC_VERIFICATION,
  GET_SIMPLE_VERIFICATION_STATUS,
  CHECK_USER_VERIFIED,
  GET_KYC_VERIFICATION_ADMIN,
  GET_PENDING_KYC_REVIEWS,
  GET_KYC_STATISTICS
};

export const KYCMutations = {
  SUBMIT_KYC_PERSONAL_INFO,
  SUBMIT_KYC_ADDRESS,
  UPDATE_KYC_ADDRESS,
  DELETE_KYC_ADDRESS,
  SUBMIT_ADDRESS_PROOF,
  SUBMIT_KYC_DOCUMENT,
  DELETE_KYC_DOCUMENT,
  UPDATE_KYC_SETTINGS,
  ADMIN_REVIEW_KYC,
  ADMIN_REVIEW_KYC_DOCUMENT
};

export const KYCFragments = {
  KYC_PROGRESS_FRAGMENT,
  KYC_PERSONAL_INFO_FRAGMENT,
  KYC_ADDRESS_FRAGMENT,
  KYC_DOCUMENT_FRAGMENT,
  KYC_SETTINGS_FRAGMENT,
  KYC_REVIEW_FRAGMENT
};

export default {
  ...KYCQueries,
  ...KYCMutations,
  ...KYCFragments
};
