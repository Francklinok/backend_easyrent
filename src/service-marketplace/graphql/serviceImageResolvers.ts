import { AuthenticationError, UserInputError } from '../../graphql/errors';
import { Service } from '../models/Service';
import ImageUploadService from '../../services/imageUploadService';
import GraphQLUpload from 'graphql-upload';

export const serviceImageResolvers = {
  Upload: GraphQLUpload,

  Query: {
    getServiceImages: async (_: any, { serviceId }: { serviceId: string }, { user }: any) => {
      if (!user) throw new AuthenticationError('Authentication required');

      const service = await Service.findById(serviceId);
      if (!service) {
        throw new UserInputError('Service not found');
      }

      // Convert photo URLs to PropertyImage format
      return service.media.photos.map((photo, index) => ({
        publicId: `service_${serviceId}_${index}`,
        originalUrl: photo,
        variants: {
          thumbnail: photo,
          small: photo,
          medium: photo,
          large: photo,
          original: photo
        },
        metadata: {
          width: 800,
          height: 600,
          format: 'webp',
          size: 0,
          aspectRatio: 1.33
        },
        uploadedAt: service.createdAt,
        order: index
      }));
    }
  },

  Mutation: {
    uploadServiceImage: async (
      _: any,
      { serviceId, file, order = 0 }: { serviceId: string; file: any; order?: number },
      { user }: any
    ) => {
      if (!user) throw new AuthenticationError('Authentication required');

      try {
        const service = await Service.findOne({ _id: serviceId, providerId: user.userId });
        if (!service) {
          return { success: false, error: 'Service not found or unauthorized' };
        }

        const { createReadStream } = await file;
        const stream = createReadStream();

        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        const imageService = ImageUploadService.getInstance();
        const validation = await imageService.validateImage(buffer);
        if (!validation.isValid) {
          return { success: false, error: validation.error };
        }

        const uploadResult = await imageService.uploadOptimizedImage(
          buffer,
          `services/${service.category}/${serviceId}`,
          `${serviceId}_${Date.now()}`
        );

        if (!uploadResult.success || !uploadResult.data) {
          return { success: false, error: uploadResult.error || 'Upload failed' };
        }

        const propertyImage = {
          publicId: uploadResult.data.publicId,
          originalUrl: uploadResult.data.originalUrl,
          variants: uploadResult.data.variants,
          metadata: uploadResult.data.metadata,
          uploadedAt: new Date(),
          order: order || service.media.photos.length
        };

        service.media.photos.push(uploadResult.data.originalUrl);
        await service.save();

        return { success: true, image: propertyImage };

      } catch (error: any) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    },

    uploadMultipleServiceImages: async (
      _: any,
      { serviceId, images }: { serviceId: string; images: any[] },
      { user }: any
    ) => {
      if (!user) throw new AuthenticationError('Authentication required');

      try {
        const service = await Service.findOne({ _id: serviceId, providerId: user.userId });
        if (!service) {
          return { success: false, images: [], successCount: 0, failureCount: images.length, errors: ['Service not found or unauthorized'] };
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
              `services/${service.category}/${serviceId}`,
              `${serviceId}_${Date.now()}_${index}`
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
                  order: imageInput.order || service.media.photos.length + index
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
        const successfulUploads = results.filter(r => r.success) as Array<{ success: true; image: any }>;
        const failedUploads = results.filter(r => !r.success) as Array<{ success: false; error: string }>;

        const newImages = successfulUploads.map(r => r.image);
        service.media.photos.push(...newImages.map(img => img.originalUrl));
        await service.save();

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

    deleteServiceImage: async (
      _: any,
      { serviceId, publicId }: { serviceId: string; publicId: string },
      { user }: any
    ) => {
      if (!user) throw new AuthenticationError('Authentication required');

      try {
        const service = await Service.findOne({ _id: serviceId, providerId: user.userId });
        if (!service) {
          return { success: false, error: 'Service not found or unauthorized' };
        }

        const imageService = ImageUploadService.getInstance();
        const deleteResult = await imageService.deleteImage(publicId);

        if (!deleteResult.success) {
          return { success: false, error: deleteResult.error || 'Failed to delete from Cloudinary' };
        }

        service.media.photos = service.media.photos.filter(photo => !photo.includes(publicId));
        await service.save();

        return { success: true, deletedPublicId: publicId };

      } catch (error: any) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  }
};

export default serviceImageResolvers;
