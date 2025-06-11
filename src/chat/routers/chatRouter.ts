import express from 'express';
import multer from 'multer';
import upload from '../middlewares/upload.js'; // assure-toi que le fichier a bien l'extension `.js`
import authenticateToken from '../middlewares/authenticateToken.js';
import ChatControllerClass from '../controllers/ChatController.js'; // fichier doit exporter par défaut la classe

const router = express.Router();

export default (io) => {
  const ChatController = new ChatControllerClass(io);

  router.post('/conversations', authenticateToken, ChatController.createOrGetConversation.bind(ChatController));
  router.get('/conversations', authenticateToken, ChatController.getUserConversations.bind(ChatController));
  router.post('/messages', authenticateToken, upload.single('media'), ChatController.sendMessage.bind(ChatController));
  router.get('/conversations/:conversationId/messages', authenticateToken, ChatController.getMessages.bind(ChatController));
  router.post('/messages/:messageId/react', authenticateToken, ChatController.reactToMessage.bind(ChatController));
  router.delete('/messages/:messageId', authenticateToken, ChatController.deleteMessage.bind(ChatController));
  router.post('/messages/:messageId/restore', authenticateToken, ChatController.restoreMessage.bind(ChatController));

  return router;
};
