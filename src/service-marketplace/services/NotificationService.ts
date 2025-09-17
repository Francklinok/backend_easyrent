import { RecommendationEngine } from './RecommendationEngine';
import { ServiceMarketplaceService } from './ServiceMarketplaceService';

export class ServiceNotificationService {
  private recommendationEngine = new RecommendationEngine();
  private marketplaceService = new ServiceMarketplaceService();

  async sendPeriodicRecommendations(userId: string, propertyId: string): Promise<void> {
    try {
      // Récupérer le profil utilisateur et les services déjà souscrits
      const subscriptions = await this.marketplaceService.getUserSubscriptions(userId);
      const subscribedServiceIds = subscriptions.map(sub => sub.serviceId);

      // Générer des recommandations
      const recommendations = await this.recommendationEngine.getRecommendations({
        propertyType: 'apartment', // À récupérer depuis la propriété
        location: {
          city: 'Paris', // À récupérer depuis la propriété
          district: 'Centre'
        },
        userProfile: {
          userId,
          preferences: ['eco', 'tech'],
          budget: 500,
          lifestyle: ['busy', 'tech-savvy']
        },
        servicesAlreadySubscribed: subscribedServiceIds,
        seasonalContext: this.getCurrentSeason()
      });

      // Envoyer les notifications (à implémenter selon votre système de notification)
      if (recommendations.length > 0) {
        console.log(`Nouvelles recommandations pour l'utilisateur ${userId}:`, recommendations);
        // Ici vous pouvez intégrer avec votre service de notification existant
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi des recommandations:', error);
    }
  }

  async notifyServiceExpiration(subscriptionId: string): Promise<void> {
    // Logique pour notifier l'expiration d'un service
    console.log(`Service ${subscriptionId} expire bientôt`);
  }

  async notifyNewServiceInArea(userId: string, serviceId: string): Promise<void> {
    // Logique pour notifier un nouveau service dans la zone
    console.log(`Nouveau service ${serviceId} disponible pour l'utilisateur ${userId}`);
  }

  private getCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }
}