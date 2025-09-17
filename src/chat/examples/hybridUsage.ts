/**
 * Exemple d'utilisation hybride : GraphQL + Controllers REST
 * Ce fichier montre comment utiliser les deux approches en parallèle
 */

import express from 'express';
import { Server as IOServer } from 'socket.io';
import ChatController from '../controllers/chatController';
import { ChatGraphQLIntegration } from '../integration/graphqlIntegration';

const app = express();
const server = require('http').createServer(app);
const io = new IOServer(server);

// ==================== CONFIGURATION HYBRIDE ====================

/**
 * Configuration qui utilise à la fois REST et GraphQL
 */
export class HybridChatConfiguration {
  private chatController: ChatController;
  private graphqlIntegration: ChatGraphQLIntegration;

  constructor(io: IOServer) {
    // Initialiser le controller REST classique
    this.chatController = new ChatController(io);

    // Initialiser l'intégration GraphQL
    this.graphqlIntegration = new ChatGraphQLIntegration(io);
  }

  /**
   * Configure les routes REST (controllers classiques)
   */
  setupRestRoutes(app: express.Application): void {
    const router = express.Router();

    // Routes REST pour le chat
    router.post('/conversations', this.chatController.createOrGetConversation);
    router.get('/conversations', this.chatController.getUserConversations);
    router.get('/conversations/:conversationId/messages', this.chatController.getMessages);
    router.post('/messages', this.chatController.sendMessage);
    router.post('/messages/:messageId/reactions/:conversationId', this.chatController.reactToMessage);
    router.delete('/messages/:messageId/:conversationId', this.chatController.deleteMessage);
    router.post('/messages/:messageId/restore', this.chatController.restoreMessage);
    router.get('/search/messages', this.chatController.searchMessages);
    router.put('/conversations/:conversationId/read', this.chatController.markConversationAsRead);
    router.post('/typing', this.chatController.handleTyping);
    router.put('/conversations/:conversationId/archive', this.chatController.archiveConversation);
    router.put('/conversations/:conversationId/unarchive', this.chatController.unarchiveConversation);
    router.get('/conversations/:conversationId/stats', this.chatController.getConversationStats);

    // Appliquer les routes avec préfixe
    app.use('/api/v1/chat', router);
  }

  /**
   * Configure GraphQL
   */
  async setupGraphQL(app: express.Application): Promise<void> {
    // Initialiser Apollo Server
    await this.graphqlIntegration.initializeApolloServer();

    // Appliquer le middleware GraphQL
    this.graphqlIntegration.applyMiddleware(app, '/graphql');
  }

  /**
   * Configuration complète hybride
   */
  async setupHybridConfiguration(app: express.Application): Promise<void> {
    // 1. Routes REST classiques
    this.setupRestRoutes(app);

    // 2. GraphQL endpoint
    await this.setupGraphQL(app);

    console.log('✅ Configuration hybride terminée:');
    console.log('   📍 REST API: /api/v1/chat/*');
    console.log('   🚀 GraphQL: /graphql');
    console.log('   🔗 GraphQL Playground: /graphql (en développement)');
  }
}

// ==================== EXEMPLES D'UTILISATION ====================

/**
 * Exemples de requêtes côté client
 */
