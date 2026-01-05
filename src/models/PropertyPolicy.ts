import { Schema, model, Document, Types } from 'mongoose';

export interface IPropertyPolicy extends Document {
  propertyId: Types.ObjectId;
  override: {
    paymentTiming?: 'BEFORE_ACCEPTANCE' | 'AFTER_ACCEPTANCE';
    allowMultipleRequests?: boolean;
    holdDurationHours?: number;
    depositRequired?: boolean;
    visitRequired?: boolean;
  };
  isActive: boolean;
}

const PropertyPolicySchema = new Schema<IPropertyPolicy>({
  propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, unique: true },
  override: {
    paymentTiming: { 
      type: String, 
      enum: ['BEFORE_ACCEPTANCE', 'AFTER_ACCEPTANCE'] 
    },
    allowMultipleRequests: Boolean,
    holdDurationHours: Number,
    depositRequired: Boolean,
    visitRequired: Boolean
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default model<IPropertyPolicy>('PropertyPolicy', PropertyPolicySchema);