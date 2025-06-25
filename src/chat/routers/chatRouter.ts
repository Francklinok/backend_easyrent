import express from 'express';
import authenticate from '../../auth/middlewares/authenticate';
import ChatController from '../controllers/chatController'; 
import { Server as IOServer } from 'socket.io';
import chatValidationRules from '../middleware/validators';
const chatRouter = express.Router();
import { upload } from '../utils/upload';

export default (io:IOServer) => {
  const chatController = new ChatController(io);
  chatRouter.use(authenticate);
  chatRouter.post('/create-or-get',chatValidationRules.createConversation, chatController.createOrGetConversation.bind(chatController));
  chatRouter.get('/conversations',chatValidationRules.getUserConversations, chatController.getUserConversations.bind(chatController));
  chatRouter.post('/messages', upload.single('media'), chatValidationRules.sendMessage,chatController.sendMessage.bind(chatController));
  chatRouter.get('/conversations/:conversationId/messages',chatValidationRules.getMessages, chatController.getMessages.bind(chatController));
  chatRouter.post(
    '/conversations/:conversationId/messages/:messageId/reactions',
    chatValidationRules.reactToMessage,
    chatController.reactToMessage.bind(chatController)
  );
  chatRouter.patch('/conversations/:conversationId/read', chatController.markConversationAsRead.bind(chatController));
  chatRouter.post('/conversations/typing',chatValidationRules.handleTyping, chatController.handleTyping.bind(chatController));






  chatRouter.get('/messages/search', chatValidationRules.searchMessages, chatController.searchMessages.bind(chatController));
  chatRouter.patch('/conversations/:conversationId/archive',chatValidationRules.archiveConversation, chatController.archiveConversation.bind(chatController));
  chatRouter.get('/conversations/:conversationId/stats',chatValidationRules.getConversationStats, chatController.getConversationStats.bind(chatController));
  chatRouter.delete('/messages/:messageId',chatValidationRules.deleteMessage, chatController.deleteMessage.bind(chatController));
  chatRouter.post('/messages/:messageId/restore',chatValidationRules.restoreMessage, chatController.restoreMessage.bind(chatController));


  return chatRouter;
};
