// Models
export { ContractModel } from './models/Contract';
export { ContractPartyModel } from './models/ContractParty';
export { ContractTemplateModel } from './models/ContractTemplate';

// Services
export { ContractService } from './services/ContractService';

// GraphQL
export { contractTypeDefs } from './graphql/typeDefs';
export { contractResolvers } from './graphql/resolvers';

// Types
export * from './types';

// Utils
export { generateContractPDF } from './utils/pdfGenerator';
export { generateQRCode, generateAdvancedQRCode } from './utils/qrGenerator';
export { generateWatermark, generateAdvancedWatermark } from './utils/watermarkGenerator';
export { validateContractVariables, validateContractCompleteness } from './utils/validator';
export { AIAnalysisService } from './utils/aiAnalysis';

// Default exports
import ContractService from './services/ContractService';
import contractResolvers from './graphql/resolvers';

export { ContractService as default };
export const resolvers = contractResolvers;