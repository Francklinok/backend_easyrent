import paramsService from '../services/ParamsService';
import { PremiumTier } from '../types/paramsTypes';

const getUserId = (context: any): string => {
  if (!context.user || (!context.user.userId && !context.user._id)) {
    throw new Error('Non authentifié');
  }
  return (context.user.userId || context.user._id).toString();
};

const requireAuth = (context: any): void => {
  if (!context.user) {
    throw new Error('Authentification requise');
  }
};

export const paramsResolvers = {
  Query: {
    // ================================
    // GET ALL PARAMS
    // ================================
    userParams: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getAllParams(userId);
    },

    // ================================
    // SECURITY
    // ================================
    securitySettings: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getSecuritySettings(userId);
    },

    // ================================
    // PRIVACY
    // ================================
    privacySettings: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getPrivacySettings(userId);
    },

    isUserBlocked: async (_: any, args: { targetUserId: string }, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.isUserBlocked(userId, args.targetUserId);
    },

    blockList: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getBlockList(userId);
    },

    // ================================
    // PREMIUM
    // ================================
    premiumSettings: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getPremiumSettings(userId);
    },

    isPremium: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.isPremium(userId);
    },

    premiumTier: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getPremiumTier(userId);
    },

    checkUsageLimit: async (
      _: any,
      args: { limitType: string; currentUsage: number },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.checkUsageLimit(userId, args.limitType as any, args.currentUsage);
    },

    // ================================
    // FAVORITES
    // ================================
    favoriteSettings: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getFavoriteSettings(userId);
    },

    favoriteProperties: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getFavoriteProperties(userId);
    },

    isFavoriteProperty: async (_: any, args: { propertyId: string }, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.isFavoriteProperty(userId, args.propertyId);
    },

    savedSearches: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getSavedSearches(userId);
    },

    // ================================
    // LANGUAGE
    // ================================
    languageSettings: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getLanguageSettings(userId);
    },

    // ================================
    // REGION
    // ================================
    regionSettings: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.getRegionSettings(userId);
    }
  },

  Mutation: {
    // ================================
    // SECURITY MUTATIONS
    // ================================
    updateSecuritySettings: async (
      _: any,
      args: { input: any },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.updateSecuritySettings(userId, args.input);
    },

    enableTwoFactor: async (
      _: any,
      args: { method: 'sms' | 'email' | 'authenticator' },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.enableTwoFactor(userId, args.method);
    },

    disableTwoFactor: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.disableTwoFactor(userId);
    },

    addSecurityQuestion: async (
      _: any,
      args: { question: string; answer: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.addSecurityQuestion(userId, {
        question: args.question,
        answer: args.answer
      });
    },

    verifySecurityQuestion: async (
      _: any,
      args: { questionId: string; answer: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.verifySecurityQuestion(userId, args.questionId, args.answer);
    },

    removeSecurityQuestion: async (
      _: any,
      args: { questionId: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.removeSecurityQuestion(userId, args.questionId);
    },

    updateIpWhitelist: async (
      _: any,
      args: { ipAddresses: string[] },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.updateIpWhitelist(userId, args.ipAddresses);
    },

    // ================================
    // PRIVACY MUTATIONS
    // ================================
    updatePrivacySettings: async (
      _: any,
      args: { input: any },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.updatePrivacySettings(userId, args.input);
    },

    blockUser: async (
      _: any,
      args: { userId: string; reason?: string },
      context: any
    ) => {
      requireAuth(context);
      const currentUserId = getUserId(context);
      return paramsService.blockUser(currentUserId, {
        userId: args.userId,
        reason: args.reason
      });
    },

    unblockUser: async (
      _: any,
      args: { userId: string },
      context: any
    ) => {
      requireAuth(context);
      const currentUserId = getUserId(context);
      return paramsService.unblockUser(currentUserId, args.userId);
    },

    // ================================
    // PREMIUM MUTATIONS
    // ================================
    updatePremiumSettings: async (
      _: any,
      args: { input: any },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.updatePremiumSettings(userId, args.input);
    },

    upgradePremium: async (
      _: any,
      args: { tier: PremiumTier; paymentMethodId: string; promoCode?: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.upgradePremium(userId, {
        tier: args.tier,
        paymentMethodId: args.paymentMethodId,
        promoCode: args.promoCode
      });
    },

    cancelPremium: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.cancelPremium(userId);
    },

    // ================================
    // FAVORITES MUTATIONS
    // ================================
    updateFavoriteSettings: async (
      _: any,
      args: { input: any },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.updateFavoriteSettings(userId, args.input);
    },

    addFavoriteProperty: async (
      _: any,
      args: { propertyId: string; notes?: string; tags?: string[]; notifyPriceDrop?: boolean },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.addFavoriteProperty(userId, {
        propertyId: args.propertyId,
        notes: args.notes,
        tags: args.tags,
        notifyPriceDrop: args.notifyPriceDrop
      });
    },

    removeFavoriteProperty: async (
      _: any,
      args: { propertyId: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.removeFavoriteProperty(userId, args.propertyId);
    },

    createSavedSearch: async (
      _: any,
      args: { input: any },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.createSavedSearch(userId, args.input);
    },

    deleteSavedSearch: async (
      _: any,
      args: { searchId: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.deleteSavedSearch(userId, args.searchId);
    },

    createFavoriteCollection: async (
      _: any,
      args: { input: any },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.createFavoriteCollection(userId, args.input);
    },

    deleteFavoriteCollection: async (
      _: any,
      args: { collectionId: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.deleteFavoriteCollection(userId, args.collectionId);
    },

    addToCollection: async (
      _: any,
      args: { collectionId: string; propertyId: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.addToCollection(userId, args.collectionId, args.propertyId);
    },

    removeFromCollection: async (
      _: any,
      args: { collectionId: string; propertyId: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.removeFromCollection(userId, args.collectionId, args.propertyId);
    },

    addFavoriteAgent: async (
      _: any,
      args: { agentId: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.addFavoriteAgent(userId, args.agentId);
    },

    removeFavoriteAgent: async (
      _: any,
      args: { agentId: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.removeFavoriteAgent(userId, args.agentId);
    },

    // ================================
    // LANGUAGE MUTATIONS
    // ================================
    updateLanguageSettings: async (
      _: any,
      args: { input: any },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.updateLanguageSettings(userId, args.input);
    },

    setPreferredLanguage: async (
      _: any,
      args: { language: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.setPreferredLanguage(userId, args.language);
    },

    setTimezone: async (
      _: any,
      args: { timezone: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.setTimezone(userId, args.timezone);
    },

    setCurrency: async (
      _: any,
      args: { code: string; symbol: string; position: 'before' | 'after' },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.setCurrency(userId, args.code, args.symbol, args.position);
    },

    // ================================
    // REGION MUTATIONS
    // ================================
    updateRegionSettings: async (
      _: any,
      args: { input: any },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.updateRegionSettings(userId, args.input);
    },

    setCurrentRegion: async (
      _: any,
      args: { region: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.setCurrentRegion(userId, args.region);
    },

    addPreferredRegion: async (
      _: any,
      args: { region: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.addPreferredRegion(userId, args.region);
    },

    removePreferredRegion: async (
      _: any,
      args: { region: string },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.removePreferredRegion(userId, args.region);
    },

    setMeasurementUnit: async (
      _: any,
      args: { unit: 'metric' | 'imperial' },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.setMeasurementUnit(userId, args.unit);
    },

    // ================================
    // UTILITY MUTATIONS
    // ================================
    resetParamsToDefaults: async (
      _: any,
      args: { sections?: string[] },
      context: any
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.resetToDefaults(userId, args.sections as any);
    },

    deleteUserParams: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.deleteUserParams(userId);
    },

    exportUserParams: async (_: any, __: any, context: any) => {
      requireAuth(context);
      const userId = getUserId(context);
      return paramsService.exportUserParams(userId);
    }
  },

  // ================================
  // TYPE RESOLVERS
  // ================================
  UserParams: {
    userId: (parent: any) => parent.userId?.toString() || parent.userId
  },

  FavoriteItem: {
    propertyId: (parent: any) => parent.propertyId?.toString() || parent.propertyId
  },

  FavoriteCollection: {
    properties: (parent: any) => parent.properties?.map((p: any) => p.toString()) || []
  },

  PrivacySettings: {
    blockList: (parent: any) => parent.blockList?.map((id: any) => id.toString()) || []
  },

  PremiumSettings: {
    referredBy: (parent: any) => parent.referredBy?.toString() || null
  }
};

export default paramsResolvers;
