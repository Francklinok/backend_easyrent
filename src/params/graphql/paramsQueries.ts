import { gql } from 'graphql-tag';

// ================================
// QUERIES
// ================================

export const GET_USER_PARAMS = gql`
  query GetUserParams {
    userParams {
      userId
      security {
        twoFactorEnabled
        twoFactorMethod
        loginNotifications
        passwordExpiryDays
        sessionTimeout
        trustedDevicesEnabled
        maxActiveSessions
        biometricEnabled
        securityQuestions {
          questionId
          question
          createdAt
        }
        loginAlerts {
          newDevice
          newLocation
          failedAttempts
        }
        ipWhitelist
        lastSecurityCheck
      }
      privacy {
        profileVisibility
        showEmail
        showPhone
        showAddress
        showOnlineStatus
        showLastActive
        allowSearchByEmail
        allowSearchByPhone
        dataSharing {
          analytics
          thirdParty
          marketing
          personalization
        }
        blockList
        activityTracking
        locationSharing
        readReceipts
      }
      premium {
        tier
        status
        startDate
        endDate
        autoRenew
        usageLimits {
          maxProperties
          maxPhotosPerProperty
          maxMessages
          maxFavorites
          prioritySupport
          analyticsAccess
          featuredListings
        }
        trialUsed
      }
      favorites {
        properties {
          propertyId
          addedAt
          notes
          tags
          notifyPriceDrop
        }
        searches {
          id
          name
          notificationsEnabled
          frequency
        }
        agents
        notifications {
          priceDrops
          availabilityChanges
          newMatches
        }
        maxFavorites
      }
      language {
        preferredLanguage
        fallbackLanguage
        dateFormat
        timeFormat
        numberFormat {
          decimalSeparator
          thousandSeparator
        }
        currency {
          code
          symbol
          position
        }
        timezone
        autoDetect
      }
      region {
        currentRegion
        homeRegion
        preferredRegions
        measurementUnit
        temperatureUnit
        autoDetectLocation
        defaultSearchRadius
      }
      createdAt
      updatedAt
      version
    }
  }
`;

export const GET_SECURITY_SETTINGS = gql`
  query GetSecuritySettings {
    securitySettings {
      twoFactorEnabled
      twoFactorMethod
      loginNotifications
      passwordExpiryDays
      sessionTimeout
      trustedDevicesEnabled
      maxActiveSessions
      biometricEnabled
      securityQuestions {
        questionId
        question
        createdAt
      }
      loginAlerts {
        newDevice
        newLocation
        failedAttempts
      }
      ipWhitelist
      lastSecurityCheck
    }
  }
`;

export const GET_PRIVACY_SETTINGS = gql`
  query GetPrivacySettings {
    privacySettings {
      profileVisibility
      showEmail
      showPhone
      showAddress
      showOnlineStatus
      showLastActive
      allowSearchByEmail
      allowSearchByPhone
      dataSharing {
        analytics
        thirdParty
        marketing
        personalization
      }
      blockList
      activityTracking
      locationSharing
      readReceipts
    }
  }
`;

export const GET_PREMIUM_SETTINGS = gql`
  query GetPremiumSettings {
    premiumSettings {
      tier
      status
      startDate
      endDate
      autoRenew
      paymentMethod
      features {
        featureId
        name
        enabled
        limit
        usedCount
      }
      usageLimits {
        maxProperties
        maxPhotosPerProperty
        maxMessages
        maxFavorites
        prioritySupport
        analyticsAccess
        featuredListings
      }
      billingHistory {
        id
        date
        amount
        currency
        description
        status
        invoiceUrl
      }
      trialUsed
      referralCode
    }
  }
`;

export const GET_FAVORITE_SETTINGS = gql`
  query GetFavoriteSettings {
    favoriteSettings {
      properties {
        propertyId
        addedAt
        notes
        tags
        priceAtSave
        notifyPriceDrop
      }
      searches {
        id
        name
        criteria {
          location {
            city
            region
            country
          }
          priceRange {
            min
            max
          }
          propertyType
          bedrooms {
            min
            max
          }
          amenities
        }
        createdAt
        lastRun
        notificationsEnabled
        frequency
      }
      agents
      collections {
        id
        name
        description
        properties
        isPrivate
        createdAt
        updatedAt
      }
      notifications {
        priceDrops
        availabilityChanges
        newMatches
      }
      maxFavorites
    }
  }
`;

