import axios from 'axios';
import { CryptoConfig } from '../../crypto/config/CryptoConfig';

export interface PriceConversion {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  timestamp: Date;
  provider: string;
}

export interface CryptoPriceData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: Date;
}

export class PriceService {
  private cryptoConfig: CryptoConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.cryptoConfig = new CryptoConfig();
  }

  async convertCurrency(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<PriceConversion> {
    try {
      const cacheKey = `${fromCurrency}-${toCurrency}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        const rate = cached.data.rate;
        return {
          fromCurrency,
          toCurrency,
          fromAmount: amount,
          toAmount: amount * rate,
          rate,
          timestamp: new Date(),
          provider: 'cache'
        };
      }

      // Crypto to fiat or crypto to crypto
      if (this.isCryptoCurrency(fromCurrency) || this.isCryptoCurrency(toCurrency)) {
        return await this.convertCryptoCurrency(fromCurrency, toCurrency, amount);
      }

      // Fiat to fiat conversion
      return await this.convertFiatCurrency(fromCurrency, toCurrency, amount);
    } catch (error) {
      console.error('Currency conversion error:', error);
      throw new Error(`Failed to convert ${fromCurrency} to ${toCurrency}`);
    }
  }

  async getCryptoPrices(symbols: string[]): Promise<CryptoPriceData[]> {
    try {
      const symbolsStr = symbols.map(s => s.toLowerCase()).join(',');
      const response = await axios.get(
        `${process.env.CRYPTO_API_URL}/simple/price`,
        {
          params: {
            ids: symbolsStr,
            vs_currencies: 'eur,usd',
            include_24hr_change: true,
            include_market_cap: true,
            include_24hr_vol: true
          },
          headers: process.env.CRYPTO_API_KEY ? {
            'X-CG-Demo-API-Key': process.env.CRYPTO_API_KEY
          } : {}
        }
      );

      return Object.entries(response.data).map(([id, data]: [string, any]) => ({
        symbol: id.toUpperCase(),
        name: id,
        price: data.eur || data.usd || 0,
        change24h: data.eur_24h_change || data.usd_24h_change || 0,
        marketCap: data.eur_market_cap || data.usd_market_cap || 0,
        volume24h: data.eur_24h_vol || data.usd_24h_vol || 0,
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      throw new Error('Failed to fetch cryptocurrency prices');
    }
  }

  async getCryptoPrice(symbol: string, vsCurrency: string = 'EUR'): Promise<number> {
    try {
      const cacheKey = `${symbol}-${vsCurrency}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data.price;
      }

      const response = await axios.get(
        `${process.env.CRYPTO_API_URL}/simple/price`,
        {
          params: {
            ids: symbol.toLowerCase(),
            vs_currencies: vsCurrency.toLowerCase()
          },
          headers: process.env.CRYPTO_API_KEY ? {
            'X-CG-Demo-API-Key': process.env.CRYPTO_API_KEY
          } : {}
        }
      );

      const price = response.data[symbol.toLowerCase()]?.[vsCurrency.toLowerCase()];
      if (!price) {
        throw new Error(`Price not found for ${symbol}/${vsCurrency}`);
      }

      this.cache.set(cacheKey, {
        data: { price },
        timestamp: Date.now()
      });

      return price;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      throw new Error(`Failed to fetch price for ${symbol}`);
    }
  }

  private async convertCryptoCurrency(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<PriceConversion> {
    if (this.isCryptoCurrency(fromCurrency) && this.isCryptoCurrency(toCurrency)) {
      // Crypto to crypto via EUR
      const fromPriceEur = await this.getCryptoPrice(fromCurrency, 'EUR');
      const toPriceEur = await this.getCryptoPrice(toCurrency, 'EUR');
      const rate = fromPriceEur / toPriceEur;

      return {
        fromCurrency,
        toCurrency,
        fromAmount: amount,
        toAmount: amount * rate,
        rate,
        timestamp: new Date(),
        provider: 'coingecko'
      };
    }

    if (this.isCryptoCurrency(fromCurrency) && !this.isCryptoCurrency(toCurrency)) {
      // Crypto to fiat
      const rate = await this.getCryptoPrice(fromCurrency, toCurrency);
      return {
        fromCurrency,
        toCurrency,
        fromAmount: amount,
        toAmount: amount * rate,
        rate,
        timestamp: new Date(),
        provider: 'coingecko'
      };
    }

    if (!this.isCryptoCurrency(fromCurrency) && this.isCryptoCurrency(toCurrency)) {
      // Fiat to crypto
      const rate = await this.getCryptoPrice(toCurrency, fromCurrency);
      const conversionRate = 1 / rate;
      return {
        fromCurrency,
        toCurrency,
        fromAmount: amount,
        toAmount: amount * conversionRate,
        rate: conversionRate,
        timestamp: new Date(),
        provider: 'coingecko'
      };
    }

    throw new Error('Invalid currency conversion');
  }

  private async convertFiatCurrency(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<PriceConversion> {
    // For fiat currencies, use a forex API or default rates
    // For now, using EUR as base currency
    const exchangeRates: Record<string, number> = {
      'EUR': 1,
      'USD': 1.10,
      'GBP': 0.85,
      'CHF': 0.95,
      'CAD': 1.45
    };

    const fromRate = exchangeRates[fromCurrency.toUpperCase()] || 1;
    const toRate = exchangeRates[toCurrency.toUpperCase()] || 1;
    const rate = toRate / fromRate;

    return {
      fromCurrency,
      toCurrency,
      fromAmount: amount,
      toAmount: amount * rate,
      rate,
      timestamp: new Date(),
      provider: 'internal'
    };
  }

  private isCryptoCurrency(currency: string): boolean {
    const supportedCryptos = process.env.CRYPTO_SUPPORTED_CURRENCIES?.split(',') || [
      'BTC', 'ETH', 'LTC', 'BCH', 'XRP', 'ADA'
    ];
    return supportedCryptos.includes(currency.toUpperCase());
  }

  async getExchangeRates(baseCurrency: string = 'EUR'): Promise<Record<string, number>> {
    try {
      const cacheKey = `rates-${baseCurrency}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Get fiat rates
      const fiatRates = {
        'EUR': baseCurrency === 'EUR' ? 1 : 0.91,
        'USD': baseCurrency === 'USD' ? 1 : 1.10,
        'GBP': baseCurrency === 'GBP' ? 1 : 0.85,
        'CHF': baseCurrency === 'CHF' ? 1 : 0.95
      };

      // Get crypto rates
      const supportedCryptos = process.env.CRYPTO_SUPPORTED_CURRENCIES?.split(',') || [
        'BTC', 'ETH', 'LTC', 'BCH', 'XRP', 'ADA'
      ];

      const cryptoRates: Record<string, number> = {};
      for (const crypto of supportedCryptos) {
        try {
          cryptoRates[crypto] = await this.getCryptoPrice(crypto, baseCurrency);
        } catch (error) {
          console.warn(`Failed to fetch rate for ${crypto}:`, error);
          cryptoRates[crypto] = 0;
        }
      }

      const allRates = { ...fiatRates, ...cryptoRates };

      this.cache.set(cacheKey, {
        data: allRates,
        timestamp: Date.now()
      });

      return allRates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      throw new Error('Failed to fetch exchange rates');
    }
  }

  calculateTransactionFee(amount: number, currency: string, paymentMethod: string): number {
    const baseFee = parseFloat(process.env.CRYPTO_TRANSACTION_FEE || '1.5');

    // Different fees for different payment methods
    const feeMultipliers: Record<string, number> = {
      'crypto': 1.0,
      'bank_transfer': 0.5,
      'credit_card': 1.5,
      'paypal': 2.0,
      'stripe': 1.2
    };

    const multiplier = feeMultipliers[paymentMethod] || 1.0;
    const feePercent = baseFee * multiplier;

    return (amount * feePercent) / 100;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

