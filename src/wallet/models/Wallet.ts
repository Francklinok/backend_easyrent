import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  userId: string;
  balance: number;
  pendingBalance: number;
  currency: string;
  cryptoBalances: {
    currency: string;
    amount: number;
    value: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0, min: 0 },
  pendingBalance: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'EUR', enum: ['EUR', 'USD', 'GBP'] },
  cryptoBalances: [{
    currency: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    value: { type: Number, required: true, min: 0 }
  }]
}, {
  timestamps: true
});

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);