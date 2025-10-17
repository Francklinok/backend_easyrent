import { MobileMoneyProvider } from '../services/MobileMoneyService';

export const MOBILE_MONEY_PROVIDERS: MobileMoneyProvider[] = [
  // Afrique de l'Ouest - Zone UEMOA (XOF)

  // Côte d'Ivoire
  {
    id: 'orange_money_ci',
    name: 'Orange Money',
    shortCode: 'OM',
    country: 'Côte d\'Ivoire',
    countryCode: 'CI',
    currency: 'XOF',
    logo: 'https://cdn.orange.com/logos/orange-money-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 1.5,
      withdrawal: 2.0,
      transfer: 1.0,
      minimum: 50,
      maximum: 5000
    },
    limits: {
      minTransaction: 100,
      maxTransaction: 1000000,
      dailyLimit: 2000000,
      monthlyLimit: 10000000
    },
    apiEndpoint: 'https://api.orange.ci/mobile-money/v1',
    webhookSecret: 'orange_ci_webhook_secret'
  },
  {
    id: 'mtn_money_ci',
    name: 'MTN Mobile Money',
    shortCode: 'MOMO',
    country: 'Côte d\'Ivoire',
    countryCode: 'CI',
    currency: 'XOF',
    logo: 'https://cdn.mtn.com/logos/mtn-momo-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 1.2,
      withdrawal: 1.8,
      transfer: 0.8,
      minimum: 25,
      maximum: 4000
    },
    limits: {
      minTransaction: 50,
      maxTransaction: 1500000,
      dailyLimit: 3000000,
      monthlyLimit: 15000000
    },
    apiEndpoint: 'https://api.mtn.ci/momo/v1',
    webhookSecret: 'mtn_ci_webhook_secret'
  },
  {
    id: 'wave_ci',
    name: 'Wave',
    shortCode: 'WAVE',
    country: 'Côte d\'Ivoire',
    countryCode: 'CI',
    currency: 'XOF',
    logo: 'https://cdn.wave.com/logos/wave-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 0.5,
      withdrawal: 1.0,
      transfer: 0.3,
      minimum: 10,
      maximum: 2000
    },
    limits: {
      minTransaction: 25,
      maxTransaction: 2000000,
      dailyLimit: 5000000,
      monthlyLimit: 20000000
    },
    apiEndpoint: 'https://api.wave.com/v1',
    webhookSecret: 'wave_ci_webhook_secret'
  },

  // Sénégal
  {
    id: 'orange_money_sn',
    name: 'Orange Money',
    shortCode: 'OM',
    country: 'Sénégal',
    countryCode: 'SN',
    currency: 'XOF',
    logo: 'https://cdn.orange.com/logos/orange-money-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 1.5,
      withdrawal: 2.0,
      transfer: 1.0,
      minimum: 50,
      maximum: 5000
    },
    limits: {
      minTransaction: 100,
      maxTransaction: 1000000,
      dailyLimit: 2000000,
      monthlyLimit: 10000000
    },
    apiEndpoint: 'https://api.orange.sn/mobile-money/v1',
    webhookSecret: 'orange_sn_webhook_secret'
  },
  {
    id: 'wave_sn',
    name: 'Wave',
    shortCode: 'WAVE',
    country: 'Sénégal',
    countryCode: 'SN',
    currency: 'XOF',
    logo: 'https://cdn.wave.com/logos/wave-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 0.0, // Wave gratuit au Sénégal
      withdrawal: 0.5,
      transfer: 0.0,
      minimum: 0,
      maximum: 1000
    },
    limits: {
      minTransaction: 25,
      maxTransaction: 2000000,
      dailyLimit: 5000000,
      monthlyLimit: 20000000
    },
    apiEndpoint: 'https://api.wave.com/v1',
    webhookSecret: 'wave_sn_webhook_secret'
  },

  // Togo
  {
    id: 'tmoney_tg',
    name: 'T-Money',
    shortCode: 'TMONEY',
    country: 'Togo',
    countryCode: 'TG',
    currency: 'XOF',
    logo: 'https://cdn.togocom.tg/logos/tmoney-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 1.0,
      withdrawal: 1.5,
      transfer: 0.75,
      minimum: 25,
      maximum: 3000
    },
    limits: {
      minTransaction: 50,
      maxTransaction: 1000000,
      dailyLimit: 2500000,
      monthlyLimit: 12000000
    },
    apiEndpoint: 'https://api.togocom.tg/tmoney/v1',
    webhookSecret: 'tmoney_tg_webhook_secret'
  },
  {
    id: 'flooz_tg',
    name: 'Flooz',
    shortCode: 'FLOOZ',
    country: 'Togo',
    countryCode: 'TG',
    currency: 'XOF',
    logo: 'https://cdn.moov.tg/logos/flooz-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 0.8,
      withdrawal: 1.2,
      transfer: 0.5,
      minimum: 20,
      maximum: 2500
    },
    limits: {
      minTransaction: 25,
      maxTransaction: 1500000,
      dailyLimit: 3000000,
      monthlyLimit: 15000000
    },
    apiEndpoint: 'https://api.moov.tg/flooz/v1',
    webhookSecret: 'flooz_tg_webhook_secret'
  },

  // Mali
  {
    id: 'orange_money_ml',
    name: 'Orange Money',
    shortCode: 'OM',
    country: 'Mali',
    countryCode: 'ML',
    currency: 'XOF',
    logo: 'https://cdn.orange.com/logos/orange-money-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 1.5,
      withdrawal: 2.0,
      transfer: 1.0,
      minimum: 50,
      maximum: 5000
    },
    limits: {
      minTransaction: 100,
      maxTransaction: 1000000,
      dailyLimit: 2000000,
      monthlyLimit: 10000000
    },
    apiEndpoint: 'https://api.orange.ml/mobile-money/v1',
    webhookSecret: 'orange_ml_webhook_secret'
  },

  // Burkina Faso
  {
    id: 'orange_money_bf',
    name: 'Orange Money',
    shortCode: 'OM',
    country: 'Burkina Faso',
    countryCode: 'BF',
    currency: 'XOF',
    logo: 'https://cdn.orange.com/logos/orange-money-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 1.5,
      withdrawal: 2.0,
      transfer: 1.0,
      minimum: 50,
      maximum: 5000
    },
    limits: {
      minTransaction: 100,
      maxTransaction: 1000000,
      dailyLimit: 2000000,
      monthlyLimit: 10000000
    },
    apiEndpoint: 'https://api.orange.bf/mobile-money/v1',
    webhookSecret: 'orange_bf_webhook_secret'
  },

  // Afrique de l'Est

  // Kenya
  {
    id: 'mpesa_ke',
    name: 'M-Pesa',
    shortCode: 'MPESA',
    country: 'Kenya',
    countryCode: 'KE',
    currency: 'KES',
    logo: 'https://cdn.safaricom.co.ke/logos/mpesa-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 0.0,
      withdrawal: 1.5,
      transfer: 0.5,
      minimum: 10,
      maximum: 300
    },
    limits: {
      minTransaction: 10,
      maxTransaction: 300000,
      dailyLimit: 300000,
      monthlyLimit: 3000000
    },
    apiEndpoint: 'https://api.safaricom.co.ke/mpesa/v1',
    webhookSecret: 'mpesa_ke_webhook_secret'
  },
  {
    id: 'airtel_money_ke',
    name: 'Airtel Money',
    shortCode: 'AIRTEL',
    country: 'Kenya',
    countryCode: 'KE',
    currency: 'KES',
    logo: 'https://cdn.airtel.co.ke/logos/airtel-money-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 0.0,
      withdrawal: 1.2,
      transfer: 0.3,
      minimum: 5,
      maximum: 250
    },
    limits: {
      minTransaction: 10,
      maxTransaction: 250000,
      dailyLimit: 250000,
      monthlyLimit: 2500000
    },
    apiEndpoint: 'https://api.airtel.co.ke/money/v1',
    webhookSecret: 'airtel_ke_webhook_secret'
  },

  // Ghana
  {
    id: 'mtn_momo_gh',
    name: 'MTN Mobile Money',
    shortCode: 'MOMO',
    country: 'Ghana',
    countryCode: 'GH',
    currency: 'GHS',
    logo: 'https://cdn.mtn.com/logos/mtn-momo-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 0.75,
      withdrawal: 1.5,
      transfer: 0.5,
      minimum: 0.5,
      maximum: 100
    },
    limits: {
      minTransaction: 1,
      maxTransaction: 5000,
      dailyLimit: 10000,
      monthlyLimit: 50000
    },
    apiEndpoint: 'https://api.mtn.com.gh/momo/v1',
    webhookSecret: 'mtn_gh_webhook_secret'
  },
  {
    id: 'vodafone_cash_gh',
    name: 'Vodafone Cash',
    shortCode: 'VCASH',
    country: 'Ghana',
    countryCode: 'GH',
    currency: 'GHS',
    logo: 'https://cdn.vodafone.com.gh/logos/vodafone-cash-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 0.75,
      withdrawal: 1.5,
      transfer: 0.5,
      minimum: 0.5,
      maximum: 100
    },
    limits: {
      minTransaction: 1,
      maxTransaction: 5000,
      dailyLimit: 10000,
      monthlyLimit: 50000
    },
    apiEndpoint: 'https://api.vodafone.com.gh/cash/v1',
    webhookSecret: 'vodafone_gh_webhook_secret'
  },

  // Afrique Centrale

  // Cameroun
  {
    id: 'orange_money_cm',
    name: 'Orange Money',
    shortCode: 'OM',
    country: 'Cameroun',
    countryCode: 'CM',
    currency: 'XAF',
    logo: 'https://cdn.orange.com/logos/orange-money-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 1.5,
      withdrawal: 2.0,
      transfer: 1.0,
      minimum: 100,
      maximum: 10000
    },
    limits: {
      minTransaction: 200,
      maxTransaction: 2000000,
      dailyLimit: 4000000,
      monthlyLimit: 20000000
    },
    apiEndpoint: 'https://api.orange.cm/mobile-money/v1',
    webhookSecret: 'orange_cm_webhook_secret'
  },
  {
    id: 'mtn_momo_cm',
    name: 'MTN Mobile Money',
    shortCode: 'MOMO',
    country: 'Cameroun',
    countryCode: 'CM',
    currency: 'XAF',
    logo: 'https://cdn.mtn.com/logos/mtn-momo-logo.png',
    isActive: true,
    supportedOperations: ['deposit', 'withdrawal', 'transfer'],
    fees: {
      deposit: 1.2,
      withdrawal: 1.8,
      transfer: 0.8,
      minimum: 50,
      maximum: 8000
    },
    limits: {
      minTransaction: 100,
      maxTransaction: 3000000,
      dailyLimit: 6000000,
      monthlyLimit: 30000000
    },
    apiEndpoint: 'https://api.mtn.cm/momo/v1',
    webhookSecret: 'mtn_cm_webhook_secret'
  }
];

