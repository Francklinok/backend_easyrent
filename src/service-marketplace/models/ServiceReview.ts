import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceReview extends Document {
  userId: string;
  serviceId: string;
  subscriptionId: string;
  rating: number;
  comment: string;
  photos?: string[];
  isVerified: boolean;
  providerResponse?: {
    comment: string;
    date: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ServiceReviewSchema = new Schema<IServiceReview>({
  userId: { type: String, required: true },
  serviceId: { type: String, required: true },
  subscriptionId: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, maxlength: 1000 },
  photos: [{ type: String }],
  isVerified: { type: Boolean, default: false },
  providerResponse: {
    comment: { type: String, maxlength: 500 },
    date: { type: Date }
  }
}, {
  timestamps: true
});

ServiceReviewSchema.index({ serviceId: 1, rating: -1 });
ServiceReviewSchema.index({ userId: 1 });

export const ServiceReview = mongoose.model<IServiceReview>('ServiceReview', ServiceReviewSchema);