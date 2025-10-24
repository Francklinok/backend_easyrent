import express, { NextFunction, Request, Response } from 'express';
import { multipleImageUpload, singleImageUpload, handleMulterError } from '../../middleware/multerConfig';
import ImageUploadService from '../../services/imageUploadService';

const router = express.Router();

// Middleware d'authentification (à adapter selon votre système)
const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  next();
};

/**
 * POST /api/upload/images
 * Upload une seule image sans propriété
 */
router.post('/images', requireAuth, singleImageUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni'
      });
      return;
    }

    const user = req.user as any;
    const userId = user.userId || user.id;

    // Upload l'image
    const imageService = ImageUploadService.getInstance();
    const uploadResult = await imageService.uploadOptimizedImage(
      file.buffer,
      `temp/users/${userId}`,
      `${userId}_${Date.now()}`
    );

    if (!uploadResult.success || !uploadResult.data) {
      res.status(500).json({
        success: false,
        error: uploadResult.error || 'Échec de l\'upload'
      });
      return;
    }

    // Retourner l'objet image complet
    res.status(201).json({
      success: true,
      image: {
        publicId: uploadResult.data.publicId,
        originalUrl: uploadResult.data.originalUrl,
        variants: uploadResult.data.variants,
        metadata: uploadResult.data.metadata,
        uploadedAt: new Date(),
        order: 0
      },
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
 * POST /api/upload/images/multiple
 * Upload plusieurs images sans propriété
 */
router.post('/images/multiple', requireAuth, multipleImageUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni'
      });
      return;
    }

    const user = req.user as any;
    const userId = user.userId || user.id;

    // Upload toutes les images
    const imageService = ImageUploadService.getInstance();
    const buffers = files.map(file => file.buffer);

    const uploadResult = await imageService.uploadMultipleImages(
      buffers,
      `temp/users/${userId}`
    );

    if (!uploadResult.success) {
      res.status(500).json({
        success: false,
        error: 'Échec de l\'upload multiple',
        details: uploadResult.results
      });
      return;
    }

    // Créer les objets image pour les uploads réussis
    const newImages = uploadResult.results
      .filter(result => result.success && result.data)
      .map((result, index) => ({
        publicId: result.data!.publicId,
        originalUrl: result.data!.originalUrl,
        variants: result.data!.variants,
        metadata: result.data!.metadata,
        uploadedAt: new Date(),
        order: index
      }));

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

// Middleware de gestion d'erreurs Multer
router.use(handleMulterError);

export default router;
