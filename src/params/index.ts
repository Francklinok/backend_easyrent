// Types
export * from './types/paramsTypes';
export * from './types/kycTypes';

// Models
export { default as UserParamsModel, UserParamsSchema, IUserParams } from './models/paramsSchema';
export { default as KYCVerificationModel, KYCVerificationSchema, IKYCVerification } from './models/kycSchema';

// Services
export { default as paramsService, paramsService as ParamsService } from './services/ParamsService';
export { default as paramsClientService, paramsClientService as ParamsClientService } from './services/ParamsClientService';
export { default as kycService, kycService as KYCService } from './services/KYCService';

// Routes (REST fallback)
export { default as paramsRoutes } from './routes/paramsRoutes';

// GraphQL (primary)
export { default as paramsTypeDefs, paramsTypeDefs as paramsSchema } from './graphql/paramsSchema';
export { default as paramsResolvers } from './graphql/paramsResolvers';
export { ParamsQueries, ParamsMutations } from './graphql/paramsQueries';
export * from './graphql/paramsQueries';

// KYC GraphQL
export { default as kycTypeDefs, kycTypeDefs as kycSchema } from './graphql/kycSchema';
export { default as kycResolvers } from './graphql/kycResolvers';
export { KYCQueries, KYCMutations, KYCFragments } from './graphql/kycQueries';
export * from './graphql/kycQueries';
