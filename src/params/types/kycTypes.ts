import { Types } from 'mongoose';

// ================================
// KYC VERIFICATION ENUMS
// ================================

export enum KYCVerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended'
}

export enum KYCDocumentType {
  NATIONAL_ID = 'national_id',
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
  RESIDENCE_PERMIT = 'residence_permit',
  VOTER_ID = 'voter_id',
  BIRTH_CERTIFICATE = 'birth_certificate',
  UTILITY_BILL = 'utility_bill',
  BANK_STATEMENT = 'bank_statement',
  TAX_CERTIFICATE = 'tax_certificate',
  OTHER = 'other'
}

export enum KYCDocumentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  REQUIRES_RESUBMISSION = 'requires_resubmission'
}

export enum KYCRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum KYCVerificationLevel {
  BASIC = 'basic',           // Email + Phone verified
  STANDARD = 'standard',     // Basic + ID document
  ENHANCED = 'enhanced',     // Standard + Address proof
  PREMIUM = 'premium'        // Enhanced + Liveness check + Additional docs
}

export enum KYCReviewAction {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REQUEST_MORE_INFO = 'request_more_info',
  ESCALATED = 'escalated'
}

// ================================
// KYC DOCUMENT INTERFACES
// ================================

export interface KYCDocument {
  id: string;
  type: KYCDocumentType;
  status: KYCDocumentStatus;

  // Document details
  documentNumber?: string;
  issuingCountry: string;
  issuingAuthority?: string;
  issueDate?: Date;
  expiryDate?: Date;

  // File information
  frontImageUrl: string;
  backImageUrl?: string;
  selfieImageUrl?: string;

  // Extracted data (from OCR/AI)
  extractedData?: {
    fullName?: string;
    dateOfBirth?: string;
    nationality?: string;
    gender?: string;
    address?: string;
    documentNumber?: string;
    mrz?: string; // Machine Readable Zone for passports
  };

  // Verification results
  verificationScore?: number; // 0-100
  matchConfidence?: number;   // Face match confidence 0-100
  authenticityCheck?: {
    passed: boolean;
    checks: AuthenticityCheck[];
  };

  // Metadata
  uploadedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  rejectionReason?: string;
  notes?: string;
}

export interface AuthenticityCheck {
  checkType: string;
  passed: boolean;
  confidence: number;
  details?: string;
}

// ================================
// KYC PERSONAL INFORMATION
// ================================

export interface KYCPersonalInfo {
  // Legal name (as on documents)
  firstName: string;
  middleName?: string;
  lastName: string;

  // Date of birth
  dateOfBirth: Date;
  placeOfBirth?: string;

  // Nationality
  nationality: string;
  secondNationality?: string;

  // Gender
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';

  // Contact info for verification
  phoneNumber: string;
  alternativePhone?: string;

  // Occupation
  occupation?: string;
  employer?: string;
}

// ================================
// KYC ADDRESS INFORMATION
// ================================

export interface KYCAddress {
  // Address type
  type: 'residential' | 'mailing' | 'business';
  isPrimary: boolean;

  // Address details
  streetAddress: string;
  streetAddress2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;

  // Coordinates for geo-verification
  coordinates?: {
    latitude: number;
    longitude: number;
  };

  // Proof of address document
  proofDocument?: {
    type: 'utility_bill' | 'bank_statement' | 'tax_document' | 'lease_agreement' | 'other';
    documentUrl: string;
    issueDate: Date;
    verificationStatus: KYCDocumentStatus;
  };

  // Verification status
  verified: boolean;
  verifiedAt?: Date;
  residenceDuration?: string; // e.g., "2 years"
}

// ================================
// KYC REVIEW & AUDIT
// ================================

export interface KYCReview {
  id: string;
  reviewerId: Types.ObjectId;
  reviewerName?: string;
  reviewerRole?: string;

  action: KYCReviewAction;
  previousStatus: KYCVerificationStatus;
  newStatus: KYCVerificationStatus;

  notes?: string;
  rejectionReasons?: string[];
  requiredActions?: string[];

  createdAt: Date;
}

export interface KYCAuditLog {
  id: string;
  action: string;
  performedBy: Types.ObjectId | 'system';
  performedByName?: string;

  previousValue?: any;
  newValue?: any;

