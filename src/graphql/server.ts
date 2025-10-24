import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { HeaderMap } from '@apollo/server';
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

    // Application du middleware GraphQL avec Apollo Server v5
    app.use(
      '/graphql',
      cors<cors.CorsRequest>({
        origin: '*',
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS']
      }),
      json(),
      async (req: any, res: any) => {
        try {
          const context = await createGraphQLContext({ req, res });

          // Convertir les headers Express en HeaderMap d'Apollo
          const headerMap = new HeaderMap();
          Object.entries(req.headers).forEach(([key, value]) => {
            if (typeof value === 'string') {
              headerMap.set(key, value);
            } else if (Array.isArray(value)) {
              headerMap.set(key, value.join(', '));
            }
          });

          const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
            httpGraphQLRequest: {
              method: req.method?.toUpperCase() || 'POST',
              headers: headerMap,
              search: req.url.split('?')[1] || '',
              body: req.body,
            },
            context: async () => context,
          });

          // Définir le status et les headers de la réponse
          for (const [key, value] of httpGraphQLResponse.headers) {
            res.setHeader(key, value);
          }

          res.status(httpGraphQLResponse.status || 200);

          // Envoyer le body
          if (httpGraphQLResponse.body.kind === 'complete') {
            res.send(httpGraphQLResponse.body.string);
          } else {
            for await (const chunk of httpGraphQLResponse.body.asyncIterator) {
              res.write(chunk);
            }
            res.end();
          }
        } catch (error) {
          logger.error('GraphQL request error', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          res.status(500).json({ errors: [{ message: 'Internal server error' }] });
        }
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