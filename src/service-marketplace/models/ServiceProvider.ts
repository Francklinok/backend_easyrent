import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceProvider extends Document {
  userId: string;
  companyName?: string;
  description: string;
  certifications: string[];
  rating: number;
  totalReviews: number;
  isVerified: boolean;
  availableZones: string[];
  contactInfo: {
    phone?: string;
    email?: string;
    website?: string;
  };
  businessInfo: {
    siret?: string;
    insurance?: string;
    license?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ServiceProviderSchema = new Schema<IServiceProvider>({
  userId: { type: String, required: true, unique: true },
  companyName: { type: String, maxlength: 100 },
  description: { type: String, required: true, maxlength: 500 },
  certifications: [{ type: String }],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  availableZones: [{ type: String, required: true }],
  contactInfo: {
    phone: { type: String },
    email: { type: String },
    website: { type: String }
  },
  businessInfo: {
    siret: { type: String },
    insurance: { type: String },
    license: { type: String }
  }
}, {
  timestamps: true
});

ServiceProviderSchema.index({ userId: 1 });
ServiceProviderSchema.index({ availableZones: 1, isVerified: 1 });

export const ServiceProvider = mongoose.model<IServiceProvider>('ServiceProvider', ServiceProviderSchema);