import { v2 as cloudinary } from 'cloudinary';

// Configuration Cloudinary
export const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  console.log('✅ Cloudinary configured successfully');
};

// Vérification de la configuration
export const verifyCloudinaryConfig = () => {
  const requiredEnvVars = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Cloudinary environment variables: ${missingVars.join(', ')}`
    );
  }

  return true;
};

// Paramètres d'upload par défaut pour les propriétés
export const defaultPropertyUploadOptions = {
  folder: 'easyrent/properties',
  resource_type: 'image' as const,
  overwrite: true,
  invalidate: true,
  // Optimisations automatiques
  auto: 'color' as const,
  fetch_format: 'auto' as const,
  quality: 'auto' as const,
  // Transformations par défaut
  flags: 'progressive',
  // Limites de sécurité
  max_file_size: 10000000, // 10MB
  // Tags pour l'organisation
  tags: ['property', 'easyrent']
};

// Paramètres pour les différents variants
export const variantOptions = {
  thumbnail: {
    width: 150,
    height: 150,
    crop: 'fill' as const,
    gravity: 'center' as const,
    quality: 80,
    format: 'webp'
  },
  small: {
    width: 400,
    crop: 'scale' as const,
    quality: 85,
    format: 'webp'
  },
  medium: {
    width: 800,
    crop: 'scale' as const,
    quality: 90,
    format: 'webp'
  },
  large: {
    width: 1200,
    crop: 'scale' as const,
    quality: 95,
    format: 'webp'
  },
  original: {
    width: 1920,
    crop: 'scale' as const,
    quality: 100,
    format: 'webp'
  }
};

// Helper pour générer des URLs transformées
export const generateTransformedUrl = (
  publicId: string,
  transformations: Record<string, any>
) => {
  return cloudinary.url(publicId, {
    ...transformations,
    secure: true
  });
};

// Helper pour générer des URLs responsives
export const generateResponsiveUrl = (publicId: string) => {
  return cloudinary.url(publicId, {
    width: 'auto',
    crop: 'scale',
    format: 'auto',
    quality: 'auto',
    responsive: true,
    secure: true
  });
};

// Nettoyage des ressources (utile pour les tests ou la maintenance)
export const cleanupTestImages = async (tag: string = 'test') => {
  try {
    const result = await cloudinary.api.delete_resources_by_tag(tag);
    console.log(`🧹 Cleaned up ${result.deleted.length} test images`);
    return result;
  } catch (error) {
    console.error('Error cleaning up test images:', error);
    throw error;
  }
};

// Statistiques d'utilisation
export const getCloudinaryUsage = async () => {
  try {
    const usage = await cloudinary.api.usage();
    return {
      credits: usage.credits,
      used_credits: usage.used_credits,
      storage: usage.storage,
      bandwidth: usage.bandwidth,
      requests: usage.requests
    };
  } catch (error) {
    console.error('Error fetching Cloudinary usage:', error);
    throw error;
  }
};

export default cloudinary;