export class CryptoConfig {
  public readonly supportedCurrencies: string[];
  public readonly networks: Record<string, string>;
  public readonly apiUrl: string;
  public readonly apiKey?: string;

  constructor() {
    this.supportedCurrencies = process.env.CRYPTO_SUPPORTED_CURRENCIES?.split(',') || [
      'BTC', 'ETH', 'LTC', 'BCH', 'XRP', 'ADA', 'USDT', 'USDC'
    ];

    this.networks = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      LTC: 'litecoin',
      BCH: 'bitcoin-cash',
      XRP: 'ripple',
      ADA: 'cardano',
      USDT: 'ethereum',
      USDC: 'ethereum'
    };

    this.apiUrl = process.env.CRYPTO_API_URL || 'https://api.coingecko.com/api/v3';
    this.apiKey = process.env.CRYPTO_API_KEY;
  }

  isSupportedCurrency(currency: string): boolean {
    return this.supportedCurrencies.includes(currency.toUpperCase());
  }

  getNetwork(currency: string): string | undefined {
    return this.networks[currency.toUpperCase()];
  }
}
