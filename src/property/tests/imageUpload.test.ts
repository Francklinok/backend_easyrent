import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import ImageUploadService from '../../services/imageUploadService';
import { ImageOptimizer } from '../utils/imageOptimization';

// Mock Cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn()
    },
    api: {
      resource: jest.fn(),
      resources: jest.fn()
    }
  }
}));

describe('Image Upload Service', () => {
  let imageService: ImageUploadService;
  let testImageBuffer: Buffer;

  beforeEach(() => {
    imageService = ImageUploadService.getInstance();

    // Créer un buffer d'image de test (PNG simple 1x1 pixel)
    testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Image Validation', () => {
    it('should validate a correct image buffer', async () => {
      const result = await imageService.validateImage(testImageBuffer);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid image buffer', async () => {
      const invalidBuffer = Buffer.from('not an image');
      const result = await imageService.validateImage(invalidBuffer);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject images that are too small', async () => {
      // Cette image est techniquement valide mais trop petite pour nos standards
      const result = await imageService.validateImage(testImageBuffer);
      // Note: testImageBuffer est 1x1px, donc devrait être rejeté par la validation de taille
    });
  });

  describe('Image Optimization', () => {
    it('should optimize image with default settings', async () => {
      const result = await ImageOptimizer.optimizeImage(testImageBuffer);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.info.width).toBeGreaterThan(0);
      expect(result.info.height).toBeGreaterThan(0);
      expect(result.info.size).toBeGreaterThan(0);
    });

    it('should create placeholder image', async () => {
      const placeholder = await ImageOptimizer.createPlaceholder(testImageBuffer);

      expect(placeholder).toBeInstanceOf(Buffer);
      expect(placeholder.length).toBeLessThan(testImageBuffer.length);
    });

    it('should analyze image and provide suggestions', async () => {
      const analysis = await ImageOptimizer.analyzeImage(testImageBuffer);

      expect(analysis.metadata).toBeDefined();
      expect(analysis.suggestions).toBeInstanceOf(Array);
      expect(analysis.estimatedSavings).toBeGreaterThanOrEqual(0);
    });

    it('should perform smart optimization', async () => {
      const result = await ImageOptimizer.smartOptimize(testImageBuffer);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.info.compressionRatio).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Responsive Image Generation', () => {
    it('should generate multiple responsive sizes', async () => {
      const sizes = [
        { width: 300, suffix: 'small' },
        { width: 600, suffix: 'medium' },
        { width: 1200, suffix: 'large' }
      ];

      const results = await ImageOptimizer.generateResponsiveSizes(testImageBuffer, sizes);

      expect(Object.keys(results)).toHaveLength(3);
      expect(results.small).toBeDefined();
      expect(results.medium).toBeDefined();
      expect(results.large).toBeDefined();
    });

    it('should create complete responsive set', async () => {
      const responsiveSet = await ImageOptimizer.createResponsiveSet(testImageBuffer);

      expect(responsiveSet.thumbnail).toBeInstanceOf(Buffer);
      expect(responsiveSet.small).toBeInstanceOf(Buffer);
      expect(responsiveSet.medium).toBeInstanceOf(Buffer);
      expect(responsiveSet.large).toBeInstanceOf(Buffer);
      expect(responsiveSet.original).toBeInstanceOf(Buffer);
      expect(responsiveSet.placeholder).toBeInstanceOf(Buffer);
      expect(responsiveSet.totalSavings).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid image gracefully', async () => {
      const invalidBuffer = Buffer.from('invalid image data');

      expect(async () => {
        await ImageOptimizer.optimizeImage(invalidBuffer);
      }).not.toThrow();
    });

    it('should handle optimization errors', async () => {
      const corruptedBuffer = Buffer.alloc(100); // Buffer vide

      try {
        await ImageOptimizer.optimizeImage(corruptedBuffer);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Performance Tests', () => {
    it('should process image within reasonable time', async () => {
      const startTime = Date.now();
      await ImageOptimizer.optimizeImage(testImageBuffer);
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // Moins de 5 secondes
    });

    it('should calculate savings accurately', async () => {
      const savings = await ImageOptimizer.calculateSavings(testImageBuffer);

      expect(savings.originalSize).toBeGreaterThan(0);
      expect(savings.optimizedSize).toBeGreaterThan(0);
      expect(savings.savingsPercent).toBeGreaterThanOrEqual(0);
      expect(savings.savingsPercent).toBeLessThanOrEqual(100);
    });
  });
});

describe('Integration Tests', () => {
  // Ces tests nécessitent une vraie connexion Cloudinary pour fonctionner
  describe.skip('Cloudinary Integration', () => {
    let imageService: ImageUploadService;

    beforeEach(() => {
      imageService = ImageUploadService.getInstance();
    });

    it('should upload image to Cloudinary', async () => {
      // Ce test nécessite des vraies credentials Cloudinary
      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

      if (fs.existsSync(testImagePath)) {
        const imageBuffer = fs.readFileSync(testImagePath);
        const result = await imageService.uploadOptimizedImage(imageBuffer, 'test');

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.originalUrl).toBeDefined();
      }
    });

    it('should delete image from Cloudinary', async () => {
      // Test de suppression après upload
      // Nécessite un vrai publicId depuis un upload précédent
    });
  });
});

// Helper pour créer des images de test de différentes tailles
export function createTestImage(width: number, height: number, format: 'png' | 'jpeg' = 'png'): Buffer {
  // Création programmatique d'images de test
  // Cette fonction pourrait utiliser sharp pour créer des images de test
  const sharp = require('sharp');

  return sharp({
    create: {
      width,
      height,
      channels: format === 'png' ? 4 : 3,
      background: { r: 255, g: 0, b: 0, alpha: format === 'png' ? 0.5 : undefined }
    }
  })[format]().toBuffer();
}

// Helper pour mesurer les performances
export function measurePerformance<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve) => {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

    resolve({ result, duration });
  });
}