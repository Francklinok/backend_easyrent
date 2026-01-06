import { createLogger } from '../../utils/logger/logger';
import paramsService from './ParamsService';
import {
  SecuritySettings,
  PrivacySettings,
  PremiumSettings,
  FavoriteSettings,
  LanguageSettings,
  RegionSettings,
  UserParams,
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
  PremiumTier,
  FavoriteItem,
  SavedSearch,
  FavoriteCollection
} from '../types/paramsTypes';

const logger = createLogger('ParamsClientService');

// Interface for GraphQL context
interface GraphQLContext {
  user?: {
    userId?: string;
    _id?: string;
  };
}

// Type for GraphQL operations
interface GraphQLOperation {
  query: string;
  variables?: Record<string, any>;
}

// Type for GraphQL response
interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Hybrid client service for user parameters
 * Priority: GraphQL > REST (fallback)
 */
class ParamsClientService {
  private graphqlEndpoint: string;
  private useGraphQLFirst: boolean = true;

  constructor(graphqlEndpoint: string = '/graphql') {
    this.graphqlEndpoint = graphqlEndpoint;
  }

  /**
   * Executes an operation trying GraphQL first, then REST as fallback
   */
  private async executeWithFallback<T>(
    graphqlOperation: () => Promise<T>,
    restFallback: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    if (this.useGraphQLFirst) {
      try {
        logger.debug(`[GraphQL] Attempting ${operationName}`);
        const result = await graphqlOperation();
        logger.debug(`[GraphQL] Success ${operationName}`);
        return result;
      } catch (graphqlError) {
        logger.warn(`[GraphQL] Failed ${operationName}, falling back to REST`, {
          error: graphqlError instanceof Error ? graphqlError.message : 'Unknown error'
        });
      }
    }

    try {
      logger.debug(`[REST] Attempting ${operationName}`);
      const result = await restFallback();
      logger.debug(`[REST] Success ${operationName}`);
      return result;
    } catch (restError) {
      logger.error(`[REST] Failed ${operationName}`, {
        error: restError instanceof Error ? restError.message : 'Unknown error'
      });
      throw restError;
    }
  }

  /**
   * Disables GraphQL and uses only REST
   */
  disableGraphQL(): void {
    this.useGraphQLFirst = false;
    logger.info('GraphQL disabled, using REST only');
  }

  /**
   * Enables GraphQL as the primary method
   */
  enableGraphQL(): void {
    this.useGraphQLFirst = true;
    logger.info('GraphQL enabled as primary method');
  }

  // ================================
  // ALL PARAMS
  // ================================

  async getAllParams(userId: string, context?: GraphQLContext): Promise<UserParams> {
    return this.executeWithFallback(
      async () => {
        // GraphQL via resolvers directs (côté serveur)
        if (context) {
          return paramsService.getAllParams(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.getAllParams(userId),
      'getAllParams'
    );
  }

  // ================================
  // SECURITY
  // ================================

  async getSecuritySettings(userId: string, context?: GraphQLContext): Promise<SecuritySettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.getSecuritySettings(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.getSecuritySettings(userId),
      'getSecuritySettings'
    );
  }

  async updateSecuritySettings(
    userId: string,
    updates: UpdateSecuritySettingsDto,
    context?: GraphQLContext
  ): Promise<SecuritySettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.updateSecuritySettings(userId, updates);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.updateSecuritySettings(userId, updates),
      'updateSecuritySettings'
    );
  }

