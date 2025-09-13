import { ObjectId } from 'mongodb';
import { getDb } from '../../config/database';
import { Wallet, Transaction, PaymentMethod, CreateTransactionRequest, CreatePaymentMethodRequest, TransferRequest } from '../types/walletTypes';

export class WalletService {
  private db = getDb();

  async createWallet(userId: string): Promise<Wallet> {
    const wallet: Omit<Wallet, 'id'> = {
      userId,
      balance: 0,
      pendingBalance: 0,
      currency: 'EUR',
      cryptoBalances: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection('wallets').insertOne(wallet);
    return { ...wallet, id: result.insertedId.toString() };
  }

  async getWallet(userId: string): Promise<Wallet | null> {
    const wallet = await this.db.collection('wallets').findOne({ userId });
    if (!wallet) return null;
    return { ...wallet, id: wallet._id.toString() };
  }

  async updateBalance(userId: string, amount: number, isPending = false): Promise<void> {
    const updateField = isPending ? 'pendingBalance' : 'balance';
    await this.db.collection('wallets').updateOne(
      { userId },
      { 
        $inc: { [updateField]: amount },
        $set: { updatedAt: new Date() }
      }
    );
  }

  async createTransaction(userId: string, data: CreateTransactionRequest): Promise<Transaction> {
    const transaction: Omit<Transaction, 'id'> = {
      userId,
      type: data.type,
      amount: data.amount,
      currency: data.currency || 'EUR',
      description: data.description,
      status: 'pending',
      paymentMethodId: data.paymentMethodId,
      cryptoCurrency: data.cryptoCurrency,
      recipientId: data.recipientId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection('transactions').insertOne(transaction);
    return { ...transaction, id: result.insertedId.toString() };
  }

  async getTransactions(userId: string, limit = 50): Promise<Transaction[]> {
    const transactions = await this.db.collection('transactions')
      .find({ $or: [{ userId }, { recipientId: userId }] })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return transactions.map(t => ({ ...t, id: t._id.toString() }));
  }

  async updateTransactionStatus(transactionId: string, status: 'completed' | 'failed' | 'cancelled'): Promise<void> {
    await this.db.collection('transactions').updateOne(
      { _id: new ObjectId(transactionId) },
      { 
        $set: { 
          status,
          updatedAt: new Date()
        }
      }
    );
  }

  async processPayment(userId: string, data: CreateTransactionRequest): Promise<Transaction> {
    const session = this.db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Créer la transaction
        const transaction = await this.createTransaction(userId, data);
        
        // Déduire du solde si c'est un paiement
        if (data.type === 'payment') {
          await this.updateBalance(userId, -data.amount);
        }
        
        // Ajouter au solde si c'est une réception
        if (data.type === 'received') {
          await this.updateBalance(userId, data.amount);
        }
        
        // Marquer comme complété
        await this.updateTransactionStatus(transaction.id, 'completed');
        
        return transaction;
      });
    } finally {
      await session.endSession();
    }

    return this.getTransactionById(userId, data.recipientId || userId);
  }

  async transferMoney(userId: string, data: TransferRequest): Promise<Transaction> {
    const session = this.db.client.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // Vérifier le solde
        const wallet = await this.getWallet(userId);
        if (!wallet || wallet.balance < data.amount) {
          throw new Error('Solde insuffisant');
        }

        // Créer la transaction de débit
        const debitTransaction = await this.createTransaction(userId, {
          type: 'payment',
          amount: data.amount,
          currency: data.currency,
          description: data.description,
          recipientId: data.recipientId,
          paymentMethodId: data.paymentMethodId
        });

        // Créer la transaction de crédit pour le destinataire
        await this.createTransaction(data.recipientId, {
          type: 'received',
          amount: data.amount,
          currency: data.currency,
          description: `Reçu de ${userId}: ${data.description}`,
          recipientId: userId
        });

        // Mettre à jour les soldes
        await this.updateBalance(userId, -data.amount);
        await this.updateBalance(data.recipientId, data.amount);

        // Marquer les transactions comme complétées
        await this.updateTransactionStatus(debitTransaction.id, 'completed');

        return debitTransaction;
      });
    } finally {
      await session.endSession();
    }
  }

  async getTransactionById(userId: string, transactionId: string): Promise<Transaction | null> {
    const transaction = await this.db.collection('transactions').findOne({
      _id: new ObjectId(transactionId),
      $or: [{ userId }, { recipientId: userId }]
    });

    if (!transaction) return null;
    return { ...transaction, id: transaction._id.toString() };
  }
}