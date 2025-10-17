import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import sharp from 'sharp';
import { Readable } from 'stream';

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface ImageVariant {
  width: number;
  height?: number;
  quality: number;
  format: 'webp' | 'jpg' | 'png';
  suffix: string;
}

export interface OptimizedImage {
  publicId: string;
  originalUrl: string;
  variants: {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    original: string;
  };
  metadata: {
    width: number;
    height: number;
    format: string;
    size: number;
    aspectRatio: number;
  };
}

export interface UploadResult {
  success: boolean;
  data?: OptimizedImage;
  error?: string;
}

export class ImageUploadService {
  private static instance: ImageUploadService;

  // Définition des variants d'images
  private readonly imageVariants: Record<string, ImageVariant> = {
    thumbnail: { width: 150, height: 150, quality: 80, format: 'webp', suffix: '_thumb' },
    small: { width: 300, quality: 85, format: 'webp', suffix: '_sm' },
    medium: { width: 600, quality: 90, format: 'webp', suffix: '_md' },
    large: { width: 1200, quality: 95, format: 'webp', suffix: '_lg' },
    original: { width: 1920, quality: 100, format: 'webp', suffix: '_orig' }
  };

  private constructor() {}

  static getInstance(): ImageUploadService {
    if (!ImageUploadService.instance) {
      ImageUploadService.instance = new ImageUploadService();
    }
    return ImageUploadService.instance;
  }

