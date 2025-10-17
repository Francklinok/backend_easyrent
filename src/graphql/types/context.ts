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
