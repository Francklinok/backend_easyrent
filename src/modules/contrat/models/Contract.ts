import { Schema, model, Document, Model } from 'mongoose';
import { Contract, ContractStatus, ContractType } from '../types';

export interface ContractDocument extends Omit<Contract, 'id'>, Document {
  updateStatus(status: ContractStatus, updatedBy: string): Promise<this>;
  updateVariables(variables: Record<string, any>, updatedBy: string): Promise<this>;
  addAnalysis(analysis: any): Promise<this>;
}

export interface ContractModel extends Model<ContractDocument> {
  findByUser(userId: string): Promise<any[]>;
  findByProperty(propertyId: string): Promise<ContractDocument[]>;
  getAnalytics(filters: any): Promise<any[]>;
}

const contractSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  templateId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(ContractType),
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(ContractStatus),
    default: ContractStatus.DRAFT,
    index: true
  },
  variables: {
    type: Schema.Types.Mixed,
    default: {}
  },
  propertyId: {
    type: String,
    index: true,
    sparse: true
  },
  reservationId: {
    type: String,
    index: true,
    sparse: true
  },
  generatedFileUri: String,
  signedFileUri: String,
  qrCodeData: String,
  watermarkData: String,
  aiAnalysis: {
    riskScore: {
      type: Number,
      min: 0,
      max: 100
    },
    complianceScore: {
      type: Number,
      min: 0,
      max: 100
    },
    marketAnalysis: String,
    recommendations: [String]
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  signedAt: Date,
  expiresAt: Date,
  createdBy: {
    type: String,
    required: true,
    index: true
  },
  updatedBy: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual pour les parties du contrat
contractSchema.virtual('parties', {
  ref: 'ContractParty',
  localField: 'id',
  foreignField: 'contractId'
});

// Index composés
contractSchema.index({ type: 1, status: 1 });
contractSchema.index({ createdBy: 1, type: 1 });
contractSchema.index({ propertyId: 1, type: 1 });
contractSchema.index({ createdAt: -1 });

// Middleware de pré-sauvegarde
contractSchema.pre('save', function(next) {
  if (this.isNew && !this.id) {
    this.id = `CONTRACT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }
  next();
});

// Méthodes d'instance
contractSchema.methods.updateStatus = function(status: ContractStatus, updatedBy: string) {
  this.status = status;
  this.updatedBy = updatedBy;
  this.updatedAt = new Date();

  if (status === ContractStatus.SIGNED && !this.signedAt) {
    this.signedAt = new Date();
  }

  return this.save();
};

contractSchema.methods.updateVariables = function(variables: Record<string, any>, updatedBy: string) {
  this.variables = { ...this.variables, ...variables };
  this.updatedBy = updatedBy;
  this.updatedAt = new Date();
  return this.save();
};

contractSchema.methods.addAnalysis = function(analysis: any) {
  this.aiAnalysis = analysis;
  this.updatedAt = new Date();
  return this.save();
};

// Méthodes statiques
contractSchema.statics.findByUser = function(userId: string) {
  return this.aggregate([
    {
      $lookup: {
        from: 'contractparties',
        localField: 'id',
        foreignField: 'contractId',
        as: 'parties'
      }
    },
    {
      $match: {
        'parties.userId': userId
      }
    },
    {
      $sort: { createdAt: -1 }
    }
  ]);
};

contractSchema.statics.findByProperty = function(propertyId: string) {
  return this.find({ propertyId }).sort({ createdAt: -1 });
};

contractSchema.statics.getAnalytics = function(filters: any = {}) {
  return this.aggregate([
    { $match: filters },
    {
      $group: {
        _id: null,
        totalContracts: { $sum: 1 },
        avgRiskScore: { $avg: '$aiAnalysis.riskScore' },
        avgComplianceScore: { $avg: '$aiAnalysis.complianceScore' },
        contractsByType: {
          $push: {
            type: '$type',
            status: '$status'
          }
        }
      }
    }
  ]);
};

export const ContractModel = model<ContractDocument, ContractModel>('Contract', contractSchema) as ContractModel;