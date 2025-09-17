// Requêtes GraphQL optimisées pour les cas d'usage critiques

export const PROPERTY_DETAILS_QUERY = `
  query PropertyDetails($id: ID!) {
    property(id: $id) {
      id
      title
      description
      address
      propertyType
      actionType
      status
      images
      availableFrom
      
      generalHInfo {
        rooms
        bedrooms
        bathrooms
        surface
        area
        furnished
        pets
        maxOccupants
      }
      
      ownerCriteria {
        monthlyRent
        depositAmount
        minimumDuration
        guarantorRequired
      }
      
      owner {
        id
        fullName
        profilePicture
        email
        phoneNumber
      }
      
      activities(first: 10) {
        edges {
          node {
            id
            isVisited
            visitDate
            isReservation
            message
            client {
              id
              fullName
              profilePicture
            }
          }
        }
      }
      
      recommendedServices {
        service {
          id
          title
          category
          pricing {
            basePrice
            currency
            billingPeriod
          }
          provider {
            companyName
            rating
            isVerified
          }
        }
        score
        reason
        urgency
        estimatedPrice
      }
      
      pricePerSquareMeter
      isAvailable
    }
  }
`;

export const SERVICE_MARKETPLACE_QUERY = `
  query ServiceMarketplace($filters: ServiceFilters, $pagination: PaginationInput) {
    services(filters: $filters, pagination: $pagination) {
      edges {
        node {
          id
          title
          description
          category
          contractTypes
          status
          rating
          totalReviews
          
          pricing {
            basePrice
            currency
            billingPeriod
            discounts {
              longTerm
              seasonal
            }
          }
          
          provider {
            id
            companyName
            rating
            isVerified
            availableZones
          }
          
          media {
            photos
          }
          
          requirements {
            propertyTypes
            isMandatory
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const WALLET_DASHBOARD_QUERY = `
  query WalletDashboard {
    wallet {
      id
      balance
      pendingBalance
      currency
      
      cryptoBalances {
        currency
        amount
        value
      }
      
      transactions(limit: 20) {
        id
        type
        amount
        currency
        description
        status
        createdAt
        
        recipient {
          id
          fullName
        }
        
        relatedProperty {
          id
          title
          address
        }
        
        relatedService {
          id
          title
          category
        }
      }
      
      paymentMethods {
        id
        type
        name
        isDefault
        isActive
      }
    }
    
    me {
      id
      fullName
      serviceSubscriptions {
        id
        status
        startDate
        endDate
        
        service {
          id
          title
          category
        }
        
        pricing {
          amount
          currency
          billingPeriod
        }
      }
    }
  }
`;

export const CHAT_CONVERSATION_QUERY = `
  query ChatConversation($conversationId: ID!, $messageLimit: Int = 50) {
    conversation(id: $conversationId) {
      id
      
      participants {
        id
        fullName
        profilePicture
        presenceStatus
      }
      
      property {
        id
        title
        address
        images
        ownerCriteria {
          monthlyRent
        }
      }
      
      messages(limit: $messageLimit) {
        id
        content
        messageType
        createdAt
        
        sender {
          id
          fullName
          profilePicture
        }
        
        replyTo {
          id
          content
          sender {
            fullName
          }
        }
        
        property {
          id
          title
          images
        }
        
        aiInsights {
          sentiment {
            score
            label
          }
          intentDetection
          priority
        }
      }
      
      unreadCount(userId: $userId)
    }
  }
`;

export const ACTIVITY_MANAGEMENT_QUERY = `
  query ActivityManagement($propertyId: ID, $userId: ID, $pagination: PaginationInput) {
    activities(propertyId: $propertyId, userId: $userId, pagination: $pagination) {
      edges {
        node {
          id
          isVisited
          visitDate
          isVisiteAcccepted
          isReservation
          reservationDate
          isReservationAccepted
          booking
          isBookingAccepted
          isPayment
          amount
          message
          
          property {
            id
            title
            address
            images
            ownerCriteria {
              monthlyRent
            }
            owner {
              id
              fullName
              profilePicture
            }
          }
          
          client {
            id
            fullName
            profilePicture
            email
            phoneNumber
          }
          
          uploadedFiles {
            fileName
            fileUrl
            uploadedAt
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
      totalCount
    }
  }
`;

export const SERVICE_RECOMMENDATIONS_QUERY = `
  query ServiceRecommendations($input: RecommendationInput!) {
    serviceRecommendations(input: $input) {
      service {
        id
        title
        description
        category
        
        pricing {
          basePrice
          currency
          billingPeriod
        }
        
        provider {
          companyName
          rating
          isVerified
        }
        
        media {
          photos
        }
      }
      
      score
      reason
      urgency
      estimatedPrice
      
      neighborhoodData {
        popularServices
        averageRating
        totalUsers
      }
    }
  }
`;

// Mutations optimisées
export const CREATE_PROPERTY_MUTATION = `
  mutation CreateProperty($input: CreatePropertyInput!) {
    createProperty(input: $input) {
      id
      title
      description
      address
      propertyType
      actionType
      status
      images
      
      generalHInfo {
        rooms
        bedrooms
        bathrooms
        surface
        area
      }
      
      ownerCriteria {
        monthlyRent
        depositAmount
      }
      
      owner {
        id
        fullName
      }
    }
  }
`;

export const SUBSCRIBE_TO_SERVICE_MUTATION = `
  mutation SubscribeToService($input: SubscribeServiceInput!) {
    subscribeToService(input: $input) {
      id
      contractType
      status
      startDate
      endDate
      autoRenewal
      
      service {
        id
        title
        category
        provider {
          companyName
        }
      }
      
      pricing {
        amount
        currency
        billingPeriod
      }
    }
  }
`;

export const SEND_MESSAGE_MUTATION = `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      content
      messageType
      createdAt
      
      sender {
        id
        fullName
        profilePicture
      }
      
      conversation {
        id
      }
      
      property {
        id
        title
      }
    }
  }
`;

// Subscriptions pour le temps réel
export const MESSAGE_ADDED_SUBSCRIPTION = `
  subscription MessageAdded($conversationId: ID!) {
    messageAdded(conversationId: $conversationId) {
      id
      content
      messageType
      createdAt
      
      sender {
        id
        fullName
        profilePicture
      }
      
      aiInsights {
        sentiment {
          score
          label
        }
        priority
      }
    }
  }
`;

export const WALLET_UPDATED_SUBSCRIPTION = `
  subscription WalletUpdated($userId: ID!) {
    walletUpdated(userId: $userId) {
      wallet {
        balance
        pendingBalance
      }
      transaction {
        id
        type
        amount
        description
      }
      type
    }
  }
`;