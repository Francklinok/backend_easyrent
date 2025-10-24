import { Request, Response } from 'express';
import { ServiceMarketplaceService } from '../services/ServiceMarketplaceService';
import { RecommendationEngine } from '../services/RecommendationEngine';
import { ServiceDocumentUploadService } from '../utils/serviceDocumentUpload';
import ImageUploadService from '../../services/imageUploadService';
import { Service } from '../models/Service';
import multer from 'multer';

const storage = multer.memoryStorage();
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
      const files = req.files as Express.Multer.File[];
      
      let photos: string[] = [];
      
      if (files && files.length > 0) {
        const imageService = ImageUploadService.getInstance();
        
        for (const file of files) {
          const validation = await imageService.validateImage(file.buffer);
          if (!validation.isValid) {
            throw new Error(validation.error || 'Invalid image');
          }
          
          const uploadResult = await imageService.uploadOptimizedImage(
            file.buffer,
            `services/${req.body.category}`,
            `service_${Date.now()}_${Math.random().toString(36).substring(7)}`
          );
          
          if (uploadResult.success && uploadResult.data) {
            photos.push(uploadResult.data.originalUrl);
          }
        }
      }
      
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

  async uploadServiceDocuments(req: Request, res: Response) {
    try {
      const { serviceId } = req.params;
      const userId = (req as any).user?.userId;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      const service = await Service.findOne({ _id: serviceId, providerId: userId });
      if (!service) {
        return res.status(404).json({ success: false, message: 'Service non trouvé' });
      }

      const validation = ServiceDocumentUploadService.validateDocuments(
        service.category,
        service.verificationDocuments
      );

      const uploadedDocs: any = {};

      if (files.professionalLicense) {
        uploadedDocs.professionalLicense = [];
        for (const file of files.professionalLicense) {
          const result = await ServiceDocumentUploadService.uploadDocument(
            file.buffer,
            serviceId,
            service.category,
            'professionalLicense'
          );
          uploadedDocs.professionalLicense.push(result.url);
        }
      }

      if (files.insurance) {
        uploadedDocs.insurance = [];
        for (const file of files.insurance) {
          const result = await ServiceDocumentUploadService.uploadDocument(
            file.buffer,
            serviceId,
            service.category,
            'insurance'
          );
          uploadedDocs.insurance.push(result.url);
        }
      }

      if (files.certifications) {
        uploadedDocs.certifications = [];
        for (const file of files.certifications) {
          const result = await ServiceDocumentUploadService.uploadDocument(
            file.buffer,
            serviceId,
            service.category,
            'certifications'
          );
          uploadedDocs.certifications.push(result.url);
        }
      }

      if (files.identityProof) {
        uploadedDocs.identityProof = [];
        for (const file of files.identityProof) {
          const result = await ServiceDocumentUploadService.uploadDocument(
            file.buffer,
            serviceId,
            service.category,
            'identityProof'
          );
          uploadedDocs.identityProof.push(result.url);
        }
      }

      service.verificationDocuments = {
        ...service.verificationDocuments,
        ...uploadedDocs,
        status: 'pending'
      };

      await service.save();

      res.json({
        success: true,
        message: 'Documents uploadés avec succès',
        data: { documents: uploadedDocs, validation }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de l\'upload des documents',
        error: error.message
      });
    }
  }

  async uploadJustificationImages(req: Request, res: Response) {
    try {
      const { serviceId } = req.params;
      const userId = (req as any).user?.userId;
      const files = req.files as Express.Multer.File[];

      const service = await Service.findOne({ _id: serviceId, providerId: userId });
      if (!service) {
        return res.status(404).json({ success: false, message: 'Service non trouvé' });
      }

      const imageService = ImageUploadService.getInstance();
      const uploadedImages: string[] = [];

      for (const file of files) {
        const validation = await imageService.validateImage(file.buffer);
        if (!validation.isValid) {
          throw new Error(validation.error || 'Invalid image');
        }
        
        const uploadResult = await imageService.uploadOptimizedImage(
          file.buffer,
          `services/${service.category}/${serviceId}`,
          `${serviceId}_${Date.now()}`
        );
        
        if (uploadResult.success && uploadResult.data) {
          uploadedImages.push(uploadResult.data.originalUrl);
        }
      }

      service.justificationImages = [...(service.justificationImages || []), ...uploadedImages];
      await service.save();

      res.json({
        success: true,
        message: 'Images justificatives uploadées avec succès',
        data: { images: uploadedImages }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de l\'upload des images',
        error: error.message
      });
    }
  }

  async getServiceWithDocuments(req: Request, res: Response) {
    try {
      const { serviceId } = req.params;

      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Service non trouvé' });
      }

      const isMandatory = ServiceDocumentUploadService.areDocumentsMandatory(service.category);
      const validation = ServiceDocumentUploadService.validateDocuments(
        service.category,
        service.verificationDocuments
      );

      res.json({
        success: true,
        data: {
          service,
          documentRequirements: {
            isMandatory,
            validation
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du service',
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