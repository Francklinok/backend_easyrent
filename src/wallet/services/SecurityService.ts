import crypto from 'crypto';
import { IWalletTransaction } from '../models/EnhancedWallet';

export interface SecurityCheck {
  passed: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  recommendations: string[];
  blockTransaction: boolean;
}

export interface FraudPattern {
  pattern: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  action: 'monitor' | 'review' | 'block';
}

export interface TransactionRisk {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high';
  factors: string[];
  shouldBlock: boolean;
  shouldReview: boolean;
}

export class SecurityService {
  private suspiciousPatterns: FraudPattern[] = [
    {
      pattern: 'rapid_multiple_transactions',
      description: 'Multiple transactions in short time frame',
      riskLevel: 'medium',
      action: 'review'
    },
    {
      pattern: 'unusual_amount',
      description: 'Transaction amount significantly higher than user average',
      riskLevel: 'high',
      action: 'review'
    },
    {
      pattern: 'new_device_large_amount',
      description: 'Large transaction from new device',
      riskLevel: 'high',
      action: 'block'
    },
    {
      pattern: 'multiple_failed_attempts',
      description: 'Multiple failed transaction attempts',
      riskLevel: 'high',
      action: 'block'
    },
    {
      pattern: 'crypto_rapid_conversion',
      description: 'Rapid cryptocurrency conversions',
      riskLevel: 'medium',
      action: 'monitor'
    }
  ];

  async validateTransaction(
    userId: string,
    amount: number,
    currency: string,
    paymentMethod: string,
    userTransactionHistory: IWalletTransaction[],
    userInfo: any
  ): Promise<SecurityCheck> {
    const checks: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let blockTransaction = false;

    // Check transaction amount limits
    const amountCheck = this.checkTransactionLimits(amount, currency, userInfo);
    if (!amountCheck.passed) {
      checks.push(...amountCheck.reasons);
      recommendations.push(...amountCheck.recommendations);
      if (amountCheck.riskLevel === 'high') {
        riskLevel = 'high';
        blockTransaction = true;
      }
    }

    // Check transaction frequency
    const frequencyCheck = this.checkTransactionFrequency(userTransactionHistory);
    if (!frequencyCheck.passed) {
      checks.push(...frequencyCheck.reasons);
      recommendations.push(...frequencyCheck.recommendations);
      if (frequencyCheck.riskLevel === 'high') {
        riskLevel = 'high';
      }
    }

    // Check for suspicious patterns
    const patternCheck = this.checkSuspiciousPatterns(
      userId,
      amount,
      currency,
      userTransactionHistory
    );
    if (!patternCheck.passed) {
      checks.push(...patternCheck.reasons);
      recommendations.push(...patternCheck.recommendations);
      if (patternCheck.riskLevel === 'high') {
        riskLevel = 'high';
        blockTransaction = true;
      }
    }

    // Check payment method security
    const paymentMethodCheck = this.checkPaymentMethodSecurity(paymentMethod, amount);
    if (!paymentMethodCheck.passed) {
      checks.push(...paymentMethodCheck.reasons);
      recommendations.push(...paymentMethodCheck.recommendations);
    }

    const overallPassed = checks.length === 0;

    return {
      passed: overallPassed && !blockTransaction,
      riskLevel,
      reasons: checks,
      recommendations,
      blockTransaction
    };
  }

