export interface ContractTemplate {
  id: string;
  type: ContractType;
  name: string;
  description: string;
  template: string;
  variables: ContractVariable[];
  legalClauses: LegalClause[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractVariable {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'currency' | 'email' | 'phone';
  required: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

export interface LegalClause {
  id: string;
  title: string;
  content: string;
  isRequired: boolean;
  order: number;
}

export enum ContractType {
  RENTAL = 'rental',
  PURCHASE = 'purchase',
  LEASE = 'lease',
  SUBLEASE = 'sublease',
  COMMERCIAL_RENTAL = 'commercial_rental',
  VACATION_RENTAL = 'vacation_rental',
  RESERVATION = 'reservation'
}

export interface Contract {
  id: string;
  templateId: string;
  type: ContractType;
  status: ContractStatus;
  parties: ContractParty[];
  variables: Record<string, any>;
  propertyId?: string;
  reservationId?: string;
  generatedFileUri?: string;
  signedFileUri?: string;
  qrCodeData?: string;
  watermarkData?: string;
  aiAnalysis?: {
    riskScore: number;
    complianceScore: number;
    marketAnalysis: string;
    recommendations: string[];
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  signedAt?: Date;
  expiresAt?: Date;
  createdBy: string;
  updatedBy?: string;
}

export enum ContractStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  PENDING_SIGNATURE = 'pending_signature',
  SIGNED = 'signed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface ContractParty {
  id: string;
  contractId: string;
  role: PartyRole;
  userId: string;
  signedAt?: Date;
  signature?: string;
  ipAddress?: string;
  deviceInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum PartyRole {
  LANDLORD = 'landlord',
  TENANT = 'tenant',
  BUYER = 'buyer',
  SELLER = 'seller',
  AGENT = 'agent',
  GUARANTOR = 'guarantor'
}

export interface ContractGenerationRequest {
  templateId: string;
  type: ContractType;
  propertyId?: string;
  reservationId?: string;
  parties: {
    role: PartyRole;
    userId: string;
  }[];
  variables: Record<string, any>;
  autoGenerate?: boolean;
  metadata?: Record<string, any>;
}

export interface ContractSigningRequest {
  contractId: string;
  partyId: string;
  signature: string;
  signedAt: Date;
  ipAddress: string;
  deviceInfo?: string;
}

export interface ContractUpdateRequest {
  contractId: string;
  variables?: Record<string, any>;
  status?: ContractStatus;
  metadata?: Record<string, any>;
}

export interface ContractSearchFilters {
  type?: ContractType;
  status?: ContractStatus;
  userId?: string;
  propertyId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface ContractAnalytics {
  totalContracts: number;
  contractsByType: Record<ContractType, number>;
  contractsByStatus: Record<ContractStatus, number>;
  averageProcessingTime: number;
  complianceScore: number;
  riskScore: number;
  monthlyTrends: {
    month: string;
    count: number;
    value: number;
  }[];
}