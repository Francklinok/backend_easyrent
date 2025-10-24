import gql from 'graphql-tag';

export const propertyTypeDefs = gql`
  enum PropertyStatus {
    AVAILABLE
    RENTED
    MAINTENANCE
    UNAVAILABLE
  }

  enum PropertyActionType {
    rent
    sell
  }

  enum PropertyType {
    villa
    apartment
    home
    penthouse
    studio
    loft
    bureau
    chalet
    hotel
    terrain
    commercial
  }

  enum SolvabilityType {
    instant
    date
  }

  enum GuarantorLocation {
    same
    different
  }

  type GeneralHouseInfo {
    rooms: Int!
    bedrooms: Int!
    bathrooms: Int!
    toilets: Int
    surface: Float!
    area: String!
    furnished: Boolean!
    pets: Boolean!
    smoking: Boolean!
    maxOccupants: Int!
  }

  type GeneralLandInfo {
    surface: Float!
    constructible: Boolean!
    cultivable: Boolean!
    fence: Boolean!
  }

  type OwnerCriteria {
    monthlyRent: Float!
    isGarantRequired: Boolean!
    depositAmount: Float!
    minimumDuration: Int!
    solvability: SolvabilityType!
    guarantorRequired: Boolean!
    guarantorLocation: GuarantorLocation!
    acceptedSituations: [String!]!
    isdocumentRequired: Boolean!
    requiredDocuments: RequiredDocuments!
  }

  type RequiredDocuments {
    client: [String!]!
    guarantor: [String!]!
  }

  type Equipment {
    name: String!
    category: String!
    condition: String
  }

  type Atout {
    name: String!
    description: String
    icon: String
  }

  type Property {
    id: ID!
    propertyId: ID!
    ownerId: ID!
    acquiredBy: ID
    actionType: PropertyActionType!
    propertyType: PropertyType!
    island: Boolean!
    ishome: Boolean!
    title: String!
    description: String!
    address: String!
    generalHInfo: GeneralHouseInfo!
    generalLandinfo: GeneralLandInfo
    images: [String!]!
    amenities: [String!]!
    availableFrom: String!
    status: PropertyStatus!
    isActive: Boolean!
    equipments: [Equipment!]!
    ownerCriteria: OwnerCriteria!
    iserviceAvalaible: Boolean!
    services: [PropertyService!]
    atouts: [Atout!]!
    createdAt: String!
    updatedAt: String!

    # Relations GraphQL
    owner: User
    activities: [Activity!]
    conversations: [Conversation!]
    recentActivities: [Activity!]
    similarProperties: [Property!]

    # Computed fields
    pricePerSquareMeter: Float
    isAvailable: Boolean
    occupancyRate: Float
    performanceScore: Float

    # Analytics
    financialStats: PropertyFinancialStats
    marketAnalysis: PropertyMarketAnalysis
    reviews: [PropertyReview!]
    recommendedServices: [ServiceRecommendation!]
  }

  type PropertyService {
    serviceId: ID!
  }

  type PropertyFinancialStats {
    totalRevenue: Float!
    totalExpenses: Float!
    netIncome: Float!
    transactionCount: Int!
    averageMonthlyRevenue: Float!
  }

  type PropertyMarketAnalysis {
    averageMarketPrice: Float!
    pricePosition: String!
    priceDifference: Float!
    pricePercentage: Int!
    competitorCount: Int!
    marketTrend: String!
  }

  type PropertyReview {
    id: ID!
    rating: Int!
    comment: String!
    reviewer: User!
    date: String!
  }

  type PropertyStats {
    totalProperties: Int!
    availableProperties: Int!
    rentedProperties: Int!
    averageRent: Float!
    averageSize: Float!
    propertiesByArea: [PropertyAreaStat!]!
    propertiesByStatus: [PropertyStatusStat!]!
  }

  type PropertyAreaStat {
    area: String!
    count: Int!
    averageRent: Float!
  }

  type PropertyStatusStat {
    status: PropertyStatus!
    count: Int!
  }

  type PropertyConnection {
    edges: [PropertyEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PropertyEdge {
    node: Property!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  input PropertyFilters {
    actionType: PropertyActionType
    propertyType: PropertyType
    status: PropertyStatus
    minPrice: Float
    maxPrice: Float
    minRooms: Int
    maxRooms: Int
    minBedrooms: Int
    maxBedrooms: Int
    minSurface: Float
    maxSurface: Float
    area: String
    furnished: Boolean
    pets: Boolean
    smoking: Boolean
    amenities: [String!]
    availableFrom: String
    tags: [String!]
  }

  input PaginationInput {
    first: Int
    after: String
    page: Int
    limit: Int
    sortBy: String
    sortOrder: String
  }

  input CreatePropertyInput {
    actionType: PropertyActionType!
    propertyType: PropertyType!
    island: Boolean = false
    ishome: Boolean = true
    title: String!
    description: String!
    address: String!
    generalHInfo: GeneralHouseInfoInput!
    generalLandinfo: GeneralLandInfoInput
    images: [String!]!
    amenities: [String!] = []
    availableFrom: String!
    equipments: [EquipmentInput!] = []
    ownerCriteria: OwnerCriteriaInput!
    iserviceAvalaible: Boolean = false
    services: [PropertyServiceInput!]
    atouts: [AtoutInput!] = []
  }

  input GeneralHouseInfoInput {
    rooms: Int!
    bedrooms: Int!
    bathrooms: Int!
    toilets: Int = 0
    surface: Float!
    area: String!
    furnished: Boolean = false
    pets: Boolean = false
    smoking: Boolean = false
    maxOccupants: Int = 1
  }

  input GeneralLandInfoInput {
    surface: Float!
    constructible: Boolean = true
    cultivable: Boolean = true
    fence: Boolean = false
  }

  input OwnerCriteriaInput {
    monthlyRent: Float!
    isGarantRequired: Boolean = false
    depositAmount: Float = 0
    minimumDuration: Int = 1
    solvability: SolvabilityType = instant
    guarantorRequired: Boolean = false
    guarantorLocation: GuarantorLocation = same
    acceptedSituations: [String!] = []
    isdocumentRequired: Boolean = false
    requiredDocuments: RequiredDocumentsInput
  }

  input RequiredDocumentsInput {
    client: [String!] = []
    guarantor: [String!] = []
  }

  input EquipmentInput {
    name: String!
    category: String!
    condition: String
  }

  input AtoutInput {
    name: String!
    description: String
    icon: String
  }

  input PropertyServiceInput {
    serviceId: ID!
  }

  input UpdatePropertyInput {
    actionType: PropertyActionType
    propertyType: PropertyType
    island: Boolean
    ishome: Boolean
    title: String
    description: String
    address: String
    generalHInfo: GeneralHouseInfoInput
    generalLandinfo: GeneralLandInfoInput
    images: [String!]
    amenities: [String!]
    availableFrom: String
    equipments: [EquipmentInput!]
    ownerCriteria: OwnerCriteriaInput
    iserviceAvalaible: Boolean
    services: [PropertyServiceInput!]
    atouts: [AtoutInput!]
    status: PropertyStatus
    isActive: Boolean
  }

  extend type Query {
    property(id: ID!): Property
    properties(filters: PropertyFilters, pagination: PaginationInput): PropertyConnection!
    searchProperties(query: String, filters: PropertyFilters, pagination: PaginationInput): PropertyConnection!
    similarProperties(propertyId: ID!, limit: Int = 5): [Property!]!
    propertyStats: PropertyStats!
    propertiesByOwner(ownerId: ID, pagination: PaginationInput, status: PropertyStatus): PropertyConnection!
  }

  extend type Mutation {
    createProperty(input: CreatePropertyInput!): Property!
    updateProperty(id: ID!, input: UpdatePropertyInput!): Property!
    deleteProperty(id: ID!): Boolean!
    restoreProperty(id: ID!): Property!
    updatePropertyStatus(id: ID!, status: PropertyStatus!): Property!
  }

  extend type Subscription {
    propertyUpdated(propertyId: ID!): Property!
    propertyStatusChanged(ownerId: ID!): Property!
    newPropertyInArea(area: String!): Property!
  }
`;