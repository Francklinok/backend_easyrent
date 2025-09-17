import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceSubscription extends Document {
  userId: string;
  propertyId: string;
  serviceId: string;
  contractType: string;
  status: string;
  startDate: Date;
  endDate?: Date;
  pricing: {
    amount: number;
    currency: string;
    billingPeriod: string;
  };
  autoRenewal: boolean;
  sharedWith?: string[];
  paymentHistory: {
    date: Date;
    amount: number;
    status: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSubscriptionSchema = new Schema<IServiceSubscription>({
  userId: { type: String, required: true },
  propertyId: { type: String, required: true },
  serviceId: { type: String, required: true },
  contractType: { 
    type: String, 
    required: true, 
    enum: ['short_term', 'long_term', 'seasonal', 'on_demand', 'emergency']
  },
  status: { 
    type: String, 
    default: 'active', 
    enum: ['active', 'paused', 'cancelled', 'completed']
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  pricing: {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'EUR' },
    billingPeriod: { type: String, required: true }
  },
  autoRenewal: { type: Boolean, default: false },
  sharedWith: [{ type: String }],
  paymentHistory: [{
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'pending', 'failed'], default: 'pending' }
  }]
}, {
  timestamps: true
});

ServiceSubscriptionSchema.index({ userId: 1, status: 1 });
ServiceSubscriptionSchema.index({ serviceId: 1 });
ServiceSubscriptionSchema.index({ propertyId: 1 });

export const ServiceSubscription = mongoose.model<IServiceSubscription>('ServiceSubscription', ServiceSubscriptionSchema);