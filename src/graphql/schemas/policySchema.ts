import gql from 'graphql-tag';

export const policyTypeDefs = gql`
  type CountryPolicy {
    id: ID!
    countryCode: String!
    paymentTiming: PaymentTiming!
    allowMultipleRequests: Boolean!
    holdDurationHours: Int!
    depositRequired: Boolean!
    cancellationGraceHours: Int!
    visitRequired: Boolean!
    paymentMethods: [String!]!
    isActive: Boolean!
  }

  enum PaymentTiming {
    BEFORE_ACCEPTANCE
    AFTER_ACCEPTANCE
  }

  type ReservationResponse {
    status: String!
    nextAction: String!
    message: String!
    requiresPayment: Boolean!
    requiresVisit: Boolean!
    paymentMethods: [String!]
    expiresAt: String
  }

  type ReservationRequirements {
    requiredDocuments: [String!]!
    requiredFields: [FormField!]!
    paymentMethods: [String!]!
    visitRequired: Boolean!
    depositRequired: Boolean!
  }

  type FormField {
    fieldName: String!
    fieldType: String!
    required: Boolean!
    label: String!
    options: [String!]
  }

  input SmartReservationInput {
    propertyId: ID!
    message: String!
    countryCode: String
  }

  extend type Query {
    getCountryPolicy(countryCode: String): CountryPolicy
    getPaymentMethods(countryCode: String): [String!]!
    getReservationRequirements(propertyId: ID!, countryCode: String): ReservationRequirements!
    detectCountry: String!
  }

  extend type Mutation {
    smartReservation(input: SmartReservationInput!): ReservationResponse!
    smartAcceptReservation(activityId: ID!, countryCode: String): ReservationResponse!
  }
`;