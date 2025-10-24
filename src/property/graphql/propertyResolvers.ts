import Property from '../model/propertyModel';
import User from '../../users/models/userModel';
import Activity from '../../activity/model/activitySchema';
import { Service } from '../../service-marketplace/models/Service';
import { RecommendationEngine } from '../../service-marketplace/services/RecommendationEngine';
import PropertyServices from '../proprityServices/proprityServices';
import Conversation from '../../chat/model/conversationModel';
import { Transaction } from '../../wallet/models/Transaction';
import { PropertyType } from '../types/propertyType';

// type SimilarPropertyResult =
//   | PropertyType[]                      
//   | { properties: PropertyType[] };    

export const propertyResolvers = {
  Query: {
    property: async (_: any, { id }: any, { user }: any) => {
      try {
        const propertyService = new PropertyServices();
        const property = await propertyService.finPropertyById(id);

        if (!property) throw new Error('Property not found');

        return property;
      } catch (error: any) {
        throw new Error(`Error fetching property: ${error.message}`);
      }
    },
    
    properties: async (_: any, { filters, pagination }: any) => {
      try {
        const propertyService = new PropertyServices();
        const result: any = await propertyService.getProperty({
          ...filters,
          ...pagination
        });

        const properties = Array.isArray(result) ? result : (result?.properties || []);
        const edges = properties.map((property: any, index: number) => ({
          node: property,
          cursor: Buffer.from(((pagination?.page || 1) * (pagination?.limit || 10) + index).toString()).toString('base64')
        }));

        return {
          edges,
          pageInfo: {
            hasNextPage: result?.page < result?.totalPages || false,
            hasPreviousPage: result?.page > 1 || false,
            startCursor: edges[0]?.cursor,
            endCursor: edges[edges.length - 1]?.cursor
          },
          totalCount: result?.total || properties.length
        };
      } catch (error: any) {
        throw new Error(`Error fetching properties: ${error.message}`);
      }
    },
    
    searchProperties: async (_: any, { query, filters, pagination }: any) => {
      try {
        const propertyService = new PropertyServices();

        if (query) {
          const result: any = await propertyService.searchProperty({
            q: query,
            pagination
          });

          const properties = Array.isArray(result) ? result : (result?.properties || []);
          const edges = properties.map((property: any, index: number) => ({
            node: property,
            cursor: Buffer.from(((pagination?.page || 1) * (pagination?.limit || 10) + index).toString()).toString('base64')
          }));

          return {
            edges,
            pageInfo: {
              hasNextPage: result?.page < result?.totalPages || false,
              hasPreviousPage: result?.page > 1 || false,
              startCursor: edges[0]?.cursor,
              endCursor: edges[edges.length - 1]?.cursor
            },
            totalCount: result?.total || properties.length
          };
        }

        const result = await propertyService.getProperty({
          ...filters,
          ...pagination
        });
        
        return result;
      } catch (error: any) {
        throw new Error(`Error searching properties: ${error.message}`);
      }
    },
    
    similarProperties: async (_: any, { propertyId, limit }: any) => {
      try {
        const propertyService = new PropertyServices();
        const result = await propertyService.getSImilarProperty({
          propertyId,
          pagination: { limit: limit || 5 }
        }) as any

        return Array.isArray(result) ? result : (result?.properties || []);
      } catch (error: any) {
        throw new Error(`Error fetching similar properties: ${error.message}`);
      }
    },
    
    propertyStats: async (_: any, __: any, { user }: any) => {
      try {
        if (!user) throw new Error('Authentication required');

        const propertyService = new PropertyServices();
        const stats = await propertyService.getPropertyState();

        if (!stats) throw new Error('Statistics not available');

        return stats;
      } catch (error: any) {
        throw new Error(`Error fetching property stats: ${error.message}`);
      }
    },
    
    propertiesByOwner: async (_: any, { ownerId, pagination, status }: any, { user }: any) => {
      try {
        if (!user) throw new Error('Authentication required');

        const propertyService = new PropertyServices();
        const result: any = await propertyService.getPropertyByOwner({
          ownerId: ownerId || user.userId,
          pagination,
          status
        });

        const properties = Array.isArray(result) ? result : (result?.properties || []);
        const edges = properties.map((property: any, index: number) => ({
          node: property,
          cursor: Buffer.from(((pagination?.page || 1) * (pagination?.limit || 10) + index).toString()).toString('base64')
        }));

        return {
          edges,
          pageInfo: {
            hasNextPage: result?.page < result?.totalPages || false,
            hasPreviousPage: result?.page > 1 || false,
            startCursor: edges[0]?.cursor,
            endCursor: edges[edges.length - 1]?.cursor
          },
          totalCount: result?.total || properties.length
        };
      } catch (error: any) {
        throw new Error(`Error fetching properties by owner: ${error.message}`);
      }
    }
  },

  Mutation: {
    createProperty: async (_: any, { input }: any, { user }: any) => {
      try {
        if (!user) throw new Error('Authentication required');

        // Transform images from strings to proper format if needed
        if (input.images && Array.isArray(input.images) && input.images.length > 0) {
          input.images = input.images.map((img: any, index: number) => {
            if (typeof img === 'string') {
              // Create a temporary image object for simple string URLs
              return {
                publicId: `temp_${Date.now()}_${index}`,
                originalUrl: img,
                variants: {
                  thumbnail: img,
                  small: img,
                  medium: img,
                  large: img,
                  original: img
                },
                metadata: {
                  width: 800,
                  height: 600,
                  format: 'jpg',
                  size: 0,
                  aspectRatio: 1.33
                },
                uploadedAt: new Date(),
                order: index
              };
            }
            return img;
          });
        }

        // Remove services if not provided
        if (!input.services || !input.services.serviceId) {
          delete input.services;
        }

        const propertyService = new PropertyServices();
        const property = await propertyService.createProperty(
          input,
          user.userId
        );

        if (!property) throw new Error('Failed to create property');

        // Transform images back to strings for GraphQL response
        const propertyResponse = (property as any).toObject ? (property as any).toObject() : property;
        if (propertyResponse.images && Array.isArray(propertyResponse.images)) {
          propertyResponse.images = propertyResponse.images.map((img: any) => {
            if (typeof img === 'object' && img.originalUrl) {
              return img.originalUrl;
            }
            return img;
          });
        }

        return propertyResponse;
      } catch (error: any) {
        throw new Error(`Error creating property: ${error.message}`);
      }
    },
    
    updateProperty: async (_: any, { id, input }: any, { user }: any) => {
      try {
        if (!user) throw new Error('Authentication required');

        const property = await Property.findOne({ _id: id, ownerId: user.userId });
        if (!property) throw new Error('Property not found or unauthorized');

        const propertyService = new PropertyServices();
        const updatedProperty = await propertyService.updateProperty({
          propertyId: id,
          data: input
        });

        if (!updatedProperty) throw new Error('Failed to update property');

        return updatedProperty;
      } catch (error: any) {
        throw new Error(`Error updating property: ${error.message}`);
      }
    },
    
    deleteProperty: async (_: any, { id }: any, { user }: any) => {
      try {
        if (!user) throw new Error('Authentication required');

        const property = await Property.findById(id);
        if (!property || property.ownerId.toString() !== user.userId) {
          throw new Error('Property not found or unauthorized');
        }

        const propertyService = new PropertyServices();
        const result = await propertyService.deleteProperty(id);

        return !!result;
      } catch (error: any) {
        throw new Error(`Error deleting property: ${error.message}`);
      }
    },
    
    restoreProperty: async (_: any, { id }: any, { user }: any) => {
      try {
        if (!user) throw new Error('Authentication required');

        const property = await Property.findById(id);
        if (!property || property.ownerId.toString() !== user.userId) {
          throw new Error('Property not found or unauthorized');
        }

        const propertyService = new PropertyServices();
        const result = await propertyService.restoreProperty(id);

        if (!result) throw new Error('Failed to restore property');

        return await Property.findById(id);
      } catch (error: any) {
        throw new Error(`Error restoring property: ${error.message}`);
      }
    },

    updatePropertyStatus: async (_: any, { id, status }: any, { user }: any) => {
      try {
        if (!user) throw new Error('Authentication required');

        const property = await Property.findOne({ _id: id, ownerId: user.userId });
        if (!property) throw new Error('Property not found or unauthorized');

        property.status = status;
        await property.save();

        return property;
      } catch (error: any) {
        throw new Error(`Error updating property status: ${error.message}`);
      }
    }
  },

  Property: {
    // Map MongoDB _id to GraphQL id
    id: (property: any) => {
      return property._id?.toString() || property.id?.toString() || null;
    },

    // Extract ID from ownerId if it's populated
    ownerId: (property: any) => {
      if (property.ownerId) {
        // If it's an object (populated), return the _id
        if (typeof property.ownerId === 'object' && property.ownerId._id) {
          return property.ownerId._id.toString();
        }
        // If it's already a string/ObjectId, return it
        return property.ownerId.toString();
      }
      return null;
    },

    // Transform image objects to strings for GraphQL
    images: (property: any) => {
      if (property.images && Array.isArray(property.images)) {
        return property.images.map((img: any) => {
          if (typeof img === 'object' && img.originalUrl) {
            return img.originalUrl;
          }
          return img;
        });
      }
      return property.images || [];
    },

    // Map old status values to GraphQL enum
    status: (property: any) => {
      const statusMap: Record<string, string> = {
        'disponible': 'AVAILABLE',
        'loué': 'RENTED',
        'louée': 'RENTED',
        'maintenance': 'MAINTENANCE',
        'indisponible': 'UNAVAILABLE'
      };

      const status = property.status || 'AVAILABLE';
      return statusMap[status.toLowerCase()] || status.toUpperCase();
    },

    owner: async (property: any) => {
      return await User.findById(property.ownerId);
    },
    
    activities: async (property: any) => {
      return await Activity.find({ propertyId: property._id }).sort({ createdAt: -1 });
    },
    
    services: async (property: any) => {
      try {
        return await Service.find({ 
          'availability.zones': property.generalHInfo?.area,
          'requirements.propertyTypes': property.propertyType,
          status: 'active'
        });
      } catch (error) {
        return [];
      }
    },
    
    conversations: async (property: any) => {
      return await Conversation.find({ propertyId: property._id })
        .populate('participants', 'firstName lastName profilePicture')
        .sort({ updatedAt: -1 })
        .limit(10);
    },
    
    recentActivities: async (property: any) => {
      return await Activity.find({ propertyId: property._id })
        .populate('clientId', 'firstName lastName profilePicture email')
        .sort({ createdAt: -1 })
        .limit(20);
    },
    
    financialStats: async (property: any) => {
      const transactions = await Transaction.find({
        'metadata.propertyId': property._id.toString()
      });
      
      const totalRevenue = transactions
        .filter(t => t.type === 'received')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpenses = transactions
        .filter(t => t.type === 'payment')
        .reduce((sum, t) => sum + t.amount, 0);
      
      return {
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        transactionCount: transactions.length,
        averageMonthlyRevenue: totalRevenue / 12
      };
    },
    
    similarProperties: async (property: any) => {
      const propertyService = new PropertyServices();
      return await propertyService.getSImilarProperty({
        propertyId: property._id.toString(),
        pagination: { limit: 5 }
      });
    },
    
    occupancyRate: async (property: any) => {
      const totalDays = 365;
      const rentedDays = await Activity.countDocuments({
        propertyId: property._id,
        isReservationAccepted: true,
        createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
      }) * 30;
      
      return Math.min(100, (rentedDays / totalDays) * 100);
    },
    
    performanceScore: async (property: any) => {
      const activities = await Activity.find({ propertyId: property._id });
      const totalActivities = activities.length;
      const acceptedActivities = activities.filter(a =>
        a.isReservationAccepted || a.isVisitAccepted
      ).length;
      
      if (totalActivities === 0) return 0;
      
      const acceptanceRate = (acceptedActivities / totalActivities) * 100;
      const priceCompetitiveness = 75;
      const responseTime = 85;
      
      return Math.round((acceptanceRate + priceCompetitiveness + responseTime) / 3);
    },
    
    reviews: async (property: any) => {
      const activities = await Activity.find({
        propertyId: property._id,
        isReservationAccepted: true
      }).populate('clientId', 'firstName lastName');
      
      return activities.slice(0, 10).map(activity => ({
        id: activity._id,
        rating: Math.floor(Math.random() * 2) + 4,
        comment: `Excellent séjour dans cette propriété. ${activity.message}`,
        reviewer: activity.clientId,
        date: activity.createdAt
      }));
    },
    
    marketAnalysis: async (property: any) => {
      try {
        const similarProperties = await Property.find({
          'generalHInfo.area': property.generalHInfo?.area,
          propertyType: property.propertyType,
          isActive: true,
          _id: { $ne: property._id }
        });
        
        if (similarProperties.length === 0) {
          return {
            averageMarketPrice: 0,
            pricePosition: 'unknown',
            priceDifference: 0,
            pricePercentage: 0,
            competitorCount: 0,
            marketTrend: 'stable'
          };
        }
        
        const averagePrice = similarProperties.reduce(
          (sum, p) => sum + (p.ownerCriteria?.monthlyRent || 0), 0
        ) / similarProperties.length;
        
        const propertyPrice = property.ownerCriteria?.monthlyRent || 0;
        const pricePosition = propertyPrice > averagePrice ? 'above' : 'below';
        const priceDifference = Math.abs(propertyPrice - averagePrice);
        const pricePercentage = averagePrice > 0 ? (priceDifference / averagePrice) * 100 : 0;
        
        return {
          averageMarketPrice: averagePrice,
          pricePosition,
          priceDifference,
          pricePercentage: Math.round(pricePercentage),
          competitorCount: similarProperties.length,
          marketTrend: 'stable'
        };
      } catch (error) {
        return {
          averageMarketPrice: 0,
          pricePosition: 'unknown',
          priceDifference: 0,
          pricePercentage: 0,
          competitorCount: 0,
          marketTrend: 'stable'
        };
      }
    },
    
    pricePerSquareMeter: (property: any) => {
      const surface = property.generalHInfo?.surface || 0;
      const rent = property.ownerCriteria?.monthlyRent || 0;
      return surface > 0 ? rent / surface : 0;
    },
    
    isAvailable: (property: any) => {
      return property.status === 'AVAILABLE' && property.isActive;
    },
    
    recommendedServices: async (property: any) => {
      try {
        const recommendationEngine = new RecommendationEngine();
        
        const recommendations = await recommendationEngine.getRecommendations({
          propertyType: property.propertyType || 'apartment',
          location: {
            city: property.generalHInfo?.area || 'Unknown',
            district: property.generalHInfo?.area || 'Unknown',
            coordinates: [0, 0]
          },
          userProfile: {
            userId: property.ownerId?.toString() || '',
            preferences: ['maintenance', 'security'],
            budget: (property.ownerCriteria?.monthlyRent || 0) * 0.1,
            lifestyle: ['property_owner']
          },
          servicesAlreadySubscribed: []
        });
        
        return recommendations || [];
      } catch (error) {
        return [];
      }
    }
  },

  PropertyStats: {
    totalProperties: (stats) => stats.totalProperties || 0,
    availableProperties: (stats) => stats.availableProperties || 0,
    rentedProperties: (stats) => stats.rentedProperties || 0,
    averageRent: (stats) => stats.averageRent || 0,
    averageSize: (stats) => stats.averageSize || 0,
    propertiesByArea: (stats) => stats.propertiesByArea || [],
    propertiesByStatus: (stats) => stats.propertiesByStatus || []
  },
  
  PropertyFinancialStats: {
    totalRevenue: (stats) => stats.totalRevenue || 0,
    totalExpenses: (stats) => stats.totalExpenses || 0,
    netIncome: (stats) => stats.netIncome || 0,
    transactionCount: (stats) => stats.transactionCount || 0,
    averageMonthlyRevenue: (stats) => stats.averageMonthlyRevenue || 0
  },
  
  PropertyMarketAnalysis: {
    averageMarketPrice: (analysis) => analysis.averageMarketPrice || 0,
    pricePosition: (analysis) => analysis.pricePosition || 'unknown',
    priceDifference: (analysis) => analysis.priceDifference || 0,
    pricePercentage: (analysis) => analysis.pricePercentage || 0,
    competitorCount: (analysis) => analysis.competitorCount || 0,
    marketTrend: (analysis) => analysis.marketTrend || 'stable'
  }
};