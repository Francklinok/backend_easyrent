// Export principal du module GraphQL
export { typeDefs } from './types';
export { resolvers } from './resolvers';
export { apolloServer, initializeGraphQLServer } from './server';
export { createGraphQLContext, requireAuth, requireRole, requireOwnership } from './middleware/authMiddleware';
export { permissions, complexityLimitRule } from './schemas/performance';
export * from './queries/optimizedQueries';

// Types pour l'utilisation externe
export interface GraphQLConfig {
  endpoint: string;
  playground: boolean;
  introspection: boolean;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  uploads: {
    maxFileSize: number;
    maxFiles: number;
  };
}

// Configuration par défaut
export const defaultGraphQLConfig: GraphQLConfig = {
  endpoint: '/graphql',
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  uploads: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5
  }
};