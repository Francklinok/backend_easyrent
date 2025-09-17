import { Request, Response } from 'express';
import { ServiceMarketplaceService } from '../services/ServiceMarketplaceService';
import { RecommendationEngine } from '../services/RecommendationEngine';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/services/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
  }
});

export const upload = multer({ storage });

export class ServiceController {
  private serviceMarketplace = new ServiceMarketplaceService();
  private recommendationEngine = new RecommendationEngine();

  async createServiceProvider(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const provider = await this.serviceMarketplace.createServiceProvider(userId, req.body);
      
      res.status(201).json({
        success: true,
        message: 'Profil prestataire créé avec succès',
        data: provider
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de la création du profil prestataire',
        error: error.message
      });
    }
  }

  async createService(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const photos = (req.files as Express.Multer.File[])?.map(file => file.path) || [];
      
      const service = await this.serviceMarketplace.createService(userId, req.body, photos);
      
      res.status(201).json({
        success: true,
        message: 'Service créé avec succès',
        data: service
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de la création du service',
        error: error.message
      });
    }
  }

  async getServices(req: Request, res: Response) {
    try {
      const filters = {
        category: req.query.category as string,
        location: req.query.location as string,
        propertyType: req.query.propertyType as string,
        contractType: req.query.contractType as string,
        priceRange: req.query.minPrice && req.query.maxPrice 
          ? [Number(req.query.minPrice), Number(req.query.maxPrice)] as [number, number]
          : undefined
      };
      
      const services = await this.serviceMarketplace.getServices(filters);
      
      res.json({
        success: true,
        data: services
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des services',
        error: error.message
      });
    }
  }

  async subscribeToService(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const subscription = await this.serviceMarketplace.subscribeToService(userId, req.body);
      
      res.status(201).json({
        success: true,
        message: 'Abonnement créé avec succès',
        data: subscription
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de l\'abonnement au service',
        error: error.message
      });
    }
  }

  async getUserSubscriptions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const subscriptions = await this.serviceMarketplace.getUserSubscriptions(userId);
      
      res.json({
        success: true,
        data: subscriptions
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des abonnements',
        error: error.message
      });
    }
  }

  async pauseSubscription(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { subscriptionId } = req.params;
      
      await this.serviceMarketplace.pauseSubscription(userId, subscriptionId);
      
      res.json({
        success: true,
        message: 'Abonnement mis en pause'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise en pause',
        error: error.message
      });
    }
  }

  async shareService(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { subscriptionId } = req.params;
      const { shareWithUserIds } = req.body;
      
      await this.serviceMarketplace.shareService(userId, subscriptionId, shareWithUserIds);
      
      res.json({
        success: true,
        message: 'Service partagé avec succès'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors du partage du service',
        error: error.message
      });
    }
  }

  async getRecommendations(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const input = req.body;
      
      const recommendations = await this.recommendationEngine.getRecommendations({
        ...input,
        userProfile: {
          ...input.userProfile,
          userId
        }
      });
      
      res.json({
        success: true,
        data: recommendations
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération des recommandations',
        error: error.message
      });
    }
  }

  async getProviderServices(req: Request, res: Response) {
    try {
      const providerId = (req as any).user?.userId;
      const services = await this.serviceMarketplace.getProviderServices(providerId);
      
      res.json({
        success: true,
        data: services
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des services',
        error: error.message
      });
    }
  }

  async getServiceStats(req: Request, res: Response) {
    try {
      const { serviceId } = req.params;
      const stats = await this.serviceMarketplace.getServiceStats(serviceId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message
      });
    }
  }
}