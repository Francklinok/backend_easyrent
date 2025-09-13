import { ObjectId } from 'mongodb';
import { getDb } from '../../config/database';
import { PaymentMethod, CreatePaymentMethodRequest } from '../types/walletTypes';

export class PaymentMethodService {
  private db = getDb();

  async createPaymentMethod(userId: string, data: CreatePaymentMethodRequest): Promise<PaymentMethod> {
    // Si c'est la première méthode ou marquée par défaut, désactiver les autres
    if (data.isDefault) {
      await this.db.collection('paymentMethods').updateMany(
        { userId },
        { $set: { isDefault: false } }
      );
    }

    const paymentMethod: Omit<PaymentMethod, 'id'> = {
      userId,
      type: data.type,
      name: data.name,
      details: this.sanitizeDetails(data.details),
      isDefault: data.isDefault || false,
      isActive: true,
      createdAt: new Date()
    };

    const result = await this.db.collection('paymentMethods').insertOne(paymentMethod);
    return { ...paymentMethod, id: result.insertedId.toString() };
  }

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    const methods = await this.db.collection('paymentMethods')
      .find({ userId, isActive: true })
      .sort({ isDefault: -1, createdAt: -1 })
      .toArray();

    return methods.map(m => ({ ...m, id: m._id.toString() }));
  }

  async deletePaymentMethod(userId: string, methodId: string): Promise<void> {
    await this.db.collection('paymentMethods').updateOne(
      { _id: new ObjectId(methodId), userId },
      { $set: { isActive: false } }
    );
  }

  async setDefaultPaymentMethod(userId: string, methodId: string): Promise<void> {
    // Désactiver toutes les méthodes par défaut
    await this.db.collection('paymentMethods').updateMany(
      { userId },
      { $set: { isDefault: false } }
    );

    // Activer la nouvelle méthode par défaut
    await this.db.collection('paymentMethods').updateOne(
      { _id: new ObjectId(methodId), userId },
      { $set: { isDefault: true } }
    );
  }

  private sanitizeDetails(details: any) {
    const sanitized = { ...details };
    
    // Masquer les informations sensibles
    if (sanitized.cardNumber) {
      sanitized.last4 = sanitized.cardNumber.slice(-4);
      delete sanitized.cardNumber;
      delete sanitized.cvv;
    }

    if (sanitized.iban) {
      sanitized.last4 = sanitized.iban.slice(-4);
    }

    return sanitized;
  }
}