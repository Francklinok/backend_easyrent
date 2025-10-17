import gql from 'graphql-tag';

export const serviceTypeDefs = gql`
  enum ServiceCategory {
    maintenance
    cleaning
    security
    gardening
    insurance
    utilities
    wellness
    emergency
    eco
    tech
    collaborative
  }

  enum ContractType {
    short_term
    long_term
    seasonal
    on_demand
    emergency
  }

  enum ServiceStatus {
    active
    inactive
    pending
    suspended
  }

  enum SubscriptionStatus {
    active
    paused
    cancelled
    completed
  }

  enum BillingPeriod {
    hourly
    daily
    weekly
    monthly
    yearly
    one_time
  }

  enum PaymentStatus {
    paid
    pending
    failed
  }

  type ServiceProvider {
    id: ID!
    userId: ID!
    companyName: String
    description: String!
    certifications: [String!]!
    rating: Float!
    totalReviews: Int!
    isVerified: Boolean!
    availableZones: [String!]!
    contactInfo: ContactInfo!
    businessInfo: BusinessInfo!
    createdAt: String!
    updatedAt: String!

    # Relations
    user: User
    services: [Service!]!
  }

  type ContactInfo {
    phone: String
    email: String
    website: String
  }

  type BusinessInfo {
    siret: String
    insurance: String
    license: String
  }

  type Service {
    id: ID!
    providerId: ID!
    title: String!
    description: String!
    category: ServiceCategory!
    contractTypes: [ContractType!]!
    pricing: ServicePricing!
    requirements: ServiceRequirements!
    availability: ServiceAvailability!
    media: ServiceMedia!
    tags: [String!]!
    status: ServiceStatus!
    rating: Float!
    totalReviews: Int!
    createdAt: String!
    updatedAt: String!

    # Relations
    provider: ServiceProvider
    subscriptions: [ServiceSubscription!]!
    reviews: [ServiceReview!]!

    # Computed fields
    isAvailableForProperty(propertyId: ID!): Boolean!
    estimatedPrice(propertyType: String!): Float!
  }

  type ServicePricing {
    basePrice: Float!
    currency: String!
    billingPeriod: BillingPeriod!
    discounts: ServiceDiscounts
  }

  type ServiceDiscounts {
    longTerm: Float
    seasonal: Float
    bulk: Float
  }

  type ServiceRequirements {
    propertyTypes: [String!]!
    minContractDuration: Int
    maxContractDuration: Int
    isMandatory: Boolean!
    isOptional: Boolean!
  }

  type ServiceAvailability {
    zones: [String!]!
    schedule: ServiceSchedule!
    isEmergency: Boolean!
  }

  type ServiceSchedule {
    days: [String!]!
    hours: String!
  }

  type ServiceMedia {
    photos: [String!]!
    videos: [String!]!
    documents: [String!]!
  }

  type ServiceSubscription {
    id: ID!
    userId: ID!
    propertyId: ID!
    serviceId: ID!
    contractType: ContractType!
    status: SubscriptionStatus!
    startDate: String!
    endDate: String
    pricing: SubscriptionPricing!
    autoRenewal: Boolean!
    sharedWith: [ID!]!
    paymentHistory: [PaymentRecord!]!
    createdAt: String!
    updatedAt: String!

    # Relations
    user: User
    property: Property
    service: Service
  }

  type SubscriptionPricing {
    amount: Float!
    currency: String!
    billingPeriod: String!
  }

  type PaymentRecord {
    date: String!
    amount: Float!
    status: PaymentStatus!
  }

  type ServiceReview {
    id: ID!
    userId: ID!
    serviceId: ID!
    subscriptionId: ID!
    rating: Int!
    comment: String!
    photos: [String!]!
    isVerified: Boolean!
    providerResponse: ProviderResponse
    createdAt: String!
    updatedAt: String!

    # Relations
    user: User
    service: Service
    subscription: ServiceSubscription
  }

  type ProviderResponse {
    comment: String!
    date: String!
  }

  type ServiceRecommendation {
    serviceId: ID!
    score: Float!
    reason: String!
    urgency: String!
    category: ServiceCategory!
    estimatedPrice: Float!
    neighborhoodData: NeighborhoodData

    # Relations
    service: Service
  }

  type NeighborhoodData {
    popularServices: [String!]!
    averageRating: Float!
    totalUsers: Int!
  }

  type ServiceConnection {
    edges: [ServiceEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ServiceEdge {
    node: Service!
    cursor: String!
  }

  type ServiceStats {
    totalServices: Int!
    activeServices: Int!
    totalProviders: Int!
    averageRating: Float!
    popularCategories: [CategoryStat!]!
    revenueByCategory: [CategoryRevenue!]!
  }

  type CategoryStat {
    category: ServiceCategory!
    count: Int!
    averageRating: Float!
  }

  type CategoryRevenue {
    category: ServiceCategory!
    revenue: Float!
    subscriptions: Int!
  }

  input ServiceFilters {
    category: ServiceCategory
    location: String
    propertyType: String
    contractType: ContractType
    priceRange: PriceRangeInput
    isEmergency: Boolean
    tags: [String!]
    rating: Float
  }

  input PriceRangeInput {
    min: Float!
    max: Float!
  }

  input CreateServiceProviderInput {
    companyName: String
    description: String!
    certifications: [String!] = []
    availableZones: [String!]!
    contactInfo: ContactInfoInput
    businessInfo: BusinessInfoInput
  }

  input ContactInfoInput {
    phone: String
    email: String
    website: String
  }

  input BusinessInfoInput {
    siret: String
    insurance: String
    license: String
  }

  input CreateServiceInput {
    title: String!
    description: String!
    category: ServiceCategory!
    contractTypes: [ContractType!]!
    pricing: ServicePricingInput!
    requirements: ServiceRequirementsInput!
    availability: ServiceAvailabilityInput!
    tags: [String!] = []
  }

  input ServicePricingInput {
    basePrice: Float!
    currency: String = "EUR"
    billingPeriod: BillingPeriod!
    discounts: ServiceDiscountsInput
  }

  input ServiceDiscountsInput {
    longTerm: Float
    seasonal: Float
    bulk: Float
  }

  input ServiceRequirementsInput {
    propertyTypes: [String!]!
    minContractDuration: Int
    maxContractDuration: Int
    isMandatory: Boolean = false
    isOptional: Boolean = true
  }

  input ServiceAvailabilityInput {
    zones: [String!]!
    schedule: ServiceScheduleInput!
    isEmergency: Boolean = false
  }

  input ServiceScheduleInput {
    days: [String!]!
    hours: String!
  }

  input SubscribeServiceInput {
    serviceId: ID!
    propertyId: ID!
    contractType: ContractType!
    startDate: String!
    endDate: String
    autoRenewal: Boolean = false
    sharedWith: [ID!] = []
  }

  input UpdateServiceInput {
    title: String
    description: String
    category: ServiceCategory
    contractTypes: [ContractType!]
    pricing: ServicePricingInput
    requirements: ServiceRequirementsInput
    availability: ServiceAvailabilityInput
    tags: [String!]
    status: ServiceStatus
  }

  input RecommendationInput {
    propertyType: String!
    location: LocationInput!
    userProfile: UserProfileInput!
    servicesAlreadySubscribed: [ID!]!
    seasonalContext: String
  }

  input LocationInput {
    city: String!
    district: String!
    coordinates: [Float!]
  }

  input UserProfileInput {
    userId: ID!
    preferences: [String!]!
    budget: Float!
    lifestyle: [String!]!
  }

  input CreateReviewInput {
    serviceId: ID!
    subscriptionId: ID!
    rating: Int!
    comment: String!
    photos: [String!] = []
  }

  extend type Query {
    service(id: ID!): Service
    services(filters: ServiceFilters, pagination: PaginationInput): ServiceConnection!
    serviceRecommendations(input: RecommendationInput!): [ServiceRecommendation!]!
    serviceProvider(id: ID!): ServiceProvider
    serviceProviders(filters: String, pagination: PaginationInput): [ServiceProvider!]!
    userSubscriptions(userId: ID!): [ServiceSubscription!]!
    serviceStats: ServiceStats!
    providerServices(providerId: ID!): [Service!]!
    serviceReviews(serviceId: ID!, pagination: PaginationInput): [ServiceReview!]!
  }

  extend type Mutation {
    createServiceProvider(input: CreateServiceProviderInput!): ServiceProvider!
    updateServiceProvider(id: ID!, input: CreateServiceProviderInput!): ServiceProvider!

    createService(input: CreateServiceInput!): Service!
    updateService(id: ID!, input: UpdateServiceInput!): Service!
    deleteService(id: ID!): Boolean!

    subscribeToService(input: SubscribeServiceInput!): ServiceSubscription!
    pauseSubscription(subscriptionId: ID!): ServiceSubscription!
    resumeSubscription(subscriptionId: ID!): ServiceSubscription!
    cancelSubscription(subscriptionId: ID!): ServiceSubscription!
    shareService(subscriptionId: ID!, shareWithUserIds: [ID!]!): ServiceSubscription!

    createServiceReview(input: CreateReviewInput!): ServiceReview!
    respondToReview(reviewId: ID!, response: String!): ServiceReview!
  }

  extend type Subscription {
    serviceUpdated(serviceId: ID!): Service!
    subscriptionStatusChanged(userId: ID!): ServiceSubscription!
    newServiceInCategory(category: ServiceCategory!): Service!
    newRecommendations(userId: ID!): [ServiceRecommendation!]!
  }
`;