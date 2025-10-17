import { Wallet, IWallet } from '../models/Wallet';
import { CryptoBalance } from '../types/walletTypes';
import mongoose from 'mongoose';
import config from '../../../config';

export class CryptoService {

  private checkCryptoEnabled(): void {
    if (!config.features.crypto.enabled) {
      throw new Error('Crypto functionality is currently disabled');
    }
  }

  private validateCurrency(currency: string): void {
    if (!config.features.crypto.supportedCurrencies.includes(currency)) {
      throw new Error(`Currency ${currency} is not supported`);
    }
  }

  async getPrices(currencies: string[] = []): Promise<any[]> {
    this.checkCryptoEnabled();

    // Filtrer seulement les devises supportées
    const supportedCurrencies = currencies.filter(c =>
      config.features.crypto.supportedCurrencies.includes(c)
    );

    if (supportedCurrencies.length === 0) {
      return [];
    }

    // Simuler des prix pour l'exemple (vous devriez appeler une vraie API)
    const mockPrices = {
      'BTC': 45000,
      'ETH': 3200,
      'LTC': 180,
      'BCH': 420,
      'XRP': 0.65,
      'ADA': 1.85
    };

    return supportedCurrencies.map(currency => ({
      currency,
      priceEUR: mockPrices[currency] || 0,
      priceUSD: mockPrices[currency] * 1.1 || 0,
      change24h: Math.random() * 10 - 5, // Random change between -5% and +5%
      lastUpdated: new Date().toISOString()
    }));
  }
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
    this.checkCryptoEnabled();
    const wallet = await Wallet.findOne({ userId });
    return wallet?.cryptoBalances || [];
  }

  async buyCrypto(userId: string, currency: string, amount: number, totalCost: number): Promise<void> {
    this.checkCryptoEnabled();
    this.validateCurrency(currency);

    // Vérifier les limites d'achat
    if (totalCost < config.features.crypto.minimumBuyAmount) {
      throw new Error(`Minimum buy amount is ${config.features.crypto.minimumBuyAmount} EUR`);
    }

    if (totalCost > config.features.crypto.maximumBuyAmount) {
      throw new Error(`Maximum buy amount is ${config.features.crypto.maximumBuyAmount} EUR`);
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet || wallet.balance < totalCost) {
          throw new Error('Solde insuffisant pour acheter cette crypto');
        }

        // Appliquer les frais de transaction
        const feeAmount = totalCost * (config.features.crypto.transactionFeePercentage / 100);
        const finalCost = totalCost + feeAmount;

        if (wallet.balance < finalCost) {
          throw new Error(`Solde insuffisant (frais inclus: ${feeAmount} EUR)`);
        }

        await Wallet.updateOne(
          { userId },
          { $inc: { balance: -finalCost } }
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
    this.checkCryptoEnabled();
    this.validateCurrency(currency);

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const wallet = await Wallet.findOne({ userId }).session(session);
        const cryptoBalance = wallet?.cryptoBalances?.find(c => c.currency === currency);

        if (!cryptoBalance || cryptoBalance.amount < amount) {
          throw new Error('Solde crypto insuffisant');
        }

        // Appliquer les frais de transaction
        const feeAmount = totalValue * (config.features.crypto.transactionFeePercentage / 100);
        const finalValue = totalValue - feeAmount;

        await Wallet.updateOne(
          { userId },
          { $inc: { balance: finalValue } }
        ).session(session);

        const newAmount = cryptoBalance.amount - amount;
        await this.updateCryptoBalance(userId, currency, newAmount, newAmount * (cryptoBalance.value / cryptoBalance.amount));
      });
    } finally {
      await session.endSession();
    }
  }
}