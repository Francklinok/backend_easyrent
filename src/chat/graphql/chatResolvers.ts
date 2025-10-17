import Message from '../model/chatModel';
import Conversation from '../model/conversationModel';
import User from '../../users/models/userModel';
import Property from '../../property/model/propertyModel';
import ChatService from '../services/chatService';
import EncryptionService from '../services/encryptionService';
import ValidationService from '../services/validationService';
import AIAnalysisService from '../services/AIAnalysis';
import { Types } from 'mongoose';

export const chatResolvers = {
  Query: {
    conversation: async (_: any, { id }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const conversation = await Conversation.findById(id)
        .populate('participants', 'firstName lastName profilePicture presenceStatus lastActive')
        .populate('propertyId', 'title address images ownerCriteria');
      
      if (!conversation) throw new Error('Conversation not found');
      
      const isParticipant = conversation.participants.some(
        (p: any) => p._id.toString() === user.userId
      );
      
      if (!isParticipant) throw new Error('Access denied');
      
      return conversation;
    },
    
    conversations: async (_: any, { pagination }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const chatService = new ChatService(null as any);
      const conversations = await chatService.getUserConversations({
        userId: user.userId,
        page: pagination?.first ? Math.ceil(pagination.first / 20) : 1,
        limit: pagination?.first || 20
      });
      
      const edges = conversations.map((conversation, index) => ({
        node: conversation,
        cursor: Buffer.from(index.toString()).toString('base64')
      }));
      
      return {
        edges,
        pageInfo: {
          hasNextPage: conversations.length === (pagination?.first || 20),
          hasPreviousPage: false,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor
        },
        totalCount: conversations.length
      };
    },
    
    searchConversations: async (_: any, { query, filters }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const searchQuery: any = {
        participants: user.userId,
        $or: [
          { 'participants.firstName': new RegExp(query, 'i') },
          { 'participants.lastName': new RegExp(query, 'i') },
          { 'propertyId.title': new RegExp(query, 'i') }
        ]
      };
      
      if (filters?.type) searchQuery.type = filters.type;
      
      return await Conversation.find(searchQuery)
        .populate('participants', 'firstName lastName profilePicture')
        .populate('propertyId', 'title images')
        .sort({ updatedAt: -1 })
        .limit(20);
    },
    
    conversationAnalytics: async (_: any, { conversationId }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const chatService = new ChatService(null as any);
      return await chatService.getConversationStats(conversationId);
    }
  },

  Mutation: {
    sendMessage: async (_: any, { input }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const chatService = new ChatService(null as any);
      
      const messageData = {
        userId: user.userId,
        conversationId: input.conversationId,
        content: input.content,
        messageType: input.messageType || 'text',
        replyTo: input.replyToId,
        mentions: input.mentions || [],
        scheduleFor: input.scheduleFor,
        priority: input.priority || 'normal'
      };
      
      return await chatService.sendMessage(messageData);
    },
    
    reactToMessage: async (_: any, { input }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const chatService = new ChatService(null as any);
      return await chatService.reactToMessage({
        messageId: input.messageId,
        userId: user.userId,
        reactionType: input.reactionType,
        conversationId: input.conversationId
      });
    },
    
    markMessagesAsRead: async (_: any, { conversationId, messageIds }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const chatService = new ChatService(null as any);
      await chatService.markMessagesAsRead(conversationId, user.userId, messageIds);
      return true;
    },
    
    deleteMessage: async (_: any, { input }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const chatService = new ChatService(null as any);
      return await chatService.deleteMessage({
        messageId: input.messageId,
        userId: user.userId,
        conversationId: input.conversationId,
        deleteType: input.deleteType || 'soft',
        deleteFor: input.deleteFor || 'me'
      });
    },
    
    archiveConversation: async (_: any, { conversationId }: any, { user, req }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const chatService = new ChatService(null as any);
      return await chatService.archivedConversation(
        user.userId,
        conversationId,
        req.ip,
        req.headers['user-agent']
      );
    },
    
    createOrGetConversation: async (_: any, { input }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const chatService = new ChatService(null as any);
      return await chatService.createOrGetConversation({
        userId: user.userId,
        participantId: input.participantId,
        type: input.type || 'direct',
        propertyId: input.propertyId
      });
    }
  },

  Conversation: {
    participants: async (conversation: any) => {
      return await User.find({ _id: { $in: conversation.participants } })
        .select('firstName lastName profilePicture presenceStatus lastActive email');
    },

    lastMessage: async (conversation: any) => {
      return await Message.findOne({ conversationId: conversation._id })
        .sort({ createdAt: -1 });
    },

    unreadCount: async (conversation: any, { userId }: any) => {
      return await Message.countDocuments({
        conversationId: conversation._id,
        senderId: { $ne: userId },
        'status.read': { $not: { $elemMatch: { userId } } }
      });
    },

    messages: async (conversation: any, { limit, offset, filters }: any) => {
      const query: any = { conversationId: conversation._id, isDeleted: false };
      
      if (filters?.messageType) query.messageType = filters.messageType;
      if (filters?.senderId) query.senderId = filters.senderId;
      if (filters?.dateRange) {
        query.createdAt = {};
        if (filters.dateRange.start) query.createdAt.$gte = new Date(filters.dateRange.start);
        if (filters.dateRange.end) query.createdAt.$lte = new Date(filters.dateRange.end);
      }
      
      const messages = await Message.find(query)
        .populate('senderId', 'firstName lastName profilePicture')
        .populate('replyTo')
        .populate('mentions.userId', 'firstName lastName username')
        .sort({ createdAt: -1 })
        .skip(offset || 0)
        .limit(limit || 50);
      
      // Déchiffrer les messages si nécessaire
      for (const message of messages) {
        if (message.content && typeof message.content === 'string' && message.content.includes(':')) {
          try {
            message.content = await EncryptionService.decrypt(message.content);
          } catch (error) {
            console.error('Erreur déchiffrement:', error);
          }
        }
      }
      
      return messages;
    },
    
    property: async (conversation: any) => {
      if (!conversation.propertyId) return null;
      return await Property.findById(conversation.propertyId);
    },

    stats: async (conversation: any) => {
      const chatService = new ChatService(null as any);
      return await chatService.getConversationStats(conversation._id.toString());
    },

    onlineParticipants: async (conversation: any) => {
      return await User.find({
        _id: { $in: conversation.participants },
        presenceStatus: 'online'
      }).select('firstName lastName profilePicture');
    },

    isArchivedFor: (conversation: any, { userId }: any) => {
      if (!conversation.isArchivedBy) return false;
      return conversation.isArchivedBy.some(
        (entry: any) => entry.userId.toString() === userId
      );
    }
  },

  Message: {
    sender: async (message: any) => {
      return await User.findById(message.senderId);
    },

    conversation: async (message: any) => {
      return await Conversation.findById(message.conversationId);
    },

    replyTo: async (message: any) => {
      if (!message.replyTo) return null;
      return await Message.findById(message.replyTo);
    },

    property: async (message: any) => {
      if (!message.location?.propertyId) return null;
      return await Property.findById(message.location.propertyId);
    },

    aiInsights: (message: any) => {
      return message.aiInsights || null;
    },

    reactions: (message: any) => {
      return message.reactions || [];
    },

    mentions: async (message: any) => {
      if (!message.mentions || message.mentions.length === 0) return [];
      
      return await User.find({
        _id: { $in: message.mentions.map((m: any) => m.userId) }
      }).select('firstName lastName username profilePicture');
    },
    
    readStatus: (message: any, { userId }: any) => {
      if (!message.status?.read) return null;

      const readEntry = message.status.read.find(
        (entry: any) => entry.userId.toString() === userId
      );

      return readEntry ? readEntry.timestamp : null;
    },

    isEdited: (message: any) => {
      return message.isEdited || false;
    },

    editHistory: (message: any) => {
      return message.editHistory || [];
    },

    sentimentAnalysis: async (message: any) => {
      if (message.aiInsights?.sentiment) {
        return message.aiInsights.sentiment;
      }
      
      const analysis = await AIAnalysisService.analyzeMessage(
        message.content,
        message.messageType,
        message.senderId.toString()
      );
      
      return analysis.sentiment;
    }
  },

  Subscription: {
    messageAdded: {
      subscribe: async function* (_: any, { conversationId }: any, { user }: any) {
        if (!user) throw new Error('Authentication required');
        
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(user.userId)) {
          throw new Error('Access denied');
        }
        
        const message = await Message.findOne({ conversationId }).sort({ createdAt: -1 });
        yield { messageAdded: message };
      }
    },
    
    conversationUpdated: {
      subscribe: async function* (_: any, { userId }: any, { user }: any) {
        if (!user || user.userId !== userId) throw new Error('Access denied');

        yield { conversationUpdated: null };
      }
    },

    typingStatus: {
      subscribe: async function* (_: any, { conversationId }: any, { user }: any) {
        if (!user) throw new Error('Authentication required');
        
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(user.userId)) {
          throw new Error('Access denied');
        }
        
        yield { typingStatus: { userId: user.userId, isTyping: false } };
      }
    }
  },

  AIInsight: {
    sentiment: (aiInsight: any) => aiInsight.sentiment,
    intentDetection: (aiInsight: any) => aiInsight.intentDetection,
    autoSuggestions: (aiInsight: any) => aiInsight.autoSuggestions || [],
    priority: (aiInsight: any) => aiInsight.priority || 'normal',
    confidence: (aiInsight: any) => aiInsight.confidence || 0,
    language: (aiInsight: any) => aiInsight.language || 'unknown',
    topics: (aiInsight: any) => aiInsight.topics || [],
    entities: (aiInsight: any) => aiInsight.entities || []
  },

  SentimentAnalysis: {
    score: (sentiment: any) => sentiment.score || 0,
    label: (sentiment: any) => sentiment.label || 'neutral'
  }
};