import { getDb } from '../../config/database';
import { CryptoBalance } from '../types/walletTypes';

export class CryptoService {
  private db = getDb();

  async updateCryptoBalance(userId: string, currency: string, amount: number, value: number): Promise<void> {
    await this.db.collection('wallets').updateOne(
      { userId },
      {
        $set: {
          [`cryptoBalances.${currency}`]: { currency, amount, value },
          updatedAt: new Date()
        }
      }
    );
  }

  async getCryptoBalances(userId: string): Promise<CryptoBalance[]> {
    const wallet = await this.db.collection('wallets').findOne({ userId });
    return wallet?.cryptoBalances || [];
  }

  async buyCrypto(userId: string, currency: string, amount: number, totalCost: number): Promise<void> {
    const session = this.db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Vérifier le solde
        const wallet = await this.db.collection('wallets').findOne({ userId });
        if (!wallet || wallet.balance < totalCost) {
          throw new Error('Solde insuffisant pour acheter cette crypto');
        }

        // Déduire du solde principal
        await this.db.collection('wallets').updateOne(
          { userId },
          { $inc: { balance: -totalCost } }
        );

        // Ajouter à la crypto balance
        const existingCrypto = wallet.cryptoBalances?.find(c => c.currency === currency);
        const newAmount = existingCrypto ? existingCrypto.amount + amount : amount;
        
        await this.updateCryptoBalance(userId, currency, newAmount, newAmount * (totalCost / amount));
      });
    } finally {
      await session.endSession();
    }
  }

  async sellCrypto(userId: string, currency: string, amount: number, totalValue: number): Promise<void> {
    const session = this.db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        const wallet = await this.db.collection('wallets').findOne({ userId });
        const cryptoBalance = wallet?.cryptoBalances?.find(c => c.currency === currency);
        
        if (!cryptoBalance || cryptoBalance.amount < amount) {
          throw new Error('Solde crypto insuffisant');
        }

        // Ajouter au solde principal
        await this.db.collection('wallets').updateOne(
          { userId },
          { $inc: { balance: totalValue } }
        );

        // Déduire de la crypto balance
        const newAmount = cryptoBalance.amount - amount;
        await this.updateCryptoBalance(userId, currency, newAmount, newAmount * (cryptoBalance.value / cryptoBalance.amount));
      });
    } finally {
      await session.endSession();
    }
  }
}