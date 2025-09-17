import { Service } from '../models/Service';
import { ServiceProvider } from '../models/ServiceProvider';
import { ServiceSubscription } from '../models/ServiceSubscription';
import { ServiceReview } from '../models/ServiceReview';
import { ServiceMarketplaceService } from '../services/ServiceMarketplaceService';
import { RecommendationEngine } from '../services/RecommendationEngine';
import User from '../../users/models/userModel';
import Property from '../../property/model/propertyModel';

export const serviceResolvers = {
  Query: {
    service: async (_, { id }) => {
      return await Service.findById(id);
    },
    
    services: async (_, { filters, pagination }) => {
      const marketplaceService = new ServiceMarketplaceService();
      const services = await marketplaceService.getServices(filters || {});
      
      const limit = pagination?.first || 20;
      const skip = pagination?.after ? parseInt(Buffer.from(pagination.after, 'base64').toString()) : 0;
      
      const paginatedServices = services.slice(skip, skip + limit);
      const hasNextPage = services.length > skip + limit;
      
      const edges = paginatedServices.map((service, index) => ({
        node: service,
        cursor: Buffer.from((skip + index).toString()).toString('base64')
      }));
      
      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: skip > 0,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor
        },
        totalCount: services.length
      };
    },
    
    serviceRecommendations: async (_, { input }) => {
      const recommendationEngine = new RecommendationEngine();
      return await recommendationEngine.getRecommendations(input);
    }
  },

  Mutation: {
    createService: async (_, { input }, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const marketplaceService = new ServiceMarketplaceService();
      return await marketplaceService.createService(user.userId, input);
    },
    
    subscribeToService: async (_, { input }, { user }) => {
      if (!user) throw new Error('Authentication required');
      
      const marketplaceService = new ServiceMarketplaceService();
      return await marketplaceService.subscribeToService(user.userId, input);
    }
  },

  Service: {
    provider: async (service) => {
      return await ServiceProvider.findOne({ userId: service.providerId });
    },
    
    subscriptions: async (service) => {
      return await ServiceSubscription.find({ serviceId: service._id });
    },
    
    reviews: async (service) => {
      return await ServiceReview.find({ serviceId: service._id }).sort({ createdAt: -1 });
    },
    
    isAvailableForProperty: async (service, { propertyId }) => {
      const property = await Property.findById(propertyId);
      if (!property) return false;
      
      return service.requirements.propertyTypes.includes(property.propertyType) &&
             service.availability.zones.includes(property.generalHInfo.area);
    },
    
    estimatedPrice: async (service, { propertyType }) => {
      let basePrice = service.pricing.basePrice;
      
      // Ajustement du prix selon le type de propriété
      const propertyMultipliers = {
        'villa': 1.5,
        'penthouse': 1.8,
        'apartment': 1.0,
        'studio': 0.8,
        'commercial': 2.0
      };
      
      return basePrice * (propertyMultipliers[propertyType] || 1.0);
    }
  },

  ServiceProvider: {
    user: async (provider) => {
      return await User.findById(provider.userId);
    },
    
    services: async (provider) => {
      return await Service.find({ providerId: provider.userId });
    }
  },

  ServiceSubscription: {
    user: async (subscription) => {
      return await User.findById(subscription.userId);
    },
    
    property: async (subscription) => {
      return await Property.findById(subscription.propertyId);
    },
    
    service: async (subscription) => {
      return await Service.findById(subscription.serviceId);
    },
    
    paymentHistory: async (subscription) => {
      return subscription.paymentHistory || [];
    }
  },

  ServiceRecommendation: {
    service: async (recommendation) => {
      return await Service.findById(recommendation.serviceId);
    },
    
    neighborhoodData: async (recommendation) => {
      // Calculer les données du quartier
      const service = await Service.findById(recommendation.serviceId);
      if (!service) return null;
      
      const subscriptions = await ServiceSubscription.find({
        serviceId: recommendation.serviceId,
        status: 'active'
      });
      
      const reviews = await ServiceReview.find({
        serviceId: recommendation.serviceId
      });
      
      const averageRating = reviews.length > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        : 0;
      
      return {
        popularServices: [service.category],
        averageRating,
        totalUsers: subscriptions.length
      };
    }
  }
};