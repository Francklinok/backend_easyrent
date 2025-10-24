import { Service } from '../models/Service';
import { ServiceProvider } from '../models/ServiceProvider';
import { ServiceSubscription } from '../models/ServiceSubscription';
import { ServiceReview } from '../models/ServiceReview';
import { ServiceMarketplaceService } from '../services/ServiceMarketplaceService';
import { RecommendationEngine } from '../services/RecommendationEngine';
import { ServiceDocumentUploadService } from '../utils/serviceDocumentUpload';
import ImageUploadService from '../../services/imageUploadService';
import User from '../../users/models/userModel';
import Property from '../../property/model/propertyModel';
import GraphQLUpload from 'graphql-upload-ts';


export const serviceResolvers = {
  Query: {
    service: async (_: any, { id }) => {
      try {
        const service = await Service.findById(id);
        if (!service) throw new Error('Service not found');
        return service;
      } catch (error: any) {
        throw new Error(`Error fetching service: ${error.message}`);
      }
    },
    
    services: async (_: any, { filters, pagination }) => {
      try {
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
      } catch (error: any) {
        throw new Error(`Error fetching services: ${error.message}`);
      }
    },
    
    serviceRecommendations: async (_: any, { input }) => {
      try {
        const recommendationEngine = new RecommendationEngine();
        const recommendations = await recommendationEngine.getRecommendations(input);
        return recommendations || [];
      } catch (error: any) {
        throw new Error(`Error fetching service recommendations: ${error.message}`);
      }
    },

    serviceProvider: async (_: any, { id }) => {
      try {
        const provider = await ServiceProvider.findById(id);
        if (!provider) throw new Error('Service provider not found');
        return provider;
      } catch (error: any) {
        throw new Error(`Error fetching service provider: ${error.message}`);
      }
    },

    serviceProviders: async (_: any, { filters, pagination }) => {
      try {
        const query = filters ? { $text: { $search: filters } } : {};
        const limit = pagination?.limit || 20;
        const skip = ((pagination?.page || 1) - 1) * limit;

        return await ServiceProvider.find(query)
          .skip(skip)
          .limit(limit)
          .sort({ rating: -1, totalReviews: -1 });
      } catch (error: any) {
        throw new Error(`Error fetching service providers: ${error.message}`);
      }
    },

    userSubscriptions: async (_: any, { userId }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');
        if (userId !== user.userId && user.role !== 'admin') {
          throw new Error('Unauthorized access');
        }

        const marketplaceService = new ServiceMarketplaceService();
        return await marketplaceService.getUserSubscriptions(userId);
      } catch (error: any) {
        throw new Error(`Error fetching user subscriptions: ${error.message}`);
      }
    },

    serviceStats: async (_, __, { user }) => {
      try {
        if (!user || user.role !== 'admin') {
          throw new Error('Admin access required');
        }

        const totalServices = await Service.countDocuments();
        const activeServices = await Service.countDocuments({ status: 'active' });
        const totalProviders = await ServiceProvider.countDocuments();

        const services = await Service.find();
        const averageRating = services.reduce((sum, s) => sum + s.rating, 0) / services.length || 0;

        const popularCategories = await Service.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 }, averageRating: { $avg: '$rating' } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]);

        return {
          totalServices,
          activeServices,
          totalProviders,
          averageRating,
          popularCategories: popularCategories.map(cat => ({
            category: cat._id,
            count: cat.count,
            averageRating: cat.averageRating
          })),
          revenueByCategory: [] // À implémenter avec les données de paiement
        };
      } catch (error: any) {
        throw new Error(`Error fetching service stats: ${error.message}`);
      }
    },

    providerServices: async (_: any, { providerId }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');
        if (providerId !== user.userId && user.role !== 'admin') {
          throw new Error('Unauthorized access');
        }

        const marketplaceService = new ServiceMarketplaceService();
        return await marketplaceService.getProviderServices(providerId);
      } catch (error: any) {
        throw new Error(`Error fetching provider services: ${error.message}`);
      }
    },

    serviceReviews: async (_: any, { serviceId, pagination }) => {
      try {
        const limit = pagination?.limit || 20;
        const skip = ((pagination?.page || 1) - 1) * limit;

        return await ServiceReview.find({ serviceId })
          .populate('userId', 'firstName lastName profilePicture')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit);
      } catch (error: any) {
        throw new Error(`Error fetching service reviews: ${error.message}`);
      }
    }
  },

  Mutation: {
    createServiceProvider: async (_: any, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const marketplaceService = new ServiceMarketplaceService();
        const provider = await marketplaceService.createServiceProvider(user.userId, input);

        if (!provider) throw new Error('Failed to create service provider');

        return provider;
      } catch (error: any) {
        throw new Error(`Error creating service provider: ${error.message}`);
      }
    },

    updateServiceProvider: async (_: any, { id, input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const provider = await ServiceProvider.findOne({ _id: id, userId: user.userId });
        if (!provider) throw new Error('Service provider not found or unauthorized');

        Object.assign(provider, input);
        await provider.save();

        return provider;
      } catch (error: any) {
        throw new Error(`Error updating service provider: ${error.message}`);
      }
    },

    createService: async (_: any, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        // Handle image uploads if provided
        if (input.images && Array.isArray(input.images) && input.images.length > 0) {
          if (input.images.length > 10) {
            throw new Error('Maximum 10 images allowed');
          }

          const imageService = ImageUploadService.getInstance();
          const uploadedImages: string[] = [];
          const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

          for (const imageFile of input.images) {
            const { createReadStream } = await imageFile;
            const stream = createReadStream();
            const chunks: Buffer[] = [];
            let totalSize = 0;
            
            for await (const chunk of stream) {
              totalSize += chunk.length;
              if (totalSize > MAX_FILE_SIZE) {
                throw new Error('File too large (max 10MB)');
              }
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            const validation = await imageService.validateImage(buffer);
            if (!validation.isValid) {
              throw new Error(validation.error || 'Invalid image');
            }

            const safeCategory = input.category.replace(/[^a-zA-Z0-9_-]/g, '');
            const uploadResult = await imageService.uploadOptimizedImage(
              buffer,
              `services/${safeCategory}`,
              `service_${Date.now()}_${Math.random().toString(36).substring(7)}`
            );

            if (uploadResult.success && uploadResult.data) {
              uploadedImages.push(uploadResult.data.originalUrl);
            }
          }

          input.media = {
            ...input.media,
            photos: uploadedImages
          };
          delete input.images;
        }

        const marketplaceService = new ServiceMarketplaceService();
        const service = await marketplaceService.createService(user.userId, input);

        if (!service) throw new Error('Failed to create service');

        return service;
      } catch (error: any) {
        throw new Error(`Error creating service: ${error.message}`);
      }
    },

    updateService: async (_: any, { id, input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const service = await Service.findOne({ _id: id, providerId: user.userId });
        if (!service) throw new Error('Service not found or unauthorized');

        Object.assign(service, input);
        await service.save();

        return service;
      } catch (error: any) {
        throw new Error(`Error updating service: ${error.message}`);
      }
    },

    deleteService: async (_: any, { id }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const service = await Service.findOne({ _id: id, providerId: user.userId });
        if (!service) throw new Error('Service not found or unauthorized');

        await Service.findByIdAndDelete(id);
        return true;
      } catch (error: any) {
        throw new Error(`Error deleting service: ${error.message}`);
      }
    },
    
    subscribeToService: async (_: any, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const marketplaceService = new ServiceMarketplaceService();
        const subscription = await marketplaceService.subscribeToService(user.userId, input);

        if (!subscription) throw new Error('Failed to create subscription');

        return subscription;
      } catch (error: any) {
        throw new Error(`Error subscribing to service: ${error.message}`);
      }
    },

    pauseSubscription: async (_: any, { subscriptionId }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const marketplaceService = new ServiceMarketplaceService();
        await marketplaceService.pauseSubscription(user.userId, subscriptionId);

        return await ServiceSubscription.findById(subscriptionId);
      } catch (error: any) {
        throw new Error(`Error pausing subscription: ${error.message}`);
      }
    },

    resumeSubscription: async (_: any, { subscriptionId }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const marketplaceService = new ServiceMarketplaceService();
        await marketplaceService.resumeSubscription(user.userId, subscriptionId);

        return await ServiceSubscription.findById(subscriptionId);
      } catch (error: any) {
        throw new Error(`Error resuming subscription: ${error.message}`);
      }
    },

    cancelSubscription: async (_: any, { subscriptionId }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const marketplaceService = new ServiceMarketplaceService();
        await marketplaceService.cancelSubscription(user.userId, subscriptionId);

        return await ServiceSubscription.findById(subscriptionId);
      } catch (error: any) {
        throw new Error(`Error cancelling subscription: ${error.message}`);
      }
    },

    shareService: async (_: any, { subscriptionId, shareWithUserIds }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const marketplaceService = new ServiceMarketplaceService();
        await marketplaceService.shareService(user.userId, subscriptionId, shareWithUserIds);

        return await ServiceSubscription.findById(subscriptionId);
      } catch (error: any) {
        throw new Error(`Error sharing service: ${error.message}`);
      }
    },

    createServiceReview: async (_: any, { input }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        // Vérifier que l'utilisateur a bien un abonnement à ce service
        const subscription = await ServiceSubscription.findOne({
          _id: input.subscriptionId,
          userId: user.userId
        });

        if (!subscription) throw new Error('Subscription not found or unauthorized');

        const review = new ServiceReview({
          ...input,
          userId: user.userId
        });

        await review.save();

        // Mettre à jour la note moyenne du service
        const service = await Service.findById(input.serviceId);
        if (service) {
          const reviews = await ServiceReview.find({ serviceId: input.serviceId });
          const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

          service.rating = averageRating;
          service.totalReviews = reviews.length;
          await service.save();
        }

        return review;
      } catch (error: any) {
        throw new Error(`Error creating service review: ${error.message}`);
      }
    },

    respondToReview: async (_: any, { reviewId, response }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const review = await ServiceReview.findById(reviewId).populate('serviceId');
        if (!review) throw new Error('Review not found');

        const service = await Service.findById(review.serviceId);
        if (!service || service.providerId !== user.userId) {
          throw new Error('Unauthorized to respond to this review');
        }

        review.providerResponse = {
          comment: response,
          date: new Date()
        };

        await review.save();
        return review;
      } catch (error: any) {
        throw new Error(`Error responding to review: ${error.message}`);
      }
    },

    uploadServiceDocuments: async (_: any, { serviceId, documents }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const service = await Service.findOne({ _id: serviceId, providerId: user.userId });
        if (!service) throw new Error('Service not found or unauthorized');

        const uploadedDocs: any = {};

        const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB for documents
        const ALLOWED_DOC_TYPES = ['professionalLicense', 'insurance', 'certifications', 'identityProof'];

        for (const [docType, files] of Object.entries(documents)) {
          if (!files || !Array.isArray(files)) continue;
          if (!ALLOWED_DOC_TYPES.includes(docType)) {
            throw new Error(`Invalid document type: ${docType}`);
          }
          
          uploadedDocs[docType] = [];
          for (const file of files) {
            const { createReadStream } = await file;
            const stream = createReadStream();
            const chunks: Buffer[] = [];
            let totalSize = 0;
            
            for await (const chunk of stream) {
              totalSize += chunk.length;
              if (totalSize > MAX_FILE_SIZE) {
                throw new Error('Document too large (max 20MB)');
              }
              chunks.push(chunk);
            }
            
            const buffer = Buffer.concat(chunks);
            const safeServiceId = serviceId.replace(/[^a-zA-Z0-9_-]/g, '');
            const safeCategory = service.category.replace(/[^a-zA-Z0-9_-]/g, '');
            const safeDocType = docType.replace(/[^a-zA-Z0-9_-]/g, '');
            
            const result = await ServiceDocumentUploadService.uploadDocument(
              buffer,
              safeServiceId,
              safeCategory,
              safeDocType
            );
            uploadedDocs[docType].push(result.url);
          }
        }

        service.verificationDocuments = {
          ...service.verificationDocuments,
          ...uploadedDocs,
          status: 'pending'
        } as any;

        await service.save();
        return service;
      } catch (error: any) {
        throw new Error(`Error uploading documents: ${error.message}`);
      }
    },

    uploadJustificationImages: async (_: any, { serviceId, images }, { user }) => {
      try {
        if (!user) throw new Error('Authentication required');

        const service = await Service.findOne({ _id: serviceId, providerId: user.userId });
        if (!service) throw new Error('Service not found or unauthorized');

        const imageService = ImageUploadService.getInstance();
        const uploadedImages: string[] = [];

        if (images.length > 10) {
          throw new Error('Maximum 10 images allowed');
        }

        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

        for (const image of images) {
          const { createReadStream } = await image;
          const stream = createReadStream();
          const chunks: Buffer[] = [];
          let totalSize = 0;
          
          for await (const chunk of stream) {
            totalSize += chunk.length;
            if (totalSize > MAX_FILE_SIZE) {
              throw new Error('Image too large (max 10MB)');
            }
            chunks.push(chunk);
          }
          
          const buffer = Buffer.concat(chunks);
          
          const validation = await imageService.validateImage(buffer);
          if (!validation.isValid) {
            throw new Error(validation.error || 'Invalid image');
          }

          const safeServiceId = serviceId.replace(/[^a-zA-Z0-9_-]/g, '');
          const safeCategory = service.category.replace(/[^a-zA-Z0-9_-]/g, '');
          
          const uploadResult = await imageService.uploadOptimizedImage(
            buffer,
            `services/${safeCategory}/${safeServiceId}`,
            `${safeServiceId}_${Date.now()}`
          );

          if (uploadResult.success && uploadResult.data) {
            uploadedImages.push(uploadResult.data.originalUrl);
          }
        }

        service.justificationImages = [...(service.justificationImages || []), ...uploadedImages];
        await service.save();
        
        return service;
      } catch (error: any) {
        throw new Error(`Error uploading justification images: ${error.message}`);
      }
    }
  },

  Upload: GraphQLUpload,

  Service: {
    provider: async (service: any) => {
      return await ServiceProvider.findOne({ userId: service.providerId });
    },
    
    subscriptions: async (service: any) => {
      return await ServiceSubscription.find({ serviceId: service._id });
    },
    
    reviews: async (service: any) => {
      return await ServiceReview.find({ serviceId: service._id }).sort({ createdAt: -1 });
    },
    
    verificationStatus: (service: any) => {
      return service.verificationDocuments?.status || 'pending';
    },
    
    hasRequiredDocuments: (service: any) => {
      const validation = ServiceDocumentUploadService.validateDocuments(
        service.category,
        service.verificationDocuments || {}
      );
      return validation.isValid;
    },
    
    documentRequirements: (service: any) => {
      const isMandatory = ServiceDocumentUploadService.areDocumentsMandatory(service.category);
      const validation = ServiceDocumentUploadService.validateDocuments(
        service.category,
        service.verificationDocuments || {}
      );
      
      return {
        isMandatory,
        requiredDocuments: validation.requiredDocuments || [],
        errors: validation.errors || [],
        warnings: validation.warnings || []
      };
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