import { Service, IService } from '../models/Service';
import { ServiceProvider, IServiceProvider } from '../models/ServiceProvider';
import { ServiceSubscription, IServiceSubscription } from '../models/ServiceSubscription';
import { CreateServiceRequest, SubscribeServiceRequest } from '../types/serviceTypes';
import mongoose from 'mongoose';

export class ServiceMarketplaceService {
  
  async createServiceProvider(userId: string, data: Partial<IServiceProvider>): Promise<IServiceProvider> {
    const provider = new ServiceProvider({
      userId,
      ...data
    });
    return await provider.save();
  }
  
  async createService(providerId: string, data: CreateServiceRequest, photos?: string[]): Promise<IService> {
    const service = new Service({
      providerId,
      ...data,
      media: {
        photos: photos || [],
        videos: [],
        documents: []
      }
    });
    return await service.save();
  }
  
  async getServices(filters: {
    category?: string;
    location?: string;
    propertyType?: string;
    priceRange?: [number, number];
    contractType?: string;
  }): Promise<IService[]> {
    const query: any = { status: 'active' };
    
    if (filters.category) query.category = filters.category;
    if (filters.location) query['availability.zones'] = filters.location;
    if (filters.propertyType) query['requirements.propertyTypes'] = filters.propertyType;
    if (filters.contractType) query.contractTypes = filters.contractType;
    if (filters.priceRange) {
      query['pricing.basePrice'] = {
        $gte: filters.priceRange[0],
        $lte: filters.priceRange[1]
      };
    }
    
    return await Service.find(query)
      .sort({ rating: -1, totalReviews: -1 })
      .limit(50);
  }
  
  async subscribeToService(userId: string, data: SubscribeServiceRequest): Promise<IServiceSubscription> {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // Vérifier que le service existe et est disponible
        const service = await Service.findById(data.serviceId).session(session);
        if (!service || service.status !== 'active') {
          throw new Error('Service non disponible');
        }
        
        // Créer l'abonnement
        const subscription = new ServiceSubscription({
          userId,
          ...data,
          pricing: {
            amount: service.pricing.basePrice,
            currency: service.pricing.currency,
            billingPeriod: service.pricing.billingPeriod
          }
        });
        
        await subscription.save({ session });
        
        return subscription;
      });
    } finally {
      await session.endSession();
    }
  }
  
  async getUserSubscriptions(userId: string): Promise<IServiceSubscription[]> {
    return await ServiceSubscription.find({ userId })
      .populate('serviceId')
      .sort({ createdAt: -1 });
  }
  
  async pauseSubscription(userId: string, subscriptionId: string): Promise<void> {
    await ServiceSubscription.updateOne(
      { _id: subscriptionId, userId },
      { status: 'paused' }
    );
  }
  
  async resumeSubscription(userId: string, subscriptionId: string): Promise<void> {
    await ServiceSubscription.updateOne(
      { _id: subscriptionId, userId },
      { status: 'active' }
    );
  }
  
  async cancelSubscription(userId: string, subscriptionId: string): Promise<void> {
    await ServiceSubscription.updateOne(
      { _id: subscriptionId, userId },
      { status: 'cancelled' }
    );
  }
  
  async shareService(userId: string, subscriptionId: string, shareWithUserIds: string[]): Promise<void> {
    const subscription = await ServiceSubscription.findOne({
      _id: subscriptionId,
      userId
    });
    
    if (!subscription) {
      throw new Error('Abonnement non trouvé');
    }
    
    // Calculer le nouveau prix partagé
    const totalUsers = shareWithUserIds.length + 1;
    const sharedPrice = subscription.pricing.amount / totalUsers;
    
    await ServiceSubscription.updateOne(
      { _id: subscriptionId },
      {
        sharedWith: shareWithUserIds,
        'pricing.amount': sharedPrice
      }
    );
  }
  
  async getProviderServices(providerId: string): Promise<IService[]> {
    return await Service.find({ providerId })
      .sort({ createdAt: -1 });
  }
  
  async updateServiceStatus(providerId: string, serviceId: string, status: string): Promise<void> {
    await Service.updateOne(
      { _id: serviceId, providerId },
      { status }
    );
  }
  
  async getServiceStats(serviceId: string): Promise<any> {
    const subscriptions = await ServiceSubscription.aggregate([
      { $match: { serviceId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.amount' }
        }
      }
    ]);
    
    return {
      subscriptions,
      totalActive: subscriptions.find(s => s._id === 'active')?.count || 0,
      monthlyRevenue: subscriptions.reduce((sum, s) => sum + (s.totalRevenue || 0), 0)
    };
  }
}