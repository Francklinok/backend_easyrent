export type TransactionType = 'payment' | 'received' | 'crypto' | 'deposit' | 'withdrawal';

export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'cancelled';

export type PaymentMethodType = 'card' | 'bank' | 'paypal' | 'mobile_money' | 'crypto';

export interface PaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
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

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  status: TransactionStatus;
  paymentMethodId?: string;
  cryptoCurrency?: string;
  recipientId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  pendingBalance: number;
  currency: string;
  cryptoBalances: CryptoBalance[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CryptoBalance {
  currency: string;
  amount: number;
  value: number;
}

export interface CreatePaymentMethodRequest {
  type: PaymentMethodType;
  name: string;
  details: {
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    iban?: string;
    email?: string;
    phoneNumber?: string;
    cryptoAddress?: string;
  };
  isDefault?: boolean;
}

export interface CreateTransactionRequest {
  type: TransactionType;
  amount: number;
  currency?: string;
  description: string;
  paymentMethodId?: string;
  recipientId?: string;
  cryptoCurrency?: string;
}

export interface TransferRequest {
  recipientId: string;
  amount: number;
  currency?: string;
  description: string;
  paymentMethodId?: string;
}