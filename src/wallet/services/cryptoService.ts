import { Wallet, IWallet } from '../models/Wallet';
import { CryptoBalance } from '../types/walletTypes';
import mongoose from 'mongoose';

export class CryptoService {
  async updateCryptoBalance(userId: string, currency: string, amount: number, value: number): Promise<void> {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return;

    const cryptoIndex = wallet.cryptoBalances.findIndex(c => c.currency === currency);
    if (cryptoIndex >= 0) {
      wallet.cryptoBalances[cryptoIndex] = { currency, amount, value };
    } else {
      wallet.cryptoBalances.push({ currency, amount, value });
    }
    
    await wallet.save();
  }

  async getCryptoBalances(userId: string): Promise<CryptoBalance[]> {
    const wallet = await Wallet.findOne({ userId });
    return wallet?.cryptoBalances || [];
  }

  async buyCrypto(userId: string, currency: string, amount: number, totalCost: number): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet || wallet.balance < totalCost) {
          throw new Error('Solde insuffisant pour acheter cette crypto');
        }

        await Wallet.updateOne(
          { userId },
          { $inc: { balance: -totalCost } }
        ).session(session);

        const existingCrypto = wallet.cryptoBalances?.find(c => c.currency === currency);
        const newAmount = existingCrypto ? existingCrypto.amount + amount : amount;
        
        await this.updateCryptoBalance(userId, currency, newAmount, newAmount * (totalCost / amount));
      });
    } finally {
      await session.endSession();
    }
  }

  async sellCrypto(userId: string, currency: string, amount: number, totalValue: number): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOne({ userId }).session(session);
        const cryptoBalance = wallet?.cryptoBalances?.find(c => c.currency === currency);
        
        if (!cryptoBalance || cryptoBalance.amount < amount) {
          throw new Error('Solde crypto insuffisant');
        }

        await Wallet.updateOne(
          { userId },
          { $inc: { balance: totalValue } }
        ).session(session);

        const newAmount = cryptoBalance.amount - amount;
        await this.updateCryptoBalance(userId, currency, newAmount, newAmount * (cryptoBalance.value / cryptoBalance.amount));
      });
    } finally {
      await session.endSession();
    }
  }
}