  /**
   * Upload et optimise une image avec plusieurs variants
   */
  async uploadOptimizedImage(
    imageBuffer: Buffer,
    folder: string = 'properties',
    filename?: string
  ): Promise<UploadResult> {
    try {
      // Obtenir les métadonnées de l'image originale
      const metadata = await sharp(imageBuffer).metadata();

      if (!metadata.width || !metadata.height) {
        return { success: false, error: 'Impossible de lire les métadonnées de l\'image' };
      }

      // Valider le format d'image
      if (!['jpeg', 'jpg', 'png', 'webp'].includes(metadata.format || '')) {
        return { success: false, error: 'Format d\'image non supporté. Utilisez JPG, PNG ou WebP.' };
      }

      // Valider la taille (max 10MB)
      if (imageBuffer.length > 10 * 1024 * 1024) {
        return { success: false, error: 'L\'image est trop volumineuse (max 10MB).' };
      }

      const publicId = filename || `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Créer tous les variants
      const variants: Record<string, string> = {};

      for (const [variantName, config] of Object.entries(this.imageVariants)) {
        try {
          const optimizedBuffer = await this.optimizeImage(imageBuffer, config);
          const uploadResult = await this.uploadToCloudinary(
            optimizedBuffer,
            `${publicId}${config.suffix}`,
            folder
          );

          variants[variantName] = uploadResult.secure_url;
        } catch (error) {
          console.error(`Erreur lors de la création du variant ${variantName}:`, error);
          // Continuer avec les autres variants même si un échoue
        }
      }

      // S'assurer qu'on a au moins un variant
      if (Object.keys(variants).length === 0) {
        return { success: false, error: 'Impossible de créer les variants d\'image' };
      }

      const optimizedImage: OptimizedImage = {
        publicId,
        originalUrl: variants.original || variants.large || Object.values(variants)[0],
        variants: {
          thumbnail: variants.thumbnail || variants.small || Object.values(variants)[0],
          small: variants.small || variants.medium || Object.values(variants)[0],
          medium: variants.medium || variants.large || Object.values(variants)[0],
          large: variants.large || variants.original || Object.values(variants)[0],
          original: variants.original || variants.large || Object.values(variants)[0]
        },
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format || 'unknown',
          size: imageBuffer.length,
          aspectRatio: metadata.width / metadata.height
        }
      };

      return { success: true, data: optimizedImage };

    } catch (error) {
      console.error('Erreur lors de l\'upload d\'image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de l\'upload'
      };
    }
  }

  /**
   * Upload multiple images en parallèle
   */
  async uploadMultipleImages(
    images: Buffer[],
    folder: string = 'properties'
  ): Promise<{
    success: boolean;
    results: UploadResult[];
    successCount: number;
    failureCount: number;
  }> {
    const results = await Promise.allSettled(
      images.map(imageBuffer => this.uploadOptimizedImage(imageBuffer, folder))
    );

    const mappedResults: UploadResult[] = results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return { success: false, error: result.reason?.message || 'Erreur inconnue' };
      }
    });

    const successCount = mappedResults.filter(r => r.success).length;
    const failureCount = mappedResults.length - successCount;

    return {
      success: successCount > 0,
      results: mappedResults,
      successCount,
      failureCount
    };
  }

  /**
   * Supprime une image et tous ses variants de Cloudinary
   */
  async deleteImage(publicId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Supprimer tous les variants
      const deletePromises = Object.values(this.imageVariants).map(variant =>
        cloudinary.uploader.destroy(`${publicId}${variant.suffix}`)
      );

      await Promise.allSettled(deletePromises);

      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la suppression d\'image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la suppression'
      };
    }
  }

  /**
   * Optimise une image selon la configuration donnée
   */
  private async optimizeImage(imageBuffer: Buffer, config: ImageVariant): Promise<Buffer> {
    let sharpInstance = sharp(imageBuffer);

    // Redimensionner
    if (config.height) {
      sharpInstance = sharpInstance.resize(config.width, config.height, {
        fit: 'cover',
        position: 'center'
      });
    } else {
      sharpInstance = sharpInstance.resize(config.width, null, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Appliquer le format et la qualité
    switch (config.format) {
      case 'webp':
        sharpInstance = sharpInstance.webp({
          quality: config.quality,
          effort: 6, // Meilleure compression
          smartSubsample: true
        });
        break;
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({
          quality: config.quality,
          progressive: true,
          mozjpeg: true
        });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({
          quality: config.quality,
          compressionLevel: 9,
          adaptiveFiltering: true
        });
        break;
    }

    // Optimisations supplémentaires
    return sharpInstance
      .sharpen() // Léger sharpening
      .normalise() // Normaliser l'exposition
      .toBuffer();
  }

  /**
   * Upload vers Cloudinary avec options optimisées
   */
  private async uploadToCloudinary(
    buffer: Buffer,
    publicId: string,
    folder: string
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder: folder,
          resource_type: 'image',
          overwrite: true,
          invalidate: true,
          // Optimisations Cloudinary
          auto: 'color', // Optimisation automatique des couleurs
          fetch_format: 'auto', // Format automatique selon le navigateur
          quality: 'auto', // Qualité automatique
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result);
          } else {
            reject(new Error('Résultat d\'upload vide'));
          }
        }
      );

      const stream = Readable.from(buffer);
      stream.pipe(uploadStream);
    });
  }

  /**
   * Génère des URLs optimisées pour différents contextes
   */
  generateOptimizedUrls(publicId: string): Record<string, string> {
    const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;

    return {
      thumbnail: `${baseUrl}/w_150,h_150,c_fill,f_webp,q_80/${publicId}_thumb`,
      small: `${baseUrl}/w_300,c_scale,f_webp,q_85/${publicId}_sm`,
      medium: `${baseUrl}/w_600,c_scale,f_webp,q_90/${publicId}_md`,
      large: `${baseUrl}/w_1200,c_scale,f_webp,q_95/${publicId}_lg`,
      original: `${baseUrl}/w_1920,c_scale,f_webp,q_100/${publicId}_orig`,
      // URLs responsives
      responsive: `${baseUrl}/w_auto,c_scale,f_auto,q_auto/${publicId}_lg`,
      // URL avec placeholder en cas de chargement lent
      placeholder: `${baseUrl}/w_50,h_50,c_fill,e_blur:300,f_webp,q_30/${publicId}_thumb`
    };
  }

  /**
   * Valide qu'un buffer est une image valide
   */
  async validateImage(buffer: Buffer): Promise<{ isValid: boolean; error?: string }> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        return { isValid: false, error: 'Fichier non reconnu comme image' };
      }

      if (metadata.width > 5000 || metadata.height > 5000) {
        return { isValid: false, error: 'Image trop grande (max 5000x5000px)' };
      }

      if (metadata.width < 100 || metadata.height < 100) {
        return { isValid: false, error: 'Image trop petite (min 100x100px)' };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: 'Impossible de traiter le fichier comme une image'
      };
    }
  }

  /**
   * Obtient les informations d'une image depuis Cloudinary
   */
  async getImageInfo(publicId: string): Promise<any> {
    try {
      return await cloudinary.api.resource(publicId);
    } catch (error) {
      console.error('Erreur lors de la récupération des infos image:', error);
      return null;
    }
  }

  /**
   * Liste toutes les images d'un dossier
   */
  async listImages(folder: string, maxResults: number = 100): Promise<any[]> {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: maxResults,
        resource_type: 'image'
      });
      return result.resources;
    } catch (error) {
      console.error('Erreur lors de la liste des images:', error);
      return [];
    }
  }
}

export default ImageUploadService;