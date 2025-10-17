import { Schema, model, Document, Model } from 'mongoose';
import { ContractTemplate, ContractType, ContractVariable, LegalClause } from '../types';

export interface ContractTemplateDocument extends Omit<ContractTemplate, 'id'>, Document {
  deactivate(): Promise<this>;
  activate(): Promise<this>;
  updateTemplate(template: string, updatedBy: string): Promise<this>;
  addVariable(variable: ContractVariable): Promise<this>;
  removeVariable(key: string): Promise<this>;
  addLegalClause(clause: LegalClause): Promise<this>;
  removeLegalClause(clauseId: string): Promise<this>;
}

export interface ContractTemplateModel extends Model<ContractTemplateDocument> {
  findByType(type: ContractType): Promise<ContractTemplateDocument[]>;
  findActiveTemplates(): Promise<ContractTemplateDocument[]>;
  getDefaultTemplate(type: ContractType): Promise<ContractTemplateDocument | null>;
}

const contractVariableSchema = new Schema({
  key: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'number', 'date', 'boolean', 'currency', 'email', 'phone'],
    required: true
  },
  required: {
    type: Boolean,
    default: false
  },
  defaultValue: Schema.Types.Mixed,
  validation: {
    min: Number,
    max: Number,
    pattern: String,
    options: [String]
  }
}, { _id: false });

const legalClauseSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isRequired: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    required: true
  }
}, { _id: false });

const contractTemplateSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(ContractType),
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  template: {
    type: String,
    required: true
  },
  variables: [contractVariableSchema],
  legalClauses: [legalClauseSchema],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index composés
contractTemplateSchema.index({ type: 1, isActive: 1 });
contractTemplateSchema.index({ createdAt: -1 });

// Middleware de pré-sauvegarde
contractTemplateSchema.pre('save', function(next) {
  if (this.isNew && !this.id) {
    this.id = `template_${this.type}_${Date.now()}`;
  }
  next();
});

// Méthodes d'instance
contractTemplateSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

contractTemplateSchema.methods.activate = function() {
  this.isActive = true;
  return this.save();
};

contractTemplateSchema.methods.updateTemplate = function(template: string, updatedBy: string) {
  this.template = template;
  this.updatedBy = updatedBy;
  this.updatedAt = new Date();
  return this.save();
};

contractTemplateSchema.methods.addVariable = function(variable: ContractVariable) {
  if (!this.variables.find(v => v.key === variable.key)) {
    this.variables.push(variable);
    return this.save();
  }
  throw new Error('Variable with this key already exists');
};

contractTemplateSchema.methods.removeVariable = function(key: string) {
  this.variables = this.variables.filter(v => v.key !== key);
  return this.save();
};

contractTemplateSchema.methods.addLegalClause = function(clause: LegalClause) {
  if (!this.legalClauses.find(c => c.id === clause.id)) {
    this.legalClauses.push(clause);
    this.legalClauses.sort((a, b) => a.order - b.order);
    return this.save();
  }
  throw new Error('Legal clause with this ID already exists');
};

contractTemplateSchema.methods.removeLegalClause = function(clauseId: string) {
  this.legalClauses = this.legalClauses.filter(c => c.id !== clauseId);
  return this.save();
};

// Méthodes statiques
contractTemplateSchema.statics.findByType = function(type: ContractType) {
  return this.find({ type, isActive: true }).sort({ createdAt: -1 });
};

contractTemplateSchema.statics.findActiveTemplates = function() {
  return this.find({ isActive: true }).sort({ type: 1, createdAt: -1 });
};

contractTemplateSchema.statics.getDefaultTemplate = function(type: ContractType) {
  return this.findOne({ type, isActive: true }).sort({ createdAt: 1 });
};

export const ContractTemplateModel = model<ContractTemplateDocument, ContractTemplateModel>('ContractTemplate', contractTemplateSchema) as ContractTemplateModel;