import gql from 'graphql-tag';

export const userTypeDefs = gql`
  extend type User {
    username: String
    phoneNumber: String
    dateOfBirth: String
    address: Address
    agentDetails: AgentDetails
    preferences: UserPreferences
    loginHistory: [LoginHistory!]
    securityDetails: SecurityDetails
    notifications: [Notification!]
    properties: [Property!]
    activities: [Activity!]
    conversations: [Conversation!]
    wallet: Wallet
    fullName: String
    serviceSubscriptions: [ServiceSubscription!]
    serviceProvider: ServiceProvider
  }

  type Address {
    street: String
    city: String
    state: String
    postalCode: String
    country: String
  }

  type AgentDetails {
    agencyName: String
    licenseNumber: String
    yearsOfExperience: Int
    specializations: [String!]
  }

  type UserPreferences {
    language: String
    currency: String
    notifications: NotificationPreferences
  }

  type NotificationPreferences {
    email: Boolean
    sms: Boolean
    push: Boolean
  }

  type LoginHistory {
    timestamp: String!
    ipAddress: String
    userAgent: String
    location: String
  }

  type SecurityDetails {
    twoFactorEnabled: Boolean
    lastPasswordChange: String
    securityQuestions: [String!]
  }

  extend type Query {
    me: User
    user(id: ID!): User
    users(limit: Int, offset: Int): [User!]!
  }

  extend type Mutation {
    updateProfile(input: UpdateProfileInput!): User!
    updatePreferences(input: UpdatePreferencesInput!): User!
  }

  input UpdateProfileInput {
    firstName: String
    lastName: String
    phoneNumber: String
    dateOfBirth: String
    address: AddressInput
  }

  input AddressInput {
    street: String
    city: String
    state: String
    postalCode: String
    country: String
  }

  input UpdatePreferencesInput {
    language: String
    currency: String
    notifications: NotificationPreferencesInput
  }

  input NotificationPreferencesInput {
    email: Boolean
    sms: Boolean
    push: Boolean
  }
`;
