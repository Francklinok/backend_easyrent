import Conversation from "../model/conversationModel";
import  Message from "../model/chatModel"
import  sharp from  "sharp"
import  analyzeMessageWithAI from  "../services/service"

class ChatController {
  constructor(io) {
    this.io = io;
  }

  async createOrGetConversation(req, res) {
    try {
      const { participantId, type = 'direct', propertyId } = req.body;
      const userId = req.user.id;

      let conversation;
      if (type === 'direct') {
        conversation = await Conversation.findOne({
          participants: { $all: [userId, participantId], $size: 2 },
          type: 'direct'
        }).populate('participants', 'name avatar email');
      }

      if (!conversation) {
        conversation = new Conversation({
          participants: type === 'direct' ? [userId, participantId] : [userId],
          type,
          propertyId
        });
        await conversation.save();
        await conversation.populate('participants', 'name avatar email');
      }

      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getUserConversations(req, res) {
    try {
      const userId = req.user.id;

      const conversations = await Conversation.find({
        participants: userId
      })
        .populate('participants', 'name avatar email lastSeen')
        .populate('propertyId', 'title price images location')
        .sort({ updatedAt: -1 });

      const conversationsWithLastMessage = await Promise.all(
        conversations.map(async (conv) => {
          const lastMessage = await Message.findOne({ conversationId: conv._id })
            .sort({ createdAt: -1 })
            .populate('senderId', 'name avatar');

          const unreadCount = await Message.countDocuments({
            conversationId: conv._id,
            'status.read.userId': { $ne: userId },
            senderId: { $ne: userId }
          });

          return {
            ...conv.toObject(),
            lastMessage,
            unreadCount
          };
        })
      );

      res.json(conversationsWithLastMessage);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async sendMessage(req, res) {
    try {
      const { conversationId, content, messageType, replyTo, scheduledFor } = req.body;
      const userId = req.user.id;

      let mediaData = null;
      if (req.file) {
        mediaData = {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        };

        if (req.file.mimetype.startsWith('image/')) {
          const imagePath = req.file.path;
          const metadata = await sharp(imagePath).metadata();
          mediaData.dimensions = { width: metadata.width, height: metadata.height };

          const compressedPath = `uploads/compressed_${req.file.filename}`;
          await sharp(imagePath)
            .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(compressedPath);

          mediaData.compressed = true;
        }
      }

      const aiInsights = await analyzeMessageWithAI(content, messageType);

      const message = new Message({
        conversationId,
        senderId: userId,
        content,
        messageType: messageType || 'text',
        mediaData,
        replyTo: replyTo || null,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        isScheduled: !!scheduledFor,
        aiInsights
      });

      await message.save();
      await message.populate('senderId', 'name avatar');
      if (replyTo) await message.populate('replyTo');

      await Conversation.findByIdAndUpdate(conversationId, {
        updatedAt: new Date(),
        $inc: { 'analytics.messageCount': 1 }
      });

      const conversation = await Conversation.findById(conversationId);
      conversation.participants.forEach(participantId => {
        if (participantId.toString() !== userId) {
          this.io.to(participantId.toString()).emit('newMessage', message);
        }
      });

      res.json(message);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;

      const messages = await Message.find({
        conversationId,
        $or: [{ isDeleted: false }, { isDeleted: true, deletedFor: { $ne: userId } }]
      })
        .populate('senderId', 'name avatar')
        .populate('replyTo')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      await Message.updateMany(
        {
          conversationId,
          senderId: { $ne: userId },
          'status.read.userId': { $ne: userId }
        },
        {
          $addToSet: {
            'status.read': { userId, timestamp: new Date() }
          }
        }
      );

      res.json(messages.reverse());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async reactToMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const userId = req.user.id;

      const message = await Message.findById(messageId);
      if (!message) return res.status(404).json({ error: 'Message non trouvé' });

      message.reactions = message.reactions.filter(
        r => r.userId.toString() !== userId
      );

      if (emoji) {
        message.reactions.push({ userId, emoji });
      }

      await message.save();

      const conversation = await Conversation.findById(message.conversationId);
      conversation.participants.forEach(participantId => {
        this.io.to(participantId.toString()).emit('messageReaction', {
          messageId,
          reactions: message.reactions
        });
      });

      res.json({ success: true, reactions: message.reactions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { deleteFor = 'me' } = req.body;
      const userId = req.user.id;

      const message = await Message.findById(messageId);
      if (!message) return res.status(404).json({ error: 'Message non trouvé' });

      if (deleteFor === 'everyone' && message.senderId.toString() !== userId) {
        return res.status(403).json({ error: 'Non autorisé' });
      }

      if (deleteFor === 'everyone') {
        message.isDeleted = true;
        message.deletedAt = new Date();
        message.content = null;
      } else {
        message.deletedFor.push(userId);
      }

      await message.save();

      const conversation = await Conversation.findById(message.conversationId);
      conversation.participants.forEach(participantId => {
        this.io.to(participantId.toString()).emit('messageDeleted', {
          messageId,
          deleteFor,
          deletedBy: userId
        });
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async restoreMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.id;

      const message = await Message.findById(messageId);
      if (!message || !message.canRestore) {
        return res.status(404).json({ error: 'Message non restaurable' });
      }

      message.deletedFor = message.deletedFor.filter(id => id.toString() !== userId);

      if (message.deletedFor.length === 0) {
        message.isDeleted = false;
        message.deletedAt = null;
      }

      await message.save();
      await message.populate('senderId', 'name avatar');

      res.json(message);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ChatController;
