// Types
export * from './types/paramsTypes';

// Models
export { default as UserParamsModel, UserParamsSchema, IUserParams } from './models/paramsSchema';

// Services
export { default as paramsService, paramsService as ParamsService } from './services/ParamsService';
export { default as paramsClientService, paramsClientService as ParamsClientService } from './services/ParamsClientService';

// Routes (REST fallback)
export { default as paramsRoutes } from './routes/paramsRoutes';

// GraphQL (primary)
export { default as paramsTypeDefs, paramsTypeDefs as paramsSchema } from './graphql/paramsSchema';
export { default as paramsResolvers } from './graphql/paramsResolvers';
export { ParamsQueries, ParamsMutations } from './graphql/paramsQueries';
export * from './graphql/paramsQueries';
