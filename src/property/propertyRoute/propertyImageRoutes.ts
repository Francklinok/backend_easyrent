import express, { NextFunction } from 'express';
import { Request, Response } from 'express';
import { multipleImageUpload, singleImageUpload, handleMulterError } from '../../middleware/multerConfig';
import ImageUploadService from '../../services/imageUploadService';
import Property from '../model/propertyModel';
import { PropertyImage } from '../types/imageTypes';

const router = express.Router();

// Middleware d'authentification (à adapter selon votre système)
const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // TODO: Implémenter votre logique d'authentification
  const user = req.user; // Supposé être ajouté par votre middleware d'auth
  if (!user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  next();
};

/**
 * POST /api/properties/:propertyId/images
 * Upload une seule image pour une propriété
 */
router.post('/:propertyId/images', requireAuth, singleImageUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId } = req.params;
    const { order = 0 } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni'
      });
      return;
    }

    // Vérifier que la propriété existe
    const property = await Property.findOne({ propertyId });
    if (!property) {
      res.status(404).json({
        success: false,
        error: 'Propriété non trouvée'
      });
      return;
    }

    // Vérifier les permissions
    const user = req.user as any;
    if (property.ownerId.toString() !== user.id && !user.isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Non autorisé à modifier cette propriété'
      });
      return;
    }

    // Upload l'image
    const imageService = ImageUploadService.getInstance();
    const uploadResult = await imageService.uploadOptimizedImage(
      file.buffer,
      `properties/${propertyId}`,
      `${propertyId}_${Date.now()}`
    );

    if (!uploadResult.success || !uploadResult.data) {
      res.status(500).json({
        success: false,
        error: uploadResult.error || 'Échec de l\'upload'
      });
      return;
    }

    // Créer l'objet PropertyImage
    const propertyImage: PropertyImage = {
      publicId: uploadResult.data.publicId,
      originalUrl: uploadResult.data.originalUrl,
      variants: uploadResult.data.variants,
      metadata: uploadResult.data.metadata,
      uploadedAt: new Date(),
      order: parseInt(order) || property.images.length
    };

    // Ajouter l'image à la propriété
    property.images.push(propertyImage);
    await property.save();

    res.status(201).json({
      success: true,
      image: propertyImage,
      message: 'Image uploadée avec succès'
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * POST /api/properties/:propertyId/images/multiple
 * Upload plusieurs images pour une propriété
 */
router.post('/:propertyId/images/multiple', requireAuth, multipleImageUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni'
      });
      return;
    }

    // Vérifier que la propriété existe
    const property = await Property.findOne({ propertyId });
    if (!property) {
      res.status(404).json({
        success: false,
        error: 'Propriété non trouvée'
      });
      return;
    }

    // Vérifier les permissions
    const user = req.user as any;
    if (property.ownerId.toString() !== user.id && !user.isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Non autorisé à modifier cette propriété'
      });
      return;
    }

    // Upload toutes les images
    const imageService = ImageUploadService.getInstance();
    const buffers = files.map(file => file.buffer);

    const uploadResult = await imageService.uploadMultipleImages(
      buffers,
      `properties/${propertyId}`
    );

    if (!uploadResult.success) {
      res.status(500).json({
        success: false,
        error: 'Échec de l\'upload multiple',
        details: uploadResult.results
      });
      return;
    }

    // Créer les objets PropertyImage pour les uploads réussis
    const newImages: PropertyImage[] = uploadResult.results
      .filter(result => result.success && result.data)
      .map((result, index) => ({
        publicId: result.data!.publicId,
        originalUrl: result.data!.originalUrl,
        variants: result.data!.variants,
        metadata: result.data!.metadata,
        uploadedAt: new Date(),
        order: property.images.length + index
      }));

    // Ajouter les images à la propriété
    property.images.push(...newImages);
    await property.save();

    res.status(201).json({
      success: true,
      images: newImages,
      successCount: uploadResult.successCount,
      failureCount: uploadResult.failureCount,
      message: `${uploadResult.successCount} images uploadées avec succès`
    });

  } catch (error) {
    console.error('Error uploading multiple images:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * GET /api/properties/:propertyId/images
 * Récupérer toutes les images d'une propriété
 */
router.get('/:propertyId/images', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findOne({ propertyId }).select('images');
    if (!property) {
      res.status(404).json({
        success: false,
        error: 'Propriété non trouvée'
      });
      return;
    }

    res.json({
      success: true,
      images: property.images || [],
      count: property.images?.length || 0
    });

  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * DELETE /api/properties/:propertyId/images/:publicId
 * Supprimer une image spécifique
 */
router.delete('/:propertyId/images/:publicId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId, publicId } = req.params;

    // Vérifier que la propriété existe
    const property = await Property.findOne({ propertyId });
    if (!property) {
      res.status(404).json({
        success: false,
        error: 'Propriété non trouvée'
      });
      return;
    }

    // Vérifier les permissions
    const user = req.user as any;
    if (property.ownerId.toString() !== user.id && !user.isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Non autorisé à modifier cette propriété'
      });
      return;
    }

    // Trouver l'image
    const imageIndex = property.images.findIndex(img => img.publicId === publicId);
    if (imageIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Image non trouvée'
      });
      return;
    }

    // Supprimer de Cloudinary
    const imageService = ImageUploadService.getInstance();
    const deleteResult = await imageService.deleteImage(publicId);

    if (!deleteResult.success) {
      res.status(500).json({
        success: false,
        error: deleteResult.error || 'Échec de la suppression sur Cloudinary'
      });
      return;
    }

    // Supprimer de la base de données
    property.images.splice(imageIndex, 1);
    await property.save();

    res.json({
      success: true,
      message: 'Image supprimée avec succès',
      deletedPublicId: publicId
    });

  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * PUT /api/properties/:propertyId/images/reorder
 * Réorganiser l'ordre des images
 */
