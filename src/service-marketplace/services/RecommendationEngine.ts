import { Service } from '../models/Service';
import { ServiceSubscription } from '../models/ServiceSubscription';
import { RecommendationInput, ServiceRecommendation, PropertyType, ServiceCategory } from '../types/serviceTypes';

export class RecommendationEngine {
  
  async getRecommendations(input: RecommendationInput): Promise<ServiceRecommendation[]> {
    const recommendations: ServiceRecommendation[] = [];
    
    // 1. Services basés sur le type de propriété
    const propertyBasedServices = await this.getPropertyBasedServices(input.propertyType, input.location.city);
    recommendations.push(...propertyBasedServices);
    
    // 2. Services populaires dans le quartier
    const neighborhoodServices = await this.getNeighborhoodServices(input.location, input.servicesAlreadySubscribed);
    recommendations.push(...neighborhoodServices);
    
    // 3. Services saisonniers
    const seasonalServices = await this.getSeasonalServices(input.seasonalContext);
    recommendations.push(...seasonalServices);
    
    // 4. Services basés sur le profil utilisateur
    const profileBasedServices = await this.getProfileBasedServices(input.userProfile);
    recommendations.push(...profileBasedServices);
    
    // 5. Trier par score et retourner les meilleurs
    return this.sortAndFilterRecommendations(recommendations, input.userProfile.budget);
  }
  
  private async getPropertyBasedServices(propertyType: PropertyType, location: string): Promise<ServiceRecommendation[]> {
    const recommendations: ServiceRecommendation[] = [];
    
    // Règles métier selon le type de propriété
    const propertyRules = {
      house: ['gardening', 'security', 'maintenance'],
      apartment: ['insurance', 'cleaning', 'utilities'],
      villa: ['gardening', 'security', 'wellness', 'tech'],
      studio: ['cleaning', 'utilities'],
      commercial: ['security', 'maintenance', 'cleaning']
    };
    
    const suggestedCategories = propertyRules[propertyType] || [];
    
    for (const category of suggestedCategories) {
      const services = await Service.find({
        category,
        'availability.zones': location,
        status: 'active',
        'requirements.propertyTypes': propertyType
      }).limit(3);
      
      services.forEach(service => {
        recommendations.push({
          serviceId: service._id.toString(),
          score: this.calculatePropertyScore(category, propertyType),
          reason: `Recommandé pour les ${propertyType}s`,
          urgency: category === 'security' ? 'high' : 'medium',
          category: category as ServiceCategory,
          estimatedPrice: service.pricing.basePrice
        });
      });
    }
    
    return recommendations;
  }
  
  private async getNeighborhoodServices(location: any, excludeServices: string[]): Promise<ServiceRecommendation[]> {
    const recommendations: ServiceRecommendation[] = [];
    
    // Trouver les services populaires dans la zone
    const popularServices = await ServiceSubscription.aggregate([
      {
        $lookup: {
          from: 'services',
          localField: 'serviceId',
          foreignField: '_id',
          as: 'service'
        }
      },
      {
        $unwind: '$service'
      },
      {
        $match: {
          'service.availability.zones': location.city,
          serviceId: { $nin: excludeServices },
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$serviceId',
          count: { $sum: 1 },
          service: { $first: '$service' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);
    
    popularServices.forEach(item => {
      recommendations.push({
        serviceId: item._id,
        score: 70 + (item.count * 5),
        reason: `${item.count} voisins utilisent ce service`,
        urgency: 'low',
        category: item.service.category,
        estimatedPrice: item.service.pricing.basePrice
      });
    });
    
    return recommendations;
  }
  
  private async getSeasonalServices(season?: string): Promise<ServiceRecommendation[]> {
    const recommendations: ServiceRecommendation[] = [];
    
    if (!season) return recommendations;
    
    const seasonalCategories = {
      winter: ['maintenance', 'utilities'],
      spring: ['gardening', 'cleaning'],
      summer: ['gardening', 'wellness'],
      autumn: ['maintenance', 'cleaning']
    };
    
    const categories = seasonalCategories[season] || [];
    
    for (const category of categories) {
      const services = await Service.find({
        category,
        status: 'active',
        tags: { $in: ['seasonal', season] }
      }).limit(2);
      
      services.forEach(service => {
        recommendations.push({
          serviceId: service._id.toString(),
          score: 60,
          reason: `Service saisonnier pour ${season}`,
          urgency: 'low',
          category: category as ServiceCategory,
          estimatedPrice: service.pricing.basePrice
        });
      });
    }
    
    return recommendations;
  }
  
  private async getProfileBasedServices(userProfile: any): Promise<ServiceRecommendation[]> {
    const recommendations: ServiceRecommendation[] = [];
    
    // Services basés sur les préférences utilisateur
    if (userProfile.preferences.includes('eco')) {
      const ecoServices = await Service.find({
        category: 'eco',
        status: 'active',
        'pricing.basePrice': { $lte: userProfile.budget }
      }).limit(3);
      
      ecoServices.forEach(service => {
        recommendations.push({
          serviceId: service._id.toString(),
          score: 80,
          reason: 'Correspond à vos préférences écologiques',
          urgency: 'medium',
          category: 'eco',
          estimatedPrice: service.pricing.basePrice
        });
      });
    }
    
    return recommendations;
  }
  
  private calculatePropertyScore(category: string, propertyType: PropertyType): number {
    const scores = {
      house: { gardening: 90, security: 85, maintenance: 80 },
      apartment: { insurance: 90, cleaning: 85, utilities: 80 },
      villa: { gardening: 95, security: 90, wellness: 85 }
    };
    
    return scores[propertyType]?.[category] || 50;
  }
  
  private sortAndFilterRecommendations(recommendations: ServiceRecommendation[], budget: number): ServiceRecommendation[] {
    return recommendations
      .filter(rec => rec.estimatedPrice <= budget)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
}