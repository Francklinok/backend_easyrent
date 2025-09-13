import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  userId: string;
  type: 'payment' | 'received' | 'crypto' | 'deposit' | 'withdrawal';
  amount: number;
  currency: string;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  paymentMethodId?: string;
  cryptoCurrency?: string;
  recipientId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  userId: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['payment', 'received', 'crypto', 'deposit', 'withdrawal'] 
  },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'EUR' },
  description: { type: String, required: true, maxlength: 255 },
  status: { 
    type: String, 
    default: 'pending', 
    enum: ['completed', 'pending', 'failed', 'cancelled'] 
  },
  paymentMethodId: { type: String },
  cryptoCurrency: { type: String },
  recipientId: { type: String },
  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true
});

TransactionSchema.index({ userId: 1, createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);