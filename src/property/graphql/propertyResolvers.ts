import Property from '../model/propertyModel';
import User from '../../users/models/userModel';
import Activity from '../../activity/model/activitySchema';
import { Service } from '../../service-marketplace/models/Service';
import { RecommendationEngine } from '../../service-marketplace/services/RecommendationEngine';
import PropertyServices from '../proprityServices/proprityServices';
import Conversation from '../../chat/model/conversationModel';
import { Transaction } from '../../wallet/models/Transaction';

export const propertyResolvers = {
  Query: {
    property: async (_, { id }, { user }) => {
      const propertyService = new PropertyServices();
      const property = await propertyService.finPropertyById(id);
      
      if (!property) throw new Error('Property not found');
      
      return property;
    },
    
    properties: async (_, { filters, pagination }) => {
      const propertyService = new PropertyServices();
      const result = await propertyService.getProperty({
        ...filters,
        ...pagination
      });
      
      if (!result) return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false }, totalCount: 0 };
      
      const edges = result.properties.map((property, index) => ({
        node: property,
        cursor: Buffer.from((pagination?.page || 1 * index).toString()).toString('base64')
      }));
      
      return {
        edges,
        pageInfo: {
          hasNextPage: result.page < result.totalPages,
          hasPreviousPage: result.page > 1,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor
        },
        totalCount: result.total
      };
    },
    
    searchProperties: async (_, { query, filters, pagination }) => {
      const propertyService = new PropertyServices();
      
      if (query) {
        return await propertyService.searchProperty({
          q: query,
          pagination
        });
      }
      
      return await propertyService.getProperty({
        ...filters,
        ...pagination
      });
    },
    
    similarProperties: async (_, { propertyId, limit }) => {
      const propertyService = new PropertyServices();
      return await propertyService.getSImilarProperty({
        propertyId,
        pagination: { limit: limit || 5 }
      });
    },
    
    propertyStats: async (_, __, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const propertyService = new PropertyServices();
      return await propertyService.getPropertyState();
    },
    
    propertiesByOwner: async (_, { ownerId, pagination, status }, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const propertyService = new PropertyServices();
      return await propertyService.getPropertyByOwner({
        ownerId: ownerId || user.userId,
        pagination,
        status
      });
    }
  },

  Mutation: {
    createProperty: async (_, { input }, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const propertyService = new PropertyServices();
      return await propertyService.createProperty({
        ...input,
        ownerId: user.userId
      });
    },
    
    updateProperty: async (_, { id, input }, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const property = await Property.findOne({ _id: id, ownerId: user.userId });
      if (!property) throw new Error('Property not found or unauthorized');
      
      const propertyService = new PropertyServices();
      return await propertyService.updateProperty({
        propertyId: id,
        data: input
      });
    },
    
    deleteProperty: async (_, { id }, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const property = await Property.findById(id);
      if (!property || property.ownerId.toString() !== user.userId) {
        throw new Error('Property not found or unauthorized');
      }
      
      const propertyService = new PropertyServices();
      await propertyService.deleteProperty(id);
      return true;
    },
    
    restoreProperty: async (_, { id }, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const property = await Property.findById(id);
      if (!property || property.ownerId.toString() !== user.userId) {
        throw new Error('Property not found or unauthorized');
      }
      
      const propertyService = new PropertyServices();
      await propertyService.restoreProperty(id);
      return await Property.findById(id);
    }
  },

  Property: {
    owner: async (property) => {
      return await User.findById(property.ownerId);
    },
    
    activities: async (property) => {
      return await Activity.find({ propertyId: property._id }).sort({ createdAt: -1 });
    },
    
    services: async (property) => {
      return await Service.find({ 
        'availability.zones': property.generalHInfo.area,
        'requirements.propertyTypes': property.propertyType,
        status: 'active'
      });
    },
    
    conversations: async (property) => {
      return await Conversation.find({ propertyId: property._id })
        .populate('participants', 'firstName lastName profilePicture')
        .sort({ updatedAt: -1 })
        .limit(10);
    },
    
    recentActivities: async (property) => {
      return await Activity.find({ propertyId: property._id })
        .populate('clientId', 'firstName lastName profilePicture email')
        .sort({ createdAt: -1 })
        .limit(20);
    },
    
    financialStats: async (property) => {
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
    
    similarProperties: async (property) => {
      const propertyService = new PropertyServices();
      return await propertyService.getSImilarProperty({
        propertyId: property._id.toString(),
        pagination: { limit: 5 }
      });
    },
    
    occupancyRate: async (property) => {
      const totalDays = 365;
      const rentedDays = await Activity.countDocuments({
        propertyId: property._id,
        isReservationAccepted: true,
        createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
      }) * 30;
      
      return Math.min(100, (rentedDays / totalDays) * 100);
    },
    
    performanceScore: async (property) => {
      const activities = await Activity.find({ propertyId: property._id });
      const totalActivities = activities.length;
      const acceptedActivities = activities.filter(a => 
        a.isReservationAccepted || a.isVisiteAcccepted
      ).length;
      
      if (totalActivities === 0) return 0;
      
      const acceptanceRate = (acceptedActivities / totalActivities) * 100;
      const priceCompetitiveness = 75;
      const responseTime = 85;
      
      return Math.round((acceptanceRate + priceCompetitiveness + responseTime) / 3);
    },
    
    reviews: async (property) => {
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
    
    marketAnalysis: async (property) => {
      const similarProperties = await Property.find({
        'generalHInfo.area': property.generalHInfo.area,
        propertyType: property.propertyType,
        isActive: true,
        _id: { $ne: property._id }
      });
      
      const averagePrice = similarProperties.reduce(
        (sum, p) => sum + p.ownerCriteria.monthlyRent, 0
      ) / similarProperties.length;
      
      const pricePosition = property.ownerCriteria.monthlyRent > averagePrice ? 'above' : 'below';
      const priceDifference = Math.abs(property.ownerCriteria.monthlyRent - averagePrice);
      const pricePercentage = (priceDifference / averagePrice) * 100;
      
      return {
        averageMarketPrice: averagePrice,
        pricePosition,
        priceDifference,
        pricePercentage: Math.round(pricePercentage),
        competitorCount: similarProperties.length,
        marketTrend: 'stable'
      };
    },
    
    pricePerSquareMeter: (property) => {
      return property.generalHInfo.surface > 0 
        ? property.ownerCriteria.monthlyRent / property.generalHInfo.surface 
        : 0;
    },
    
    isAvailable: (property) => {
      return property.status === 'AVAILABLE' && property.isActive;
    },
    
    recommendedServices: async (property) => {
      const recommendationEngine = new RecommendationEngine();
      
      const recommendations = await recommendationEngine.getRecommendations({
        propertyType: property.propertyType,
        location: {
          city: property.generalHInfo.area,
          district: property.generalHInfo.area
        },
        userProfile: {
          userId: property.ownerId.toString(),
          preferences: ['maintenance', 'security'],
          budget: property.ownerCriteria.monthlyRent * 0.1,
          lifestyle: ['property_owner']
        },
        servicesAlreadySubscribed: []
      });
      
      return recommendations;
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