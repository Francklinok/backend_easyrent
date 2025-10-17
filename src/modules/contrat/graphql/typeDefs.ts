import gql from 'graphql-tag';

export const contractTypeDefs = gql`
  enum ContractType {
    RENTAL
    PURCHASE
    LEASE
    SUBLEASE
    COMMERCIAL_RENTAL
    VACATION_RENTAL
    RESERVATION
  }

  enum ContractStatus {
    DRAFT
    GENERATED
    PENDING_SIGNATURE
    SIGNED
    EXPIRED
    CANCELLED
  }

  enum PartyRole {
    LANDLORD
    TENANT
    BUYER
    SELLER
    AGENT
    GUARANTOR
  }

  enum VariableType {
    TEXT
    NUMBER
    DATE
    BOOLEAN
    CURRENCY
    EMAIL
    PHONE
  }

  type ContractVariable {
    key: String!
    label: String!
    type: VariableType!
    required: Boolean!
    defaultValue: String
    validation: VariableValidation
  }

  type VariableValidation {
    min: Float
    max: Float
    pattern: String
    options: [String]
  }

  type LegalClause {
    id: String!
    title: String!
    content: String!
    isRequired: Boolean!
    order: Int!
  }

  type ContractTemplate {
    id: String!
    type: ContractType!
    name: String!
    description: String!
    template: String!
    variables: [ContractVariable!]!
    legalClauses: [LegalClause!]!
    isActive: Boolean!
    version: String!
    createdAt: String!
    updatedAt: String!
    createdBy: String!
    updatedBy: String
  }

  type AIAnalysis {
    riskScore: Float!
    complianceScore: Float!
    marketAnalysis: String!
    recommendations: [String!]!
  }

  type ContractParty {
    id: String!
    contractId: String!
    role: PartyRole!
    userId: String!
    user: User
    signedAt: String
    signature: String
    ipAddress: String
    deviceInfo: String
    createdAt: String!
    updatedAt: String!
  }

  type Contract {
    id: String!
    templateId: String!
    template: ContractTemplate
    type: ContractType!
    status: ContractStatus!
    parties: [ContractParty!]!
    variables: JSON!
    propertyId: String
    property: Property
    reservationId: String
    reservation: Reservation
    generatedFileUri: String
    signedFileUri: String
    qrCodeData: String
    watermarkData: String
    aiAnalysis: AIAnalysis
    metadata: JSON
    createdAt: String!
    updatedAt: String!
    signedAt: String
    expiresAt: String
    createdBy: String!
    updatedBy: String
  }

  type ContractAnalytics {
    totalContracts: Int!
    contractsByType: JSON!
    contractsByStatus: JSON!
    averageProcessingTime: Float!
    complianceScore: Float!
    riskScore: Float!
    monthlyTrends: [MonthlyTrend!]!
  }

  type MonthlyTrend {
    month: String!
    count: Int!
    value: Float!
  }

  input ContractPartyInput {
    role: PartyRole!
    userId: String!
  }

  input ContractGenerationInput {
    templateId: String!
    type: ContractType!
    propertyId: String
    reservationId: String
    parties: [ContractPartyInput!]!
    variables: JSON!
    autoGenerate: Boolean
    metadata: JSON
  }

  input ContractSigningInput {
    contractId: String!
    partyId: String!
    signature: String!
    ipAddress: String!
    deviceInfo: String
  }

  input ContractUpdateInput {
    contractId: String!
    variables: JSON
    status: ContractStatus
    metadata: JSON
  }

  input ContractSearchFilters {
    type: ContractType
    status: ContractStatus
    userId: String
    propertyId: String
    createdAfter: String
    createdBefore: String
    limit: Int
    offset: Int
  }

  input ContractVariableInput {
    key: String!
    label: String!
    type: VariableType!
    required: Boolean!
    defaultValue: String
    validation: VariableValidationInput
  }

  input VariableValidationInput {
    min: Float
    max: Float
    pattern: String
    options: [String]
  }

  input LegalClauseInput {
    id: String!
    title: String!
    content: String!
    isRequired: Boolean!
    order: Int!
  }

  input ContractTemplateInput {
    type: ContractType!
    name: String!
    description: String!
    template: String!
    variables: [ContractVariableInput!]!
    legalClauses: [LegalClauseInput!]!
    version: String
    metadata: JSON
  }

  input ContractTemplateUpdateInput {
    name: String
    description: String
    template: String
    variables: [ContractVariableInput]
    legalClauses: [LegalClauseInput]
    isActive: Boolean
    version: String
    metadata: JSON
  }

  type Query {
    # Contract queries
    contract(id: String!): Contract
    contracts(filters: ContractSearchFilters): [Contract!]!
    contractsByUser(userId: String!): [Contract!]!
    contractsByProperty(propertyId: String!): [Contract!]!
    contractAnalytics(filters: ContractSearchFilters): ContractAnalytics!

    # Template queries
    contractTemplate(id: String!): ContractTemplate
    contractTemplates(type: ContractType): [ContractTemplate!]!
    contractTemplatesByType(type: ContractType!): [ContractTemplate!]!
  }

  type Mutation {
    # Contract mutations
    createContract(input: ContractGenerationInput!): Contract!
    generateContractFile(contractId: String!): String!
    signContract(input: ContractSigningInput!): Contract!
    updateContract(input: ContractUpdateInput!): Contract!
    deleteContract(contractId: String!): Boolean!

    # Template mutations
    createContractTemplate(input: ContractTemplateInput!): ContractTemplate!
    updateContractTemplate(templateId: String!, input: ContractTemplateUpdateInput!): ContractTemplate!
    deleteContractTemplate(templateId: String!): Boolean!
    activateContractTemplate(templateId: String!): ContractTemplate!
    deactivateContractTemplate(templateId: String!): ContractTemplate!
  }

  type Subscription {
    contractStatusChanged(contractId: String!): Contract!
    contractSigned(contractId: String!): Contract!
    newContractCreated(userId: String!): Contract!
  }

  # External types (should be defined in other modules)
  scalar JSON

  type User {
    id: String!
    fullName: String!
    email: String!
    phone: String
  }

  type Property {
    id: String!
    title: String!
    address: String!
    type: String!
    surface: Float
    rooms: Int
  }

  type Reservation {
    id: String!
    propertyId: String!
    landlordId: String!
    tenantId: String!
    startDate: String!
    endDate: String!
    monthlyRent: Float!
    status: String!
  }
`;