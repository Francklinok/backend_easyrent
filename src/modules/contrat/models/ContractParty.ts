import { Schema, model, Document, Model } from 'mongoose';
import { ContractParty, PartyRole } from '../types';

export interface ContractPartyDocument extends Omit<ContractParty, 'id'>, Document {
  sign(signature: string, ipAddress: string, deviceInfo?: string): Promise<this>;
  hasSigned(): boolean;
}

export interface ContractPartyModel extends Model<ContractPartyDocument> {
  findByContract(contractId: string): Promise<ContractPartyDocument[]>;
  findByUser(userId: string): Promise<ContractPartyDocument[]>;
  checkAllSigned(contractId: string): Promise<boolean>;
}

const contractPartySchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  contractId: {
    type: String,
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: Object.values(PartyRole),
    required: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  signedAt: Date,
  signature: String,
  ipAddress: String,
  deviceInfo: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index composés
contractPartySchema.index({ contractId: 1, role: 1 }, { unique: true });
contractPartySchema.index({ userId: 1, contractId: 1 });

// Virtual pour les informations utilisateur
contractPartySchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: 'id',
  justOne: true
});

// Virtual pour le contrat
contractPartySchema.virtual('contract', {
  ref: 'Contract',
  localField: 'contractId',
  foreignField: 'id',
  justOne: true
});

// Middleware de pré-sauvegarde
contractPartySchema.pre('save', function(next) {
  if (this.isNew && !this.id) {
    this.id = `${this.contractId}-${this.role}`;
  }
  next();
});

// Méthodes d'instance
contractPartySchema.methods.sign = function(signature: string, ipAddress: string, deviceInfo?: string) {
  this.signature = signature;
  this.signedAt = new Date();
  this.ipAddress = ipAddress;
  this.deviceInfo = deviceInfo;
  return this.save();
};

contractPartySchema.methods.hasSigned = function() {
  return !!this.signedAt && !!this.signature;
};

// Méthodes statiques
contractPartySchema.statics.findByContract = function(contractId: string) {
  return this.find({ contractId }).populate('user');
};

contractPartySchema.statics.findByUser = function(userId: string) {
  return this.find({ userId }).populate('contract');
};

contractPartySchema.statics.checkAllSigned = function(contractId: string) {
  return this.find({ contractId }).then((parties: ContractPartyDocument[]) => {
    return parties.every(party => party.hasSigned());
  });
};

export const ContractPartyModel = model<ContractPartyDocument, ContractPartyModel>('ContractParty', contractPartySchema) as ContractPartyModel;