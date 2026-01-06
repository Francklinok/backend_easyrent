import { Schema, model, Document, Types } from 'mongoose';
import {
  UserParams,
  PrivacyLevel,
  PremiumTier,
  PremiumStatus
} from '../types/paramsTypes';

// ================================
// SUB-SCHEMAS
// ================================

const SecurityQuestionSchema = new Schema({
  questionId: { type: String, required: true },
  question: { type: String, required: true },
  answerHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const LoginAlertsSchema = new Schema({
  newDevice: { type: Boolean, default: true },
  newLocation: { type: Boolean, default: true },
  failedAttempts: { type: Boolean, default: true }
}, { _id: false });

const SecuritySettingsSchema = new Schema({
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorMethod: {
    type: String,
    enum: ['sms', 'email', 'authenticator'],
    default: 'email'
  },
  loginNotifications: { type: Boolean, default: true },
  passwordExpiryDays: { type: Number, default: 90 },
  sessionTimeout: { type: Number, default: 30 }, // minutes
  trustedDevicesEnabled: { type: Boolean, default: true },
  maxActiveSessions: { type: Number, default: 5 },
  biometricEnabled: { type: Boolean, default: false },
  securityQuestions: [SecurityQuestionSchema],
  loginAlerts: { type: LoginAlertsSchema, default: () => ({}) },
  ipWhitelist: [{ type: String }],
  lastSecurityCheck: { type: Date }
}, { _id: false });

const DataSharingSchema = new Schema({
  analytics: { type: Boolean, default: true },
  thirdParty: { type: Boolean, default: false },
  marketing: { type: Boolean, default: false },
  personalization: { type: Boolean, default: true }
}, { _id: false });

const PrivacySettingsSchema = new Schema({
  profileVisibility: {
    type: String,
    enum: Object.values(PrivacyLevel),
    default: PrivacyLevel.PUBLIC
  },
  showEmail: { type: Boolean, default: false },
  showPhone: { type: Boolean, default: false },
  showAddress: { type: Boolean, default: false },
  showOnlineStatus: { type: Boolean, default: true },
  showLastActive: { type: Boolean, default: true },
  allowSearchByEmail: { type: Boolean, default: true },
  allowSearchByPhone: { type: Boolean, default: false },
  dataSharing: { type: DataSharingSchema, default: () => ({}) },
  blockList: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  activityTracking: { type: Boolean, default: true },
  locationSharing: { type: Boolean, default: false },
  readReceipts: { type: Boolean, default: true }
}, { _id: false });

const PremiumFeatureSchema = new Schema({
  featureId: { type: String, required: true },
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  limit: { type: Number },
  usedCount: { type: Number, default: 0 }
}, { _id: false });

const BillingRecordSchema = new Schema({
  id: { type: String, required: true },
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'XAF' },
  description: { type: String },
  status: {
    type: String,
    enum: ['paid', 'pending', 'failed', 'refunded'],
    default: 'pending'
  },
  invoiceUrl: { type: String }
}, { _id: false });

const UsageLimitsSchema = new Schema({
  maxProperties: { type: Number, default: 3 },
  maxPhotosPerProperty: { type: Number, default: 5 },
  maxMessages: { type: Number, default: 50 },
  maxFavorites: { type: Number, default: 20 },
  prioritySupport: { type: Boolean, default: false },
  analyticsAccess: { type: Boolean, default: false },
  featuredListings: { type: Number, default: 0 }
}, { _id: false });

const PremiumSettingsSchema = new Schema({
  tier: {
    type: String,
    enum: Object.values(PremiumTier),
    default: PremiumTier.FREE
  },
  status: {
    type: String,
    enum: Object.values(PremiumStatus),
    default: PremiumStatus.ACTIVE
  },
  startDate: { type: Date },
  endDate: { type: Date },
  autoRenew: { type: Boolean, default: false },
  paymentMethod: { type: String },
  features: [PremiumFeatureSchema],
  usageLimits: { type: UsageLimitsSchema, default: () => ({}) },
  billingHistory: [BillingRecordSchema],
  trialUsed: { type: Boolean, default: false },
  referralCode: { type: String },
  referredBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const FavoriteItemSchema = new Schema({
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
  addedAt: { type: Date, default: Date.now },
  notes: { type: String },
  tags: [{ type: String }],
  priceAtSave: { type: Number },
  notifyPriceDrop: { type: Boolean, default: false }
}, { _id: false });

const CoordinatesSchema = new Schema({
  lat: { type: Number },
  lng: { type: Number },
  radius: { type: Number, default: 10 }
}, { _id: false });

const LocationCriteriaSchema = new Schema({
  city: { type: String },
  region: { type: String },
  country: { type: String },
  coordinates: { type: CoordinatesSchema }
}, { _id: false });

const RangeSchema = new Schema({
  min: { type: Number },
  max: { type: Number }
}, { _id: false });

const SearchCriteriaSchema = new Schema({
  location: { type: LocationCriteriaSchema },
  priceRange: { type: RangeSchema },
  propertyType: [{ type: String }],
  bedrooms: { type: RangeSchema },
  bathrooms: { type: RangeSchema },
  amenities: [{ type: String }],
  keywords: [{ type: String }]
}, { _id: false });

const SavedSearchSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  criteria: { type: SearchCriteriaSchema, required: true },
  createdAt: { type: Date, default: Date.now },
  lastRun: { type: Date },
  notificationsEnabled: { type: Boolean, default: true },
  frequency: {
    type: String,
    enum: ['instant', 'daily', 'weekly'],
    default: 'daily'
  }
}, { _id: false });

const FavoriteCollectionSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  properties: [{ type: Schema.Types.ObjectId, ref: 'Property' }],
  isPrivate: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const FavoriteNotificationsSchema = new Schema({
  priceDrops: { type: Boolean, default: true },
  availabilityChanges: { type: Boolean, default: true },
  newMatches: { type: Boolean, default: true }
}, { _id: false });

const FavoriteSettingsSchema = new Schema({
  properties: [FavoriteItemSchema],
  searches: [SavedSearchSchema],
  agents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  collections: [FavoriteCollectionSchema],
  notifications: { type: FavoriteNotificationsSchema, default: () => ({}) },
  maxFavorites: { type: Number, default: 20 }
}, { _id: false });

const NumberFormatSchema = new Schema({
  decimalSeparator: { type: String, enum: ['.', ','], default: ',' },
  thousandSeparator: { type: String, enum: ['.', ',', ' '], default: ' ' }
}, { _id: false });

const CurrencySchema = new Schema({
  code: { type: String, default: 'XAF' },
  symbol: { type: String, default: 'FCFA' },
  position: { type: String, enum: ['before', 'after'], default: 'after' }
}, { _id: false });

const TranslationPreferenceSchema = new Schema({
  originalLanguage: { type: String, required: true },
  targetLanguage: { type: String, required: true },
  autoTranslate: { type: Boolean, default: true }
}, { _id: false });

const LanguageSettingsSchema = new Schema({
  preferredLanguage: { type: String, default: 'fr' },
  fallbackLanguage: { type: String, default: 'en' },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },
  timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
  numberFormat: { type: NumberFormatSchema, default: () => ({}) },
  currency: { type: CurrencySchema, default: () => ({}) },
  timezone: { type: String, default: 'Africa/Douala' },
  autoDetect: { type: Boolean, default: true },
  translationHistory: [TranslationPreferenceSchema]
}, { _id: false });

