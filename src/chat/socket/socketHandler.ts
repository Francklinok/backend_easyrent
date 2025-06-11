const Conversation = require('../models/Conversation'); // ou adapte le chemin selon ton projet

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log('Utilisateur connecté:', socket.id);

    socket.on('joinUser', async (userId) => {
      socket.join(userId);
    });

    socket.on('joinConversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
    });

    socket.on('typing', async (data) => {
      const { conversationId, userId, isTyping } = data;

      socket.to(`conversation_${conversationId}`).emit('userTyping', {
        userId,
        isTyping
      });

      if (isTyping) {
        await Conversation.findByIdAndUpdate(conversationId, {
          $addToSet: {
            typingUsers: { userId, lastTyping: new Date() }
          }
        });
      } else {
        await Conversation.findByIdAndUpdate(conversationId, {
          $pull: {
            typingUsers: { userId }
          }
        });
      }
    });

    socket.on('voiceMessage', (data) => {
      socket.to(`conversation_${data.conversationId}`).emit('voiceMessage', data);
    });

    socket.on('screenShare', (data) => {
      socket.to(`conversation_${data.conversationId}`).emit('screenShare', data);
    });

    socket.on('videoCall', (data) => {
      socket.to(data.targetUserId).emit('incomingCall', {
        from: data.from,
        conversationId: data.conversationId,
        callType: data.callType
      });
    });

    socket.on('disconnect', async () => {
      console.log('Utilisateur déconnecté:', socket.id);
      // Future logique pour mettre à jour le statut
    });
  });
}

module.exports = socketHandler;
