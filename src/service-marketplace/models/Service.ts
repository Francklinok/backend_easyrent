import mongoose, { Schema, Document } from 'mongoose';

export interface IService extends Document {
  providerId: string;
  title: string;
  description: string;
  category: string;
  contractTypes: string[];
  pricing: {
    basePrice: number;
    currency: string;
    billingPeriod: string;
    discounts?: {
      longTerm?: number;
      seasonal?: number;
      bulk?: number;
    };
  };
  requirements: {
    propertyTypes: string[];
    minContractDuration?: number;
    maxContractDuration?: number;
    isMandatory: boolean;
    isOptional: boolean;
  };
  availability: {
    zones: string[];
    schedule: {
      days: string[];
      hours: string;
    };
    isEmergency: boolean;
  };
  media: {
    photos: string[];
    videos?: string[];
    documents?: string[];
  };
  tags: string[];
  status: string;
  rating: number;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>({
  providerId: { type: String, required: true },
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String, required: true, maxlength: 1000 },
  category: { 
    type: String, 
    required: true, 
    enum: ['maintenance', 'cleaning', 'security', 'gardening', 'insurance', 'utilities', 'wellness', 'emergency', 'eco', 'tech', 'collaborative']
  },
  contractTypes: [{ 
    type: String, 
    enum: ['short_term', 'long_term', 'seasonal', 'on_demand', 'emergency']
  }],
  pricing: {
    basePrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'EUR' },
    billingPeriod: { 
      type: String, 
      required: true, 
      enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly', 'one_time']
    },
    discounts: {
      longTerm: { type: Number, min: 0, max: 100 },
      seasonal: { type: Number, min: 0, max: 100 },
      bulk: { type: Number, min: 0, max: 100 }
    }
  },
  requirements: {
    propertyTypes: [{ 
      type: String, 
      enum: ['apartment', 'house', 'studio', 'villa', 'commercial']
    }],
    minContractDuration: { type: Number },
    maxContractDuration: { type: Number },
    isMandatory: { type: Boolean, default: false },
    isOptional: { type: Boolean, default: true }
  },
  availability: {
    zones: [{ type: String, required: true }],
    schedule: {
      days: [{ type: String }],
      hours: { type: String }
    },
    isEmergency: { type: Boolean, default: false }
  },
  media: {
    photos: [{ type: String }],
    videos: [{ type: String }],
    documents: [{ type: String }]
  },
  tags: [{ type: String }],
  status: { 
    type: String, 
    default: 'active', 
    enum: ['active', 'inactive', 'pending', 'suspended']
  },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 }
}, {
  timestamps: true
});

ServiceSchema.index({ category: 1, 'availability.zones': 1, status: 1 });
ServiceSchema.index({ providerId: 1 });
ServiceSchema.index({ rating: -1, totalReviews: -1 });

export const Service = mongoose.model<IService>('Service', ServiceSchema);