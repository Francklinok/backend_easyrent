export interface GraphQLContext {
  user?: {
    userId: string;
    email: string;
    role: string;
    id: string;
  };
  req?: any;
  res?: any;
}

export type GraphQLResolver<TResult = any, TParent = any, TArgs = any> = (
  parent: TParent,
  args: TArgs,
  context: GraphQLContext,
  info: any
) => Promise<TResult> | TResult;
