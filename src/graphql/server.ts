import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './types';
import { resolvers } from './resolvers';
import { createGraphQLContext } from './middleware/authMiddleware';
import { createLogger } from '../utils/logger/logger';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { DateTimeResolver, JSONResolver } from 'graphql-scalars';

const logger = createLogger('GraphQLServer');

// Configuration du serveur Apollo v4
export const createApolloServer = (httpServer: any) => {
  try {
    logger.info('Creating GraphQL schema...');
    
    // Ajout des scalaires personnalisés aux resolvers
    const scalarResolvers = {
      DateTime: DateTimeResolver,
      JSON: JSONResolver
    };

    logger.info('Merging resolvers...');
    // Création du schéma exécutable avec les scalaires
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: {
        ...resolvers,
        ...scalarResolvers
      }
    });
    
    logger.info('Schema created successfully');

    return new ApolloServer({
    schema,

    // Gestion des erreurs
    formatError: (formattedError: GraphQLFormattedError, error: any): GraphQLFormattedError => {
      logger.error('GraphQL Error', {
        message: formattedError.message,
        path: formattedError.path,
        locations: formattedError.locations,
        extensions: formattedError.extensions
      });

      // En production, masquer les détails des erreurs internes
      if (process.env.NODE_ENV === 'production') {
        if (formattedError.message.includes('Database') || formattedError.message.includes('Internal')) {
          return {
            message: 'Internal server error',
            locations: formattedError.locations,
            path: formattedError.path
          };
        }
      }

      return {
        message: formattedError.message,
        locations: formattedError.locations,
        path: formattedError.path,
        extensions: {
          code: formattedError.extensions?.code,
          timestamp: new Date().toISOString()
        }
      };
    },

    // Configuration introspection
    introspection: process.env.NODE_ENV !== 'production',

    //Plugins pour le monitoring et la performance
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async requestDidStart() {
          return {
            async didResolveOperation(requestContext) {
              logger.info('GraphQL Operation', {
                operationName: requestContext.request.operationName,
                query: requestContext.request.query?.substring(0, 200) + '...'
              });
            },

            async didEncounterErrors(requestContext) {
              logger.error('GraphQL Request Errors', {
                operationName: requestContext.request.operationName,
                errors: requestContext.errors?.map(err => err.message)
              });
            },

            async willSendResponse(requestContext) {
              logger.info('GraphQL Response', {
                operationName: requestContext.request.operationName,
                success: !requestContext.errors?.length
              });
            }
          };
        }
      }
    ]
    });
  } catch (error) {
    logger.error('Error creating Apollo Server:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

// Export pour compatibilité
export const apolloServer = null;

// Fonction d'initialisation du serveur GraphQL
export const initializeGraphQLServer = async (app: any, httpServer: any) => {
  try {
    const server = createApolloServer(httpServer);
    await server.start();

    //Application du middleware GraphQL avec la nouvelle syntaxe
    app.use(
      '/graphql',
      cors<cors.CorsRequest>(),
      json(),
      async (req: any, res: any) => {
        const context = await createGraphQLContext({ req, res });
        return (server as any).executeHTTPGraphQLRequest({
          httpGraphQLRequest: {
            body: req.body,
            headers: req.headers,
            method: req.method,
            search: req.url.split('?')[1] || ''
          },
          context: () => context
        }).then((result: any) => {
          res.status(result.status || 200);
          for (const [key, value] of result.headers) {
            res.setHeader(key, value);
          }
          res.send(result.body);
        });
      }
    );

    logger.info('GraphQL Server initialized', {
      endpoint: '/graphql',
      introspection: process.env.NODE_ENV !== 'production' ? 'enabled' : 'disabled'
    });

    return server;
  } catch (error) {
    logger.error('Failed to initialize GraphQL Server', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};