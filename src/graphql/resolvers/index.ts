// import { mergeResolvers } from '@graphql-tools/merge';
import { propertyResolvers } from '../../property/graphql/propertyResolvers';
import { serviceResolvers } from '../../service-marketplace/graphql/serviceResolvers';
import { userResolvers } from '../../users/graphql/userResolvers';
import { walletResolvers } from '../../wallet/graphql/walletResolvers';
import { chatResolvers } from '../../chat/graphql/chatResolvers';
import { activityResolvers } from '../../activity/graphql/activityResolvers';
import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';

// Scalar resolvers
const scalarResolvers = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    serialize(value: any) {
      return value instanceof Date ? value.toISOString() : null;
    },
    parseValue(value: any) {
      return new Date(value);
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        return new Date(ast.value);
      }
      return null;
    }
  }),
  
  Upload: new GraphQLScalarType({
    name: 'Upload',
    description: 'The `Upload` scalar type represents a file upload.',
    serialize: () => {
      throw new Error('Upload serialization unsupported.');
    },
    parseValue: (value) => value,
    parseLiteral: () => {
      throw new Error('Upload literal unsupported.');
    }
  })
};

export const resolvers = {
  ...scalarResolvers,
  Query: {
    ...propertyResolvers.Query,
    ...serviceResolvers.Query,
    ...userResolvers.Query,
    ...walletResolvers.Query,
    ...chatResolvers.Query,
    ...activityResolvers.Query
  },
  Mutation: {
    ...propertyResolvers.Mutation,
    ...serviceResolvers.Mutation,
    ...walletResolvers.Mutation,
    ...chatResolvers.Mutation,
    ...activityResolvers.Mutation
  },
  Subscription: {
    ...walletResolvers.Subscription,
    ...chatResolvers.Subscription,
    ...activityResolvers.Subscription
  },
  // Types
  Property: propertyResolvers.Property,
  Service: serviceResolvers.Service,
  ServiceProvider: serviceResolvers.ServiceProvider,
  ServiceSubscription: serviceResolvers.ServiceSubscription,
  ServiceRecommendation: serviceResolvers.ServiceRecommendation,
  User: userResolvers.User,
  Wallet: walletResolvers.Wallet,
  Transaction: walletResolvers.Transaction,
  Conversation: chatResolvers.Conversation,
  Message: chatResolvers.Message,
  Activity: activityResolvers.Activity,
  // Complex types
  PropertyStats: propertyResolvers.PropertyStats,
  PropertyFinancialStats: propertyResolvers.PropertyFinancialStats,
  PropertyMarketAnalysis: propertyResolvers.PropertyMarketAnalysis,
  AIInsight: chatResolvers.AIInsight,
  SentimentAnalysis: chatResolvers.SentimentAnalysis,
  ActivityStats: activityResolvers.ActivityStats
};

/*export const resolvers = mergeResolvers([
  scalarResolvers,
  propertyResolvers,
  serviceResolvers,
  userResolvers,
  walletResolvers,
  chatResolvers,
  activityResolvers
]);*/