export const GET_LANGUAGE_SETTINGS = gql`
  query GetLanguageSettings {
    languageSettings {
      preferredLanguage
      fallbackLanguage
      dateFormat
      timeFormat
      numberFormat {
        decimalSeparator
        thousandSeparator
      }
      currency {
        code
        symbol
        position
      }
      timezone
      autoDetect
      translationHistory {
        originalLanguage
        targetLanguage
        autoTranslate
      }
    }
  }
`;

export const GET_REGION_SETTINGS = gql`
  query GetRegionSettings {
    regionSettings {
      currentRegion
      homeRegion
      preferredRegions
      regionRestrictions {
        contentRestriction
        ageVerified
        legalAcknowledged
      }
      measurementUnit
      temperatureUnit
      autoDetectLocation
      defaultSearchRadius
      taxSettings {
        vatApplicable
        vatNumber
        taxRegion
      }
    }
  }
`;

export const IS_PREMIUM = gql`
  query IsPremium {
    isPremium
  }
`;

export const GET_PREMIUM_TIER = gql`
  query GetPremiumTier {
    premiumTier
  }
`;

export const CHECK_USAGE_LIMIT = gql`
  query CheckUsageLimit($limitType: String!, $currentUsage: Int!) {
    checkUsageLimit(limitType: $limitType, currentUsage: $currentUsage) {
      allowed
      limit
      current
    }
  }
`;

export const IS_USER_BLOCKED = gql`
  query IsUserBlocked($targetUserId: ID!) {
    isUserBlocked(targetUserId: $targetUserId)
  }
`;

export const GET_BLOCK_LIST = gql`
  query GetBlockList {
    blockList
  }
`;

export const GET_FAVORITE_PROPERTIES = gql`
  query GetFavoriteProperties {
    favoriteProperties {
      propertyId
      addedAt
      notes
      tags
      priceAtSave
      notifyPriceDrop
    }
  }
`;

export const IS_FAVORITE_PROPERTY = gql`
  query IsFavoriteProperty($propertyId: ID!) {
    isFavoriteProperty(propertyId: $propertyId)
  }
`;

export const GET_SAVED_SEARCHES = gql`
  query GetSavedSearches {
    savedSearches {
      id
      name
      criteria {
        location {
          city
          region
          country
        }
        priceRange {
          min
          max
        }
        propertyType
        bedrooms {
          min
          max
        }
        amenities
        keywords
      }
      createdAt
      lastRun
      notificationsEnabled
      frequency
    }
  }
`;

// ================================
// MUTATIONS
// ================================

export const UPDATE_SECURITY_SETTINGS = gql`
  mutation UpdateSecuritySettings($input: UpdateSecuritySettingsInput!) {
    updateSecuritySettings(input: $input) {
      twoFactorEnabled
      twoFactorMethod
      loginNotifications
      passwordExpiryDays
      sessionTimeout
      trustedDevicesEnabled
      maxActiveSessions
      biometricEnabled
      lastSecurityCheck
    }
  }
`;

export const ENABLE_TWO_FACTOR = gql`
  mutation EnableTwoFactor($method: TwoFactorMethod!) {
    enableTwoFactor(method: $method) {
      twoFactorEnabled
      twoFactorMethod
    }
  }
`;

export const DISABLE_TWO_FACTOR = gql`
  mutation DisableTwoFactor {
    disableTwoFactor {
      twoFactorEnabled
    }
  }
`;

export const ADD_SECURITY_QUESTION = gql`
  mutation AddSecurityQuestion($question: String!, $answer: String!) {
    addSecurityQuestion(question: $question, answer: $answer) {
      securityQuestions {
        questionId
        question
        createdAt
      }
    }
  }
`;

export const VERIFY_SECURITY_QUESTION = gql`
  mutation VerifySecurityQuestion($questionId: String!, $answer: String!) {
    verifySecurityQuestion(questionId: $questionId, answer: $answer)
  }
`;

