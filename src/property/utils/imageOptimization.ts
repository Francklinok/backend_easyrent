import sharp from 'sharp';

export interface OptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  progressive?: boolean;
  stripMetadata?: boolean;
  blur?: number;
  sharpen?: boolean;
  normalize?: boolean;
}

export interface OptimizationResult {
  buffer: Buffer;
  info: {
    format: string;
    width: number;
    height: number;
    size: number;
    originalSize: number;
    compressionRatio: number;
  };
}

export class ImageOptimizer {
  /**
   * Optimise une image avec les options données
   */
  static async optimizeImage(
    inputBuffer: Buffer,
    options: OptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 85,
      format = 'webp',
      progressive = true,
      stripMetadata = true,
      blur,
      sharpen = false,
      normalize = false
    } = options;

    const originalSize = inputBuffer.length;
    let sharpInstance = sharp(inputBuffer);

    // Obtenir les métadonnées originales
    const metadata = await sharpInstance.metadata();

    // Redimensionner si nécessaire
    if (metadata.width && metadata.height) {
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
    }

    // Appliquer les transformations
    if (normalize) {
      sharpInstance = sharpInstance.normalise();
    }

    if (sharpen) {
      sharpInstance = sharpInstance.sharpen();
    }

    if (blur && blur > 0) {
      sharpInstance = sharpInstance.blur(blur);
    }

    // Supprimer les métadonnées EXIF si demandé
    if (stripMetadata) {
      sharpInstance = sharpInstance.withMetadata({
        density: 72, // Résolution web standard
        orientation: 1 // Orientation normale
      });
    }

    // Appliquer le format et la compression
    switch (format) {
      case 'webp':
        sharpInstance = sharpInstance.webp({
          quality,
          effort: 6, // Effort de compression maximal
          smartSubsample: true,
          // progressive
        });
        break;

      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({
          quality,
          progressive,
          mozjpeg: true, // Utiliser mozjpeg pour une meilleure compression
          trellisQuantisation: true,
          overshootDeringing: true,
          optimiseScans: true
        });
        break;

      case 'png':
        sharpInstance = sharpInstance.png({
          quality,
          compressionLevel: 9,
          adaptiveFiltering: true,
          progressive
        });
        break;
    }

    // Générer l'image optimisée
    const result = await sharpInstance.toBuffer({ resolveWithObject: true });

