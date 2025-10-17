export interface PropertyImage {
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
  uploadedAt: Date;
  order: number;
}

export interface ImageUploadInput {
  file: any; // GraphQL Upload scalar
  order?: number;
}

export interface ImageUploadResponse {
  success: boolean;
  image?: PropertyImage;
  error?: string;
}

export interface MultipleImageUploadResponse {
  success: boolean;
  images: PropertyImage[];
  successCount: number;
  failureCount: number;
  errors: string[];
}

export interface ImageVariantOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png';
}

export interface ImageProcessingOptions {
  thumbnail?: ImageVariantOptions;
  small?: ImageVariantOptions;
  medium?: ImageVariantOptions;
  large?: ImageVariantOptions;
  original?: ImageVariantOptions;
}

export interface ImageDeleteResponse {
  success: boolean;
  deletedPublicId?: string;
  error?: string;
}

export interface ImageReorderInput {
  publicId: string;
  newOrder: number;
}

export interface ImageReorderResponse {
  success: boolean;
  reorderedImages?: PropertyImage[];
  error?: string;
}