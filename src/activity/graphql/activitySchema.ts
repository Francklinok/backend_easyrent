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
    visitTime: String
    visitType: String
    isVisiteAccepted: Boolean
    isReservation: Boolean
    reservationDate: String
    isReservationAccepted: Boolean
    isPayment: Boolean
    paymentDate: String
    uploadedFiles: [String!]
    conversation: Conversation
    messages: [Message!]
    relatedTransactions: [Transaction!]
    visiteStatus: ActivityStatus!
    reservationStatus: ActivityStatus!
    paymentStatus: PayementStatus!
    type: ActivityType!
    duration: Int
    nextStep: String
    priorityScore: Int
    isCancelled: Boolean
    cancelReason: String
    cancelDate: String
    rejectionReason: String
    createdAt: String!
    updatedAt: String!
  }

  enum ActivityStatus {
    DRAFT
    PENDING
    ACCEPTED
    REFUSED
    PAYMENT_REQUIRED
    PAID
    COMPLETED
    CANCELLED
    EXPIRED
  }
  
  enum PayementStatus {
    PENDING
    COMPLETED
    FAILED
    
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

  type ActivityProgress {
    id: ID!
    propertyId: ID
    propertyTitle: String
    propertyImage: String
    visitStatus: String
    visitId: ID
    reservationStatus: String
    reservationId: ID
    paymentStatus: String
    paymentId: ID
    updatedAt: String
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

  input VisitRequestInput {
    propertyId: ID!
    message: String!
    visitDate: String
  }

  input BookingInput {
    propertyId: ID!
    message: String!
    reservationDate: String
    uploadedFiles: [String!]
  }

  type VisitRequestStatus {
    status: String!
    rejectionReason: String
    visitDate: String
    message: String
  }

  extend type Query {
    activities(
      propertyId: ID
      userId: ID
      pagination: PaginationInput
      filters: ActivityFilters
    ): ActivityConnection!
    
    activity(id: ID!): Activity
    
    getVisitRequest(id: ID, visitId: ID, propertyId: ID): Activity
    
    getUserVisitForProperty(userId: ID!, propertyId: ID!): Activity
    
    checkVisitTimeSlot(propertyId: ID!, visitDate: String!): Boolean!
    
    getVisitRequestStatus(visitId: ID!, propertyId: ID!): VisitRequestStatus

    getPropertyActivity(propertyId: ID!): [Activity!]!
    
    activityStats(
      propertyId: ID
      userId: ID
      timeRange: TimeRangeInput
    ): ActivityStats!
    
    ownerActivities(
      pagination: PaginationInput
      filters: ActivityFilters
    ): ActivityConnection!

    getUserActivities(userId: ID): [ActivityProgress]
  }

  extend type Mutation {
    createActivity(input: CreateActivityInput!): Activity!
    createVisitRequest(input: VisitRequestInput!): Activity!
    createBooking(input: BookingInput!): Activity!
    updateActivityStatus(id: ID!, status: ActivityStatus!, reason: String): Activity!
    acceptReservation(activityId: ID!): Activity!
    processPayment(activityId: ID!, amount: Float!): Activity!
    cancelActivity(id: ID!, reason: String): Activity!
  }

  extend type Subscription {
    activityUpdated(propertyId: ID, userId: ID): Activity!
  }
`;
