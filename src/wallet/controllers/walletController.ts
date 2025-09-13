import { Request, Response } from 'express';
import { WalletService } from '../services/walletService';
import { PaymentMethodService } from '../services/paymentMethodService';
import { CryptoService } from '../services/cryptoService';

export class WalletController {
  private walletService = new WalletService();
  private paymentMethodService = new PaymentMethodService();
  private cryptoService = new CryptoService();

  async getWallet(req: Request, res: Response) {
    try {
      const userId = req.user?.userId as string;
      let wallet = await this.walletService.getWallet(userId);
      
      if (!wallet) {
        wallet = await this.walletService.createWallet(userId);
      }

      const paymentMethods = await this.paymentMethodService.getPaymentMethods(userId);
      
      res.json({
        success: true,
        data: {
          ...wallet,
          paymentMethods
        }
      });
    } catch (error:any) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du portefeuille',
        error: error.message
      });
    }
  }

  async getTransactions(req: Request, res: Response) {
    try {
      const userId = req.user?.userId as string;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const transactions = await this.walletService.getTransactions(userId, limit);
      
      res.json({
        success: true,
        data: transactions
      });
    } catch (error:any) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des transactions',
        error: error.message
      });
    }
  }

  async createTransaction(req: Request, res: Response) {
    try {
      const userId = req.user?.userId as string;
      const transactionData = req.body;
      
      const transaction = await this.walletService.processPayment(userId, transactionData);
      
      res.status(201).json({
        success: true,
        message: 'Transaction créée avec succès',
        data: transaction
      });
    } catch (error:any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de la création de la transaction',
        error: error.message
      });
    }
  }

  async transferMoney(req: Request, res: Response) {
    try {
      const userId = req.user?.userId as string;
      const transferData = req.body;
      
      const transaction = await this.walletService.transferMoney(userId, transferData);
      
      res.json({
        success: true,
        message: 'Transfert effectué avec succès',
        data: transaction
      });
    } catch (error:any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors du transfert',
        error: error.message
      });
    }
  }

  async addPaymentMethod(req: Request, res: Response) {
    try {
      const userId = req.user?.userId as  string;
      const methodData = req.body;
      
      const paymentMethod = await this.paymentMethodService.createPaymentMethod(userId, methodData);
      
      res.status(201).json({
        success: true,
        message: 'Méthode de paiement ajoutée avec succès',
        data: paymentMethod
      });
    } catch (error:any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de l\'ajout de la méthode de paiement',
        error: error.message
      });
    }
  }

  async deletePaymentMethod(req: Request, res: Response) {
    try {
      const id = req.user?.userId as  string;
      const { methodId } = req.params;
      
      await this.paymentMethodService.deletePaymentMethod(id, methodId);
      
      res.json({
        success: true,
        message: 'Méthode de paiement supprimée avec succès'
      });
    } catch (error:any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression de la méthode de paiement',
        error: error.message
      });
    }
  }

  async setDefaultPaymentMethod(req: Request, res: Response) {
    try {
      const id = req.user?.userId as  string;
      const { methodId } = req.params;
      
      await this.paymentMethodService.setDefaultPaymentMethod(id, methodId);
      
      res.json({
        success: true,
        message: 'Méthode de paiement par défaut mise à jour'
      });
    } catch (error:any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour de la méthode par défaut',
        error: error.message
      });
    }
  }

  async getTransactionById(req: Request, res: Response) {
    try {
      const userId = req.user?.userId as  string;
      const { transactionId } = req.params;
      
      const transaction = await this.walletService.getTransactionById(userId, transactionId);
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction non trouvée'
        });
      }
      
      res.json({
        success: true,
        data: transaction
      });
    } catch (error:any) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la transaction',
        error: error.message
      });
    }
  }

  async buyCrypto(req: Request, res: Response) {
    try {
      const userId = req.user?.userId as  string;
      const { currency, amount, totalCost } = req.body;
      
      await this.cryptoService.buyCrypto(userId, currency, amount, totalCost);
      
      res.json({
        success: true,
        message: 'Achat de crypto effectué avec succès'
      });
    } catch (error:any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de l\'achat de crypto',
        error: error.message
      });
    }
  }

  async sellCrypto(req: Request, res: Response) {
    try {
      const userId = req.user?.userId as string;
      const { currency, amount, totalValue } = req.body;
      
      await this.cryptoService.sellCrypto(userId, currency, amount, totalValue);
      
      res.json({
        success: true,
        message: 'Vente de crypto effectuée avec succès'
      });
    } catch (error:any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de la vente de crypto',
        error: error.message
      });
    }
  }
}