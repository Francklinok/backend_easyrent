import { body, param } from 'express-validator';

export const validateCreateTransaction = [
  body('type').isIn(['payment', 'received', 'crypto', 'deposit', 'withdrawal']),
  body('amount').isFloat({ min: 0.01 }),
  body('description').isLength({ min: 1, max: 255 }),
  body('currency').optional().isLength({ min: 3, max: 3 })
];

export const validateTransfer = [
  body('recipientId').isMongoId(),
  body('amount').isFloat({ min: 0.01 }),
  body('description').isLength({ min: 1, max: 255 })
];

export const validatePaymentMethod = [
  body('type').isIn(['card', 'bank', 'paypal', 'mobile_money', 'crypto']),
  body('name').isLength({ min: 1, max: 100 }),
  body('details').isObject()
];

export const validateCryptoTransaction = [
  body('currency').isLength({ min: 2, max: 10 }),
  body('amount').isFloat({ min: 0.00000001 }),
  body('totalCost').optional().isFloat({ min: 0.01 }),
  body('totalValue').optional().isFloat({ min: 0.01 })
];

export const validateMongoId = [
  param('id').isMongoId(),
  param('methodId').optional().isMongoId(),
  param('transactionId').optional().isMongoId()
];