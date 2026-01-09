import { Schema, model, Document, Types } from 'mongoose';
import {
  KYCVerification,
  KYCVerificationStatus,
  KYCDocumentType,
  KYCDocumentStatus,
  KYCRiskLevel,
  KYCVerificationLevel,
  KYCReviewAction
} from '../types/kycTypes';

// ================================
// SUB-SCHEMAS
// ================================

const AuthenticityCheckSchema = new Schema({
  checkType: { type: String, required: true },
  passed: { type: Boolean, required: true },
  confidence: { type: Number, min: 0, max: 100 },
  details: { type: String }
}, { _id: false });

const ExtractedDataSchema = new Schema({
  fullName: { type: String },
  dateOfBirth: { type: String },
  nationality: { type: String },
  gender: { type: String },
  address: { type: String },
  documentNumber: { type: String },
  mrz: { type: String }
}, { _id: false });

const KYCDocumentSchema = new Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: Object.values(KYCDocumentType),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(KYCDocumentStatus),
    default: KYCDocumentStatus.PENDING
  },

  // Document details
  documentNumber: { type: String },
  issuingCountry: { type: String, required: true },
  issuingAuthority: { type: String },
  issueDate: { type: Date },
  expiryDate: { type: Date },

  // File information
  frontImageUrl: { type: String, required: true },
  backImageUrl: { type: String },
  selfieImageUrl: { type: String },

  // Extracted data
  extractedData: { type: ExtractedDataSchema },

  // Verification results
  verificationScore: { type: Number, min: 0, max: 100 },
  matchConfidence: { type: Number, min: 0, max: 100 },
  authenticityCheck: {
    passed: { type: Boolean },
    checks: [AuthenticityCheckSchema]
  },

  // Metadata
  uploadedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String },
  notes: { type: String }
}, { _id: false });

const KYCPersonalInfoSchema = new Schema({
  firstName: { type: String, required: true, trim: true },
  middleName: { type: String, trim: true },
  lastName: { type: String, required: true, trim: true },

  dateOfBirth: { type: Date, required: true },
  placeOfBirth: { type: String },

  nationality: { type: String, required: true },
  secondNationality: { type: String },

  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    required: true
  },

  phoneNumber: { type: String, required: true },
  alternativePhone: { type: String },

  occupation: { type: String },
  employer: { type: String }
}, { _id: false });

const AddressProofDocumentSchema = new Schema({
  type: {
    type: String,
    enum: ['utility_bill', 'bank_statement', 'tax_document', 'lease_agreement', 'other'],
    required: true
  },
  documentUrl: { type: String, required: true },
  issueDate: { type: Date, required: true },
  verificationStatus: {
    type: String,
    enum: Object.values(KYCDocumentStatus),
    default: KYCDocumentStatus.PENDING
  }
}, { _id: false });

const KYCAddressSchema = new Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['residential', 'mailing', 'business'],
    default: 'residential'
  },
  isPrimary: { type: Boolean, default: false },

  streetAddress: { type: String, required: true },
  streetAddress2: { type: String },
  city: { type: String, required: true },
  state: { type: String },
  postalCode: { type: String },
  country: { type: String, required: true },

  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  },

  proofDocument: { type: AddressProofDocumentSchema },

  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  residenceDuration: { type: String }
}, { _id: false });

const KYCProgressSchema = new Schema({
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  identityVerified: { type: Boolean, default: false },
  addressVerified: { type: Boolean, default: false },
  livenessVerified: { type: Boolean, default: false },
  overallProgress: { type: Number, default: 0, min: 0, max: 100 }
}, { _id: false });

