import mongoose  from "mongoose";
import { IConversation } from "../types/chatTypes";

// Schema Conversation avec fonctionnalités avancées
const ConversationSchema = new mongoose.Schema<IConversation>({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  type: { type: String, enum: ['direct', 'group', 'property_discussion'], default: 'direct' },
  
  // Métadonnées de groupe
  groupInfo: {
    name: String,
    description: String,
    avatar: String,
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    settings: {
      allowMemberAdd: { type: Boolean, default: true },
      allowMemberEdit: { type: Boolean, default: false },
      muteAll: { type: Boolean, default: false }
    }
  },

  // Propriété associée
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  
  // Paramètres de conversation
  settings: {
    encryption: { type: Boolean, default: true },
    disappearingMessages: {
      enabled: { type: Boolean, default: false },
      duration: { type: Number, default: 86400000 } // 24h en ms
    },
    smartReply: { type: Boolean, default: true },
    translation: { type: Boolean, default: false },
    voiceTranscription: { type: Boolean, default: true }
  },

  // Archivage et épinglage
  isArchived: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    archivedAt: { type: Date, default: Date.now }
  }],
  isPinned: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pinnedAt: { type: Date, default: Date.now }
  }],

  // Statut de frappe
  typingUsers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastTyping: { type: Date, default: Date.now }
  }],

  // Messages épinglés
  pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],

  // Innovations uniques
  aiModerator: {
    enabled: { type: Boolean, default: true },
    autoResponseSuggestions: { type: Boolean, default: true },
    priceNegotiationAssist: { type: Boolean, default: true },
    appointmentScheduling: { type: Boolean, default: true }
  },

  // Statistiques avancées
  analytics: {
    messageCount: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    mostActiveHours: [Number],
    engagement: {
      reactionsCount: { type: Number, default: 0 },
      mediaSharedCount: { type: Number, default: 0 }
    }
  }
}, {
  timestamps: true
});
const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
export  default Conversation