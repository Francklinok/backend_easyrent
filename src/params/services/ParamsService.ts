import { Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import UserParamsModel, { IUserParams } from '../models/paramsSchema';
import {
  UserParams,
  SecuritySettings,
  PrivacySettings,
  PremiumSettings,
  FavoriteSettings,
  LanguageSettings,
  RegionSettings,
  PremiumTier,
  PremiumStatus,
  PrivacyLevel,
  UpdateSecuritySettingsDto,
  UpdatePrivacySettingsDto,
  UpdatePremiumSettingsDto,
  UpdateFavoriteSettingsDto,
  UpdateLanguageSettingsDto,
  UpdateRegionSettingsDto,
  AddFavoritePropertyDto,
  CreateSavedSearchDto,
  CreateFavoriteCollectionDto,
  AddSecurityQuestionDto,
  BlockUserDto,
  UpgradePremiumDto,
  FavoriteItem,
  SavedSearch,
  FavoriteCollection,
  SecurityQuestion,
  BillingRecord
} from '../types/paramsTypes';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('ParamsService');

// ================================
// DEFAULT VALUES
// ================================

const getDefaultSecuritySettings = (): SecuritySettings => ({
  twoFactorEnabled: false,
  twoFactorMethod: 'email',
  loginNotifications: true,
  passwordExpiryDays: 90,
  sessionTimeout: 30,
  trustedDevicesEnabled: true,
  maxActiveSessions: 5,
  biometricEnabled: false,
  securityQuestions: [],
  loginAlerts: {
    newDevice: true,
    newLocation: true,
    failedAttempts: true
  },
  ipWhitelist: []
});

const getDefaultPrivacySettings = (): PrivacySettings => ({
  profileVisibility: PrivacyLevel.PUBLIC,
  showEmail: false,
  showPhone: false,
  showAddress: false,
  showOnlineStatus: true,
  showLastActive: true,
  allowSearchByEmail: true,
  allowSearchByPhone: false,
  dataSharing: {
    analytics: true,
    thirdParty: false,
    marketing: false,
    personalization: true
  },
  blockList: [],
  activityTracking: true,
  locationSharing: false,
  readReceipts: true
});

const getDefaultPremiumSettings = (): PremiumSettings => ({
  tier: PremiumTier.FREE,
  status: PremiumStatus.ACTIVE,
  autoRenew: false,
  features: [],
  usageLimits: {
    maxProperties: 3,
    maxPhotosPerProperty: 5,
    maxMessages: 50,
    maxFavorites: 20,
    prioritySupport: false,
    analyticsAccess: false,
    featuredListings: 0
  },
  billingHistory: [],
  trialUsed: false
});

const getDefaultFavoriteSettings = (): FavoriteSettings => ({
  properties: [],
  searches: [],
  agents: [],
  collections: [],
  notifications: {
    priceDrops: true,
    availabilityChanges: true,
    newMatches: true
  },
  maxFavorites: 20
});

const getDefaultLanguageSettings = (): LanguageSettings => ({
  preferredLanguage: 'fr',
  fallbackLanguage: 'en',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  numberFormat: {
    decimalSeparator: ',',
    thousandSeparator: ' '
  },
  currency: {
    code: 'XAF',
    symbol: 'FCFA',
    position: 'after'
  },
  timezone: 'Africa/Douala',
  autoDetect: true,
  translationHistory: []
});

const getDefaultRegionSettings = (): RegionSettings => ({
  currentRegion: 'CM',
  homeRegion: 'CM',
  preferredRegions: ['CM'],
  regionRestrictions: {
    contentRestriction: false,
    ageVerified: false,
    legalAcknowledged: false
  },
  measurementUnit: 'metric',
  temperatureUnit: 'celsius',
  autoDetectLocation: true,
  defaultSearchRadius: 25,
  taxSettings: {
    vatApplicable: false
  }
});

// Premium tier configurations
const PREMIUM_CONFIGS: Record<PremiumTier, PremiumSettings['usageLimits']> = {
  [PremiumTier.FREE]: {
    maxProperties: 3,
    maxPhotosPerProperty: 5,
    maxMessages: 50,
    maxFavorites: 20,
    prioritySupport: false,
    analyticsAccess: false,
    featuredListings: 0
  },
  [PremiumTier.BASIC]: {
    maxProperties: 10,
    maxPhotosPerProperty: 10,
    maxMessages: 200,
    maxFavorites: 50,
    prioritySupport: false,
    analyticsAccess: false,
    featuredListings: 1
  },
  [PremiumTier.PREMIUM]: {
    maxProperties: 50,
    maxPhotosPerProperty: 20,
    maxMessages: 1000,
    maxFavorites: 200,
    prioritySupport: true,
    analyticsAccess: true,
    featuredListings: 5
  },
  [PremiumTier.ENTERPRISE]: {
    maxProperties: -1, // unlimited
    maxPhotosPerProperty: 50,
    maxMessages: -1, // unlimited
    maxFavorites: -1, // unlimited
    prioritySupport: true,
    analyticsAccess: true,
    featuredListings: -1 // unlimited
  }
};

class ParamsService {

  // ================================
  // INITIALIZATION & RETRIEVAL
  // ================================

  async getOrCreateUserParams(userId: string): Promise<IUserParams> {
    try {
      let params = await UserParamsModel.findOne({ userId: new Types.ObjectId(userId) });

      if (!params) {
        params = await this.createDefaultParams(userId);
        logger.info('Created default params for user', { userId });
      }

      return params;
    } catch (error) {
      logger.error('Error getting user params', { userId, error });
      throw error;
    }
  }

  async createDefaultParams(userId: string): Promise<IUserParams> {
    const params = new UserParamsModel({
      userId: new Types.ObjectId(userId),
      security: getDefaultSecuritySettings(),
      privacy: getDefaultPrivacySettings(),
      premium: getDefaultPremiumSettings(),
      favorites: getDefaultFavoriteSettings(),
      language: getDefaultLanguageSettings(),
      region: getDefaultRegionSettings()
    });

    return params.save();
  }

  async getAllParams(userId: string): Promise<UserParams> {
    const params = await this.getOrCreateUserParams(userId);
    return params.toObject();
  }

  // ================================
  // SECURITY SETTINGS
  // ================================

  async getSecuritySettings(userId: string): Promise<SecuritySettings> {
    const params = await this.getOrCreateUserParams(userId);
    return params.security;
  }

  async updateSecuritySettings(
    userId: string,
    updates: UpdateSecuritySettingsDto
  ): Promise<SecuritySettings> {
    const params = await this.getOrCreateUserParams(userId);

    Object.assign(params.security, updates);
    params.security.lastSecurityCheck = new Date();

    await params.save();
    logger.info('Updated security settings', { userId });

    return params.security;
  }

  async enableTwoFactor(
    userId: string,
    method: 'sms' | 'email' | 'authenticator'
  ): Promise<SecuritySettings> {
    return this.updateSecuritySettings(userId, {
      twoFactorEnabled: true,
      twoFactorMethod: method
    });
  }

  async disableTwoFactor(userId: string): Promise<SecuritySettings> {
    return this.updateSecuritySettings(userId, {
      twoFactorEnabled: false
    });
  }

  async addSecurityQuestion(
    userId: string,
    dto: AddSecurityQuestionDto
  ): Promise<SecuritySettings> {
    const params = await this.getOrCreateUserParams(userId);

    const hashedAnswer = await bcrypt.hash(dto.answer.toLowerCase().trim(), 10);

    const securityQuestion: SecurityQuestion = {
      questionId: uuidv4(),
      question: dto.question,
      answerHash: hashedAnswer,
      createdAt: new Date()
    };

    params.security.securityQuestions.push(securityQuestion);
    await params.save();

    logger.info('Added security question', { userId });
    return params.security;
  }

  async verifySecurityQuestion(
    userId: string,
    questionId: string,
    answer: string
  ): Promise<boolean> {
    const params = await this.getOrCreateUserParams(userId);

    const question = params.security.securityQuestions.find(
      q => q.questionId === questionId
    );

    if (!question) {
      return false;
    }

    return bcrypt.compare(answer.toLowerCase().trim(), question.answerHash);
  }

  async removeSecurityQuestion(
    userId: string,
    questionId: string
  ): Promise<SecuritySettings> {
    const params = await this.getOrCreateUserParams(userId);

    params.security.securityQuestions = params.security.securityQuestions.filter(
      q => q.questionId !== questionId
    );

    await params.save();
    return params.security;
  }

  async updateIpWhitelist(
    userId: string,
    ipAddresses: string[]
  ): Promise<SecuritySettings> {
    return this.updateSecuritySettings(userId, {
      ipWhitelist: ipAddresses
    });
  }

  // ================================
  // PRIVACY SETTINGS
  // ================================

  async getPrivacySettings(userId: string): Promise<PrivacySettings> {
    const params = await this.getOrCreateUserParams(userId);
    return params.privacy;
  }

  async updatePrivacySettings(
    userId: string,
    updates: UpdatePrivacySettingsDto
  ): Promise<PrivacySettings> {
    const params = await this.getOrCreateUserParams(userId);

    if (updates.dataSharing) {
      Object.assign(params.privacy.dataSharing, updates.dataSharing);
      delete updates.dataSharing;
    }

    Object.assign(params.privacy, updates);
    await params.save();

    logger.info('Updated privacy settings', { userId });
    return params.privacy;
  }

  async blockUser(userId: string, dto: BlockUserDto): Promise<PrivacySettings> {
    const params = await this.getOrCreateUserParams(userId);

    const blockedUserId = new Types.ObjectId(dto.userId);

    if (!params.privacy.blockList.some(id => id.equals(blockedUserId))) {
      params.privacy.blockList.push(blockedUserId);
      await params.save();
      logger.info('Blocked user', { userId, blockedUserId: dto.userId });
    }

    return params.privacy;
  }

  async unblockUser(userId: string, blockedUserId: string): Promise<PrivacySettings> {
    const params = await this.getOrCreateUserParams(userId);

    params.privacy.blockList = params.privacy.blockList.filter(
      id => !id.equals(new Types.ObjectId(blockedUserId))
    );

    await params.save();
    logger.info('Unblocked user', { userId, blockedUserId });

    return params.privacy;
  }

  async isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
    const params = await this.getOrCreateUserParams(userId);
    return params.privacy.blockList.some(
      id => id.equals(new Types.ObjectId(targetUserId))
    );
  }

  async getBlockList(userId: string): Promise<Types.ObjectId[]> {
    const params = await this.getOrCreateUserParams(userId);
    return params.privacy.blockList;
  }

  // ================================
  // PREMIUM SETTINGS
  // ================================

  async getPremiumSettings(userId: string): Promise<PremiumSettings> {
    const params = await this.getOrCreateUserParams(userId);
    return params.premium;
  }

  async updatePremiumSettings(
    userId: string,
    updates: UpdatePremiumSettingsDto
  ): Promise<PremiumSettings> {
    const params = await this.getOrCreateUserParams(userId);

    Object.assign(params.premium, updates);
    await params.save();

    logger.info('Updated premium settings', { userId });
    return params.premium;
  }

  async upgradePremium(userId: string, dto: UpgradePremiumDto): Promise<PremiumSettings> {
    const params = await this.getOrCreateUserParams(userId);

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1); // 1 month default

    params.premium.tier = dto.tier;
    params.premium.status = PremiumStatus.ACTIVE;
    params.premium.startDate = now;
    params.premium.endDate = endDate;
    params.premium.paymentMethod = dto.paymentMethodId;
    params.premium.usageLimits = { ...PREMIUM_CONFIGS[dto.tier] };
    params.premium.autoRenew = true;

    // Add billing record
    const billingRecord: BillingRecord = {
      id: uuidv4(),
      date: now,
      amount: this.getPremiumPrice(dto.tier),
      currency: 'XAF',
      description: `${dto.tier} subscription`,
      status: 'paid'
    };

    params.premium.billingHistory.push(billingRecord);

    await params.save();
    logger.info('Upgraded premium', { userId, tier: dto.tier });

    return params.premium;
  }

  async cancelPremium(userId: string): Promise<PremiumSettings> {
    const params = await this.getOrCreateUserParams(userId);

    params.premium.status = PremiumStatus.CANCELLED;
    params.premium.autoRenew = false;

    await params.save();
    logger.info('Cancelled premium', { userId });

    return params.premium;
  }

  async checkPremiumExpiry(userId: string): Promise<boolean> {
    const params = await this.getOrCreateUserParams(userId);

    if (params.premium.tier === PremiumTier.FREE) {
      return false;
    }

    if (params.premium.endDate && new Date() > params.premium.endDate) {
      params.premium.status = PremiumStatus.EXPIRED;

      if (!params.premium.autoRenew) {
        params.premium.tier = PremiumTier.FREE;
        params.premium.usageLimits = { ...PREMIUM_CONFIGS[PremiumTier.FREE] };
      }

      await params.save();
      return true;
    }

    return false;
  }

  async isPremium(userId: string): Promise<boolean> {
    const params = await this.getOrCreateUserParams(userId);
    return params.premium.tier !== PremiumTier.FREE &&
           params.premium.status === PremiumStatus.ACTIVE;
  }

  async getPremiumTier(userId: string): Promise<PremiumTier> {
    const params = await this.getOrCreateUserParams(userId);
    return params.premium.tier;
  }

  async checkUsageLimit(
    userId: string,
    limitType: keyof PremiumSettings['usageLimits'],
    currentUsage: number
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const params = await this.getOrCreateUserParams(userId);
    const limit = params.premium.usageLimits[limitType];

    if (typeof limit === 'boolean') {
      return { allowed: limit, limit: limit ? 1 : 0, current: currentUsage };
    }

    const numLimit = limit as number;
    if (numLimit === -1) {
      return { allowed: true, limit: -1, current: currentUsage };
    }

    return {
      allowed: currentUsage < numLimit,
      limit: numLimit,
      current: currentUsage
    };
  }

  private getPremiumPrice(tier: PremiumTier): number {
    const prices: Record<PremiumTier, number> = {
      [PremiumTier.FREE]: 0,
      [PremiumTier.BASIC]: 5000,
      [PremiumTier.PREMIUM]: 15000,
      [PremiumTier.ENTERPRISE]: 50000
    };
    return prices[tier];
  }

  // ================================
  // FAVORITES SETTINGS
  // ================================

  async getFavoriteSettings(userId: string): Promise<FavoriteSettings> {
    const params = await this.getOrCreateUserParams(userId);
    return params.favorites;
  }

  async updateFavoriteSettings(
    userId: string,
    updates: UpdateFavoriteSettingsDto
  ): Promise<FavoriteSettings> {
    const params = await this.getOrCreateUserParams(userId);

    if (updates.notifications) {
      Object.assign(params.favorites.notifications, updates.notifications);
    }

    await params.save();
    return params.favorites;
  }

  async addFavoriteProperty(
    userId: string,
    dto: AddFavoritePropertyDto
  ): Promise<FavoriteSettings> {
    const params = await this.getOrCreateUserParams(userId);

    // Check usage limit
    const limitCheck = await this.checkUsageLimit(
      userId,
      'maxFavorites',
      params.favorites.properties.length
    );

    if (!limitCheck.allowed) {
      throw new Error(`Favorites limit reached (${limitCheck.limit})`);
    }

    const propertyId = new Types.ObjectId(dto.propertyId);

    // Check if already in favorites
    if (params.favorites.properties.some(f => f.propertyId.equals(propertyId))) {
      throw new Error('This property is already in your favorites');
    }

    const favoriteItem: FavoriteItem = {
      propertyId,
      addedAt: new Date(),
      notes: dto.notes,
      tags: dto.tags || [],
      notifyPriceDrop: dto.notifyPriceDrop ?? false
    };

    params.favorites.properties.push(favoriteItem);
    await params.save();

    logger.info('Added favorite property', { userId, propertyId: dto.propertyId });
    return params.favorites;
  }

  async removeFavoriteProperty(
    userId: string,
    propertyId: string
  ): Promise<FavoriteSettings> {
    const params = await this.getOrCreateUserParams(userId);

    params.favorites.properties = params.favorites.properties.filter(
      f => !f.propertyId.equals(new Types.ObjectId(propertyId))
    );

    await params.save();
    logger.info('Removed favorite property', { userId, propertyId });

    return params.favorites;
  }

  async isFavoriteProperty(userId: string, propertyId: string): Promise<boolean> {
    const params = await this.getOrCreateUserParams(userId);
    return params.favorites.properties.some(
      f => f.propertyId.equals(new Types.ObjectId(propertyId))
    );
  }

  async getFavoriteProperties(userId: string): Promise<FavoriteItem[]> {
    const params = await this.getOrCreateUserParams(userId);
    return params.favorites.properties;
  }

  async createSavedSearch(
    userId: string,
    dto: CreateSavedSearchDto
  ): Promise<SavedSearch> {
    const params = await this.getOrCreateUserParams(userId);

    const savedSearch: SavedSearch = {
      id: uuidv4(),
      name: dto.name,
      criteria: dto.criteria,
      createdAt: new Date(),
      notificationsEnabled: dto.notificationsEnabled ?? true,
      frequency: dto.frequency ?? 'daily'
    };

    params.favorites.searches.push(savedSearch);
    await params.save();

    logger.info('Created saved search', { userId, searchId: savedSearch.id });
    return savedSearch;
  }

  async deleteSavedSearch(
    userId: string,
    searchId: string
  ): Promise<FavoriteSettings> {
    const params = await this.getOrCreateUserParams(userId);

    params.favorites.searches = params.favorites.searches.filter(
      s => s.id !== searchId
    );

    await params.save();
    return params.favorites;
  }

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    const params = await this.getOrCreateUserParams(userId);
    return params.favorites.searches;
  }

  async createFavoriteCollection(
    userId: string,
    dto: CreateFavoriteCollectionDto
  ): Promise<FavoriteCollection> {
    const params = await this.getOrCreateUserParams(userId);

    const collection: FavoriteCollection = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      properties: (dto.propertyIds || []).map(id => new Types.ObjectId(id)),
      isPrivate: dto.isPrivate ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    params.favorites.collections.push(collection);
    await params.save();

    logger.info('Created favorite collection', { userId, collectionId: collection.id });
    return collection;
  }

  async deleteFavoriteCollection(
    userId: string,
    collectionId: string
  ): Promise<FavoriteSettings> {
    const params = await this.getOrCreateUserParams(userId);

    params.favorites.collections = params.favorites.collections.filter(
      c => c.id !== collectionId
    );

    await params.save();
    return params.favorites;
  }

  async addToCollection(
    userId: string,
    collectionId: string,
    propertyId: string
  ): Promise<FavoriteCollection | null> {
    const params = await this.getOrCreateUserParams(userId);

    const collection = params.favorites.collections.find(c => c.id === collectionId);
    if (!collection) return null;

    const propId = new Types.ObjectId(propertyId);
    if (!collection.properties.some(p => p.equals(propId))) {
      collection.properties.push(propId);
      collection.updatedAt = new Date();
      await params.save();
    }

    return collection;
  }

  async removeFromCollection(
    userId: string,
    collectionId: string,
    propertyId: string
  ): Promise<FavoriteCollection | null> {
    const params = await this.getOrCreateUserParams(userId);

    const collection = params.favorites.collections.find(c => c.id === collectionId);
    if (!collection) return null;

    collection.properties = collection.properties.filter(
      p => !p.equals(new Types.ObjectId(propertyId))
    );
    collection.updatedAt = new Date();

    await params.save();
    return collection;
  }

  async addFavoriteAgent(userId: string, agentId: string): Promise<FavoriteSettings> {
    const params = await this.getOrCreateUserParams(userId);

    const agentObjectId = new Types.ObjectId(agentId);
    if (!params.favorites.agents.some(a => a.equals(agentObjectId))) {
      params.favorites.agents.push(agentObjectId);
      await params.save();
    }

    return params.favorites;
  }

  async removeFavoriteAgent(userId: string, agentId: string): Promise<FavoriteSettings> {
    const params = await this.getOrCreateUserParams(userId);

    params.favorites.agents = params.favorites.agents.filter(
      a => !a.equals(new Types.ObjectId(agentId))
    );

    await params.save();
    return params.favorites;
  }

  // ================================
  // LANGUAGE SETTINGS
  // ================================

  async getLanguageSettings(userId: string): Promise<LanguageSettings> {
    const params = await this.getOrCreateUserParams(userId);
    return params.language;
  }

  async updateLanguageSettings(
    userId: string,
    updates: UpdateLanguageSettingsDto
  ): Promise<LanguageSettings> {
    const params = await this.getOrCreateUserParams(userId);

    if (updates.numberFormat) {
      Object.assign(params.language.numberFormat, updates.numberFormat);
      delete updates.numberFormat;
    }

    if (updates.currency) {
      Object.assign(params.language.currency, updates.currency);
      delete updates.currency;
    }

    Object.assign(params.language, updates);
    await params.save();

    logger.info('Updated language settings', { userId });
    return params.language;
  }

  async setPreferredLanguage(userId: string, language: string): Promise<LanguageSettings> {
    return this.updateLanguageSettings(userId, { preferredLanguage: language });
  }

  async setTimezone(userId: string, timezone: string): Promise<LanguageSettings> {
    return this.updateLanguageSettings(userId, { timezone });
  }

  async setCurrency(
    userId: string,
    code: string,
    symbol: string,
    position: 'before' | 'after'
  ): Promise<LanguageSettings> {
    return this.updateLanguageSettings(userId, {
      currency: { code, symbol, position }
    });
  }

  // ================================
  // REGION SETTINGS
  // ================================

  async getRegionSettings(userId: string): Promise<RegionSettings> {
    const params = await this.getOrCreateUserParams(userId);
    return params.region;
  }

  async updateRegionSettings(
    userId: string,
    updates: UpdateRegionSettingsDto
  ): Promise<RegionSettings> {
    const params = await this.getOrCreateUserParams(userId);

    Object.assign(params.region, updates);
    await params.save();

    logger.info('Updated region settings', { userId });
    return params.region;
  }

  async setCurrentRegion(userId: string, region: string): Promise<RegionSettings> {
    return this.updateRegionSettings(userId, { currentRegion: region });
  }

  async addPreferredRegion(userId: string, region: string): Promise<RegionSettings> {
    const params = await this.getOrCreateUserParams(userId);

    if (!params.region.preferredRegions.includes(region)) {
      params.region.preferredRegions.push(region);
      await params.save();
    }

    return params.region;
  }

  async removePreferredRegion(userId: string, region: string): Promise<RegionSettings> {
    const params = await this.getOrCreateUserParams(userId);

    params.region.preferredRegions = params.region.preferredRegions.filter(
      r => r !== region
    );

    await params.save();
    return params.region;
  }

  async setMeasurementUnit(
    userId: string,
    unit: 'metric' | 'imperial'
  ): Promise<RegionSettings> {
    return this.updateRegionSettings(userId, { measurementUnit: unit });
  }

  // ================================
  // UTILITY METHODS
  // ================================

  async deleteUserParams(userId: string): Promise<boolean> {
    const result = await UserParamsModel.deleteOne({
      userId: new Types.ObjectId(userId)
    });

    logger.info('Deleted user params', { userId, deleted: result.deletedCount > 0 });
    return result.deletedCount > 0;
  }

  async resetToDefaults(
    userId: string,
    sections?: ('security' | 'privacy' | 'premium' | 'favorites' | 'language' | 'region')[]
  ): Promise<UserParams> {
    const params = await this.getOrCreateUserParams(userId);

    const sectionsToReset = sections || ['security', 'privacy', 'favorites', 'language', 'region'];

    if (sectionsToReset.includes('security')) {
      params.security = getDefaultSecuritySettings() as any;
    }
    if (sectionsToReset.includes('privacy')) {
      params.privacy = getDefaultPrivacySettings() as any;
    }
    if (sectionsToReset.includes('favorites')) {
      params.favorites = getDefaultFavoriteSettings() as any;
    }
    if (sectionsToReset.includes('language')) {
      params.language = getDefaultLanguageSettings() as any;
    }
    if (sectionsToReset.includes('region')) {
      params.region = getDefaultRegionSettings() as any;
    }

    await params.save();
    logger.info('Reset params to defaults', { userId, sections: sectionsToReset });

    return params.toObject();
  }

  async exportUserParams(userId: string): Promise<object> {
    const params = await this.getOrCreateUserParams(userId);

    return {
      exportedAt: new Date(),
      version: params.version,
      security: {
        ...params.security,
        securityQuestions: params.security.securityQuestions.map(q => ({
          questionId: q.questionId,
          question: q.question,
          createdAt: q.createdAt
        }))
      },
      privacy: {
        ...params.privacy,
        blockList: params.privacy.blockList.length
      },
      premium: params.premium,
      favorites: {
        ...params.favorites,
        properties: params.favorites.properties.length,
        searches: params.favorites.searches.length,
        collections: params.favorites.collections.length,
        agents: params.favorites.agents.length
      },
      language: params.language,
      region: params.region
    };
  }
}

export const paramsService = new ParamsService();
export default paramsService;
