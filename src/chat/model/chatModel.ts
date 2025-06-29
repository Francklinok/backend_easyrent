import mongoose, { Document, Types } from "mongoose";
import { IMessage } from "../types/chatTypes";

const Schema = mongoose.Schema;
type IMessageDocument = IMessage & Document;

const MessageSchema = new Schema<IMessage>({
    msgId: {
        type: mongoose.Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId(),
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'property', 'voice_note', 'ar_preview', 'virtual_tour'],
        default: 'text'
    },
    content: {
        type: String,
        required: true
    },
    mediaData: {
        filename: String,
        originalName: String,
        size: Number,
        mimetype: String,
        duration: Number, // pour audio/video
        thumbnail: String, // pour vidéos
        dimensions: { width: Number, height: Number }, // pour images
        compressed: Boolean
    },
    // Réactions et interactions
    reactions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        emoji: String,
        timestamp: { type: Date, default: Date.now }
    }],
    
    // Mentions
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    // Statut du message
    status: {
        sent: { type: Date, default: Date.now },
        delivered: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            timestamp: { type: Date, default: Date.now }
        }],
        read: [{
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            timestamp: { type: Date, default: Date.now }
        }]
    },
    // Message en réponse
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    
    // Message transféré
    forwardedFrom: {
        originalMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
        originalSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        forwardChain: Number
    },
    // Suppression et restauration
    isDeleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedAt: Date,
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    canRestore: { type: Boolean, default: true },
    
    // Édition de message
    isEdited: { type: Boolean, default: false },
    editHistory: [{
        content: String,
        editedAt: { type: Date, default: Date.now }
    }],
    
    // Localisation
    location: {
        latitude: Number,
        longitude: Number,
        address: String,
        propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' }
    },
    // Innovations uniques
    aiInsights: {
        sentiment: {
            score: Number,
            label: String
        },
        intentDetection: String, // achat, vente, visite, négociation
        autoSuggestions: [String],
        priority: { type: String, enum: ['low', 'medium', 'normal', 'high', 'urgent'] }
    },
    // Mode sombre/clair
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    
    // Programmation d'envoi
    scheduledFor: Date,
    isScheduled: { type: Boolean, default: false },
    // Signature temporaire pour la sécurité
    temporaryAccess: {
        expiresAt: Date,
        accessCode: String
    }
}, {
    timestamps: true
});

MessageSchema.index({ content: 'text' });

const Message = mongoose.model<IMessageDocument>('Message', MessageSchema);
export default Message;