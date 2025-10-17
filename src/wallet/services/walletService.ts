import { Wallet, IWallet } from '../models/Wallet';
import { Transaction, ITransaction } from '../models/Transaction';
import { CreateTransactionRequest, TransferRequest } from '../types/walletTypes';
import mongoose from 'mongoose';

export class WalletService {

  async createWallet(userId: string): Promise<IWallet> {
    const wallet = new Wallet({
      userId,
      balance: 0,
      pendingBalance: 0,
      currency: 'EUR',
      cryptoBalances: []
    });

    return await wallet.save();
  }

  async getWallet(userId: string): Promise<IWallet | null> {
    return await Wallet.findOne({ userId });
  }

  async updateBalance(userId: string, amount: number, isPending = false): Promise<void> {
    const updateField = isPending ? 'pendingBalance' : 'balance';
    await Wallet.updateOne(
      { userId },
      { $inc: { [updateField]: amount } }
    );
  }

  async createTransaction(userId: string, data: CreateTransactionRequest): Promise<ITransaction> {
    const transaction = new Transaction({
      userId,
      type: data.type,
      amount: data.amount,
      currency: data.currency || 'EUR',
      description: data.description,
      status: 'pending',
      paymentMethodId: data.paymentMethodId,
      cryptoCurrency: data.cryptoCurrency,
      recipientId: data.recipientId
    });

    return await transaction.save();
  }

  async getTransactions(userId: string, limit = 50): Promise<ITransaction[]> {
    return await Transaction.find({ 
      $or: [{ userId }, { recipientId: userId }] 
    })
    .sort({ createdAt: -1 })
    .limit(limit);
  }

  async updateTransactionStatus(transactionId: string, status: 'completed' | 'failed' | 'cancelled'): Promise<void> {
    await Transaction.updateOne(
      { _id: transactionId },
      { $set: { status } }
    );
  }

  async processPayment(userId: string, data: CreateTransactionRequest): Promise<ITransaction> {
    const session = await mongoose.startSession();

    try {
      return await session.withTransaction(async () => {
        // Vérifier le solde pour les paiements
        if (data.type === 'payment') {
          const wallet = await this.getWallet(userId);
          if (!wallet || wallet.balance < data.amount) {
            throw new Error('Solde insuffisant');
          }
        }

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
        await this.updateTransactionStatus(transaction._id.toString(), 'completed');

        // Retourner la transaction mise à jour
        return await Transaction.findById(transaction._id);
      });
    } finally {
      await session.endSession();
    }
  }

  async transferMoney(userId: string, data: TransferRequest): Promise<ITransaction> {
    const session = await mongoose.startSession();
    
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
        await this.updateTransactionStatus(debitTransaction._id.toString(), 'completed');

        return debitTransaction;
      });
    } finally {
      await session.endSession();
    }
  }

  async getTransactionById(userId: string, transactionId: string): Promise<ITransaction | null> {
    return await Transaction.findOne({
      _id: transactionId,
      $or: [{ userId }, { recipientId: userId }]
    });
  }
}