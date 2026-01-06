import { gql } from 'graphql-tag';

export const paramsTypeDefs = gql`
  # ================================
  # ENUMS
  # ================================

  enum PrivacyLevel {
    public
    friends
    private
  }

  enum PremiumTier {
    free
    basic
    premium
    enterprise
  }

  enum PremiumStatus {
    active
    expired
    cancelled
    pending
  }

  enum TwoFactorMethod {
    sms
    email
    authenticator
  }

  enum TimeFormat {
    twelve
    twentyFour
  }

  enum CurrencyPosition {
    before
    after
  }

  enum MeasurementUnit {
    metric
    imperial
  }

  enum TemperatureUnit {
    celsius
    fahrenheit
  }

  enum SearchFrequency {
    instant
    daily
    weekly
  }

  enum BillingStatus {
    paid
    pending
    failed
    refunded
  }

  # ================================
  # SECURITY TYPES
  # ================================

  type SecurityQuestion {
    questionId: String!
    question: String!
    createdAt: String!
  }

  type LoginAlerts {
    newDevice: Boolean!
    newLocation: Boolean!
    failedAttempts: Boolean!
  }

  type SecuritySettings {
    twoFactorEnabled: Boolean!
    twoFactorMethod: TwoFactorMethod
    loginNotifications: Boolean!
    passwordExpiryDays: Int!
    sessionTimeout: Int!
    trustedDevicesEnabled: Boolean!
    maxActiveSessions: Int!
    biometricEnabled: Boolean!
    securityQuestions: [SecurityQuestion!]!
    loginAlerts: LoginAlerts!
    ipWhitelist: [String!]!
    lastSecurityCheck: String
  }

  # ================================
  # PRIVACY TYPES
  # ================================

  type DataSharing {
    analytics: Boolean!
    thirdParty: Boolean!
    marketing: Boolean!
    personalization: Boolean!
  }

  type PrivacySettings {
    profileVisibility: PrivacyLevel!
    showEmail: Boolean!
    showPhone: Boolean!
    showAddress: Boolean!
    showOnlineStatus: Boolean!
    showLastActive: Boolean!
    allowSearchByEmail: Boolean!
    allowSearchByPhone: Boolean!
    dataSharing: DataSharing!
    blockList: [ID!]!
    activityTracking: Boolean!
    locationSharing: Boolean!
    readReceipts: Boolean!
  }

  # ================================
  # PREMIUM TYPES
  # ================================

  type PremiumFeature {
    featureId: String!
    name: String!
    enabled: Boolean!
    limit: Int
    usedCount: Int
  }

  type BillingRecord {
    id: String!
    date: String!
    amount: Float!
    currency: String!
    description: String
    status: BillingStatus!
    invoiceUrl: String
  }

  type UsageLimits {
    maxProperties: Int!
    maxPhotosPerProperty: Int!
    maxMessages: Int!
    maxFavorites: Int!
    prioritySupport: Boolean!
    analyticsAccess: Boolean!
    featuredListings: Int!
  }

  type PremiumSettings {
    tier: PremiumTier!
    status: PremiumStatus!
    startDate: String
    endDate: String
    autoRenew: Boolean!
    paymentMethod: String
    features: [PremiumFeature!]!
    usageLimits: UsageLimits!
    billingHistory: [BillingRecord!]!
    trialUsed: Boolean!
    referralCode: String
    referredBy: ID
  }

  type UsageLimitCheck {
    allowed: Boolean!
    limit: Int!
    current: Int!
  }

  # ================================
  # FAVORITES TYPES
  # ================================

  type FavoriteItem {
    propertyId: ID!
    addedAt: String!
    notes: String
    tags: [String!]
    priceAtSave: Float
    notifyPriceDrop: Boolean!
  }

  type Coordinates {
    lat: Float!
    lng: Float!
    radius: Float
  }

  type LocationCriteria {
    city: String
    region: String
    country: String
    coordinates: Coordinates
  }

  type RangeCriteria {
    min: Float
    max: Float
  }

  type SearchCriteria {
    location: LocationCriteria
    priceRange: RangeCriteria
    propertyType: [String!]
    bedrooms: RangeCriteria
    bathrooms: RangeCriteria
    amenities: [String!]
    keywords: [String!]
  }

  type SavedSearch {
    id: String!
    name: String!
    criteria: SearchCriteria!
    createdAt: String!
    lastRun: String
    notificationsEnabled: Boolean!
    frequency: SearchFrequency!
  }

  type FavoriteCollection {
    id: String!
    name: String!
    description: String
    properties: [ID!]!
    isPrivate: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type FavoriteNotifications {
    priceDrops: Boolean!
    availabilityChanges: Boolean!
    newMatches: Boolean!
  }

  type FavoriteSettings {
    properties: [FavoriteItem!]!
    searches: [SavedSearch!]!
    agents: [ID!]!
    collections: [FavoriteCollection!]!
    notifications: FavoriteNotifications!
    maxFavorites: Int!
  }

  # ================================
  # LANGUAGE TYPES
  # ================================

  type NumberFormat {
    decimalSeparator: String!
    thousandSeparator: String!
  }

  type Currency {
    code: String!
    symbol: String!
    position: CurrencyPosition!
  }

  type TranslationPreference {
    originalLanguage: String!
    targetLanguage: String!
    autoTranslate: Boolean!
  }

  type LanguageSettings {
    preferredLanguage: String!
    fallbackLanguage: String!
    dateFormat: String!
    timeFormat: String!
    numberFormat: NumberFormat!
    currency: Currency!
    timezone: String!
    autoDetect: Boolean!
    translationHistory: [TranslationPreference!]!
  }

  # ================================
  # REGION TYPES
  # ================================

  type RegionRestrictions {
    contentRestriction: Boolean!
    ageVerified: Boolean!
    legalAcknowledged: Boolean!
  }

  type TaxSettings {
    vatApplicable: Boolean!
    vatNumber: String
    taxRegion: String
  }

  type RegionSettings {
    currentRegion: String!
    homeRegion: String!
    preferredRegions: [String!]!
    regionRestrictions: RegionRestrictions!
    measurementUnit: MeasurementUnit!
    temperatureUnit: TemperatureUnit!
    autoDetectLocation: Boolean!
    defaultSearchRadius: Float!
    taxSettings: TaxSettings!
  }

  # ================================
  # MAIN USER PARAMS TYPE
  # ================================

  type UserParams {
    userId: ID!
    security: SecuritySettings!
    privacy: PrivacySettings!
    premium: PremiumSettings!
    favorites: FavoriteSettings!
    language: LanguageSettings!
    region: RegionSettings!
    createdAt: String!
    updatedAt: String!
    version: Int!
  }

  type ParamsExport {
    exportedAt: String!
    version: Int!
    security: SecuritySettings!
    privacy: PrivacySettings!
    premium: PremiumSettings!
    favorites: FavoriteSettings!
    language: LanguageSettings!
    region: RegionSettings!
  }

  # ================================
  # INPUT TYPES
  # ================================

  input LoginAlertsInput {
    newDevice: Boolean
    newLocation: Boolean
    failedAttempts: Boolean
  }

  input UpdateSecuritySettingsInput {
    twoFactorEnabled: Boolean
    twoFactorMethod: TwoFactorMethod
    loginNotifications: Boolean
    passwordExpiryDays: Int
    sessionTimeout: Int
    trustedDevicesEnabled: Boolean
    maxActiveSessions: Int
    biometricEnabled: Boolean
    loginAlerts: LoginAlertsInput
    ipWhitelist: [String!]
  }

  input DataSharingInput {
    analytics: Boolean
    thirdParty: Boolean
    marketing: Boolean
    personalization: Boolean
  }

  input UpdatePrivacySettingsInput {
    profileVisibility: PrivacyLevel
    showEmail: Boolean
    showPhone: Boolean
    showAddress: Boolean
    showOnlineStatus: Boolean
    showLastActive: Boolean
    allowSearchByEmail: Boolean
    allowSearchByPhone: Boolean
    dataSharing: DataSharingInput
    activityTracking: Boolean
    locationSharing: Boolean
    readReceipts: Boolean
  }

  input UpdatePremiumSettingsInput {
    autoRenew: Boolean
    paymentMethod: String
  }

  input FavoriteNotificationsInput {
    priceDrops: Boolean
    availabilityChanges: Boolean
    newMatches: Boolean
  }

  input UpdateFavoriteSettingsInput {
    notifications: FavoriteNotificationsInput
  }

  input NumberFormatInput {
    decimalSeparator: String
    thousandSeparator: String
  }

  input CurrencyInput {
    code: String
    symbol: String
    position: CurrencyPosition
  }

  input UpdateLanguageSettingsInput {
    preferredLanguage: String
    fallbackLanguage: String
    dateFormat: String
    timeFormat: String
    numberFormat: NumberFormatInput
    currency: CurrencyInput
    timezone: String
    autoDetect: Boolean
  }

  input UpdateRegionSettingsInput {
    currentRegion: String
    homeRegion: String
    preferredRegions: [String!]
    measurementUnit: MeasurementUnit
    temperatureUnit: TemperatureUnit
    autoDetectLocation: Boolean
    defaultSearchRadius: Float
  }

  input CoordinatesInput {
    lat: Float!
    lng: Float!
    radius: Float
  }

  input LocationCriteriaInput {
    city: String
    region: String
    country: String
    coordinates: CoordinatesInput
  }

  input RangeCriteriaInput {
    min: Float
    max: Float
  }

  input SearchCriteriaInput {
    location: LocationCriteriaInput
    priceRange: RangeCriteriaInput
    propertyType: [String!]
    bedrooms: RangeCriteriaInput
    bathrooms: RangeCriteriaInput
    amenities: [String!]
    keywords: [String!]
  }

  input CreateSavedSearchInput {
    name: String!
    criteria: SearchCriteriaInput!
    notificationsEnabled: Boolean
    frequency: SearchFrequency
  }

  input CreateFavoriteCollectionInput {
    name: String!
    description: String
    isPrivate: Boolean
    propertyIds: [String!]
  }

  # ================================
  # QUERIES
  # ================================

  extend type Query {
    # All params
    userParams: UserParams!

    # Security
    securitySettings: SecuritySettings!

    # Privacy
    privacySettings: PrivacySettings!
    isUserBlocked(targetUserId: ID!): Boolean!
    blockList: [ID!]!

    # Premium
    premiumSettings: PremiumSettings!
    isPremium: Boolean!
    premiumTier: PremiumTier!
    checkUsageLimit(limitType: String!, currentUsage: Int!): UsageLimitCheck!

    # Favorites
    favoriteSettings: FavoriteSettings!
    favoriteProperties: [FavoriteItem!]!
    isFavoriteProperty(propertyId: ID!): Boolean!
    savedSearches: [SavedSearch!]!

    # Language
    languageSettings: LanguageSettings!

    # Region
    regionSettings: RegionSettings!
  }

  # ================================
  # MUTATIONS
  # ================================

  extend type Mutation {
    # Security
    updateSecuritySettings(input: UpdateSecuritySettingsInput!): SecuritySettings!
    enableTwoFactor(method: TwoFactorMethod!): SecuritySettings!
    disableTwoFactor: SecuritySettings!
    addSecurityQuestion(question: String!, answer: String!): SecuritySettings!
    verifySecurityQuestion(questionId: String!, answer: String!): Boolean!
    removeSecurityQuestion(questionId: String!): SecuritySettings!
    updateIpWhitelist(ipAddresses: [String!]!): SecuritySettings!

    # Privacy
    updatePrivacySettings(input: UpdatePrivacySettingsInput!): PrivacySettings!
    blockUser(userId: ID!, reason: String): PrivacySettings!
    unblockUser(userId: ID!): PrivacySettings!

    # Premium
    updatePremiumSettings(input: UpdatePremiumSettingsInput!): PremiumSettings!
    upgradePremium(tier: PremiumTier!, paymentMethodId: String!, promoCode: String): PremiumSettings!
    cancelPremium: PremiumSettings!

    # Favorites
    updateFavoriteSettings(input: UpdateFavoriteSettingsInput!): FavoriteSettings!
    addFavoriteProperty(propertyId: ID!, notes: String, tags: [String!], notifyPriceDrop: Boolean): FavoriteSettings!
    removeFavoriteProperty(propertyId: ID!): FavoriteSettings!
    createSavedSearch(input: CreateSavedSearchInput!): SavedSearch!
    deleteSavedSearch(searchId: String!): FavoriteSettings!
    createFavoriteCollection(input: CreateFavoriteCollectionInput!): FavoriteCollection!
    deleteFavoriteCollection(collectionId: String!): FavoriteSettings!
    addToCollection(collectionId: String!, propertyId: ID!): FavoriteCollection
    removeFromCollection(collectionId: String!, propertyId: ID!): FavoriteCollection
    addFavoriteAgent(agentId: ID!): FavoriteSettings!
    removeFavoriteAgent(agentId: ID!): FavoriteSettings!

    # Language
    updateLanguageSettings(input: UpdateLanguageSettingsInput!): LanguageSettings!
    setPreferredLanguage(language: String!): LanguageSettings!
    setTimezone(timezone: String!): LanguageSettings!
    setCurrency(code: String!, symbol: String!, position: CurrencyPosition!): LanguageSettings!

    # Region
    updateRegionSettings(input: UpdateRegionSettingsInput!): RegionSettings!
    setCurrentRegion(region: String!): RegionSettings!
    addPreferredRegion(region: String!): RegionSettings!
    removePreferredRegion(region: String!): RegionSettings!
    setMeasurementUnit(unit: MeasurementUnit!): RegionSettings!

    # Utility
    resetParamsToDefaults(sections: [String!]): UserParams!
    deleteUserParams: Boolean!
    exportUserParams: ParamsExport!
  }
`;

export default paramsTypeDefs;
