import { Document } from "mongoose";
import { Types } from "mongoose";


export interface IMessage extends Document {
  msgId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'property' | 'voice_note' | 'ar_preview' | 'virtual_tour';
  mediaData?: {
    filename?: string;
    originalName?: string;
    size?: number;
    mimetype?: string;
    duration?: number;
    thumbnail?: string;
    dimensions?: { width: number; height: number };
    compressed?: boolean;
  };
  reactions: {
    userId: Types.ObjectId;
    emoji: string;
    timestamp: Date;
  }[];
  status: {
    sent: Date;
    delivered: {
      userId: Types.ObjectId;
      timestamp: Date;
    }[];
    read: {
      userId: Types.ObjectId;
      timestamp: Date;
    }[];
  };
  replyTo?: Types.ObjectId;
  forwardedFrom?: {
    originalMessageId: Types.ObjectId;
    originalSender: Types.ObjectId;
    forwardChain: number;
  };
  isDeleted: boolean;
  deletedFor: Types.ObjectId[];
  deletedAt?: Date;
  canRestore: boolean;
  isEdited: boolean;
  editHistory: {
    content: string;
    editedAt: Date;
  }[];
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    propertyId?: Types.ObjectId;
  };
  aiInsights?: {
    sentiment?: string;
    intentDetection?: string;
    autoSuggestions?: string[];
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  };
  theme?: 'light' | 'dark' | 'auto';
  scheduledFor?: Date;
  isScheduled?: boolean;
  temporaryAccess?: {
    expiresAt: Date;
    accessCode: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConversation extends Document {
  participants: Types.ObjectId[];
  type: 'direct' | 'group' | 'property_discussion';
  groupInfo?: {
    name?: string;
    description?: string;
    avatar?: string;
    admins?: Types.ObjectId[];
    settings?: {
      allowMemberAdd?: boolean;
      allowMemberEdit?: boolean;
      muteAll?: boolean;
    };
  };
  propertyId?: Types.ObjectId;
  settings?: {
    encryption?: boolean;
    disappearingMessages?: {
      enabled: boolean;
      duration: number;
    };
    smartReply?: boolean;
    translation?: boolean;
    voiceTranscription?: boolean;
  };
  isArchived?: { userId: Types.ObjectId; archivedAt: Date }[];
  isPinned?: { userId: Types.ObjectId; pinnedAt: Date }[];
  typingUsers?: { userId: Types.ObjectId; lastTyping: Date }[];
  pinnedMessages?: Types.ObjectId[];
  aiModerator?: {
    enabled: boolean;
    autoResponseSuggestions: boolean;
    priceNegotiationAssist: boolean;
    appointmentScheduling: boolean;
  };
  analytics?: {
    messageCount: number;
    averageResponseTime: number;
    mostActiveHours: number[];
    engagement: {
      reactionsCount: number;
      mediaSharedCount: number;
    };
  };
  createdAt?: Date;
  updatedAt?: Date;
}
