import gql from 'graphql-tag';

export const activityTypeDefs = gql`
  type Activity {
    id: ID!
    propertyId: ID!
    property: Property
    clientId: ID!
    client: User
    message: String!
    isVisited: Boolean
    visitDate: String
    isVisiteAcccepted: Boolean
    isReservation: Boolean
    reservationDate: String
    isReservationAccepted: Boolean
    isPayment: Boolean
    paymentDate: String
    uploadedFiles: [String!]
    conversation: Conversation
    messages: [Message!]
    relatedTransactions: [Transaction!]
    status: ActivityStatus!
    type: ActivityType!
    duration: Int
    nextStep: String
    priorityScore: Int
    isCancelled: Boolean
    cancelReason: String
    cancelDate: String
    createdAt: String!
    updatedAt: String!
  }

  enum ActivityStatus {
    DRAFT
    PENDING
    ACCEPTED
    COMPLETED
    CANCELLED
  }

  enum ActivityType {
    INQUIRY
    VISIT
    RESERVATION
  }

  type ActivityEdge {
    node: Activity!
    cursor: String!
  }

  type ActivityConnection {
    edges: [ActivityEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ActivityStats {
    totalActivities: Int!
    visitRequests: Int!
    reservationRequests: Int!
    acceptedVisits: Int!
    acceptedReservations: Int!
    completedPayments: Int!
    acceptanceRate: Float!
    conversionRate: Float!
    averageResponseTime: Float!
  }

  input ActivityFilters {
    status: ActivityStatus
    type: ActivityType
    dateRange: DateRangeInput
  }

  input DateRangeInput {
    start: String
    end: String
  }

  input PaginationInput {
    first: Int
    after: String
    page: Int
    limit: Int
  }

  input TimeRangeInput {
    start: String
    end: String
  }

  input CreateActivityInput {
    propertyId: ID!
    message: String!
    isVisited: Boolean
    visitDate: String
    isReservation: Boolean
    reservationDate: String
    uploadedFiles: [String!]
  }

  extend type Query {
    activities(
      propertyId: ID
      userId: ID
      pagination: PaginationInput
      filters: ActivityFilters
    ): ActivityConnection!
    
    activity(id: ID!): Activity
    
    activityStats(
      propertyId: ID
      userId: ID
      timeRange: TimeRangeInput
    ): ActivityStats!
    
    ownerActivities(
      pagination: PaginationInput
      filters: ActivityFilters
    ): ActivityConnection!
  }

  extend type Mutation {
    createActivity(input: CreateActivityInput!): Activity!
    updateActivityStatus(id: ID!, status: ActivityStatus!, reason: String): Activity!
    processPayment(activityId: ID!, amount: Float!): Activity!
    cancelActivity(id: ID!, reason: String): Activity!
  }

  extend type Subscription {
    activityUpdated(propertyId: ID, userId: ID): Activity!
  }
`;