const KYCReviewSchema = new Schema({
  id: { type: String, required: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerName: { type: String },
  reviewerRole: { type: String },

  action: {
    type: String,
    enum: Object.values(KYCReviewAction),
    required: true
  },
  previousStatus: {
    type: String,
    enum: Object.values(KYCVerificationStatus),
    required: true
  },
  newStatus: {
    type: String,
    enum: Object.values(KYCVerificationStatus),
    required: true
  },

  notes: { type: String },
  rejectionReasons: [{ type: String }],
  requiredActions: [{ type: String }],

  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const KYCAuditLogSchema = new Schema({
  id: { type: String, required: true },
  action: { type: String, required: true },
  performedBy: { type: Schema.Types.Mixed, required: true }, // ObjectId or 'system'
  performedByName: { type: String },

  previousValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },

  ipAddress: { type: String },
  userAgent: { type: String },

  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const KYCSettingsSchema = new Schema({
  notifyOnStatusChange: { type: Boolean, default: true },
  notifyOnExpiry: { type: Boolean, default: true },
  expiryReminderDays: { type: Number, default: 30 },
  autoResubmitOnExpiry: { type: Boolean, default: false },
  shareVerificationWithAgents: { type: Boolean, default: true },
  shareVerificationWithLandlords: { type: Boolean, default: true }
}, { _id: false });

const RiskFactorSchema = new Schema({
  factor: { type: String, required: true },
  impact: {
    type: String,
    enum: ['positive', 'negative', 'neutral'],
    required: true
  },
  weight: { type: Number, required: true },
  details: { type: String }
}, { _id: false });

const RiskAssessmentSchema = new Schema({
  score: { type: Number, min: 0, max: 100 },
  factors: [RiskFactorSchema],
  lastAssessedAt: { type: Date }
}, { _id: false });

// ================================
// MAIN KYC VERIFICATION SCHEMA
// ================================

export interface IKYCVerification extends KYCVerification, Document {}

const KYCVerificationSchema = new Schema<IKYCVerification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // Overall status
  status: {
    type: String,
    enum: Object.values(KYCVerificationStatus),
    default: KYCVerificationStatus.UNVERIFIED
  },
  verificationLevel: {
    type: String,
    enum: Object.values(KYCVerificationLevel),
    default: KYCVerificationLevel.BASIC
  },
  riskLevel: {
    type: String,
    enum: Object.values(KYCRiskLevel),
    default: KYCRiskLevel.LOW
  },

  // Personal information
  personalInfo: { type: KYCPersonalInfoSchema },

  // Addresses
  addresses: [KYCAddressSchema],

  // Documents
  documents: [KYCDocumentSchema],

  // Verification progress
  progress: { type: KYCProgressSchema, default: () => ({}) },

  // Verification dates
  submittedAt: { type: Date },
  verifiedAt: { type: Date },
  expiresAt: { type: Date },
  lastUpdatedAt: { type: Date, default: Date.now },

  // Review history
  reviews: [KYCReviewSchema],
  auditLogs: [KYCAuditLogSchema],

  // Settings
  settings: { type: KYCSettingsSchema, default: () => ({}) },

  // Risk assessment
  riskAssessment: { type: RiskAssessmentSchema },

  // Additional flags
  isPEP: { type: Boolean, default: false },
  isSanctioned: { type: Boolean, default: false },
  requiresEnhancedDueDiligence: { type: Boolean, default: false },

  // Version for optimistic locking
  version: { type: Number, default: 1 }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      delete ret.__v;
      // Don't expose sensitive audit data to regular users
      return ret;
    }
  }
});

// ================================
// INDEXES
// ================================

KYCVerificationSchema.index({ userId: 1 });
KYCVerificationSchema.index({ status: 1 });
KYCVerificationSchema.index({ verificationLevel: 1 });
KYCVerificationSchema.index({ 'progress.overallProgress': 1 });
KYCVerificationSchema.index({ submittedAt: 1 });
KYCVerificationSchema.index({ expiresAt: 1 });
KYCVerificationSchema.index({ 'documents.type': 1 });
KYCVerificationSchema.index({ 'documents.status': 1 });

// Compound indexes for common queries
KYCVerificationSchema.index({ status: 1, submittedAt: -1 });
KYCVerificationSchema.index({ status: 1, verificationLevel: 1 });

// ================================
// MIDDLEWARE
// ================================

// Update lastUpdatedAt and version on save
KYCVerificationSchema.pre('save', function(next) {
  this.lastUpdatedAt = new Date();
  if (!this.isNew) {
    this.version = (this.version || 0) + 1;
  }
  next();
});

// Calculate overall progress before save
KYCVerificationSchema.pre('save', function(next) {
  const progress = this.progress;
  let totalSteps = 5;
  let completedSteps = 0;

  if (progress.emailVerified) completedSteps++;
  if (progress.phoneVerified) completedSteps++;
  if (progress.identityVerified) completedSteps++;
  if (progress.addressVerified) completedSteps++;
  if (progress.livenessVerified) completedSteps++;

  progress.overallProgress = Math.round((completedSteps / totalSteps) * 100);
  next();
});

