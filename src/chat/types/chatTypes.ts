
import { Document } from "mongoose";
import { Types } from "mongoose";
import { Request } from "express";
export interface IMessage extends Document {
  msgId: Types.ObjectId;
  senderId: Types.ObjectId;
  conversationId: Types.ObjectId;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'property' | 'voice_note' | 'ar_preview' | 'virtual_tour';
  content:string;
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
  mentions?: Types.ObjectId[];
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
    sentiment?:{
      score?: number;
      label?: string;
    } ;
    intentDetection?: string;
    autoSuggestions?: string[];
    priority?: 'low' | 'medium'|'normal'| 'high' | 'urgent';

  };
  theme?: 'light' | 'dark' | 'auto';
  scheduledFor?: Date;
  isScheduled?: boolean;
  temporaryAccess?: {
    expiresAt: Date;
    accessCode: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}


export interface IConversation extends Document {
  _id: Types.ObjectId
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

export type NotificationPayload = {
  userId: string;
  type: "push" | "email" | "both"; // Remove "message", "reminder", "call"
  // type: 'push' |'reminder' | 'call' ;
  push: {
    notification: {
      title: string;
      body: string;
      data: Record<string, any>;
    };
    fcmTokens?: string[];
    webpushSubscriptions?: any[];
  };
  priority?: 'low' | 'medium'| 'normal'| 'high' | 'urgent';
};

export interface MediaFile {
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
  path: string;
}
export interface CreateConversationParams {
  participantId: string;
  type?: 'direct' | 'group';
  propertyId?: string;
  userId: string;
}

export interface GetUserConversationsParams {
  userId: string;
  page?: number;
  limit?: number;
  filter?: 'all' | 'unread' | 'groups' | 'direct';
}

export interface SendMessageParams {
  conversationId: string;
  content: string;
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file';
  replyTo?: string;
  scheduleFor?: string;
  userId: string;
  file?: MediaFile;
  priority?: 'low' | 'medium'|'normal'| 'high' | 'urgent';
  mentions?: any[];
}

export interface GetMessagesParams {
  conversationId: string;
  userId: string;
  page?: number;
  limit?: number;
  messageType?: string | null;
  dateRange?: { start: string; end: string }|null;
  searchQuery?: string | null;
}

export interface ReactToMessageParams {
  messageId: string;
  emoji?: string;
  userId: string;
  customReaction?: any;
  reactionType: string; // ou un type spécifique : 'like' | 'love' | 'haha' | etc.
  conversationId: string;
}

export interface DeleteMessageParams {
  messageId: string;
  conversationId: string; 
  deleteFor?: 'me' | 'everyone';
  userId: string;
  reason?: string | null;
  canDeleteMessages?:boolean
  deleteType: 'soft' | 'hard';
}

export  interface UserPermissions {
  canDeleteMessages?: boolean;
}

export interface SearchMessagesParams {
  userId: string;
  query: string;
  conversationId?: string |null;
  messageType?: string |null;
  dateRange?: { start: string; end: string }|null;
  page?: number;
  limit?: number;
}

export interface ReactionAnalytics {
  messageId: string;
  reactions: Record<string, number>;
  totalReactions: number;
  uniqueUsers: string[];
  timeline: Array<{
    userId: string;
    emoji: string;
    timestamp: Date;
  }>;
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  isUserOnline?(userId: string): boolean;
}


export interface CustomRequestBody {
  participantId?: string;
  type?: string;
  propertyId?: string;
}

export  interface CustomUser {
  id: string;
}

export  interface CustomRequest extends Request {
  body: CustomRequestBody;
  user: CustomUser;
}
