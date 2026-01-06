import { Types } from 'mongoose';

// ================================
// ENUMS
// ================================

export enum PrivacyLevel {
  PUBLIC = 'public',
  FRIENDS = 'friends',
  PRIVATE = 'private'
}

export enum PremiumTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export enum PremiumStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PENDING = 'pending'
}

// ================================
// SECURITY SETTINGS
// ================================

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  twoFactorMethod?: 'sms' | 'email' | 'authenticator';
  loginNotifications: boolean;
  passwordExpiryDays: number;
  sessionTimeout: number; // in minutes
  trustedDevicesEnabled: boolean;
  maxActiveSessions: number;
  biometricEnabled: boolean;
  securityQuestions: SecurityQuestion[];
  loginAlerts: {
    newDevice: boolean;
    newLocation: boolean;
    failedAttempts: boolean;
  };
  ipWhitelist: string[];
  lastSecurityCheck?: Date;
}

export interface SecurityQuestion {
  questionId: string;
  question: string;
  answerHash: string;
  createdAt: Date;
}

// ================================
// PRIVACY SETTINGS
// ================================

export interface PrivacySettings {
  profileVisibility: PrivacyLevel;
  showEmail: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showOnlineStatus: boolean;
  showLastActive: boolean;
  allowSearchByEmail: boolean;
  allowSearchByPhone: boolean;
  dataSharing: {
    analytics: boolean;
    thirdParty: boolean;
    marketing: boolean;
    personalization: boolean;
  };
  blockList: Types.ObjectId[];
  activityTracking: boolean;
  locationSharing: boolean;
  readReceipts: boolean;
}

// ================================
// PREMIUM SETTINGS
// ================================

export interface PremiumSettings {
  tier: PremiumTier;
  status: PremiumStatus;
  startDate?: Date;
  endDate?: Date;
  autoRenew: boolean;
  paymentMethod?: string;
  features: PremiumFeature[];
  usageLimits: {
    maxProperties: number;
    maxPhotosPerProperty: number;
    maxMessages: number;
    maxFavorites: number;
    prioritySupport: boolean;
    analyticsAccess: boolean;
    featuredListings: number;
  };
  billingHistory: BillingRecord[];
  trialUsed: boolean;
  referralCode?: string;
  referredBy?: Types.ObjectId;
}

export interface PremiumFeature {
  featureId: string;
  name: string;
  enabled: boolean;
  limit?: number;
  usedCount?: number;
}

export interface BillingRecord {
  id: string;
  date: Date;
  amount: number;
  currency: string;
  description: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  invoiceUrl?: string;
}

// ================================
// FAVORITES SETTINGS
// ================================

export interface FavoriteSettings {
  properties: FavoriteItem[];
  searches: SavedSearch[];
  agents: Types.ObjectId[];
  collections: FavoriteCollection[];
  notifications: {
    priceDrops: boolean;
    availabilityChanges: boolean;
    newMatches: boolean;
  };
  maxFavorites: number;
}

export interface FavoriteItem {
  propertyId: Types.ObjectId;
  addedAt: Date;
  notes?: string;
  tags?: string[];
  priceAtSave?: number;
  notifyPriceDrop?: boolean;
}

export interface SavedSearch {
  id: string;
  name: string;
  criteria: SearchCriteria;
  createdAt: Date;
  lastRun?: Date;
  notificationsEnabled: boolean;
  frequency: 'instant' | 'daily' | 'weekly';
}

export interface SearchCriteria {
  location?: {
    city?: string;
    region?: string;
    country?: string;
    coordinates?: {
      lat: number;
      lng: number;
      radius: number;
    };
  };
  priceRange?: {
    min?: number;
    max?: number;
  };
  propertyType?: string[];
  bedrooms?: { min?: number; max?: number };
  bathrooms?: { min?: number; max?: number };
  amenities?: string[];
  keywords?: string[];
}

