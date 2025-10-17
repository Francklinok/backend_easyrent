import { GraphQLError } from 'graphql';
import config from '../../../config';

export const requireCryptoEnabled = () => {
  if (!config.features?.crypto?.enabled) {
    throw new GraphQLError('Crypto functionality is currently disabled', {
      extensions: { code: 'FEATURE_DISABLED' }
    });
  }
};

export const validateCryptoCurrency = (currency: string) => {
  const supportedCurrencies = config.features?.crypto?.supportedCurrencies || [];
  if (!supportedCurrencies.includes(currency)) {
    throw new GraphQLError(`Currency ${currency} is not supported. Supported currencies: ${supportedCurrencies.join(', ')}`, {
      extensions: { code: 'UNSUPPORTED_CURRENCY' }
    });
  }
};

export const validateCryptoAmount = (amount: number, amountType: 'buy' | 'sell' = 'buy') => {
  if (amountType === 'buy') {
    const minAmount = config.features?.crypto?.minimumBuyAmount || 10;
    const maxAmount = config.features?.crypto?.maximumBuyAmount || 10000;

    if (amount < minAmount) {
      throw new GraphQLError(`Minimum buy amount is ${minAmount} EUR`, {
        extensions: { code: 'AMOUNT_TOO_LOW' }
      });
    }

    if (amount > maxAmount) {
      throw new GraphQLError(`Maximum buy amount is ${maxAmount} EUR`, {
        extensions: { code: 'AMOUNT_TOO_HIGH' }
      });
    }
  }

  if (amount <= 0) {
    throw new GraphQLError('Amount must be positive', {
      extensions: { code: 'INVALID_AMOUNT' }
    });
  }
};

export const calculateCryptoFees = (amount: number): { feeAmount: number; finalAmount: number } => {
  const feePercentage = config.features?.crypto?.transactionFeePercentage || 1;
  const feeAmount = amount * (feePercentage / 100);
  const finalAmount = amount - feeAmount;

  return {
    feeAmount: parseFloat(feeAmount.toFixed(2)),
    finalAmount: parseFloat(finalAmount.toFixed(2))
  };
};

export const getCryptoLimits = () => {
  return {
    minimumBuyAmount: config.features?.crypto?.minimumBuyAmount || 10,
    maximumBuyAmount: config.features?.crypto?.maximumBuyAmount || 10000,
    transactionFeePercentage: config.features?.crypto?.transactionFeePercentage || 1,
    supportedCurrencies: config.features?.crypto?.supportedCurrencies || []
  };
};