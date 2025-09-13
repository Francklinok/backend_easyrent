import { PaymentMethod, IPaymentMethod } from '../models/PaymentMethod';
import { CreatePaymentMethodRequest } from '../types/walletTypes';

export class PaymentMethodService {

  async createPaymentMethod(userId: string, data: CreatePaymentMethodRequest): Promise<IPaymentMethod> {
    if (data.isDefault) {
      await PaymentMethod.updateMany(
        { userId },
        { $set: { isDefault: false } }
      );
    }

    const paymentMethod = new PaymentMethod({
      userId,
      type: data.type,
      name: data.name,
      details: this.sanitizeDetails(data.details),
      isDefault: data.isDefault || false,
      isActive: true
    });

    return await paymentMethod.save();
  }

  async getPaymentMethods(userId: string): Promise<IPaymentMethod[]> {
    return await PaymentMethod.find({ userId, isActive: true })
      .sort({ isDefault: -1, createdAt: -1 });
  }

  async deletePaymentMethod(userId: string, methodId: string): Promise<void> {
    await PaymentMethod.updateOne(
      { _id: methodId, userId },
      { $set: { isActive: false } }
    );
  }

  async setDefaultPaymentMethod(userId: string, methodId: string): Promise<void> {
    await PaymentMethod.updateMany(
      { userId },
      { $set: { isDefault: false } }
    );

    await PaymentMethod.updateOne(
      { _id: methodId, userId },
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