// ================================
// VIRTUAL FIELDS
// ================================

KYCVerificationSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

KYCVerificationSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiresAt) return null;
  const now = new Date();
  const expiry = new Date(this.expiresAt);
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

KYCVerificationSchema.virtual('primaryAddress').get(function() {
  return this.addresses?.find(addr => addr.isPrimary) || this.addresses?.[0];
});

KYCVerificationSchema.virtual('approvedDocuments').get(function() {
  return this.documents?.filter(doc => doc.status === KYCDocumentStatus.APPROVED) || [];
});

KYCVerificationSchema.virtual('pendingDocuments').get(function() {
  return this.documents?.filter(doc => doc.status === KYCDocumentStatus.PENDING) || [];
});

// ================================
// METHODS
// ================================

KYCVerificationSchema.methods.addAuditLog = function(
  action: string,
  performedBy: Types.ObjectId | 'system',
  previousValue?: any,
  newValue?: any,
  metadata?: { ipAddress?: string; userAgent?: string; performedByName?: string }
) {
  this.auditLogs.push({
    id: new Types.ObjectId().toString(),
    action,
    performedBy,
    performedByName: metadata?.performedByName,
    previousValue,
    newValue,
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
    createdAt: new Date()
  });
};

KYCVerificationSchema.methods.addReview = function(
  reviewerId: Types.ObjectId,
  action: KYCReviewAction,
  previousStatus: KYCVerificationStatus,
  newStatus: KYCVerificationStatus,
  options?: {
    reviewerName?: string;
    reviewerRole?: string;
    notes?: string;
    rejectionReasons?: string[];
    requiredActions?: string[];
  }
) {
  this.reviews.push({
    id: new Types.ObjectId().toString(),
    reviewerId,
    reviewerName: options?.reviewerName,
    reviewerRole: options?.reviewerRole,
    action,
    previousStatus,
    newStatus,
    notes: options?.notes,
    rejectionReasons: options?.rejectionReasons,
    requiredActions: options?.requiredActions,
    createdAt: new Date()
  });
};

KYCVerificationSchema.methods.getNextSteps = function(): string[] {
  const steps: string[] = [];
  const progress = this.progress;

  if (!progress.emailVerified) {
    steps.push('Verify your email address');
  }
  if (!progress.phoneVerified) {
    steps.push('Verify your phone number');
  }
  if (!this.personalInfo) {
    steps.push('Submit your personal information');
  }
  if (!this.documents?.length || !this.documents.some((d: any) =>
    [KYCDocumentType.NATIONAL_ID, KYCDocumentType.PASSPORT, KYCDocumentType.DRIVERS_LICENSE].includes(d.type)
  )) {
    steps.push('Upload a valid identity document (ID, Passport, or Driver\'s License)');
  }
  if (!this.addresses?.length) {
    steps.push('Add your residential address');
  }
  if (this.addresses?.length && !this.addresses.some((a: any) => a.proofDocument)) {
    steps.push('Upload proof of address (utility bill, bank statement, etc.)');
  }
  if (!progress.livenessVerified && this.verificationLevel === KYCVerificationLevel.PREMIUM) {
    steps.push('Complete liveness verification (selfie check)');
  }

  return steps;
};

// ================================
// STATIC METHODS
// ================================

KYCVerificationSchema.statics.findByUserId = function(userId: Types.ObjectId | string) {
  return this.findOne({ userId });
};

KYCVerificationSchema.statics.findPendingReviews = function(limit = 50) {
  return this.find({
    status: { $in: [KYCVerificationStatus.PENDING, KYCVerificationStatus.UNDER_REVIEW] }
  })
  .sort({ submittedAt: 1 })
  .limit(limit);
};

KYCVerificationSchema.statics.findExpiringSoon = function(days = 30) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  return this.find({
    status: KYCVerificationStatus.VERIFIED,
    expiresAt: { $lte: expiryDate, $gt: new Date() }
  });
};

// ================================
// MODEL EXPORT
// ================================

const KYCVerificationModel = model<IKYCVerification>('KYCVerification', KYCVerificationSchema);

export default KYCVerificationModel;
export { KYCVerificationSchema };
