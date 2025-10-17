import { ApolloServer } from '@apollo/server';
import cors from 'cors';
import { json } from 'body-parser';
import { chatTypeDefs, chatResolvers } from '../graphql';
import { Server as IOServer } from 'socket.io';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('ChatGraphQLIntegration');

/**
 * Configuration GraphQL pour le chat
 * Permet d'utiliser GraphQL en parallèle avec les controllers REST existants
 */
export class ChatGraphQLIntegration {
  private apolloServer: ApolloServer | null = null;

  constructor(private io: IOServer) {}

  /**
   * Initialise le serveur Apollo avec les schémas de chat
   */
  async initializeApolloServer(existingTypeDefs?: any[], existingResolvers?: any[]): Promise<ApolloServer> {
    try {
      // Combiner les schémas existants avec ceux du chat
      const typeDefs = existingTypeDefs ? [...existingTypeDefs, chatTypeDefs] : [chatTypeDefs];
      const resolvers = existingResolvers ? [...existingResolvers, chatResolvers] : [chatResolvers];

      this.apolloServer = new ApolloServer({
        typeDefs,
        resolvers,
        introspection: process.env.NODE_ENV !== 'production',
        formatError: (error) => {
          logger.error('GraphQL Error:', error);
          return {
            message: error.message,
            code: error.extensions?.code,
            path: error.path
          } as any;
        }
      });

      await this.apolloServer.start();
      logger.info('Serveur Apollo GraphQL initialisé pour le chat');

      return this.apolloServer;
    } catch (error) {
      logger.error('Erreur initialisation Apollo Server:', error);
      throw error;
    }
  }

  /**
   * Applique le middleware GraphQL à l'application Express
   */
  async applyMiddleware(app: any, path: string = '/graphql'): Promise<void> {
    if (!this.apolloServer) {
      throw new Error('Apollo Server doit être initialisé avant d\'appliquer le middleware');
    }

    app.use(
      path,
      cors(),
      json(),
      async (req: any, res: any) => {
        try {
          const context = {
            user: req.user || null,
            req,
            io: this.io
          };
          
          await this.apolloServer!.executeOperation(
            { query: req.body.query, variables: req.body.variables },
            { contextValue: context }
          ).then(result => res.json(result));
        } catch (error) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    );

    logger.info(`GraphQL endpoint disponible sur ${path}`);
  }

  /**
   * Obtient l'URL du serveur GraphQL
   */
  getGraphQLUrl(serverUrl: string, path: string = '/graphql'): string {
    return `${serverUrl}${path}`;
  }

  /**
   * Arrête le serveur Apollo
   */
  async stop(): Promise<void> {
    if (this.apolloServer) {
      await this.apolloServer.stop();
      logger.info('Serveur Apollo arrêté');
    }
  }

  /**
   * Obtient les métriques du serveur GraphQL
   */
  getMetrics() {
    return {
      isRunning: !!this.apolloServer,
      endpoint: '/graphql',
      features: [
        'Queries: conversations, messages, search',
        'Mutations: sendMessage, createConversation, react, delete',
        'Subscriptions: messageAdded, typingStatus, presenceStatus',
        'Intégration WebSocket pour temps réel',
        'Authentification JWT',
        'Gestion d\'erreurs centralisée'
      ]
    };
  }
}

/**
 * Helper pour créer une instance pré-configurée
 */
export function createChatGraphQLServer(io: IOServer): ChatGraphQLIntegration {
  return new ChatGraphQLIntegration(io);
}

/**
 * Configuration de base pour intégrer avec un serveur Apollo existant
 */
export const chatGraphQLConfig = {
  typeDefs: chatTypeDefs,
  resolvers: chatResolvers,

  // Middleware de contexte spécifique au chat
  contextMiddleware: (context: any) => {
    return {
      ...context,
      // Ajouter des utilitaires spécifiques au chat
      chatUtils: {
        formatMessage: (message: any) => ({
          ...message,
          formattedTime: new Date(message.createdAt).toLocaleString()
        }),
        validateConversationAccess: async (conversationId: string, userId: string) => {
          // Logique de validation d'accès
          return true;
        }
      }
    };
  },

  // Schémas de validation
  validationRules: [
    // Ici vous pouvez ajouter des règles de validation GraphQL personnalisées
  ],

  // Configuration des subscriptions
  subscriptions: {
    path: '/graphql-subscriptions',
    onConnect: (connectionParams: any, webSocket: any) => {
      logger.info('WebSocket GraphQL connecté');
      return { user: connectionParams.authToken };
    },
    onDisconnect: () => {
      logger.info('WebSocket GraphQL déconnecté');
    }
  }
};

// Export par défaut pour usage simple
export default ChatGraphQLIntegration;