// Configuration des règles de validation par pays
export const PHONE_VALIDATION_RULES = {
  'CI': {
    length: [8, 10],
    prefixes: {
      'orange_money_ci': ['07', '08', '09'],
      'mtn_money_ci': ['05', '06'],
      'wave_ci': ['01', '02', '03', '04', '05', '06', '07', '08', '09']
    }
  },
  'SN': {
    length: [9],
    prefixes: {
      'orange_money_sn': ['77', '78'],
      'wave_sn': ['70', '75', '76', '77', '78']
    }
  },
  'TG': {
    length: [8],
    prefixes: {
      'tmoney_tg': ['90', '91', '92', '93'],
      'flooz_tg': ['96', '97', '98', '99']
    }
  },
  'ML': {
    length: [8],
    prefixes: {
      'orange_money_ml': ['65', '66', '67', '68', '69']
    }
  },
  'BF': {
    length: [8],
    prefixes: {
      'orange_money_bf': ['65', '66', '67', '68', '69']
    }
  },
  'KE': {
    length: [9, 10],
    prefixes: {
      'mpesa_ke': ['07', '01'],
      'airtel_money_ke': ['07', '10', '73', '78']
    }
  },
  'GH': {
    length: [9, 10],
    prefixes: {
      'mtn_momo_gh': ['024', '054', '055', '059'],
      'vodafone_cash_gh': ['020', '050']
    }
  },
  'CM': {
    length: [9],
    prefixes: {
      'orange_money_cm': ['69', '65', '66', '67'],
      'mtn_momo_cm': ['67', '65', '68']
    }
  }
};

