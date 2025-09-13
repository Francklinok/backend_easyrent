import { Router } from 'express';
import { WalletController } from '../controllers/walletController';
import { authenticateToken } from '../../auth/middleware/authMiddleware';

const router = Router();
const walletController = new WalletController();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken as any);

// Routes du portefeuille
router.get('/', walletController.getWallet.bind(walletController));

// Routes des transactions
router.get('/transactions', walletController.getTransactions.bind(walletController));
router.post('/transactions', walletController.createTransaction.bind(walletController));
router.get('/transactions/:transactionId', walletController.getTransactionById.bind(walletController));

// Route de transfert
router.post('/transfer', walletController.transferMoney.bind(walletController));

// Routes des méthodes de paiement
router.post('/payment-methods', walletController.addPaymentMethod.bind(walletController));
router.delete('/payment-methods/:methodId', walletController.deletePaymentMethod.bind(walletController));
router.patch('/payment-methods/:methodId/default', walletController.setDefaultPaymentMethod.bind(walletController));

// Routes crypto
router.post('/crypto/buy', walletController.buyCrypto.bind(walletController));
router.post('/crypto/sell', walletController.sellCrypto.bind(walletController));

export default router;