export const UPDATE_PRIVACY_SETTINGS = gql`
  mutation UpdatePrivacySettings($input: UpdatePrivacySettingsInput!) {
    updatePrivacySettings(input: $input) {
      profileVisibility
      showEmail
      showPhone
      showAddress
      showOnlineStatus
      showLastActive
      allowSearchByEmail
      allowSearchByPhone
      dataSharing {
        analytics
        thirdParty
        marketing
        personalization
      }
      activityTracking
      locationSharing
      readReceipts
    }
  }
`;

export const BLOCK_USER = gql`
  mutation BlockUser($userId: ID!, $reason: String) {
    blockUser(userId: $userId, reason: $reason) {
      blockList
    }
  }
`;

export const UNBLOCK_USER = gql`
  mutation UnblockUser($userId: ID!) {
    unblockUser(userId: $userId) {
      blockList
    }
  }
`;

export const UPGRADE_PREMIUM = gql`
  mutation UpgradePremium($tier: PremiumTier!, $paymentMethodId: String!, $promoCode: String) {
    upgradePremium(tier: $tier, paymentMethodId: $paymentMethodId, promoCode: $promoCode) {
      tier
      status
      startDate
      endDate
      autoRenew
      usageLimits {
        maxProperties
        maxPhotosPerProperty
        maxMessages
        maxFavorites
        prioritySupport
        analyticsAccess
        featuredListings
      }
    }
  }
`;

export const CANCEL_PREMIUM = gql`
  mutation CancelPremium {
    cancelPremium {
      tier
      status
      autoRenew
    }
  }
`;

export const ADD_FAVORITE_PROPERTY = gql`
  mutation AddFavoriteProperty($propertyId: ID!, $notes: String, $tags: [String!], $notifyPriceDrop: Boolean) {
    addFavoriteProperty(propertyId: $propertyId, notes: $notes, tags: $tags, notifyPriceDrop: $notifyPriceDrop) {
      properties {
        propertyId
        addedAt
        notes
        tags
        notifyPriceDrop
      }
    }
  }
`;

export const REMOVE_FAVORITE_PROPERTY = gql`
  mutation RemoveFavoriteProperty($propertyId: ID!) {
    removeFavoriteProperty(propertyId: $propertyId) {
      properties {
        propertyId
      }
    }
  }
`;

export const CREATE_SAVED_SEARCH = gql`
  mutation CreateSavedSearch($input: CreateSavedSearchInput!) {
    createSavedSearch(input: $input) {
      id
      name
      criteria {
        location {
          city
          region
          country
        }
        priceRange {
          min
          max
        }
        propertyType
      }
      notificationsEnabled
      frequency
    }
  }
`;

export const DELETE_SAVED_SEARCH = gql`
  mutation DeleteSavedSearch($searchId: String!) {
    deleteSavedSearch(searchId: $searchId) {
      searches {
        id
        name
      }
    }
  }
`;

export const CREATE_FAVORITE_COLLECTION = gql`
  mutation CreateFavoriteCollection($input: CreateFavoriteCollectionInput!) {
    createFavoriteCollection(input: $input) {
      id
      name
      description
      properties
      isPrivate
      createdAt
    }
  }
`;

export const ADD_FAVORITE_AGENT = gql`
  mutation AddFavoriteAgent($agentId: ID!) {
    addFavoriteAgent(agentId: $agentId) {
      agents
    }
  }
`;

export const REMOVE_FAVORITE_AGENT = gql`
  mutation RemoveFavoriteAgent($agentId: ID!) {
    removeFavoriteAgent(agentId: $agentId) {
      agents
    }
  }
`;

export const UPDATE_LANGUAGE_SETTINGS = gql`
  mutation UpdateLanguageSettings($input: UpdateLanguageSettingsInput!) {
    updateLanguageSettings(input: $input) {
      preferredLanguage
      fallbackLanguage
      dateFormat
      timeFormat
      numberFormat {
        decimalSeparator
        thousandSeparator
      }
      currency {
        code
        symbol
        position
      }
      timezone
      autoDetect
    }
  }
`;

export const SET_PREFERRED_LANGUAGE = gql`
  mutation SetPreferredLanguage($language: String!) {
    setPreferredLanguage(language: $language) {
      preferredLanguage
    }
  }
`;