  private checkTransactionLimits(
    amount: number,
    currency: string,
    userInfo: any
  ): SecurityCheck {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Get limits from environment or defaults
    const minAmount = parseFloat(process.env.CRYPTO_MIN_BUY_AMOUNT || '10');
    const maxAmount = parseFloat(process.env.CRYPTO_MAX_BUY_AMOUNT || '10000');

    if (amount < minAmount) {
      reasons.push(`Transaction amount ${amount} ${currency} is below minimum limit ${minAmount}`);
      recommendations.push(`Minimum transaction amount is ${minAmount} ${currency}`);
      riskLevel = 'medium';
    }

    if (amount > maxAmount) {
      reasons.push(`Transaction amount ${amount} ${currency} exceeds maximum limit ${maxAmount}`);
      recommendations.push(`Consider breaking large transactions into smaller amounts`);
      riskLevel = 'high';
    }

    // Check user-specific limits based on verification level
    if (userInfo?.verificationLevel === 'unverified' && amount > 1000) {
      reasons.push('Large transaction attempted by unverified user');
      recommendations.push('Complete account verification to increase limits');
      riskLevel = 'high';
    }

    return {
      passed: reasons.length === 0,
      riskLevel,
      reasons,
      recommendations,
      blockTransaction: riskLevel === 'high'
    };
  }

  private checkTransactionFrequency(
    userTransactionHistory: IWalletTransaction[]
  ): SecurityCheck {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Count recent transactions
    const recentTransactions = userTransactionHistory.filter(
      tx => new Date(tx.createdAt) > oneHourAgo
    );

    const dailyTransactions = userTransactionHistory.filter(
      tx => new Date(tx.createdAt) > oneDayAgo
    );

    if (recentTransactions.length > 5) {
      reasons.push('Unusual number of transactions in the last hour');
      recommendations.push('Wait before making additional transactions');
      riskLevel = 'high';
    }

    if (dailyTransactions.length > 20) {
      reasons.push('High transaction volume in the last 24 hours');
      recommendations.push('Consider spreading transactions over multiple days');
      riskLevel = 'medium';
    }

    return {
      passed: reasons.length === 0,
      riskLevel,
      reasons,
      recommendations,
      blockTransaction: false
    };
  }

  private checkSuspiciousPatterns(
    userId: string,
    amount: number,
    currency: string,
    userTransactionHistory: IWalletTransaction[]
  ): SecurityCheck {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Calculate user's average transaction amount
    const amounts = userTransactionHistory
      .filter(tx => tx.currency === currency)
      .map(tx => tx.amount);

    if (amounts.length > 0) {
      const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      const maxAmount = Math.max(...amounts);

      // Check if current amount is significantly higher than usual
      if (amount > avgAmount * 5 && amount > maxAmount * 2) {
        reasons.push('Transaction amount significantly higher than user average');
        recommendations.push('Verify this transaction amount is correct');
        riskLevel = 'high';
      }
    }

    // Check for rapid cryptocurrency conversions
    const recentCryptoTxs = userTransactionHistory.filter(tx =>
      new Date(tx.createdAt) > new Date(Date.now() - 30 * 60 * 1000) && // last 30 minutes
      (tx.type === 'deposit' || tx.type === 'withdrawal')
    );

    if (recentCryptoTxs.length > 3) {
      reasons.push('Rapid cryptocurrency conversion activity detected');
      recommendations.push('Allow time between cryptocurrency transactions');
      riskLevel = 'medium';
    }

    return {
      passed: reasons.length === 0,
      riskLevel,
      reasons,
      recommendations,
      blockTransaction: riskLevel === 'high'
    };
  }

  private checkPaymentMethodSecurity(
    paymentMethod: string,
    amount: number
  ): SecurityCheck {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Different security checks for different payment methods
    switch (paymentMethod.toLowerCase()) {
      case 'crypto':
        if (amount > 5000) {
          recommendations.push('Consider using multiple smaller transactions for large crypto amounts');
        }
        break;

      case 'credit_card':
        if (amount > 2000) {
          reasons.push('Large credit card transaction may require additional verification');
          recommendations.push('Consider using bank transfer for large amounts');
          riskLevel = 'medium';
        }
        break;

      case 'bank_transfer':
        // Bank transfers are generally more secure for large amounts
        break;

      default:
        reasons.push(`Payment method ${paymentMethod} requires additional security review`);
        riskLevel = 'medium';
    }

    return {
      passed: reasons.length === 0,
      riskLevel,
      reasons,
      recommendations,
      blockTransaction: false
    };
  }

