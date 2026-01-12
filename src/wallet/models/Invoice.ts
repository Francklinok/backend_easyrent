import mongoose, { Schema, Document } from 'mongoose';

export type InvoiceType = 'reservation' | 'rent' | 'service' | 'purchase' | 'deposit' | 'commission';
export type InvoiceStatus = 'unpaid' | 'pending' | 'paid' | 'partially_paid' | 'cancelled' | 'refunded';

export interface IInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  type: InvoiceType;

  referenceId: string;
  referenceType: 'reservation' | 'rental' | 'service' | 'property' | 'subscription';
  propertyId?: string;

  clientId: string;
  clientName?: string;
  clientEmail?: string;

  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;

  subtotal: number;
  taxAmount: number;
  taxRate: number;
  commission: number;
  commissionRate: number;
  platformFee: number;
  total: number;
  currency: 'XOF' | 'EUR' | 'USD' | 'GBP';

  items: IInvoiceItem[];
  description?: string;
  notes?: string;

  amountPaid: number;
  amountDue: number;
  paymentIntentId?: string;

  issueDate: Date;
  dueDate: Date;
  paidAt?: Date;

  status: InvoiceStatus;

  metadata?: {
    reservationDates?: {
      checkIn: Date;
      checkOut: Date;
    };
    rentPeriod?: {
      startDate: Date;
      endDate: Date;
    };
    serviceDetails?: any;
    [key: string]: any;
  };

  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 }
}, { _id: false });

const InvoiceSchema = new Schema<IInvoice>({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['reservation', 'rent', 'service', 'purchase', 'deposit', 'commission']
  },


  referenceId: { type: String, required: true, index: true },
  referenceType: {
    type: String,
    required: true,
    enum: ['reservation', 'rental', 'service', 'property', 'subscription']
  },
  propertyId: { type: String, index: true },


  clientId: { type: String, required: true, index: true },
  clientName: { type: String },
  clientEmail: { type: String },

  ownerId: { type: String, required: true, index: true },
  ownerName: { type: String },
  ownerEmail: { type: String },


  subtotal: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  taxRate: { type: Number, default: 0, min: 0, max: 100 },
  commission: { type: Number, default: 0, min: 0 },
  commissionRate: { type: Number, default: 10, min: 0, max: 100 },
  platformFee: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  currency: {
    type: String,
    default: 'XOF',
    enum: ['XOF', 'EUR', 'USD', 'GBP']
  },

  items: [InvoiceItemSchema],
  description: { type: String, maxlength: 500 },
  notes: { type: String, maxlength: 1000 },

  amountPaid: { type: Number, default: 0, min: 0 },
  amountDue: { type: Number, required: true, min: 0 },
  paymentIntentId: { type: String },

  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  paidAt: { type: Date },

  status: {
    type: String,
    default: 'unpaid',
    enum: ['unpaid', 'pending', 'paid', 'partially_paid', 'cancelled', 'refunded']
  },

  metadata: { type: Schema.Types.Mixed }
}, {
  timestamps: true
});

InvoiceSchema.index({ clientId: 1, status: 1, createdAt: -1 });
InvoiceSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
InvoiceSchema.index({ type: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1, status: 1 });

InvoiceSchema.statics.generateInvoiceNumber = async function(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const startOfMonth = new Date(year, date.getMonth(), 1);
  const endOfMonth = new Date(year, date.getMonth() + 1, 0);

  const count = await this.countDocuments({
    createdAt: { $gte: startOfMonth, $lte: endOfMonth }
  });

  const sequence = String(count + 1).padStart(5, '0');
  return `INV-${year}${month}-${sequence}`;
};

InvoiceSchema.methods.calculateTotals = function(): void {
  this.subtotal = this.items.reduce((sum: number, item: IInvoiceItem) => sum + item.total, 0);

  this.taxAmount = this.subtotal * (this.taxRate / 100);

  this.commission = this.subtotal * (this.commissionRate / 100);

  this.total = this.subtotal + this.taxAmount;

  this.amountDue = Math.max(0, this.total - this.amountPaid);
};

InvoiceSchema.methods.markAsPaid = function(amount: number, paymentIntentId?: string): void {
  this.amountPaid += amount;
  this.amountDue = Math.max(0, this.total - this.amountPaid);

  if (paymentIntentId) {
    this.paymentIntentId = paymentIntentId;
  }

  if (this.amountDue <= 0) {
    this.status = 'paid';
    this.paidAt = new Date();
  } else if (this.amountPaid > 0) {
    this.status = 'partially_paid';
  }
};

InvoiceSchema.pre('save', function(next) {
  if (this.isModified('items') || this.isModified('taxRate') || this.isModified('commissionRate')) {
    (this as any).calculateTotals();
  }
  next();
});

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