const RegionRestrictionsSchema = new Schema({
  contentRestriction: { type: Boolean, default: false },
  ageVerified: { type: Boolean, default: false },
  legalAcknowledged: { type: Boolean, default: false }
}, { _id: false });

const TaxSettingsSchema = new Schema({
  vatApplicable: { type: Boolean, default: false },
  vatNumber: { type: String },
  taxRegion: { type: String }
}, { _id: false });

const RegionSettingsSchema = new Schema({
  currentRegion: { type: String, default: 'CM' },
  homeRegion: { type: String, default: 'CM' },
  preferredRegions: [{ type: String }],
  regionRestrictions: { type: RegionRestrictionsSchema, default: () => ({}) },
  measurementUnit: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
  temperatureUnit: { type: String, enum: ['celsius', 'fahrenheit'], default: 'celsius' },
  autoDetectLocation: { type: Boolean, default: true },
  defaultSearchRadius: { type: Number, default: 25 }, // km
  taxSettings: { type: TaxSettingsSchema, default: () => ({}) }
}, { _id: false });

// ================================
// MAIN SCHEMA
// ================================

export interface IUserParams extends UserParams, Document {}

const UserParamsSchema = new Schema<IUserParams>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  security: { type: SecuritySettingsSchema, default: () => ({}) },
  privacy: { type: PrivacySettingsSchema, default: () => ({}) },
  premium: { type: PremiumSettingsSchema, default: () => ({}) },
  favorites: { type: FavoriteSettingsSchema, default: () => ({}) },
  language: { type: LanguageSettingsSchema, default: () => ({}) },
  region: { type: RegionSettingsSchema, default: () => ({}) },
  version: { type: Number, default: 1 }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance optimization
UserParamsSchema.index({ userId: 1 });
UserParamsSchema.index({ 'premium.tier': 1 });
UserParamsSchema.index({ 'premium.status': 1 });
UserParamsSchema.index({ 'region.currentRegion': 1 });

// Pre-save middleware to increment version
UserParamsSchema.pre('save', function(next) {
  if (!this.isNew) {
    this.version = (this.version || 0) + 1;
  }
  next();
});

const UserParamsModel = model<IUserParams>('UserParams', UserParamsSchema);

export default UserParamsModel;
export { UserParamsSchema };