  async enableTwoFactor(
    userId: string,
    method: 'sms' | 'email' | 'authenticator',
    context?: GraphQLContext
  ): Promise<SecuritySettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.enableTwoFactor(userId, method);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.enableTwoFactor(userId, method),
      'enableTwoFactor'
    );
  }

  async disableTwoFactor(userId: string, context?: GraphQLContext): Promise<SecuritySettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.disableTwoFactor(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.disableTwoFactor(userId),
      'disableTwoFactor'
    );
  }

  async addSecurityQuestion(
    userId: string,
    dto: AddSecurityQuestionDto,
    context?: GraphQLContext
  ): Promise<SecuritySettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.addSecurityQuestion(userId, dto);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.addSecurityQuestion(userId, dto),
      'addSecurityQuestion'
    );
  }

  async verifySecurityQuestion(
    userId: string,
    questionId: string,
    answer: string,
    context?: GraphQLContext
  ): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.verifySecurityQuestion(userId, questionId, answer);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.verifySecurityQuestion(userId, questionId, answer),
      'verifySecurityQuestion'
    );
  }

  // ================================
  // PRIVACY
  // ================================

  async getPrivacySettings(userId: string, context?: GraphQLContext): Promise<PrivacySettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.getPrivacySettings(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.getPrivacySettings(userId),
      'getPrivacySettings'
    );
  }

  async updatePrivacySettings(
    userId: string,
    updates: UpdatePrivacySettingsDto,
    context?: GraphQLContext
  ): Promise<PrivacySettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.updatePrivacySettings(userId, updates);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.updatePrivacySettings(userId, updates),
      'updatePrivacySettings'
    );
  }

  async blockUser(userId: string, dto: BlockUserDto, context?: GraphQLContext): Promise<PrivacySettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.blockUser(userId, dto);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.blockUser(userId, dto),
      'blockUser'
    );
  }

  async unblockUser(userId: string, blockedUserId: string, context?: GraphQLContext): Promise<PrivacySettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.unblockUser(userId, blockedUserId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.unblockUser(userId, blockedUserId),
      'unblockUser'
    );
  }

  async isUserBlocked(userId: string, targetUserId: string, context?: GraphQLContext): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.isUserBlocked(userId, targetUserId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.isUserBlocked(userId, targetUserId),
      'isUserBlocked'
    );
  }

  // ================================
  // PREMIUM
  // ================================

  async getPremiumSettings(userId: string, context?: GraphQLContext): Promise<PremiumSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.getPremiumSettings(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.getPremiumSettings(userId),
      'getPremiumSettings'
    );
  }

  async updatePremiumSettings(
    userId: string,
    updates: UpdatePremiumSettingsDto,
    context?: GraphQLContext
  ): Promise<PremiumSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.updatePremiumSettings(userId, updates);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.updatePremiumSettings(userId, updates),
      'updatePremiumSettings'
    );
  }

  async upgradePremium(
    userId: string,
    dto: UpgradePremiumDto,
    context?: GraphQLContext
  ): Promise<PremiumSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.upgradePremium(userId, dto);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.upgradePremium(userId, dto),
      'upgradePremium'
    );
  }

  async cancelPremium(userId: string, context?: GraphQLContext): Promise<PremiumSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.cancelPremium(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.cancelPremium(userId),
      'cancelPremium'
    );
  }

  async isPremium(userId: string, context?: GraphQLContext): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.isPremium(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.isPremium(userId),
      'isPremium'
    );
  }

  async getPremiumTier(userId: string, context?: GraphQLContext): Promise<PremiumTier> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.getPremiumTier(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.getPremiumTier(userId),
      'getPremiumTier'
    );
  }

  // ================================
  // FAVORITES
  // ================================

  async getFavoriteSettings(userId: string, context?: GraphQLContext): Promise<FavoriteSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.getFavoriteSettings(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.getFavoriteSettings(userId),
      'getFavoriteSettings'
    );
  }

  async updateFavoriteSettings(
    userId: string,
    updates: UpdateFavoriteSettingsDto,
    context?: GraphQLContext
  ): Promise<FavoriteSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.updateFavoriteSettings(userId, updates);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.updateFavoriteSettings(userId, updates),
      'updateFavoriteSettings'
    );
  }

  async addFavoriteProperty(
    userId: string,
    dto: AddFavoritePropertyDto,
    context?: GraphQLContext
  ): Promise<FavoriteSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.addFavoriteProperty(userId, dto);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.addFavoriteProperty(userId, dto),
      'addFavoriteProperty'
    );
  }

  async removeFavoriteProperty(
    userId: string,
    propertyId: string,
    context?: GraphQLContext
  ): Promise<FavoriteSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.removeFavoriteProperty(userId, propertyId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.removeFavoriteProperty(userId, propertyId),
      'removeFavoriteProperty'
    );
  }

  async isFavoriteProperty(
    userId: string,
    propertyId: string,
    context?: GraphQLContext
  ): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.isFavoriteProperty(userId, propertyId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.isFavoriteProperty(userId, propertyId),
      'isFavoriteProperty'
    );
  }

  async getFavoriteProperties(userId: string, context?: GraphQLContext): Promise<FavoriteItem[]> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.getFavoriteProperties(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.getFavoriteProperties(userId),
      'getFavoriteProperties'
    );
  }

  async createSavedSearch(
    userId: string,
    dto: CreateSavedSearchDto,
    context?: GraphQLContext
  ): Promise<SavedSearch> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.createSavedSearch(userId, dto);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.createSavedSearch(userId, dto),
      'createSavedSearch'
    );
  }

  async deleteSavedSearch(
    userId: string,
    searchId: string,
    context?: GraphQLContext
  ): Promise<FavoriteSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.deleteSavedSearch(userId, searchId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.deleteSavedSearch(userId, searchId),
      'deleteSavedSearch'
    );
  }

  async getSavedSearches(userId: string, context?: GraphQLContext): Promise<SavedSearch[]> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.getSavedSearches(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.getSavedSearches(userId),
      'getSavedSearches'
    );
  }

  async createFavoriteCollection(
    userId: string,
    dto: CreateFavoriteCollectionDto,
    context?: GraphQLContext
  ): Promise<FavoriteCollection> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.createFavoriteCollection(userId, dto);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.createFavoriteCollection(userId, dto),
      'createFavoriteCollection'
    );
  }

  async addFavoriteAgent(
    userId: string,
    agentId: string,
    context?: GraphQLContext
  ): Promise<FavoriteSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.addFavoriteAgent(userId, agentId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.addFavoriteAgent(userId, agentId),
      'addFavoriteAgent'
    );
  }

  async removeFavoriteAgent(
    userId: string,
    agentId: string,
    context?: GraphQLContext
  ): Promise<FavoriteSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.removeFavoriteAgent(userId, agentId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.removeFavoriteAgent(userId, agentId),
      'removeFavoriteAgent'
    );
  }

  // ================================
  // LANGUAGE
  // ================================

  async getLanguageSettings(userId: string, context?: GraphQLContext): Promise<LanguageSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.getLanguageSettings(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.getLanguageSettings(userId),
      'getLanguageSettings'
    );
  }

  async updateLanguageSettings(
    userId: string,
    updates: UpdateLanguageSettingsDto,
    context?: GraphQLContext
  ): Promise<LanguageSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.updateLanguageSettings(userId, updates);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.updateLanguageSettings(userId, updates),
      'updateLanguageSettings'
    );
  }

  async setPreferredLanguage(
    userId: string,
    language: string,
    context?: GraphQLContext
  ): Promise<LanguageSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.setPreferredLanguage(userId, language);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.setPreferredLanguage(userId, language),
      'setPreferredLanguage'
    );
  }

  async setTimezone(
    userId: string,
    timezone: string,
    context?: GraphQLContext
  ): Promise<LanguageSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.setTimezone(userId, timezone);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.setTimezone(userId, timezone),
      'setTimezone'
    );
  }

  async setCurrency(
    userId: string,
    code: string,
    symbol: string,
    position: 'before' | 'after',
    context?: GraphQLContext
  ): Promise<LanguageSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.setCurrency(userId, code, symbol, position);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.setCurrency(userId, code, symbol, position),
      'setCurrency'
    );
  }

  // ================================
  // REGION
  // ================================

  async getRegionSettings(userId: string, context?: GraphQLContext): Promise<RegionSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.getRegionSettings(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.getRegionSettings(userId),
      'getRegionSettings'
    );
  }

  async updateRegionSettings(
    userId: string,
    updates: UpdateRegionSettingsDto,
    context?: GraphQLContext
  ): Promise<RegionSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.updateRegionSettings(userId, updates);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.updateRegionSettings(userId, updates),
      'updateRegionSettings'
    );
  }

  async setCurrentRegion(
    userId: string,
    region: string,
    context?: GraphQLContext
  ): Promise<RegionSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.setCurrentRegion(userId, region);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.setCurrentRegion(userId, region),
      'setCurrentRegion'
    );
  }

  async addPreferredRegion(
    userId: string,
    region: string,
    context?: GraphQLContext
  ): Promise<RegionSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.addPreferredRegion(userId, region);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.addPreferredRegion(userId, region),
      'addPreferredRegion'
    );
  }

  async removePreferredRegion(
    userId: string,
    region: string,
    context?: GraphQLContext
  ): Promise<RegionSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.removePreferredRegion(userId, region);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.removePreferredRegion(userId, region),
      'removePreferredRegion'
    );
  }

  async setMeasurementUnit(
    userId: string,
    unit: 'metric' | 'imperial',
    context?: GraphQLContext
  ): Promise<RegionSettings> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.setMeasurementUnit(userId, unit);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.setMeasurementUnit(userId, unit),
      'setMeasurementUnit'
    );
  }

  // ================================
  // UTILITY
  // ================================

  async resetToDefaults(
    userId: string,
    sections?: ('security' | 'privacy' | 'premium' | 'favorites' | 'language' | 'region')[],
    context?: GraphQLContext
  ): Promise<UserParams> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.resetToDefaults(userId, sections);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.resetToDefaults(userId, sections),
      'resetToDefaults'
    );
  }

  async deleteUserParams(userId: string, context?: GraphQLContext): Promise<boolean> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.deleteUserParams(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.deleteUserParams(userId),
      'deleteUserParams'
    );
  }

  async exportUserParams(userId: string, context?: GraphQLContext): Promise<object> {
    return this.executeWithFallback(
      async () => {
        if (context) {
          return paramsService.exportUserParams(userId);
        }
        throw new Error('Context GraphQL requis');
      },
      async () => paramsService.exportUserParams(userId),
      'exportUserParams'
    );
  }
}

export const paramsClientService = new ParamsClientService();
export default paramsClientService;