export const SET_TIMEZONE = gql`
  mutation SetTimezone($timezone: String!) {
    setTimezone(timezone: $timezone) {
      timezone
    }
  }
`;

export const SET_CURRENCY = gql`
  mutation SetCurrency($code: String!, $symbol: String!, $position: CurrencyPosition!) {
    setCurrency(code: $code, symbol: $symbol, position: $position) {
      currency {
        code
        symbol
        position
      }
    }
  }
`;

export const UPDATE_REGION_SETTINGS = gql`
  mutation UpdateRegionSettings($input: UpdateRegionSettingsInput!) {
    updateRegionSettings(input: $input) {
      currentRegion
      homeRegion
      preferredRegions
      measurementUnit
      temperatureUnit
      autoDetectLocation
      defaultSearchRadius
    }
  }
`;

export const SET_CURRENT_REGION = gql`
  mutation SetCurrentRegion($region: String!) {
    setCurrentRegion(region: $region) {
      currentRegion
    }
  }
`;

export const ADD_PREFERRED_REGION = gql`
  mutation AddPreferredRegion($region: String!) {
    addPreferredRegion(region: $region) {
      preferredRegions
    }
  }
`;

export const REMOVE_PREFERRED_REGION = gql`
  mutation RemovePreferredRegion($region: String!) {
    removePreferredRegion(region: $region) {
      preferredRegions
    }
  }
`;

export const SET_MEASUREMENT_UNIT = gql`
  mutation SetMeasurementUnit($unit: MeasurementUnit!) {
    setMeasurementUnit(unit: $unit) {
      measurementUnit
    }
  }
`;

export const RESET_PARAMS_TO_DEFAULTS = gql`
  mutation ResetParamsToDefaults($sections: [String!]) {
    resetParamsToDefaults(sections: $sections) {
      userId
      version
    }
  }
`;

export const EXPORT_USER_PARAMS = gql`
  mutation ExportUserParams {
    exportUserParams {
      exportedAt
      version
    }
  }
`;

// Export all queries and mutations
export const ParamsQueries = {
  GET_USER_PARAMS,
  GET_SECURITY_SETTINGS,
  GET_PRIVACY_SETTINGS,
  GET_PREMIUM_SETTINGS,
  GET_FAVORITE_SETTINGS,
  GET_LANGUAGE_SETTINGS,
  GET_REGION_SETTINGS,
  IS_PREMIUM,
  GET_PREMIUM_TIER,
  CHECK_USAGE_LIMIT,
  IS_USER_BLOCKED,
  GET_BLOCK_LIST,
  GET_FAVORITE_PROPERTIES,
  IS_FAVORITE_PROPERTY,
  GET_SAVED_SEARCHES
};

export const ParamsMutations = {
  UPDATE_SECURITY_SETTINGS,
  ENABLE_TWO_FACTOR,
  DISABLE_TWO_FACTOR,
  ADD_SECURITY_QUESTION,
  VERIFY_SECURITY_QUESTION,
  UPDATE_PRIVACY_SETTINGS,
  BLOCK_USER,
  UNBLOCK_USER,
  UPGRADE_PREMIUM,
  CANCEL_PREMIUM,
  ADD_FAVORITE_PROPERTY,
  REMOVE_FAVORITE_PROPERTY,
  CREATE_SAVED_SEARCH,
  DELETE_SAVED_SEARCH,
  CREATE_FAVORITE_COLLECTION,
  ADD_FAVORITE_AGENT,
  REMOVE_FAVORITE_AGENT,
  UPDATE_LANGUAGE_SETTINGS,
  SET_PREFERRED_LANGUAGE,
  SET_TIMEZONE,
  SET_CURRENCY,
  UPDATE_REGION_SETTINGS,
  SET_CURRENT_REGION,
  ADD_PREFERRED_REGION,
  REMOVE_PREFERRED_REGION,
  SET_MEASUREMENT_UNIT,
  RESET_PARAMS_TO_DEFAULTS,
  EXPORT_USER_PARAMS
};

export default {
  queries: ParamsQueries,
  mutations: ParamsMutations
};
