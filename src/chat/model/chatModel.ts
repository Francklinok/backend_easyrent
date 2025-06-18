import mongoose ,{ Document,Types } from "mongoose";
import { IMessage } from "../types/chatTypes";

const  Schema =   mongoose.Schema

type IMessageDocument = IMessage & Document;

const MessageSchema =  new Schema<IMessage>({
    msgId:{
        type:mongoose.Schema.Types.ObjectId, 
        ref:'conversation', 
        required:true
    },
    senderId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content:{
        type:String,
        enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'property', 'voice_note', 'ar_preview', 'virtual_tour'],
        default: 'text'
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
        ref: 'User' },
    emoji: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
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

  // Réponse à un message
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
  deletedBy:{
      type: Types.ObjectId,
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
    sentiment: String, // positif, négatif, neutre
    intentDetection: String, // achat, vente, visite, négociation
    autoSuggestions: [String],
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'] }
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



const Message = mongoose.model<IMessageDocument>('Message', MessageSchema);
export  default  Message