    return {
      buffer: result.data,
      info: {
        format: result.info.format,
        width: result.info.width,
        height: result.info.height,
        size: result.info.size,
        originalSize,
        compressionRatio: ((originalSize - result.info.size) / originalSize) * 100
      }
    };
  }

  /**
   * Crée un placeholder flou ultra-léger
   */
  static async createPlaceholder(
    inputBuffer: Buffer,
    width: number = 20,
    quality: number = 20
  ): Promise<Buffer> {
    return sharp(inputBuffer)
      .resize(width, null, { fit: 'inside' })
      .blur(2)
      .webp({ quality })
      .toBuffer();
  }

  /**
   * Génère plusieurs tailles pour la même image
   */
  static async generateResponsiveSizes(
    inputBuffer: Buffer,
    sizes: { width: number; suffix: string; quality?: number }[]
  ): Promise<Record<string, OptimizationResult>> {
    const results: Record<string, OptimizationResult> = {};

    for (const size of sizes) {
      const optimized = await this.optimizeImage(inputBuffer, {
        maxWidth: size.width,
        quality: size.quality || 85,
        format: 'webp'
      });

      results[size.suffix] = optimized;
    }

    return results;
  }

  /**
   * Analyse la qualité et suggère des optimisations
   */
  static async analyzeImage(inputBuffer: Buffer): Promise<{
    metadata: any;
    suggestions: string[];
    estimatedSavings: number;
  }> {
    const metadata = await sharp(inputBuffer).metadata();
    const suggestions: string[] = [];
    let estimatedSavings = 0;

    // Analyser la taille
    if (inputBuffer.length > 5 * 1024 * 1024) { // > 5MB
      suggestions.push('Image très volumineuse, compression fortement recommandée');
      estimatedSavings += 60;
    } else if (inputBuffer.length > 2 * 1024 * 1024) { // > 2MB
      suggestions.push('Image volumineuse, compression recommandée');
      estimatedSavings += 40;
    }

    // Analyser les dimensions
    if (metadata.width && metadata.width > 2000) {
      suggestions.push('Redimensionnement recommandé pour le web');
      estimatedSavings += 30;
    }

    // Analyser le format
    if (metadata.format === 'png' && !metadata.hasAlpha) {
      suggestions.push('Conversion en JPEG/WebP recommandée (pas de transparence)');
      estimatedSavings += 50;
    }

    if (metadata.format !== 'webp') {
      suggestions.push('Conversion en WebP pour une meilleure compression');
      estimatedSavings += 25;
    }

    // Analyser la densité
    if (metadata.density && metadata.density > 150) {
      suggestions.push('Réduction de la densité pour le web');
      estimatedSavings += 15;
    }

    return {
      metadata,
      suggestions,
      estimatedSavings: Math.min(estimatedSavings, 80) // Cap à 80%
    };
  }

  /**
   * Optimisation automatique intelligente
   */
  static async smartOptimize(inputBuffer: Buffer): Promise<OptimizationResult> {
    const analysis = await this.analyzeImage(inputBuffer);
    const metadata = analysis.metadata;

    // Déterminer les options optimales
    let quality = 85;
    let maxWidth = 1920;
    let format: 'webp' | 'jpeg' | 'png' = 'webp';

    // Ajuster selon la taille du fichier
    if (inputBuffer.length > 5 * 1024 * 1024) {
      quality = 75;
      maxWidth = 1600;
    } else if (inputBuffer.length > 2 * 1024 * 1024) {
      quality = 80;
      maxWidth = 1800;
    }

    // Ajuster selon les dimensions
    if (metadata.width && metadata.width > 3000) {
      maxWidth = 2000;
      quality = 80;
    }

    // Préserver la transparence
    if (metadata.hasAlpha) {
      format = 'webp'; // WebP supporte la transparence
    }

    return this.optimizeImage(inputBuffer, {
      maxWidth,
      quality,
      format,
      progressive: true,
      stripMetadata: true,
      sharpen: true,
      normalize: true
    });
  }

  /**
   * Crée un set complet d'images responsives
   */
  static async createResponsiveSet(inputBuffer: Buffer): Promise<{
    thumbnail: Buffer;
    small: Buffer;
    medium: Buffer;
    large: Buffer;
    original: Buffer;
    placeholder: Buffer;
    totalSavings: number;
  }> {
    const originalSize = inputBuffer.length;

    // Génération en parallèle pour optimiser les performances
    const [thumbnail, small, medium, large, original, placeholder] = await Promise.all([
      this.optimizeImage(inputBuffer, { maxWidth: 150, maxHeight: 150, quality: 80 }),
      this.optimizeImage(inputBuffer, { maxWidth: 400, quality: 85 }),
      this.optimizeImage(inputBuffer, { maxWidth: 800, quality: 90 }),
      this.optimizeImage(inputBuffer, { maxWidth: 1200, quality: 95 }),
      this.smartOptimize(inputBuffer),
      this.createPlaceholder(inputBuffer)
    ]);

    const totalOptimizedSize = thumbnail.info.size + small.info.size +
                               medium.info.size + large.info.size + original.info.size;

    const totalSavings = ((originalSize * 5 - totalOptimizedSize) / (originalSize * 5)) * 100;

    return {
      thumbnail: thumbnail.buffer,
      small: small.buffer,
      medium: medium.buffer,
      large: large.buffer,
      original: original.buffer,
      placeholder,
      totalSavings
    };
  }

  /**
   * Valide qu'un buffer est une image valide
   */
  static async validateImage(buffer: Buffer): Promise<{
    isValid: boolean;
    error?: string;
    metadata?: any;
  }> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        return { isValid: false, error: 'Dimensions invalides' };
      }

      if (metadata.width < 50 || metadata.height < 50) {
        return { isValid: false, error: 'Image trop petite (min 50x50px)' };
      }

      if (metadata.width > 10000 || metadata.height > 10000) {
        return { isValid: false, error: 'Image trop grande (max 10000x10000px)' };
      }

      return { isValid: true, metadata };

    } catch (error) {
      return {
        isValid: false,
        error: 'Fichier non reconnu comme image valide'
      };
    }
  }

  /**
   * Calcule les économies potentielles
   */
  static async calculateSavings(
    inputBuffer: Buffer,
    targetQuality: number = 85
  ): Promise<{
    originalSize: number;
    optimizedSize: number;
    savings: number;
    savingsPercent: number;
  }> {
    const originalSize = inputBuffer.length;
    const optimized = await this.smartOptimize(inputBuffer);

    const savings = originalSize - optimized.info.size;
    const savingsPercent = (savings / originalSize) * 100;

    return {
      originalSize,
      optimizedSize: optimized.info.size,
      savings,
      savingsPercent
    };
  }
}

export default ImageOptimizer;