export const ClientExamples = {

  // ========== REST API Examples ==========

  restExamples: {
    // Envoyer un message via REST
    sendMessageREST: async () => {
      const response = await fetch('/api/v1/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN'
        },
        body: JSON.stringify({
          conversationId: 'conv_123',
          content: 'Hello world!',
          messageType: 'text'
        })
      });
      return response.json();
    },

    // Récupérer les conversations via REST
    getConversationsREST: async () => {
      const response = await fetch('/api/v1/chat/conversations?page=1&limit=20', {
        headers: {
          'Authorization': 'Bearer YOUR_TOKEN'
        }
      });
      return response.json();
    }
  },

  // ========== GraphQL Examples ==========

  graphqlExamples: {
    // Envoyer un message via GraphQL
    sendMessageGraphQL: `
      mutation SendMessage($input: SendMessageInput!) {
        sendMessage(input: $input) {
          id
          content
          messageType
          createdAt
          sender {
            id
            firstName
            lastName
          }
          aiInsights {
            sentiment {
              score
              label
            }
            priority
          }
        }
      }
    `,

    // Variables pour la mutation ci-dessus
    sendMessageVariables: {
      input: {
        conversationId: "conv_123",
        content: "Hello world!",
        messageType: "TEXT"
      }
    },

    // Récupérer les conversations avec messages via GraphQL
    getConversationsGraphQL: `
      query GetConversations($pagination: PaginationInput) {
        conversations(pagination: $pagination) {
          edges {
            node {
              id
              type
              participants {
                id
                firstName
                lastName
                presenceStatus
              }
              lastMessage {
                id
                content
                messageType
                createdAt
                sender {
                  firstName
                  lastName
                }
              }
              unreadCount(userId: "user_123")
              stats {
                messageCount
                participantsCount
                lastActivity
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }
    `,

    // Subscription pour les nouveaux messages
    messageSubscription: `
      subscription MessageAdded($conversationId: ID!) {
        messageAdded(conversationId: $conversationId) {
          id
          content
          messageType
          createdAt
          sender {
            id
            firstName
            lastName
          }
          mentions {
            id
            firstName
            lastName
          }
          reactions {
            userId
            emoji
            timestamp
          }
        }
      }
    `
  }
};

// ==================== GUIDE D'UTILISATION ====================

export const UsageGuide = {

  whenToUseREST: [
    '✅ Opérations CRUD simples (Create, Read, Update, Delete)',
    '✅ Upload de fichiers médias',
    '✅ Intégration avec des systèmes existants',
    '✅ Cache HTTP standard',
    '✅ Applications mobiles avec connectivité limitée'
  ],

  whenToUseGraphQL: [
    '✅ Interface utilisateur riche nécessitant des données complexes',
    '✅ Requêtes optimisées (récupérer uniquement les champs nécessaires)',
    '✅ Subscriptions temps réel',
    '✅ Analytics et rapports complexes',
    '✅ Applications web modernes (React, Vue, Angular)'
  ],

  bestPractices: [
    '🎯 Utilisez REST pour les actions simples (envoyer message)',
    '🎯 Utilisez GraphQL pour les vues complexes (dashboard)',
    '🎯 Gardez la même logique métier dans ChatService',
    '🎯 Utilisez les subscriptions GraphQL pour le temps réel',
    '🎯 Implémentez la cache de façon cohérente entre les deux',
    '🎯 Documentez clairement quand utiliser chaque approche'
  ],

  migration: [
    '📈 Commencez par implémenter GraphQL en parallèle',
    '📈 Migrez progressivement les fonctionnalités complexes vers GraphQL',
    '📈 Gardez REST pour les opérations simples et les uploads',
    '📈 Surveillez les performances des deux approches',
    '📈 Formez l\'équipe sur les deux technologies'
  ]
};

// ==================== EXEMPLE DE CONFIGURATION SERVEUR ====================

export async function setupHybridChatServer() {
  const app = express();
  const server = require('http').createServer(app);
  const io = new IOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"]
    }
  });

  // Middleware de base
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Configuration hybride
  const hybridConfig = new HybridChatConfiguration(io);
  await hybridConfig.setupHybridConfiguration(app);

  // Routes de documentation
  app.get('/api/docs/chat', (req, res) => {
    res.json({
      message: 'Documentation API Chat Hybride',
      rest: {
        baseUrl: '/api/v1/chat',
        endpoints: [
          'POST /conversations - Créer/récupérer conversation',
          'GET /conversations - Lister les conversations',
          'POST /messages - Envoyer un message',
          'GET /conversations/:id/messages - Récupérer les messages'
        ]
      },
      graphql: {
        endpoint: '/graphql',
        playground: '/graphql (développement)',
        features: ['Queries', 'Mutations', 'Subscriptions']
      },
      examples: ClientExamples,
      guide: UsageGuide
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 Serveur chat hybride démarré sur le port ${PORT}`);
    console.log(`📡 REST API: http://localhost:${PORT}/api/v1/chat`);
    console.log(`🔍 GraphQL: http://localhost:${PORT}/graphql`);
    console.log(`📚 Documentation: http://localhost:${PORT}/api/docs/chat`);
  });

  return { app, server, io };
}

// Export de la configuration par défaut
export default HybridChatConfiguration;