  calculateTransactionRisk(
    userId: string,
    amount: number,
    currency: string,
    paymentMethod: string,
    userTransactionHistory: IWalletTransaction[],
    userInfo: any
  ): TransactionRisk {
    let riskScore = 0;
    const factors: string[] = [];

    // Amount-based risk
    const avgAmount = this.calculateAverageTransactionAmount(userTransactionHistory, currency);
    if (amount > avgAmount * 3) {
      riskScore += 25;
      factors.push('Amount significantly above user average');
    }

    // Frequency-based risk
    const recentTxCount = this.getRecentTransactionCount(userTransactionHistory, 60); // last hour
    if (recentTxCount > 3) {
      riskScore += 20;
      factors.push('High transaction frequency');
    }

    // New user risk
    if (userTransactionHistory.length < 5) {
      riskScore += 15;
      factors.push('Limited transaction history');
    }

    // Payment method risk
    const paymentMethodRisk = this.getPaymentMethodRisk(paymentMethod);
    riskScore += paymentMethodRisk.score;
    if (paymentMethodRisk.factor) {
      factors.push(paymentMethodRisk.factor);
    }

    // Time-based risk (unusual hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) {
      riskScore += 10;
      factors.push('Transaction during unusual hours');
    }

    // Currency risk
    if (this.isCryptoCurrency(currency)) {
      riskScore += 5;
      factors.push('Cryptocurrency transaction');
    }

    const level = this.getRiskLevel(riskScore);

    return {
      score: Math.min(riskScore, 100),
      level,
      factors,
      shouldBlock: riskScore >= 80,
      shouldReview: riskScore >= 60
    };
  }

  private calculateAverageTransactionAmount(
    transactions: IWalletTransaction[],
    currency: string
  ): number {
    const relevantTxs = transactions.filter(tx => tx.currency === currency);
    if (relevantTxs.length === 0) return 0;

    const total = relevantTxs.reduce((sum, tx) => sum + tx.amount, 0);
    return total / relevantTxs.length;
  }

  private getRecentTransactionCount(
    transactions: IWalletTransaction[],
    minutesAgo: number
  ): number {
    const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000);
    return transactions.filter(tx => new Date(tx.createdAt) > cutoff).length;
  }

  private getPaymentMethodRisk(paymentMethod: string): { score: number; factor?: string } {
    switch (paymentMethod.toLowerCase()) {
      case 'crypto':
        return { score: 10, factor: 'Cryptocurrency payment method' };
      case 'credit_card':
        return { score: 15, factor: 'Credit card payment' };
      case 'paypal':
        return { score: 12, factor: 'PayPal payment' };
      case 'bank_transfer':
        return { score: 5 };
      case 'stripe':
        return { score: 8 };
      default:
        return { score: 20, factor: 'Unknown payment method' };
    }
  }

  private getRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  private isCryptoCurrency(currency: string): boolean {
    const supportedCryptos = process.env.CRYPTO_SUPPORTED_CURRENCIES?.split(',') || [
      'BTC', 'ETH', 'LTC', 'BCH', 'XRP', 'ADA'
    ];
    return supportedCryptos.includes(currency.toUpperCase());
  }

  encryptSensitiveData(data: string): string {
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  }

  decryptSensitiveData(encryptedData: string): string {
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);

    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  generateTransactionHash(
    userId: string,
    amount: number,
    currency: string,
    timestamp: Date
  ): string {
    const data = `${userId}-${amount}-${currency}-${timestamp.getTime()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  validateTransactionHash(
    userId: string,
    amount: number,
    currency: string,
    timestamp: Date,
    hash: string
  ): boolean {
    const expectedHash = this.generateTransactionHash(userId, amount, currency, timestamp);
    return expectedHash === hash;
  }
}