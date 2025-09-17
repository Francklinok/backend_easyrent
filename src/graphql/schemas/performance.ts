import { shield, rule, and, or } from 'graphql-shield';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('GraphQLSecurity');

// Rate limiters pour différents types d'opérations
const queryLimiter = new RateLimiterMemory({
  keyGenerator: (root, args, context) => context.user?.userId || context.req.ip,
  points: 100, // Nombre de requêtes
  duration: 60, // Par minute
});

const mutationLimiter = new RateLimiterMemory({
  keyGenerator: (root, args, context) => context.user?.userId || context.req.ip,
  points: 20, // Nombre de mutations
  duration: 60, // Par minute
});

const subscriptionLimiter = new RateLimiterMemory({
  keyGenerator: (root, args, context) => context.user?.userId || context.req.ip,
  points: 5, // Nombre de subscriptions
  duration: 60, // Par minute
});

// Règles d'authentification
const isAuthenticated = rule({ cache: 'contextual' })(
  async (parent, args, context) => {
    return !!context.user;
  }
);

const isOwner = rule({ cache: 'contextual' })(
  async (parent, args, context) => {
    return context.user?.role === 'OWNER';
  }
);

const isAgent = rule({ cache: 'contextual' })(
  async (parent, args, context) => {
    return context.user?.role === 'AGENT';
  }
);

const isAdmin = rule({ cache: 'contextual' })(
  async (parent, args, context) => {
    return context.user?.role === 'ADMIN';
  }
);

// Règles de rate limiting
const queryRateLimit = rule({ cache: 'no_cache' })(
  async (parent, args, context) => {
    try {
      await queryLimiter.consume(context.user?.userId || context.req.ip);
      return true;
    } catch (rejRes) {
      logger.warn('Query rate limit exceeded', {
        userId: context.user?.userId,
        ip: context.req.ip
      });
      return new Error('Too many queries. Please try again later.');
    }
  }
);

const mutationRateLimit = rule({ cache: 'no_cache' })(
  async (parent, args, context) => {
    try {
      await mutationLimiter.consume(context.user?.userId || context.req.ip);
      return true;
    } catch (rejRes) {
      logger.warn('Mutation rate limit exceeded', {
        userId: context.user?.userId,
        ip: context.req.ip
      });
      return new Error('Too many mutations. Please try again later.');
    }
  }
);

// Configuration du shield de sécurité
export const permissions = shield({
  Query: {
    // Queries publiques (pas de rate limit strict)
    property: queryRateLimit,
    properties: queryRateLimit,
    service: queryRateLimit,
    services: queryRateLimit,
    
    // Queries authentifiées
    me: and(isAuthenticated, queryRateLimit),
    wallet: and(isAuthenticated, queryRateLimit),
    conversations: and(isAuthenticated, queryRateLimit),
    activities: and(isAuthenticated, queryRateLimit),
    serviceRecommendations: and(isAuthenticated, queryRateLimit),
  },
  
  Mutation: {
    // Mutations de propriété
    createProperty: and(isAuthenticated, or(isOwner, isAgent), mutationRateLimit),
    updateProperty: and(isAuthenticated, or(isOwner, isAgent), mutationRateLimit),
    
    // Mutations de service
    createService: and(isAuthenticated, mutationRateLimit),
    subscribeToService: and(isAuthenticated, mutationRateLimit),
    
    // Mutations de wallet
    createTransaction: and(isAuthenticated, mutationRateLimit),
    transferMoney: and(isAuthenticated, mutationRateLimit),
    
    // Mutations de chat
    sendMessage: and(isAuthenticated, mutationRateLimit),
    
    // Mutations d'activité
    createActivity: and(isAuthenticated, mutationRateLimit),
    updateActivityStatus: and(isAuthenticated, or(isOwner, isAgent), mutationRateLimit),
  },
  
  Subscription: {
    messageAdded: and(isAuthenticated, subscriptionLimiter),
    activityUpdated: and(isAuthenticated, subscriptionLimiter),
    walletUpdated: and(isAuthenticated, subscriptionLimiter),
    serviceRecommendationUpdated: and(isAuthenticated, subscriptionLimiter),
  }
}, {
  allowExternalErrors: true,
  fallbackError: 'Access denied',
  debug: process.env.NODE_ENV !== 'production'
});

// Middleware de complexité des requêtes
export const complexityLimitRule = (maxComplexity: number = 1000) => {
  return rule({ cache: 'no_cache' })(
    async (parent, args, context, info) => {
      // Calcul simple de la complexité basé sur la profondeur
      const depth = getQueryDepth(info);
      
      if (depth > maxComplexity) {
        logger.warn('Query complexity exceeded', {
          depth,
          maxComplexity,
          userId: context.user?.userId,
          query: info.fieldName
        });
        return new Error(`Query is too complex. Maximum depth: ${maxComplexity}`);
      }
      
      return true;
    }
  );
};

// Fonction utilitaire pour calculer la profondeur d'une requête
function getQueryDepth(info: any, depth: number = 0): number {
  if (!info.fieldNodes || !info.fieldNodes[0].selectionSet) {
    return depth;
  }
  
  let maxDepth = depth;
  
  for (const selection of info.fieldNodes[0].selectionSet.selections) {
    if (selection.selectionSet) {
      const currentDepth = getQueryDepth({
        fieldNodes: [selection]
      }, depth + 1);
      
      maxDepth = Math.max(maxDepth, currentDepth);
    }
  }
  
  return maxDepth;
}