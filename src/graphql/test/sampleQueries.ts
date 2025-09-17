// Requêtes de test pour vérifier le bon fonctionnement de GraphQL

export const TEST_QUERIES = {
  // Test Property avec toutes les relations
  PROPERTY_COMPLETE: `
    query PropertyComplete($id: ID!) {
      property(id: $id) {
        id
        title
        description
        address
        propertyType
        status
        images
        
        # Propriétaire
        owner {
          id
          fullName
          profilePicture
          email
        }
        
        # Activités récentes
        activities {
          id
          type
          status
          client {
            fullName
            profilePicture
          }
          createdAt
        }
        
        # Services recommandés
        recommendedServices {
          service {
            id
            title
            category
            provider {
              companyName
              rating
            }
          }
          score
          reason
          urgency
        }
        
        # Statistiques financières
        financialStats {
          totalRevenue
          totalExpenses
          netIncome
          averageMonthlyRevenue
        }
        
        # Analyse de marché
        marketAnalysis {
          averageMarketPrice
          pricePosition
          competitorCount
          marketTrend
        }
        
        # Métriques
        pricePerSquareMeter
        occupancyRate
        performanceScore
        isAvailable
      }
    }
  `,

  // Test Service Marketplace
  SERVICE_MARKETPLACE: `
    query ServiceMarketplace($filters: ServiceFilters) {
      services(filters: $filters) {
        edges {
          node {
            id
            title
            category
            rating
            totalReviews
            
            provider {
              companyName
              isVerified
              rating
            }
            
            pricing {
              basePrice
              currency
              billingPeriod
            }
            
            # Prix adaptatif
            estimatedPrice(propertyType: VILLA)
          }
        }
      }
      
      # Recommandations personnalisées
      serviceRecommendations(input: {
        propertyType: VILLA
        location: { city: "Paris", district: "Centre" }
        userProfile: { 
          preferences: ["eco", "tech"]
          budget: 500
          lifestyle: ["busy"]
        }
        servicesAlreadySubscribed: []
      }) {
        service {
          title
          category
        }
        score
        reason
        neighborhoodData {
          totalUsers
          averageRating
        }
      }
    }
  `,

  // Test Wallet avec relations
  WALLET_DASHBOARD: `
    query WalletDashboard {
      wallet {
        balance
        pendingBalance
        currency
        
        cryptoBalances {
          currency
          amount
          value
        }
        
        transactions(limit: 10) {
          id
          type
          amount
          description
          status
          createdAt
          
          # Relations intelligentes
          relatedProperty {
            title
            address
          }
          
          relatedService {
            title
            category
          }
          
          recipient {
            fullName
          }
        }
        
        paymentMethods {
          id
          type
          name
          isDefault
        }
      }
    }
  `
};

export const TEST_VARIABLES = {
  propertyId: "507f1f77bcf86cd799439011",
  userId: "507f1f77bcf86cd799439012",
  conversationId: "507f1f77bcf86cd799439013"
};