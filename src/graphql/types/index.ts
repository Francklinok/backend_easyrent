import gql from 'graphql-tag';
import { propertyTypeDefs } from '../../property/graphql/propertySchema';
import { serviceTypeDefs } from '../../service-marketplace/graphql/serviceSchema';
import { walletTypeDefs } from '../../wallet/graphql/walletSchema';
import { chatTypeDefs } from '../../chat/graphql/chatSchema';
import { activityTypeDefs } from '../../activity/graphql/activitySchema';
import { userTypeDefs } from '../../users/graphql/userSchema';
import { cryptoTypeDefs } from '../../crypto/graphql/cryptoSchema';

// Base types
const baseTypeDefs = gql`
  scalar Date
  scalar DateTime
  scalar JSON
  scalar Upload

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
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

export const typeDefs = [
  baseTypeDefs,
  propertyTypeDefs,
  serviceTypeDefs,
  walletTypeDefs,
  chatTypeDefs,
  activityTypeDefs,
  userTypeDefs,
  cryptoTypeDefs
];
