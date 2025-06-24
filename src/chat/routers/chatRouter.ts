import express from 'express';
import { upload } from '../utils/upload.js';
import authenticate from '../../auth/middlewares/authenticate.js';
import ChatController from '../controllers/chatController.js'; 
import { Server as IOServer } from 'socket.io';
import chatValidationRules from '../middleware/validators.js';
const chatRouter = express.Router();

export default (io:IOServer) => {
  const chatController = new ChatController(io);
  chatRouter.use(authenticate);
  chatRouter.post('/conversations',chatValidationRules.createConversation, chatController.createOrGetConversation.bind(chatController));
  // chatRouter.get('/conversations',chatValidationRules.getUserConversations, chatController.getUserConversations.bind(chatController));
  // chatRouter.patch('/conversations/:conversationId/archive',chatValidationRules.archiveConversation, chatController.archiveConversation.bind(chatController));
  // chatRouter.get('/conversations/:conversationId/stats',chatValidationRules.getConversationStats, chatController.getConversationStats.bind(chatController));
  // chatRouter.patch('/conversations/:conversationId/read', chatController.markConversationAsRead.bind(chatController));
  // chatRouter.post('/typing',chatValidationRules.handleTyping, chatController.handleTyping.bind(chatController));
  // chatRouter.post('/messages', upload.single('media'), chatValidationRules.sendMessage,chatController.sendMessage.bind(chatController));
  // chatRouter.get('/conversations/:conversationId/messages',chatValidationRules.getMessages, chatController.getMessages.bind(chatController));
  // chatRouter.post('/messages/:messageId/react', chatValidationRules.reactToMessage,chatController.reactToMessage.bind(chatController));
  // chatRouter.delete('/messages/:messageId',chatValidationRules.deleteMessage, chatController.deleteMessage.bind(chatController));
  // chatRouter.post('/messages/:messageId/restore',chatValidationRules.restoreMessage, chatController.restoreMessage.bind(chatController));
  // chatRouter.get('/messages/search', chatValidationRules.searchMessages, chatController.searchMessages.bind(chatController));


  return chatRouter;
};
