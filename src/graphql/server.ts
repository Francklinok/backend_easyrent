import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './types';
import { resolvers } from './resolvers';
import { createGraphQLContext } from './middleware/authMiddleware';
import { createLogger } from '../utils/logger/logger';
import { GraphQLError, GraphQLFormattedError } from 'graphql';

const logger = createLogger('GraphQLServer');

// Création du schéma exécutable
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

// Configuration du serveur Apollo
export const apolloServer = new ApolloServer({
  schema,
  context: createGraphQLContext,
  
  // Gestion des erreurs
  formatError: (error: GraphQLError): GraphQLFormattedError => {
    logger.error('GraphQL Error', {
      message: error.message,
      path: error.path,
      locations: error.locations,
      extensions: error.extensions
    });
    
    // En production, masquer les détails des erreurs internes
    if (process.env.NODE_ENV === 'production') {
      if (error.message.includes('Database') || error.message.includes('Internal')) {
        return {
          message: 'Internal server error',
          locations: error.locations,
          path: error.path
        };
      }
    }
    
    return {
      message: error.message,
      locations: error.locations,
      path: error.path,
      extensions: {
        code: error.extensions?.code,
        timestamp: new Date().toISOString()
      }
    };
  },
  
  // Configuration du playground GraphQL
  introspection: process.env.NODE_ENV !== 'production',
  playground: process.env.NODE_ENV !== 'production' ? {
    settings: {
      'request.credentials': 'include',
      'editor.theme': 'dark',
      'editor.fontSize': 14,
      'editor.fontFamily': 'Monaco, Menlo, "Ubuntu Mono", monospace'
    }
  } : false,
  
  // Plugins pour le monitoring et la performance
  plugins: [
    {
      requestDidStart() {
        return {
          didResolveOperation(requestContext) {
            logger.info('GraphQL Operation', {
              operationName: requestContext.request.operationName,
              query: requestContext.request.query?.substring(0, 200) + '...'
            });
          },
          
          didEncounterErrors(requestContext) {
            logger.error('GraphQL Request Errors', {
              operationName: requestContext.request.operationName,
              errors: requestContext.errors?.map(err => err.message)
            });
          },
          
          willSendResponse(requestContext) {
            const duration = Date.now() - requestContext.request.http?.body?.timestamp;
            logger.info('GraphQL Response', {
              operationName: requestContext.request.operationName,
              duration: `${duration}ms`,
              success: !requestContext.errors?.length
            });
          }
        };
      }
    }
  ],
  
  // Configuration CORS pour GraphQL
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  
  // Limite de taille des requêtes
  uploads: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5
  }
});

// Fonction d'initialisation du serveur GraphQL
export const initializeGraphQLServer = async (app: any) => {
  try {
    await apolloServer.start();
    
    // Application du middleware GraphQL
    apolloServer.applyMiddleware({ 
      app, 
      path: '/graphql',
      cors: false // Géré par Apollo Server
    });
    
    logger.info('GraphQL Server initialized', {
      endpoint: `/graphql`,
      playground: process.env.NODE_ENV !== 'production' ? '/graphql' : 'disabled'
    });
    
    return apolloServer;
  } catch (error) {
    logger.error('Failed to initialize GraphQL Server', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};