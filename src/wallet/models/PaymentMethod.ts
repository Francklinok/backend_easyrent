import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentMethod extends Document {
  userId: string;
  type: 'card' | 'bank' | 'paypal' | 'mobile_money' | 'crypto';
  name: string;
  details: {
    last4?: string;
    expiry?: string;
    iban?: string;
    email?: string;
    phoneNumber?: string;
    cryptoAddress?: string;
  };
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>({
  userId: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['card', 'bank', 'paypal', 'mobile_money', 'crypto'] 
  },
  name: { type: String, required: true, maxlength: 100 },
  details: {
    last4: { type: String },
    expiry: { type: String },
    iban: { type: String },
    email: { type: String },
    phoneNumber: { type: String },
    cryptoAddress: { type: String }
  },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

PaymentMethodSchema.index({ userId: 1, isActive: 1 });

export const PaymentMethod = mongoose.model<IPaymentMethod>('PaymentMethod', PaymentMethodSchema);