// Pays supportés avec leurs devises
export const SUPPORTED_COUNTRIES = {
  'CI': { name: 'Côte d\'Ivoire', currency: 'XOF', flag: '🇨🇮' },
  'SN': { name: 'Sénégal', currency: 'XOF', flag: '🇸🇳' },
  'TG': { name: 'Togo', currency: 'XOF', flag: '🇹🇬' },
  'ML': { name: 'Mali', currency: 'XOF', flag: '🇲🇱' },
  'BF': { name: 'Burkina Faso', currency: 'XOF', flag: '🇧🇫' },
  'KE': { name: 'Kenya', currency: 'KES', flag: '🇰🇪' },
  'GH': { name: 'Ghana', currency: 'GHS', flag: '🇬🇭' },
  'CM': { name: 'Cameroun', currency: 'XAF', flag: '🇨🇲' }
};

// Devises supportées
export const SUPPORTED_CURRENCIES = {
  'XOF': { name: 'Franc CFA Ouest', symbol: 'F CFA', countries: ['CI', 'SN', 'TG', 'ML', 'BF'] },
  'XAF': { name: 'Franc CFA Central', symbol: 'F CFA', countries: ['CM'] },
  'KES': { name: 'Shilling Kenyan', symbol: 'KSh', countries: ['KE'] },
  'GHS': { name: 'Cedi Ghanéen', symbol: 'GH₵', countries: ['GH'] }
};