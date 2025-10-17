import gql from 'graphql-tag';

export const cryptoTypeDefs = gql`
  # ========== CRYPTO PAYMENTS ==========

  type CryptoPayment {
    id: ID!
    paymentId: String!
    userId: String!
    propertyId: String!
    paymentType: PaymentType!
    cryptocurrency: Cryptocurrency!
    network: BlockchainNetwork!
    amount: Float!
    amountFiat: Float!
    fiatCurrency: String!
    exchangeRate: Float!
    transactionHash: String!
    fromAddress: String!
    toAddress: String!
    blockHeight: Int
    confirmations: Int!
    gasUsed: Float
    gasPrice: Float
    status: PaymentStatus!
    confirmationsRequired: Int!
    smartContractAddress: String
    smartContractFunction: String
    contractInteractionData: JSON
    escrow: EscrowInfo
    recurring: RecurringInfo
    metadata: PaymentMetadata!
    createdAt: String!
    updatedAt: String!
  }

  type EscrowInfo {
    isEscrow: Boolean!
    escrowAddress: String
    releaseConditions: [String!]
    releaseDate: String
    isReleased: Boolean!
    releasedAt: String
    releasedTo: String
  }

  type RecurringInfo {
    isRecurring: Boolean!
    frequency: RecurringFrequency
    nextPaymentDate: String
    endDate: String
    totalPayments: Int
    completedPayments: Int!
  }

  type PaymentMetadata {
    propertyAddress: String!
    landlordId: String!
    leaseId: String
    paymentDescription: String!
    invoiceNumber: String
  }

  # ========== PROPERTY TOKENS ==========

  type PropertyToken {
    id: ID!
    tokenId: String!
    propertyId: String!
    propertyDetails: PropertyDetails!
    tokenomics: PropertyTokenomics!
    blockchain: BlockchainDetails!
    ownership: OwnershipInfo!
    revenueSharing: RevenueSharing!
    trading: TradingInfo!
    governance: GovernanceInfo!
    compliance: ComplianceInfo!
    legal: LegalInfo!
    status: TokenStatus!
    valueMetrics: ValueMetrics!
    createdAt: String!
    updatedAt: String!
  }

  type PropertyDetails {
    address: String!
    propertyType: PropertyType!
    totalValue: Float!
    currency: String!
    lastValuation: String!
  }

  type PropertyTokenomics {
    tokenSymbol: String!
    tokenName: String!
    totalSupply: Float!
    circulatingSupply: Float!
    tokenPrice: Float!
    priceHistory: [PriceHistoryPoint!]!
    minimumInvestment: Float!
  }

  type PriceHistoryPoint {
    date: String!
    price: Float!
    volume: Float!
    marketCap: Float!
  }

  type BlockchainDetails {
    network: BlockchainNetwork!
    contractAddress: String
    tokenStandard: TokenStandard!
    deploymentCost: Float!
    gasOptimization: Boolean!
  }

  type OwnershipInfo {
    totalOwners: Int!
    ownershipDistribution: [OwnershipDistribution!]!
  }

  type OwnershipDistribution {
    ownerId: String!
    tokensOwned: Float!
    ownershipPercentage: Float!
    acquisitionDate: String!
    averagePurchasePrice: Float!
    investmentAmount: Float!
    kycStatus: KYCStatus!
    accreditedInvestor: Boolean!
  }

  type RevenueSharing {
    enabled: Boolean!
    distributionFrequency: DistributionFrequency!
    nextDistribution: String!
    totalRevenueDistributed: Float!
    distributionHistory: [RevenueDistribution!]!
    reservePercentage: Float!
    managementFee: Float!
    expectedAnnualReturn: Float!
  }

  type RevenueDistribution {
    period: String!
    totalRevenue: Float!
    distributableAmount: Float!
    managementFee: Float!
    reserveAmount: Float!
    distributionDate: String!
    distributions: [IndividualDistribution!]!
  }

  type IndividualDistribution {
    ownerId: String!
    amount: Float!
    tokensOwned: Float!
    ownershipPercentage: Float!
    distributionDate: String!
    period: String!
    transactionHash: String!
  }

  type TradingInfo {
    isTradeEnabled: Boolean!
    dexListings: [DexListing!]!
    tradingVolume24h: Float!
    totalTradingVolume: Float!
    priceDiscovery: PriceDiscoveryMethod!
    liquidityPool: LiquidityPoolInfo!
    orderBook: OrderBook!
  }

  type DexListing {
    exchange: String!
    pair: String!
    liquidity: Float!
    volume24h: Float!
    apr: Float!
  }

  type LiquidityPoolInfo {
    totalLiquidity: Float!
    providers: [LiquidityProvider!]!
    rewardRate: Float!
  }

  type LiquidityProvider {
    providerId: String!
    liquidityProvided: Float!
    rewardsEarned: Float!
    joinDate: String!
  }

  type OrderBook {
    buyOrders: [TradingOrder!]!
    sellOrders: [TradingOrder!]!
    lastTrade: LastTrade
  }

  type TradingOrder {
    orderId: String!
    listingId: String
    sellerId: String
    buyerId: String
    tokensAmount: Float!
    pricePerToken: Float!
    totalValue: Float!
    orderType: OrderType!
    status: OrderStatus!
    createdAt: String!
    expiresAt: String
    minimumBid: Float
    reservePrice: Float
    bids: [Bid!]!
    views: Int!
    favorites: Int!
  }

  type Bid {
    bidId: String!
    bidderId: String!
    amount: Float!
    currency: String!
    walletAddress: String!
    timestamp: String!
    status: BidStatus!
    escrowTxHash: String!
  }

  type LastTrade {
    price: Float!
    quantity: Float!
    timestamp: String!
    buyer: String!
    seller: String!
  }

  type GovernanceInfo {
    enabled: Boolean!
    votingRights: VotingRights!
    quorum: Float!
    proposals: [Proposal!]!
    votingHistory: [Vote!]!
  }

  type Proposal {
    proposalId: String!
    title: String!
    description: String!
    proposalType: ProposalType!
    proposer: String!
    createdAt: String!
    votingStart: String!
    votingEnd: String!
    status: ProposalStatus!
    votes: VoteTally!
    voters: [Voter!]!
    quorumReached: Boolean!
    executed: Boolean!
  }

  type VoteTally {
    for: Float!
    against: Float!
    abstain: Float!
  }

  type Voter {
    userId: String!
    vote: VoteChoice!
    votingPower: Float!
    timestamp: String!
  }

  type Vote {
    proposalId: String!
    vote: VoteChoice!
    votingPower: Float!
    timestamp: String!
  }

  type ComplianceInfo {
    isCompliant: Boolean!
    jurisdiction: String!
    regulations: [String!]!
    auditTrail: [AuditEntry!]!
    kycRequirement: Boolean!
    accreditedInvestorOnly: Boolean!
  }

  type AuditEntry {
    action: String!
    performedBy: String!
    timestamp: String!
    details: String!
  }

  type LegalInfo {
    propertyDeed: String!
    operatingAgreement: String!
    prospectus: String!
    legalDocuments: [LegalDocument!]!
    custodian: String!
    propertyManager: String!
  }

  type LegalDocument {
    type: String!
    url: String!
    hash: String!
  }

  type ValueMetrics {
    currentValuation: Float!
    occupancyRate: Float!
    netOperatingIncome: Float!
    capRate: Float!
    appreciationRate: Float!
    totalReturn: Float!
    cashFlow: CashFlow!
  }

  type CashFlow {
    monthly: Float!
    quarterly: Float!
    annual: Float!
  }

  # ========== UTILITY TOKENS ==========

  type UtilityToken {
    id: ID!
    tokenId: String!
    name: String!
    symbol: String!
    contractAddress: String
    blockchain: BlockchainNetwork!
    decimals: Int!
    totalSupply: Float!
    circulatingSupply: Float!
    tokenomics: UtilityTokenomics!
    utilities: TokenUtilities!
    userBalances: [UserBalance!]!
    transactions: [TokenTransaction!]!
    platform: PlatformIntegration!
    economics: TokenEconomics!
    liquidity: LiquidityInfo!
    status: TokenStatus!
    launchDate: String!
    createdAt: String!
    updatedAt: String!
  }

  type UtilityTokenomics {
    initialPrice: Float!
    currentPrice: Float!
    priceHistory: [PriceHistoryPoint!]!
    distribution: TokenDistribution!
    vestingSchedules: [VestingSchedule!]!
  }

  type TokenDistribution {
    ecosystem: Float!
    team: Float!
    investors: Float!
    platform: Float!
    users: Float!
  }

  type VestingSchedule {
    category: VestingCategory!
    totalTokens: Float!
    releasedTokens: Float!
    vestingPeriod: Int!
    cliffPeriod: Int!
    nextRelease: String!
    releaseAmount: Float!
  }

  type TokenUtilities {
    feeDiscounts: FeeDiscounts!
    priorityAccess: PriorityAccess!
    staking: StakingUtility!
    governance: GovernanceUtility!
    cashback: CashbackUtility!
  }

  type FeeDiscounts {
    enabled: Boolean!
    tiers: [DiscountTier!]!
  }

  type DiscountTier {
    minTokens: Float!
    discountPercentage: Float!
    description: String!
  }

  type PriorityAccess {
    enabled: Boolean!
    minTokensRequired: Float!
    benefits: [String!]!
  }

  type StakingUtility {
    enabled: Boolean!
    apy: Float!
    minStakeAmount: Float!
    lockupPeriods: [LockupPeriod!]!
  }

  type LockupPeriod {
    duration: Int!
    multiplier: Float!
  }

  type GovernanceUtility {
    enabled: Boolean!
    minTokensForProposal: Float!
    votingPower: VotingPowerType!
    proposalDuration: Int!
    proposals: [Proposal!]
  }

  type CashbackUtility {
    enabled: Boolean!
    rate: Float!
    maxCashbackPerTransaction: Float!
    applicableServices: [String!]!
  }

  type UserBalance {
    userId: String!
    balance: Float!
    stakedBalance: Float!
    lockedBalance: Float!
    lastUpdate: String!
    stakingInfo: [StakingPosition!]!
  }

  type StakingPosition {
    amount: Float!
    startDate: String!
    lockupPeriod: Int!
    rewardsAccrued: Float!
    rewardsClaimed: Float!
    lastClaimDate: String!
  }

  type TokenTransaction {
    transactionId: String!
    type: TransactionType!
    from: String!
    to: String!
    amount: Float!
    fee: Float
    reason: String!
    metadata: JSON
    transactionHash: String!
    blockNumber: Int!
    timestamp: String!
  }

  type PlatformIntegration {
    acceptedServices: [AcceptedService!]!
    usage: UsageMetrics!
  }

  type AcceptedService {
    serviceType: ServiceType!
    discountRate: Float!
    acceptanceRate: Float!
  }

  type UsageMetrics {
    totalTransactions: Int!
    totalVolume: Float!
    activeUsers: Int!
    averageHoldingTime: Float!
    utilityUsage: UtilityUsage!
  }

  type UtilityUsage {
    staking: Float!
    feePayments: Float!
    governance: Float!
    cashback: Float!
  }

  type TokenEconomics {
    burnMechanisms: BurnMechanisms!
    revenueStreams: RevenueStreams!
    buyback: BuybackProgram!
  }

  type BurnMechanisms {
    transactionBurn: TransactionBurn!
    periodicBurn: PeriodicBurn!
  }

  type TransactionBurn {
    enabled: Boolean!
    burnRate: Float!
  }

  type PeriodicBurn {
    enabled: Boolean!
    frequency: BurnFrequency!
    burnAmount: Float!
    nextBurn: String!
  }

  type RevenueStreams {
    platformFees: Float!
    premiumSubscriptions: Float!
    transactionFees: Float!
    stakingFees: Float!
  }

  type BuybackProgram {
    enabled: Boolean!
    frequency: BuybackFrequency!
    percentage: Float!
    lastBuyback: String!
    nextBuyback: String!
    totalBoughtBack: Float!
  }

  type LiquidityInfo {
    dexListings: [DexListing!]!
    liquidityMining: LiquidityMining!
  }

  type LiquidityMining {
    enabled: Boolean!
    pools: [LiquidityMiningPool!]!
  }

  type LiquidityMiningPool {
    pair: String!
    rewardRate: Float!
    totalLiquidity: Float!
    participants: Int!
  }

  # ========== SMART CONTRACTS ==========

  type SmartContract {
    id: ID!
    contractId: String!
    contractType: ContractType!
    propertyId: String!
    blockchain: BlockchainNetwork!
    contractAddress: String
    abi: [JSON!]!
    bytecode: String
    parties: [ContractParty!]!
    terms: ContractTerms!
    paymentSchedule: PaymentSchedule
    functions: [ContractFunction!]!
    executionHistory: [ExecutionRecord!]!
    milestones: [Milestone!]!
    oracles: OracleIntegration
    security: SecurityInfo!
    status: ContractStatus!
    deployedAt: String
    terminatedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type ContractParty {
    role: PartyRole!
    userId: String!
    walletAddress: String!
    signature: String
    signedAt: String
  }

  type ContractTerms {
    monthlyRent: Float
    currency: String!
    leaseDuration: Int
    securityDeposit: Float
    salePrice: Float
    escrowAmount: Float
    releaseConditions: [String!]!
    startDate: String!
    endDate: String
    automaticRenewal: Boolean
    penaltyClause: [PenaltyClause!]!
  }

  type PenaltyClause {
    description: String!
    amount: Float!
    currency: String!
  }

  type PaymentSchedule {
    frequency: PaymentFrequency!
    amount: Float!
    currency: String!
    nextPaymentDate: String!
    totalPayments: Int!
    completedPayments: Int!
    autoExecute: Boolean!
  }

  type ContractFunction {
    name: String!
    description: String!
    parameters: [FunctionParameter!]!
    access: FunctionAccess!
  }

  type FunctionParameter {
    name: String!
    type: String!
    description: String!
  }

  type ExecutionRecord {
    functionName: String!
    executedBy: String!
    executedAt: String!
    transactionHash: String!
    gasUsed: Int!
    success: Boolean!
    parameters: JSON
    result: JSON
    error: String
  }

  type Milestone {
    id: String!
    description: String!
    condition: String!
    status: MilestoneStatus!
    completedAt: String
    evidence: [Evidence!]!
  }

  type Evidence {
    type: EvidenceType!
    data: String!
    uploadedBy: String!
    uploadedAt: String!
  }

  type OracleIntegration {
    priceOracle: PriceOracle
    propertyOracle: PropertyOracle
  }

  type PriceOracle {
    provider: String!
    endpoint: String!
    frequency: Int!
    lastUpdate: String!
    currentPrice: Float!
  }

  type PropertyOracle {
    provider: String!
    endpoint: String!
    lastValuation: String!
    currentValuation: Float!
  }

  type SecurityInfo {
    isAudited: Boolean!
    auditReport: String
    vulnerabilities: [Vulnerability!]!
    pausedFunctions: [String!]!
  }

  type Vulnerability {
    severity: VulnerabilitySeverity!
    description: String!
    status: VulnerabilityStatus!
    reportedAt: String!
  }

  # ========== DEFI ==========

  # Dynamic Pricing
  type DynamicPricing {
    id: ID!
    propertyId: String!
    baseRent: Float!
    currentYieldRate: Float!
    adjustedRent: Float!
    pricingTier: PricingTier!
    discountPercentage: Float!
    lastUpdate: String!
    smoothingFactor: Float!
    historicalYields: [YieldHistory!]!
    isActive: Boolean!
  }

  type YieldHistory {
    date: String!
    yieldRate: Float!
    discountApplied: Float!
  }

  # Multi-Asset Staking
  type MultiAssetStaking {
    id: ID!
    propertyId: String!
    ownerId: String!
    totalStakedAmount: Float!
    assets: [StakingAsset!]!
    rebalanceThreshold: Float!
    autoRebalanceEnabled: Boolean!
    insuranceProvider: String!
    insuranceCoverage: Float!
    totalYield: Float!
    monthlyYield: Float!
    riskScore: Float!
    lastRebalanceDate: String!
    performanceHistory: [PerformanceHistory!]!
    diversificationScore: Float!
    isActive: Boolean!
  }

  type StakingAsset {
    assetType: AssetType!
    protocol: String!
    amount: Float!
    expectedYield: Float!
    currentYield: Float!
    riskLevel: RiskLevel!
    insuranceCovered: Boolean!
    lastRebalance: String!
  }

  type PerformanceHistory {
    date: String!
    totalYield: Float!
    assetPerformance: [AssetPerformance!]!
  }

  type AssetPerformance {
    assetType: String!
    yield: Float!
    allocation: Float!
  }

  # Fractional Ownership
  type FractionalOwnership {
    id: ID!
    propertyId: String!
    totalShares: Int!
    sharePrice: Float!
    availableShares: Int!
    totalValue: Float!
    shareholders: [Shareholder!]!
    daoGovernance: DAOGovernance!
    revenueSharing: PropertyRevenueSharing!
    transitionPath: TransitionPath!
    liquidityPool: PropertyLiquidityPool!
    totalShareholderValue: Float!
    isActive: Boolean!
  }

  type Shareholder {
    userId: String!
    shares: [FractionalShare!]!
    totalOwnership: Float!
    isActive: Boolean!
    joinDate: String!
  }

  type FractionalShare {
    tokenId: String!
    sharePercentage: Float!
    purchasePrice: Float!
    currentValue: Float!
    purchaseDate: String!
    isTransferrable: Boolean!
    votingRights: Boolean!
  }

  type DAOGovernance {
    isEnabled: Boolean!
    votingThreshold: Float!
    proposalCount: Int!
    activeProposals: [DAOProposal!]!
  }

  type DAOProposal {
    proposalId: String!
    title: String!
    description: String!
    votes: [DAOVote!]!
    status: ProposalStatus!
    createdAt: String!
    expiresAt: String!
  }

  type DAOVote {
    userId: String!
    vote: VoteChoice!
    votingPower: Float!
  }

  type PropertyRevenueSharing {
    enabled: Boolean!
    distributionSchedule: DistributionSchedule!
    lastDistribution: String
    totalDistributed: Float!
    distributions: [PropertyRevenueDistribution!]!
  }

  type PropertyRevenueDistribution {
    month: Int!
    year: Int!
    totalRevenue: Float!
    distributionPerShare: Float!
    distributed: Boolean!
    distributionDate: String
  }

  type TransitionPath {
    enabled: Boolean!
    tenantUserId: String
    accumulatedShares: Float!
    monthlyAccumulation: Float!
    targetOwnership: Float!
  }

  type PropertyLiquidityPool {
    available: Boolean!
    poolSize: Float!
    tradingEnabled: Boolean!
    lastTradePrice: Float!
    priceHistory: [PropertyPriceHistory!]!
  }

  type PropertyPriceHistory {
    date: String!
    price: Float!
    volume: Float!
  }

  # Loyalty Mining
  type LoyaltyMining {
    id: ID!
    userId: String!
    propertyId: String
    totalPoints: Int!
    currentTier: LoyaltyTier!
    tierMultiplier: Float!
    contractStartDate: String!
    contractDuration: Int!
    loyaltyActions: [LoyaltyAction!]!
    referrals: [ReferralBonus!]!
    referralCode: String!
    tokens: LoyaltyTokens!
    achievements: [Achievement!]!
    monthlyBonus: MonthlyBonus!
    loyaltyScore: Float!
    isActive: Boolean!
  }

  type LoyaltyAction {
    actionType: ActionType!
    points: Int!
    multiplier: Float!
    date: String!
    verified: Boolean!
    referenceId: String
  }

  type ReferralBonus {
    referredUserId: String!
    referralCode: String!
    bonusAmount: Float!
    conversionDate: String!
    isActive: Boolean!
  }

  type LoyaltyTokens {
    total: Float!
    available: Float!
    locked: Float!
    vestingSchedule: [VestingEntry!]!
  }

  type VestingEntry {
    amount: Float!
    releaseDate: String!
    released: Boolean!
  }

  type Achievement {
    achievementId: String!
    name: String!
    description: String!
    pointsReward: Int!
    unlockedDate: String!
  }

  type MonthlyBonus {
    consecutiveMonths: Int!
    lastPaymentDate: String
    bonusMultiplier: Float!
  }

  # AI Risk Assessment
  type AIRiskAssessment {
    id: ID!
    userId: String!
    propertyId: String
    onChainData: OnChainData!
    riskFactors: RiskFactors!
    overallRiskScore: Float!
    riskCategory: RiskCategory!
    predictionModel: PredictionModel!
    dynamicAdjustments: DynamicAdjustments!
    monitoringAlerts: [MonitoringAlert!]!
    confidenceScore: Float!
    lastAssessment: String!
    nextReview: String!
    isActive: Boolean!
  }

  type OnChainData {
    walletAddress: String!
    totalTransactions: Int!
    averageTransactionValue: Float!
    defiProtocolsUsed: [String!]!
    stakingHistory: [StakingHistoryEntry!]!
    liquidityProviding: [LiquidityEntry!]!
    creditScore: Float!
    riskLevel: RiskLevel!
  }

  type StakingHistoryEntry {
    protocol: String!
    amount: Float!
    duration: Int!
    returns: Float!
  }

  type LiquidityEntry {
    pool: String!
    amount: Float!
    duration: Int!
    impermanentLoss: Float!
  }

  type RiskFactors {
    paymentHistory: PaymentHistoryRisk!
    financialStability: FinancialStabilityRisk!
    behaviouralMetrics: BehaviouralMetricsRisk!
    externalFactors: ExternalFactorsRisk!
  }

  type PaymentHistoryRisk {
    totalPayments: Int!
    latePayments: Int!
    averageDelayDays: Float!
    consistency: Float!
  }

  type FinancialStabilityRisk {
    incomeVolatility: Float!
    debtToIncomeRatio: Float!
    cryptoAssetVolatility: Float!
    diversificationScore: Float!
  }

  type BehaviouralMetricsRisk {
    platformEngagement: Float!
    communityParticipation: Float!
    maintenanceReporting: Float!
    disputeHistory: Float!
  }

  type ExternalFactorsRisk {
    marketConditions: Float!
    regionEconomicHealth: Float!
    propertyMarketTrend: Float!
    seasonalFactors: Float!
  }

  type PredictionModel {
    algorithm: Algorithm!
    accuracy: Float!
    lastTraining: String!
    features: [String!]!
    predictions: [RiskPrediction!]!
  }

  type RiskPrediction {
    predictionType: PredictionType!
    probability: Float!
    confidence: Float!
    timeframe: Int!
    createdAt: String!
  }

  type DynamicAdjustments {
    conditionsAdjustment: Float!
    depositMultiplier: Float!
    interestRateAdjustment: Float!
    insurancePremium: Float!
  }

  type MonitoringAlert {
    alertType: AlertType!
    severity: AlertSeverity!
    message: String!
    actionRequired: Boolean!
    createdAt: String!
    resolved: Boolean!
  }

  # Insurance DAO
  type InsuranceDAO {
    id: ID!
    poolId: String!
    pools: [InsurancePool!]!
    totalPoolValue: Float!
    governance: InsuranceGovernance!
    claims: [InsuranceClaim!]!
    riskAssessment: InsuranceRiskAssessment!
    feeStructure: InsuranceFeeStructure!
    statistics: InsuranceStatistics!
    coverageRatio: Float!
    isActive: Boolean!
  }

  type InsurancePool {
    poolType: PoolType!
    totalFunds: Float!
    availableFunds: Float!
    lockedFunds: Float!
    contributors: [InsuranceContributor!]!
    coverageLimit: Float!
    minimumStake: Float!
    riskMultiplier: Float!
  }

  type InsuranceContributor {
    userId: String!
    contribution: Float!
    contributionDate: String!
    votingPower: Float!
    isActive: Boolean!
  }

  type InsuranceGovernance {
    votingThreshold: Float!
    votingPeriod: Int!
    quorumRequired: Float!
    proposals: [InsuranceProposal!]!
  }

  type InsuranceProposal {
    proposalId: String!
    proposalType: InsuranceProposalType!
    title: String!
    description: String!
    parameters: JSON
    votes: [InsuranceVote!]!
    status: ProposalStatus!
    createdAt: String!
    expiresAt: String!
    executedAt: String
  }

  type InsuranceVote {
    voterId: String!
    vote: VoteChoice!
    votingPower: Float!
    timestamp: String!
  }

  type InsuranceClaim {
    claimId: String!
    claimType: ClaimType!
    amount: Float!
    description: String!
    evidence: [String!]!
    status: ClaimStatus!
    claimantId: String!
    propertyId: String
    createdAt: String!
    resolvedAt: String
    votes: [ClaimVote!]!
  }

  type ClaimVote {
    voterId: String!
    vote: ClaimVoteChoice!
    votingPower: Float!
    reason: String
    timestamp: String!
  }

  type InsuranceRiskAssessment {
    protocolRisks: [ProtocolRisk!]!
    propertyRisks: [PropertyRisk!]!
  }

  type ProtocolRisk {
    protocol: String!
    riskLevel: Float!
    coverageMultiplier: Float!
    lastAssessment: String!
  }

  type PropertyRisk {
    propertyId: String!
    riskLevel: Float!
    premiumMultiplier: Float!
    coverageAmount: Float!
  }

  type InsuranceFeeStructure {
    claimFee: Float!
    administrationFee: Float!
    reinsuranceFee: Float!
    treasuryFee: Float!
  }

  type InsuranceStatistics {
    totalClaims: Int!
    approvedClaims: Int!
    totalPaidOut: Float!
    successRate: Float!
    averageClaimAmount: Float!
    averageProcessingTime: Float!
  }

  type YieldFarmingPool {
    poolId: String!
    name: String!
    tokenA: String!
    tokenB: String!
    totalLiquidity: Float!
    apy: Float!
    totalStaked: Float!
    rewardToken: String!
    rewardRate: Float!
    participants: Int!
    lockupPeriod: Int!
    multiplier: Float!
    isActive: Boolean!
    createdAt: String!
  }

  type LendingPool {
    poolId: String!
    asset: String!
    totalSupply: Float!
    totalBorrow: Float!
    supplyRate: Float!
    borrowRate: Float!
    collateralFactor: Float!
    liquidationThreshold: Float!
    utilizationRate: Float!
    isActive: Boolean!
  }

  type DeFiPosition {
    positionId: String!
    userId: String!
    poolId: String!
    type: PositionType!
    amount: Float!
    asset: String
    collateralTokenId: String
    collateralAmount: Float
    interestRate: Float!
    createdAt: String!
    lastUpdate: String!
    interestAccrued: Float!
    isActive: Boolean!
    healthFactor: Float
  }

  type UserDeFiSummary {
    totalValue: Float!
    totalRewards: Float!
    positionsCount: Int!
    yieldFarming: Int!
    lending: Int!
    positions: [DeFiPosition!]!
  }

  # ========== MARKETPLACE ==========

  type MarketplaceListing {
    listingId: String!
    token: TokenInfo!
    sellerId: String!
    quantity: Float!
    pricePerToken: Float!
    currency: String!
    listingType: ListingType!
    highestBid: Float
    bidCount: Int!
    views: Int!
    favorites: Int!
    createdAt: String!
    expiresAt: String!
  }

  type TokenInfo {
    tokenId: String!
    name: String!
    symbol: String
    type: String!
    propertyType: PropertyType
    location: String
  }

  type TradingHistory {
    type: TradeType!
    tokenId: String!
    tokenName: String!
    quantity: Float!
    pricePerToken: Float!
    totalAmount: Float!
    currency: String!
    status: String!
    createdAt: String!
    listingId: String
    bidId: String
  }

  # ========== PRICE DATA ==========

  type PriceData {
    symbol: String!
    price: Float!
    change24h: Float!
    volume24h: Float!
    marketCap: Float
    lastUpdate: String!
    source: String!
  }

  type ExchangeRate {
    from: String!
    to: String!
    rate: Float!
    timestamp: String!
    source: String!
  }

  type MarketIndicators {
    cryptoMarket: CryptoMarketData!
    realEstateMarket: RealEstateMarketData!
    defiMetrics: DeFiMetrics!
  }

  type CryptoMarketData {
    totalMarketCap: Float!
    fearGreedIndex: Int!
    dominance: Float!
  }

  type RealEstateMarketData {
    averageCapRate: Float!
    priceAppreciation: Float!
    rentalYield: Float!
  }

  type DeFiMetrics {
    totalValueLocked: Float!
    averageApy: Float!
    liquidityIndex: Float!
  }

  type HistoricalDataPoint {
    timestamp: String!
    price: Float!
    volume: Float!
  }

  # ========== ENUMS ==========

  enum PaymentType {
    rent
    purchase
    deposit
    security_deposit
    service_fee
  }

  enum Cryptocurrency {
    BTC
    ETH
    USDT
    USDC
    MATIC
    BNB
  }

  enum BlockchainNetwork {
    bitcoin
    ethereum
    polygon
    bsc
    avalanche
  }

  enum PaymentStatus {
    pending
    confirming
    confirmed
    failed
    refunded
  }

  enum RecurringFrequency {
    weekly
    monthly
    quarterly
  }

  enum PropertyType {
    residential
    commercial
    industrial
    land
  }

  enum TokenStandard {
    ERC_20
    ERC_721
    ERC_1155
  }

  enum TokenStatus {
    development
    tokenized
    deployed
    active
    paused
    completed
  }

  enum KYCStatus {
    pending
    verified
    rejected
  }

  enum DistributionFrequency {
    weekly
    monthly
    quarterly
    annually
  }

  enum PriceDiscoveryMethod {
    oracle_based
    amm_based
    order_book
    hybrid
  }

  enum OrderType {
    market
    limit
    fixed_price
    auction
    dutch_auction
  }

  enum OrderStatus {
    open
    filled
    cancelled
    expired
    sold
  }

  enum BidStatus {
    active
    accepted
    rejected
    cancelled
  }

  enum VotingRights {
    proportional
    equal
    weighted
  }

  enum ProposalType {
    parameter_change
    feature_request
    treasury_allocation
    partnership
  }

  enum ProposalStatus {
    active
    passed
    rejected
    executed
    expired
  }

  enum VoteChoice {
    for
    against
    abstain
  }

  enum VestingCategory {
    team
    investors
    ecosystem
  }

  enum VotingPowerType {
    linear
    quadratic
    weighted
  }

  enum TransactionType {
    mint
    burn
    transfer
    stake
    unstake
    reward
    purchase
    redemption
  }

  enum ServiceType {
    rental
    purchase
    marketplace
    premium_features
  }

  enum BurnFrequency {
    weekly
    monthly
    quarterly
  }

  enum BuybackFrequency {
    weekly
    monthly
    quarterly
  }

  enum ContractType {
    lease
    sale
    escrow
    revenue_sharing
    utility_token
  }

  enum PartyRole {
    landlord
    tenant
    buyer
    seller
    investor
    platform
  }

  enum PaymentFrequency {
    weekly
    monthly
    quarterly
  }

  enum FunctionAccess {
    public
    owner_only
    parties_only
  }

  enum ContractStatus {
    draft
    deployed
    active
    paused
    completed
    terminated
  }

  enum MilestoneStatus {
    pending
    met
    failed
  }

  enum EvidenceType {
    file
    transaction
    signature
  }

  enum VulnerabilitySeverity {
    low
    medium
    high
    critical
  }

  enum VulnerabilityStatus {
    open
    resolved
  }

  enum PositionType {
    supply
    borrow
    stake
    liquidity
  }

  enum ListingType {
    fixed_price
    auction
    dutch_auction
  }

  enum TradeType {
    buy
    sell
  }

  # New DeFi Enums
  enum PricingTier {
    low
    medium
    high
  }

  enum AssetType {
    ETH
    DeFi
    RWA
  }

  enum RiskLevel {
    very_low
    low
    medium
    high
    very_high
  }

  enum DistributionSchedule {
    monthly
    quarterly
    annual
  }

  enum LoyaltyTier {
    bronze
    silver
    gold
    platinum
    diamond
  }

  enum ActionType {
    payment_ontime
    contract_renewal
    referral
    review
    maintenance_report
  }

  enum RiskCategory {
    premium
    standard
    cautious
    high_risk
  }

  enum Algorithm {
    random_forest
    neural_network
    gradient_boosting
    ensemble
  }

  enum PredictionType {
    payment_default
    early_termination
    property_damage
    renewal_likelihood
  }

  enum AlertType {
    risk_increase
    unusual_activity
    payment_prediction
    market_volatility
  }

  enum AlertSeverity {
    low
    medium
    high
    critical
  }

  enum PoolType {
    defi_protection
    property_coverage
    general_fund
  }

  enum InsuranceProposalType {
    coverage_adjustment
    pool_rebalancing
    fee_structure
    policy_update
  }

  enum ClaimType {
    defi_loss
    property_damage
    payment_default
    smart_contract_bug
  }

  enum ClaimStatus {
    pending
    investigating
    voting
    approved
    rejected
    paid
  }

  enum ClaimVoteChoice {
    approve
    reject
  }

  # ========== INPUTS ==========

  input CreateCryptoPaymentInput {
    userId: String!
    propertyId: String!
    paymentType: PaymentType!
    cryptocurrency: Cryptocurrency!
    network: BlockchainNetwork!
    amountFiat: Float!
    fiatCurrency: String!
    fromAddress: String!
    toAddress: String!
    metadata: PaymentMetadataInput!
    recurring: RecurringInfoInput
    escrow: EscrowInfoInput
  }

  input PaymentMetadataInput {
    propertyAddress: String!
    landlordId: String!
    leaseId: String
    paymentDescription: String!
    invoiceNumber: String
  }

  input RecurringInfoInput {
    frequency: RecurringFrequency!
    endDate: String
    totalPayments: Int!
  }

  input EscrowInfoInput {
    releaseConditions: [String!]!
    releaseDate: String
  }

  input TokenizePropertyInput {
    propertyId: String!
    propertyAddress: String!
    propertyValue: Float!
    currency: String!
    totalTokens: Float!
    tokenSymbol: String!
    tokenName: String!
    blockchain: BlockchainNetwork!
    ownerId: String!
    minimumInvestment: Float!
    expectedAnnualReturn: Float!
    propertyType: PropertyType!
    legalDocuments: [LegalDocumentInput!]!
  }

  input LegalDocumentInput {
    type: String!
    url: String!
    hash: String!
  }

  input BuyTokensInput {
    propertyTokenId: String!
    buyerId: String!
    tokensAmount: Float!
    paymentMethod: String!
    walletAddress: String
  }

  input CreateUtilityTokenInput {
    name: String!
    symbol: String!
    totalSupply: Float!
    initialPrice: Float!
    blockchain: BlockchainNetwork!
    distribution: TokenDistributionInput!
  }

  input TokenDistributionInput {
    ecosystem: Float!
    team: Float!
    investors: Float!
    platform: Float!
    users: Float!
  }

  input StakeTokensInput {
    userId: String!
    tokenId: String!
    amount: Float!
    lockupPeriod: Int!
  }

  input CreateProposalInput {
    proposerId: String!
    tokenId: String!
    title: String!
    description: String!
    proposalType: ProposalType!
    votingPeriod: Int
  }

  input ListTokenInput {
    sellerId: String!
    tokenType: String!
    tokenId: String!
    quantity: Float!
    pricePerToken: Float!
    currency: String!
    listingType: ListingType!
    duration: Int
    minimumBid: Float
    reservePrice: Float
  }

  input PlaceBidInput {
    bidderId: String!
    listingId: String!
    bidAmount: Float!
    currency: String!
    walletAddress: String!
  }

  input YieldFarmingStakeInput {
    userId: String!
    poolId: String!
    amount: Float!
    lockupPeriod: Int
  }

  input LendingActionInput {
    userId: String!
    poolId: String!
    amount: Float!
    action: String!
    collateralTokenId: String
    collateralAmount: Float
  }

  input CryptoFiltersInput {
    paymentType: PaymentType
    cryptocurrency: Cryptocurrency
    status: PaymentStatus
    startDate: String
    endDate: String
    limit: Int
    offset: Int
  }

  input PropertyTokenFiltersInput {
    propertyType: PropertyType
    blockchain: BlockchainNetwork
    status: TokenStatus
    minPrice: Float
    maxPrice: Float
    limit: Int
  }

  input MarketplaceFiltersInput {
    tokenType: String
    priceRange: PriceRangeInput
    location: String
    propertyType: PropertyType
    sortBy: String
    limit: Int
  }

  input PriceRangeInput {
    min: Float!
    max: Float!
  }

  # New DeFi Inputs
  input SetupDynamicPricingInput {
    propertyId: String!
    baseRent: Float!
    initialYieldRate: Float
  }

  input UpdateRentPricingInput {
    propertyId: String!
    newYieldRate: Float!
  }

  input ProcessRentPaymentInput {
    tenantId: String!
    propertyId: String!
    paymentAmount: Float!
  }

  input SetupMultiAssetStakingInput {
    propertyId: String!
    ownerId: String!
    totalAmount: Float!
  }

  input TokenizePropertyInput2 {
    propertyId: String!
    totalValue: Float!
    totalShares: Int
  }

  input PurchasePropertySharesInput {
    propertyId: String!
    buyerId: String!
    sharesToBuy: Int!
  }

  input EnableTenantTransitionInput {
    propertyId: String!
    tenantId: String!
    monthlyAccumulation: Float
  }

  input InitializeLoyaltyInput {
    userId: String!
    propertyId: String!
    contractDuration: Int!
  }

  input UpdateLoyaltyInput {
    userId: String!
    propertyId: String!
    actionType: ActionType!
    referenceId: String
  }

  input ProcessReferralInput {
    referralCode: String!
    newUserId: String!
  }

  input CreateRiskAssessmentInput {
    userId: String!
    propertyId: String!
    walletAddress: String!
  }

  input SubmitInsuranceClaimInput {
    claimantId: String!
    claimType: ClaimType!
    amount: Float!
    description: String!
    evidence: [String!]!
    propertyId: String
  }

  input VoteOnInsuranceClaimInput {
    claimId: String!
    voterId: String!
    vote: ClaimVoteChoice!
    reason: String
  }

  # ========== QUERIES ==========

  type Query {
    # Crypto Payments
    getCryptoPayment(paymentId: String!): CryptoPayment
    getUserCryptoPayments(userId: String!, filters: CryptoFiltersInput): CryptoPaymentList!
    getPropertyCryptoPayments(propertyId: String!): [CryptoPayment!]!

    # Property Tokens
    getPropertyToken(tokenId: String!): PropertyToken
    getPropertyTokens(filters: PropertyTokenFiltersInput): [PropertyToken!]!
    getUserPropertyTokens(userId: String!): [UserPropertyToken!]!

    # Utility Tokens
    getUtilityToken(tokenId: String!): UtilityToken
    getUserUtilityTokens(userId: String!): [UserUtilityToken!]!
    getUtilityTokenProposals(tokenId: String!): [Proposal!]!

    # Smart Contracts
    getSmartContract(contractId: String!): SmartContract
    getPropertyContracts(propertyId: String!): [SmartContract!]!
    getUserContracts(userId: String!): [SmartContract!]!

    # Marketplace
    getMarketplaceListings(filters: MarketplaceFiltersInput): [MarketplaceListing!]!
    getUserTradingHistory(userId: String!): [TradingHistory!]!
    getMarketplaceListing(listingId: String!): MarketplaceListing

    # DeFi
    getYieldFarmingPools: [YieldFarmingPool!]!
    getLendingPools: [LendingPool!]!
    getUserDeFiPositions(userId: String!): UserDeFiSummary!

    # Price Data
    getCryptoPrices(symbols: [String!]!): [PriceData!]!
    getExchangeRate(from: String!, to: String!): ExchangeRate!
    getMarketIndicators: MarketIndicators!
    getHistoricalData(symbol: String!, period: String!): [HistoricalDataPoint!]!
    getPropertyValuation(propertyId: String!, location: String!): Float!

    # Analytics
    getCryptoAnalytics(userId: String!): CryptoAnalytics!

    # New DeFi Queries
    getDynamicPricing(propertyId: String!): DynamicPricing
    getMultiAssetStaking(propertyId: String!): MultiAssetStaking
    getFractionalOwnership(propertyId: String!): FractionalOwnership
    getLoyaltyMining(userId: String!, propertyId: String): LoyaltyMining
    getAIRiskAssessment(userId: String!, propertyId: String): AIRiskAssessment
    getInsuranceDAO: InsuranceDAO
    getInsuranceClaims(userId: String): [InsuranceClaim!]!
    getUserLoyaltyPrograms(userId: String!): [LoyaltyMining!]!
    getPropertyStakingPerformance(propertyId: String!): [PerformanceHistory!]!
    getUserRiskAssessments(userId: String!): [AIRiskAssessment!]!
    getInsuranceStatistics: InsuranceStatistics!
  }

  # ========== MUTATIONS ==========

  type Mutation {
    # Crypto Payments
    createCryptoPayment(input: CreateCryptoPaymentInput!): CryptoPayment!
    processCryptoPayment(paymentId: String!, transactionHash: String!): CryptoPayment!
    confirmCryptoPayment(paymentId: String!, confirmations: Int!, blockHeight: Int): CryptoPayment!
    refundCryptoPayment(paymentId: String!, reason: String!): CryptoPayment!
    releaseEscrow(paymentId: String!, releasedBy: String!): CryptoPayment!

    # Property Tokens
    tokenizeProperty(input: TokenizePropertyInput!): PropertyToken!
    buyPropertyTokens(input: BuyTokensInput!): TokenPurchaseResult!
    sellPropertyTokens(input: SellTokensInput!): TokenSaleResult!
    distributeRevenue(propertyTokenId: String!, totalRevenue: Float!, period: String!): Boolean!

    # Utility Tokens
    createUtilityToken(input: CreateUtilityTokenInput!): UtilityToken!
    mintUtilityTokens(tokenId: String!, recipient: String!, amount: Float!, reason: String!): Boolean!
    stakeUtilityTokens(input: StakeTokensInput!): Boolean!
    claimStakingRewards(userId: String!, tokenId: String!): Float!

    # Governance
    createGovernanceProposal(input: CreateProposalInput!): String!
    voteOnProposal(userId: String!, tokenId: String!, proposalId: String!, vote: VoteChoice!): Boolean!

    # Marketplace
    listTokensForSale(input: ListTokenInput!): String!
    placeBid(input: PlaceBidInput!): Boolean!
    acceptBid(sellerId: String!, listingId: String!, bidId: String!): Boolean!
    cancelListing(sellerId: String!, listingId: String!): Boolean!

    # DeFi
    stakeInYieldFarm(input: YieldFarmingStakeInput!): Boolean!
    claimYieldFarmingRewards(userId: String!, poolId: String!): Float!
    supplyToLendingPool(input: LendingActionInput!): Boolean!
    borrowFromLendingPool(input: LendingActionInput!): Boolean!
    repayLoan(userId: String!, positionId: String!, amount: Float!): Boolean!
    liquidatePosition(liquidatorId: String!, positionId: String!): Boolean!

    # Price Alerts
    subscribeToPriceAlerts(userId: String!, alerts: [PriceAlertInput!]!): Boolean!

    # New DeFi Mutations
    setupDynamicPricing(input: SetupDynamicPricingInput!): DynamicPricing!
    updateRentPricing(input: UpdateRentPricingInput!): DynamicPricing!
    processRentPayment(input: ProcessRentPaymentInput!): RentPaymentResult!
    setupMultiAssetStaking(input: SetupMultiAssetStakingInput!): MultiAssetStaking!
    rebalancePortfolio(propertyId: String!): Boolean!
    tokenizePropertyAdvanced(input: TokenizePropertyInput2!): PropertyTokenizationResult!
    purchasePropertyShares(input: PurchasePropertySharesInput!): Boolean!
    enableTenantTransition(input: EnableTenantTransitionInput!): Boolean!
    initializeLoyalty(input: InitializeLoyaltyInput!): LoyaltyMining!
    updateLoyalty(input: UpdateLoyaltyInput!): LoyaltyUpdateResult!
    processReferral(input: ProcessReferralInput!): ReferralResult!
    createRiskAssessment(input: CreateRiskAssessmentInput!): AIRiskAssessment!
    updateRiskAssessment(userId: String!, propertyId: String!): AIRiskAssessment!
    submitInsuranceClaim(input: SubmitInsuranceClaimInput!): String!
    voteOnInsuranceClaim(input: VoteOnInsuranceClaimInput!): Boolean!
  }

  # ========== RESPONSE TYPES ==========

  type CryptoPaymentList {
    payments: [CryptoPayment!]!
    total: Int!
    hasMore: Boolean!
  }

  type UserPropertyToken {
    propertyToken: PropertyToken!
    tokensOwned: Float!
    ownershipPercentage: Float!
    investmentAmount: Float!
    currentValue: Float!
    unrealizedGains: Float!
  }

  type UserUtilityToken {
    token: UtilityTokenInfo!
    balance: Float!
    stakedBalance: Float!
    pendingRewards: Float!
    totalValue: Float!
  }

  type UtilityTokenInfo {
    tokenId: String!
    name: String!
    symbol: String!
    currentPrice: Float!
  }

  type TokenPurchaseResult {
    success: Boolean!
    transactionHash: String!
    tokensOwned: Float!
    totalCost: Float!
    newOwnershipPercentage: Float!
  }

  type TokenSaleResult {
    success: Boolean!
    orderId: String!
    orderType: OrderType!
    status: String!
  }

  type CryptoAnalytics {
    totalPortfolioValue: Float!
    totalPayments: Int!
    totalRevenue: Float!
    activeTokens: Int!
    stakingRewards: Float!
    portfolioBreakdown: [PortfolioItem!]!
  }

  type PortfolioItem {
    type: String!
    name: String!
    value: Float!
    percentage: Float!
  }

  input SellTokensInput {
    propertyTokenId: String!
    sellerId: String!
    tokensAmount: Float!
    pricePerToken: Float
    orderType: OrderType!
  }

  input PriceAlertInput {
    symbol: String!
    targetPrice: Float!
    condition: String!
    frequency: String!
  }

  # New DeFi Response Types
  type RentPaymentResult {
    success: Boolean!
    originalRent: Float!
    adjustedRent: Float!
    discountApplied: Float!
    yieldGenerated: Float!
    loyaltyPointsEarned: Int!
    tokensAwarded: Float!
    nextPaymentDue: String!
  }

  type PropertyTokenizationResult {
    success: Boolean!
    totalShares: Int!
    sharePrice: Float!
    availableShares: Int!
    daoEnabled: Boolean!
    revenueSharing: Boolean!
  }

  type LoyaltyUpdateResult {
    pointsEarned: Int!
    tokensAwarded: Float!
  }

  type ReferralResult {
    success: Boolean!
    bonusPoints: Int!
  }

  # ========== SUBSCRIPTIONS ==========

  type Subscription {
    cryptoPaymentUpdates(userId: String!): CryptoPayment!
    priceUpdates(symbols: [String!]!): PriceData!
    tokenTransfers(tokenId: String!): TokenTransaction!
    governanceUpdates(tokenId: String!): Proposal!
    marketplaceUpdates: MarketplaceListing!
    deFiPositionUpdates(userId: String!): DeFiPosition!
  }

  # ========== CUSTOM SCALARS ==========

  scalar JSON
`;

export default cryptoTypeDefs;