router.put('/:propertyId/images/reorder', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId } = req.params;
    const { imageOrders } = req.body; // Array of { publicId, newOrder }

    if (!Array.isArray(imageOrders)) {
      res.status(400).json({
        success: false,
        error: 'imageOrders doit être un tableau'
      });
      return;
    }

    // Vérifier que la propriété existe
    const property = await Property.findOne({ propertyId });
    if (!property) {
      res.status(404).json({
        success: false,
        error: 'Propriété non trouvée'
      });
      return;
    }

    // Vérifier les permissions
    const user = req.user as any;
    if (property.ownerId.toString() !== user.id && !user.isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Non autorisé à modifier cette propriété'
      });
      return;
    }

    // Mettre à jour l'ordre des images
    imageOrders.forEach(({ publicId, newOrder }: { publicId: string; newOrder: number }) => {
      const imageIndex = property.images.findIndex(img => img.publicId === publicId);
      if (imageIndex !== -1) {
        property.images[imageIndex].order = newOrder;
      }
    });

    // Trier les images par ordre
    property.images.sort((a, b) => a.order - b.order);
    await property.save();

    res.json({
      success: true,
      images: property.images,
      message: 'Ordre des images mis à jour'
    });

  } catch (error) {
    console.error('Error reordering images:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

/**
 * POST /api/properties/:propertyId/images/:publicId/compress
 * Compresser une image existante
 */
router.post('/:propertyId/images/:publicId/compress', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyId, publicId } = req.params;
    const { quality = 85 } = req.body;

    // TODO: Implémenter la compression d'image existante
    res.status(501).json({
      success: false,
      error: 'Fonctionnalité de compression pas encore implémentée'
    });

  } catch (error) {
    console.error('Error compressing image:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// Middleware de gestion d'erreurs Multer
router.use(handleMulterError);

export default router;