import { Server as IOServer } from 'socket.io';
import ChatService from './chatService';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('ChatServiceInstance');

/**
 * Instance singleton de ChatService
 * Initialisée une seule fois au démarrage du serveur
 */
let chatServiceInstance: ChatService | null = null;

/**
 * Initialise le ChatService avec le serveur Socket.IO
 * Doit être appelé une seule fois au démarrage du serveur
 */
export const initializeChatService = (io: IOServer): ChatService => {
  if (chatServiceInstance) {
    logger.warn('ChatService already initialized, returning existing instance');
    return chatServiceInstance;
  }

  logger.info('Initializing ChatService singleton...');
  chatServiceInstance = new ChatService(io);
  logger.info('✅ ChatService singleton initialized successfully');

  return chatServiceInstance;
};

/**
 * Récupère l'instance singleton de ChatService
 * Lance une erreur si le service n'a pas été initialisé
 */
export const getChatService = (): ChatService => {
  if (!chatServiceInstance) {
    throw new Error('ChatService not initialized. Call initializeChatService() first.');
  }

  return chatServiceInstance;
};

/**
 * Vérifie si le ChatService est initialisé
 */
export const isChatServiceInitialized = (): boolean => {
  return chatServiceInstance !== null;
};
