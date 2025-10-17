import { GraphQLContext } from './context';

export type ResolverFn<TResult, TParent, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: GraphQLContext,
  info: any
) => Promise<TResult> | TResult;

export interface Resolvers {
  Query?: Record<string, ResolverFn<any, any, any>>;
  Mutation?: Record<string, ResolverFn<any, any, any>>;
  Subscription?: Record<string, any>;
  [key: string]: any;
}
