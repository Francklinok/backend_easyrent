import { AuthenticationError, ForbiddenError, UserInputError } from '../../graphql/errors';
import { PubSub } from 'graphql-subscriptions';
import GraphQLUpload from 'graphql-upload-ts';
import Property from '../model/propertyModel';
import ImageUploadService from '../../services/imageUploadService';
import {
  PropertyImage,
  ImageUploadResponse,
  MultipleImageUploadResponse,
  ImageDeleteResponse,
  ImageReorderResponse,
  ImageReorderInput
} from '../types/imageTypes';

const pubsub: any = new PubSub();

// Events
const IMAGE_UPLOAD_PROGRESS = 'IMAGE_UPLOAD_PROGRESS';
const IMAGE_PROCESSING_COMPLETE = 'IMAGE_PROCESSING_COMPLETE';

export const imageResolvers = {
  Upload: GraphQLUpload,

  Query: {
    getPropertyImages: async (_: any, { propertyId }: { propertyId: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      const property = await Property.findOne({ propertyId });
      if (!property) {
        throw new UserInputError('Property not found');
      }

      return property.images || [];
    },

    getImageInfo: async (_: any, { publicId }: { publicId: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      const imageService = ImageUploadService.getInstance();
      const imageInfo = await imageService.getImageInfo(publicId);

      if (!imageInfo) {
        throw new UserInputError('Image not found');
      }

      return {
        publicId: imageInfo.public_id,
        originalUrl: imageInfo.secure_url,
        metadata: {
          width: imageInfo.width,
          height: imageInfo.height,
          format: imageInfo.format,
          size: imageInfo.bytes,
          aspectRatio: imageInfo.width / imageInfo.height
        }
      };
    }
  },

  Mutation: {
    uploadPropertyImage: async (
      _: any,
      { propertyId, file, order = 0 }: { propertyId: string; file: any; order?: number },
      { user }: any
    ): Promise<ImageUploadResponse> => {
      if (!user) throw new AuthenticationError('Authentication required');

      try {
        // Vérifier que la propriété existe et que l'utilisateur en est le propriétaire
        const property = await Property.findOne({ propertyId });
        if (!property) {
          return { success: false, error: 'Property not found' };
        }

        if (property.ownerId.toString() !== user.id && !user.isAdmin) {
          return { success: false, error: 'Not authorized to upload images for this property' };
        }

        const { createReadStream } = await file;
        const stream = createReadStream();

        // Convertir le stream en buffer
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Valider l'image
        const imageService = ImageUploadService.getInstance();
        const validation = await imageService.validateImage(buffer);
        if (!validation.isValid) {
          return { success: false, error: validation.error };
        }

        // Publier le progrès
        pubsub.publish(IMAGE_UPLOAD_PROGRESS, {
          imageUploadProgress: {
            propertyId,
            publicId: 'uploading',
            progress: 0.1,
            stage: 'Starting upload',
            completed: false
          }
        });

        // Upload l'image
        const uploadResult = await imageService.uploadOptimizedImage(
          buffer,
          `properties/${propertyId}`,
          `${propertyId}_${Date.now()}`
        );

        if (!uploadResult.success || !uploadResult.data) {
          return { success: false, error: uploadResult.error || 'Upload failed' };
        }

        // Publier le progrès
        pubsub.publish(IMAGE_UPLOAD_PROGRESS, {
          imageUploadProgress: {
            propertyId,
            publicId: uploadResult.data.publicId,
            progress: 0.8,
            stage: 'Processing variants',
            completed: false
          }
        });

        // Créer l'objet PropertyImage
        const propertyImage: PropertyImage = {
          publicId: uploadResult.data.publicId,
          originalUrl: uploadResult.data.originalUrl,
          variants: uploadResult.data.variants,
          metadata: uploadResult.data.metadata,
          uploadedAt: new Date(),
          order: order || property.images.length
        };

        // Ajouter l'image à la propriété
        property.images.push(propertyImage);
        await property.save();

        // Publier la completion
        pubsub.publish(IMAGE_UPLOAD_PROGRESS, {
          imageUploadProgress: {
            propertyId,
            publicId: uploadResult.data.publicId,
            progress: 1.0,
            stage: 'Complete',
            completed: true
          }
        });

        pubsub.publish(IMAGE_PROCESSING_COMPLETE, {
          imageProcessingComplete: propertyImage,
          propertyId
        });

        return { success: true, image: propertyImage };

      } catch (error: any) {
        console.error('Error uploading image:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    },

    uploadMultiplePropertyImages: async (
      _: any,
      { propertyId, images }: { propertyId: string; images: any[] },
      { user }: any
    ): Promise<MultipleImageUploadResponse> => {
      if (!user) throw new AuthenticationError('Authentication required');

      try {
        const property = await Property.findOne({ propertyId });
        if (!property) {
          return { success: false, images: [], successCount: 0, failureCount: images.length, errors: ['Property not found'] };
        }

        if (property.ownerId.toString() !== user.id && !user.isAdmin) {
          return { success: false, images: [], successCount: 0, failureCount: images.length, errors: ['Not authorized'] };
        }

        const uploadPromises = images.map(async (imageInput, index) => {
          try {
            const { createReadStream } = await imageInput.file;
            const stream = createReadStream();

            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            const imageService = ImageUploadService.getInstance();
            const uploadResult = await imageService.uploadOptimizedImage(
              buffer,
              `properties/${propertyId}`,
              `${propertyId}_${Date.now()}_${index}`
            );

            if (uploadResult.success && uploadResult.data) {
              return {
                success: true,
                image: {
                  publicId: uploadResult.data.publicId,
                  originalUrl: uploadResult.data.originalUrl,
                  variants: uploadResult.data.variants,
                  metadata: uploadResult.data.metadata,
                  uploadedAt: new Date(),
                  order: imageInput.order || property.images.length + index
                }
              };
            } else {
              return { success: false, error: uploadResult.error || 'Upload failed' };
            }
          } catch (error: any) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        });

        const results = await Promise.all(uploadPromises);
        const successfulUploads = results.filter(r => r.success) as Array<{ success: true; image: PropertyImage }>;
        const failedUploads = results.filter(r => !r.success) as Array<{ success: false; error: string }>;

        // Ajouter les images réussies à la propriété
        const newImages = successfulUploads.map(r => r.image);
        property.images.push(...newImages);
        await property.save();

        return {
          success: successfulUploads.length > 0,
          images: newImages,
          successCount: successfulUploads.length,
          failureCount: failedUploads.length,
          errors: failedUploads.map(f => f.error)
        };

      } catch (error: any) {
        return {
          success: false,
          images: [],
          successCount: 0,
          failureCount: images.length,
          errors: [error instanceof Error ? error.message : 'Unknown error occurred']
        };
      }
    },

    deletePropertyImage: async (
      _: any,
      { propertyId, publicId }: { propertyId: string; publicId: string },
      { user }: any
    ): Promise<ImageDeleteResponse> => {
      if (!user) throw new AuthenticationError('Authentication required');

      try {
        const property = await Property.findOne({ propertyId });
        if (!property) {
          return { success: false, error: 'Property not found' };
        }

        if (property.ownerId.toString() !== user.id && !user.isAdmin) {
          return { success: false, error: 'Not authorized' };
        }

        // Vérifier que l'image existe
        const imageIndex = property.images.findIndex(img => img.publicId === publicId);
        if (imageIndex === -1) {
          return { success: false, error: 'Image not found' };
        }

        // Supprimer de Cloudinary
        const imageService = ImageUploadService.getInstance();
        const deleteResult = await imageService.deleteImage(publicId);

        if (!deleteResult.success) {
          return { success: false, error: deleteResult.error || 'Failed to delete from Cloudinary' };
        }

        // Supprimer de la base de données
        property.images.splice(imageIndex, 1);
        await property.save();

        return { success: true, deletedPublicId: publicId };

      } catch (error: any) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    },

    reorderPropertyImages: async (
      _: any,
      { propertyId, imageOrders }: { propertyId: string; imageOrders: ImageReorderInput[] },
      { user }: any
    ): Promise<ImageReorderResponse> => {
      if (!user) throw new AuthenticationError('Authentication required');

      try {
        const property = await Property.findOne({ propertyId });
        if (!property) {
          return { success: false, error: 'Property not found' };
        }

        if (property.ownerId.toString() !== user.id && !user.isAdmin) {
          return { success: false, error: 'Not authorized' };
        }

        // Mettre à jour l'ordre des images
        imageOrders.forEach(({ publicId, newOrder }) => {
          const imageIndex = property.images.findIndex(img => img.publicId === publicId);
          if (imageIndex !== -1) {
            property.images[imageIndex].order = newOrder;
          }
        });

        // Trier les images par ordre
        property.images.sort((a, b) => a.order - b.order);

        await property.save();

        return { success: true, reorderedImages: property.images };

      } catch (error: any) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    },

    replacePropertyImage: async (
      _: any,
      { propertyId, oldPublicId, newFile, order }: {
        propertyId: string;
        oldPublicId: string;
        newFile: any;
        order?: number;
      },
      { user }: any
    ): Promise<ImageUploadResponse> => {
      if (!user) throw new AuthenticationError('Authentication required');

      try {
        const property = await Property.findOne({ propertyId });
        if (!property) {
          return { success: false, error: 'Property not found' };
        }

        if (property.ownerId.toString() !== user.id && !user.isAdmin) {
          return { success: false, error: 'Not authorized' };
        }

        // Trouver l'ancienne image
        const imageIndex = property.images.findIndex(img => img.publicId === oldPublicId);
        if (imageIndex === -1) {
          return { success: false, error: 'Image not found' };
        }

        // Upload la nouvelle image
        const { createReadStream } = await newFile;
        const stream = createReadStream();

        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        const imageService = ImageUploadService.getInstance();
        const uploadResult = await imageService.uploadOptimizedImage(
          buffer,
          `properties/${propertyId}`,
          `${propertyId}_${Date.now()}_replacement`
        );

        if (!uploadResult.success || !uploadResult.data) {
          return { success: false, error: uploadResult.error || 'Upload failed' };
        }

        // Supprimer l'ancienne image de Cloudinary
        await imageService.deleteImage(oldPublicId);

        // Remplacer dans la base de données
        const newPropertyImage: PropertyImage = {
          publicId: uploadResult.data.publicId,
          originalUrl: uploadResult.data.originalUrl,
          variants: uploadResult.data.variants,
          metadata: uploadResult.data.metadata,
          uploadedAt: new Date(),
          order: order || property.images[imageIndex].order
        };

        property.images[imageIndex] = newPropertyImage;
        await property.save();

        return { success: true, image: newPropertyImage };

      } catch (error: any) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    },

    compressPropertyImages: async (
      _: any,
      { propertyId, quality = 85 }: { propertyId: string; quality?: number },
      { user }: any
    ): Promise<MultipleImageUploadResponse> => {
      if (!user) throw new AuthenticationError('Authentication required');

      // TODO: Implémenter la compression des images existantes
      return {
        success: false,
        images: [],
        successCount: 0,
        failureCount: 0,
        errors: ['Compression feature not yet implemented']
      };
    },

    generateImageVariants: async (
      _: any,
      { propertyId, publicId }: { propertyId: string; publicId: string },
      { user }: any
    ): Promise<ImageUploadResponse> => {
      if (!user) throw new AuthenticationError('Authentication required');

      // TODO: Implémenter la génération de variants pour images existantes
      return {
        success: false,
        error: 'Variant generation feature not yet implemented'
      };
    }
  },

  Subscription: {
    imageUploadProgress: {
      subscribe: (_: any, { propertyId }: { propertyId: string }, { user }: any) => {
        if (!user) throw new AuthenticationError('Authentication required');
        return pubsub.asyncIterator([IMAGE_UPLOAD_PROGRESS]);
      },
      resolve: (payload: any, { propertyId }: { propertyId: string }) => {
        return payload.imageUploadProgress.propertyId === propertyId ? payload.imageUploadProgress : null;
      }
    },

    imageProcessingComplete: {
      subscribe: (_: any, { propertyId }: { propertyId: string }, { user }: any) => {
        if (!user) throw new AuthenticationError('Authentication required');
        return pubsub.asyncIterator([IMAGE_PROCESSING_COMPLETE]);
      },
      resolve: (payload: any, { propertyId }: { propertyId: string }) => {
        return payload.propertyId === propertyId ? payload.imageProcessingComplete : null;
      }
    }
  }
};

export default imageResolvers;