  ipAddress?: string;
  userAgent?: string;

  createdAt: Date;
}

// ================================
// KYC VERIFICATION SETTINGS
// ================================

export interface KYCSettings {
  // User preferences for verification
  notifyOnStatusChange: boolean;
  notifyOnExpiry: boolean;
  expiryReminderDays: number;

  // Auto-resubmission
  autoResubmitOnExpiry: boolean;

  // Privacy
  shareVerificationWithAgents: boolean;
  shareVerificationWithLandlords: boolean;
}

// ================================
// MAIN KYC VERIFICATION INTERFACE
// ================================

export interface KYCVerification {
  userId: Types.ObjectId;

  // Overall status
  status: KYCVerificationStatus;
  verificationLevel: KYCVerificationLevel;
  riskLevel: KYCRiskLevel;

  // Personal information
  personalInfo?: KYCPersonalInfo;

  // Addresses
  addresses: KYCAddress[];

  // Documents
  documents: KYCDocument[];

  // Verification progress
  progress: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    addressVerified: boolean;
    livenessVerified: boolean;
    overallProgress: number; // 0-100
  };

  // Verification dates
  submittedAt?: Date;
  verifiedAt?: Date;
  expiresAt?: Date;
  lastUpdatedAt: Date;

  // Review history
  reviews: KYCReview[];
  auditLogs: KYCAuditLog[];

  // Settings
  settings: KYCSettings;

  // Risk assessment
  riskAssessment?: {
    score: number;
    factors: {
      factor: string;
      impact: 'positive' | 'negative' | 'neutral';
      weight: number;
      details?: string;
    }[];
    lastAssessedAt: Date;
  };

  // Additional flags
  isPEP?: boolean;           // Politically Exposed Person
  isSanctioned?: boolean;    // On sanctions list
  requiresEnhancedDueDiligence?: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// ================================
// DTOs FOR MUTATIONS
// ================================

export interface SubmitKYCPersonalInfoDto {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string; // ISO date string
  placeOfBirth?: string;
  nationality: string;
  secondNationality?: string;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phoneNumber: string;
  alternativePhone?: string;
  occupation?: string;
  employer?: string;
}

export interface SubmitKYCAddressDto {
  type: 'residential' | 'mailing' | 'business';
  isPrimary?: boolean;
  streetAddress: string;
  streetAddress2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  residenceDuration?: string;
}

export interface SubmitKYCDocumentDto {
  type: KYCDocumentType;
  documentNumber?: string;
  issuingCountry: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  frontImageUrl: string;
  backImageUrl?: string;
  selfieImageUrl?: string;
}

export interface SubmitAddressProofDto {
  addressId: string;
  proofType: 'utility_bill' | 'bank_statement' | 'tax_document' | 'lease_agreement' | 'other';
  documentUrl: string;
  issueDate: string;
}

export interface UpdateKYCSettingsDto {
  notifyOnStatusChange?: boolean;
  notifyOnExpiry?: boolean;
  expiryReminderDays?: number;
  autoResubmitOnExpiry?: boolean;
  shareVerificationWithAgents?: boolean;
  shareVerificationWithLandlords?: boolean;
}

export interface AdminReviewKYCDto {
  action: KYCReviewAction;
  notes?: string;
  rejectionReasons?: string[];
  requiredActions?: string[];
  riskLevel?: KYCRiskLevel;
}

export interface AdminReviewDocumentDto {
  documentId: string;
  status: KYCDocumentStatus;
  rejectionReason?: string;
  notes?: string;
  verificationScore?: number;
}

// ================================
// RESPONSE TYPES
// ================================

export interface KYCStatusResponse {
  status: KYCVerificationStatus;
  verificationLevel: KYCVerificationLevel;
  progress: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    addressVerified: boolean;
    livenessVerified: boolean;
    overallProgress: number;
  };
  nextSteps: string[];
  estimatedReviewTime?: string;
  expiresAt?: Date;
}

export interface KYCDocumentUploadResponse {
  documentId: string;
  status: KYCDocumentStatus;
  message: string;
  extractedData?: any;
}

export interface KYCVerificationResult {
  success: boolean;
  status: KYCVerificationStatus;
  verificationLevel: KYCVerificationLevel;
  message: string;
  errors?: string[];
  nextSteps?: string[];
}