export interface FavoriteCollection {
  id: string;
  name: string;
  description?: string;
  properties: Types.ObjectId[];
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ================================
// LANGUAGE SETTINGS
// ================================

export interface LanguageSettings {
  preferredLanguage: string;
  fallbackLanguage: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  numberFormat: {
    decimalSeparator: '.' | ',';
    thousandSeparator: '.' | ',' | ' ';
  };
  currency: {
    code: string;
    symbol: string;
    position: 'before' | 'after';
  };
  timezone: string;
  autoDetect: boolean;
  translationHistory: TranslationPreference[];
}

export interface TranslationPreference {
  originalLanguage: string;
  targetLanguage: string;
  autoTranslate: boolean;
}

// ================================
// REGION SETTINGS
// ================================

export interface RegionSettings {
  currentRegion: string;
  homeRegion: string;
  preferredRegions: string[];
  regionRestrictions: {
    contentRestriction: boolean;
    ageVerified: boolean;
    legalAcknowledged: boolean;
  };
  measurementUnit: 'metric' | 'imperial';
  temperatureUnit: 'celsius' | 'fahrenheit';
  autoDetectLocation: boolean;
  defaultSearchRadius: number; // in km
  taxSettings: {
    vatApplicable: boolean;
    vatNumber?: string;
    taxRegion?: string;
  };
}

// ================================
// COMBINED USER PARAMS
// ================================

export interface UserParams {
  userId: Types.ObjectId;
  security: SecuritySettings;
  privacy: PrivacySettings;
  premium: PremiumSettings;
  favorites: FavoriteSettings;
  language: LanguageSettings;
  region: RegionSettings;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// ================================
// DTOs
// ================================

export interface UpdateSecuritySettingsDto {
  twoFactorEnabled?: boolean;
  twoFactorMethod?: 'sms' | 'email' | 'authenticator';
  loginNotifications?: boolean;
  passwordExpiryDays?: number;
  sessionTimeout?: number;
  trustedDevicesEnabled?: boolean;
  maxActiveSessions?: number;
  biometricEnabled?: boolean;
  loginAlerts?: {
    newDevice?: boolean;
    newLocation?: boolean;
    failedAttempts?: boolean;
  };
  ipWhitelist?: string[];
}

export interface UpdatePrivacySettingsDto {
  profileVisibility?: PrivacyLevel;
  showEmail?: boolean;
  showPhone?: boolean;
  showAddress?: boolean;
  showOnlineStatus?: boolean;
  showLastActive?: boolean;
  allowSearchByEmail?: boolean;
  allowSearchByPhone?: boolean;
  dataSharing?: {
    analytics?: boolean;
    thirdParty?: boolean;
    marketing?: boolean;
    personalization?: boolean;
  };
  activityTracking?: boolean;
  locationSharing?: boolean;
  readReceipts?: boolean;
}

export interface UpdatePremiumSettingsDto {
  autoRenew?: boolean;
  paymentMethod?: string;
}

export interface UpdateFavoriteSettingsDto {
  notifications?: {
    priceDrops?: boolean;
    availabilityChanges?: boolean;
    newMatches?: boolean;
  };
}

export interface UpdateLanguageSettingsDto {
  preferredLanguage?: string;
  fallbackLanguage?: string;
  dateFormat?: string;
  timeFormat?: '12h' | '24h';
  numberFormat?: {
    decimalSeparator?: '.' | ',';
    thousandSeparator?: '.' | ',' | ' ';
  };
  currency?: {
    code?: string;
    symbol?: string;
    position?: 'before' | 'after';
  };
  timezone?: string;
  autoDetect?: boolean;
}

export interface UpdateRegionSettingsDto {
  currentRegion?: string;
  homeRegion?: string;
  preferredRegions?: string[];
  measurementUnit?: 'metric' | 'imperial';
  temperatureUnit?: 'celsius' | 'fahrenheit';
  autoDetectLocation?: boolean;
  defaultSearchRadius?: number;
}

export interface AddFavoritePropertyDto {
  propertyId: string;
  notes?: string;
  tags?: string[];
  notifyPriceDrop?: boolean;
}

export interface CreateSavedSearchDto {
  name: string;
  criteria: SearchCriteria;
  notificationsEnabled?: boolean;
  frequency?: 'instant' | 'daily' | 'weekly';
}

export interface CreateFavoriteCollectionDto {
  name: string;
  description?: string;
  isPrivate?: boolean;
  propertyIds?: string[];
}

export interface AddSecurityQuestionDto {
  question: string;
  answer: string;
}

export interface BlockUserDto {
  userId: string;
  reason?: string;
}

export interface UpgradePremiumDto {
  tier: PremiumTier;
  paymentMethodId: string;
  promoCode?: string;
}
