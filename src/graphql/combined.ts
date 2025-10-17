import gql from 'graphql-tag';
import { merge } from 'lodash';

// Import des schémas et resolvers
import { propertyTypeDefs, propertyResolvers } from '../property/graphql';
import { serviceTypeDefs, serviceResolvers } from '../service-marketplace/graphql';
import { walletTypeDefs, walletResolvers } from '../wallet/graphql';

// Schéma de base avec les types communs
const baseTypeDefs = gql`
  scalar Date
  scalar DateTime

  type User {
    id: ID!
    userId: ID!
    firstName: String!
    lastName: String!
    email: String!
    profilePicture: String
    role: String!
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type Activity {
    id: ID!
    propertyId: ID!
    clientId: ID!
    message: String!
    isReservationAccepted: Boolean
    isVisiteAcccepted: Boolean
    visitDate: String
    reservationStartDate: String
    reservationEndDate: String
    createdAt: String!
    updatedAt: String!
  }

  type Conversation {
    id: ID!
    propertyId: ID!
    participants: [User!]!
    lastMessage: String
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }

  type Subscription {
    _empty: String
  }
`;

// Combiner tous les schémas
export const combinedTypeDefs = [
  baseTypeDefs,
  propertyTypeDefs,
  serviceTypeDefs,
  walletTypeDefs
];

// Combiner tous les resolvers
export const combinedResolvers = merge(
  propertyResolvers,
  serviceResolvers,
  walletResolvers
);

// Types pour le contexte GraphQL
export interface GraphQLContext {
  user?: {
    userId: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
  req: any;
  res: any;
}

export * from '../property/graphql';
export * from '../service-marketplace/graphql';
export * from '../wallet/graphql';