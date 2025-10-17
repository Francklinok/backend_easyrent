import { gql } from 'graphql-tag';

export const imageTypeDefs = gql`
  scalar Upload

  type PropertyImageVariants {
    thumbnail: String!
    small: String!
    medium: String!
    large: String!
    original: String!
  }

  type PropertyImageMetadata {
    width: Int!
    height: Int!
    format: String!
    size: Int!
    aspectRatio: Float!
  }

  type PropertyImage {
    publicId: String!
    originalUrl: String!
    variants: PropertyImageVariants!
    metadata: PropertyImageMetadata!
    uploadedAt: String!
    order: Int!
  }

  type ImageUploadResponse {
    success: Boolean!
    image: PropertyImage
    error: String
  }

  type MultipleImageUploadResponse {
    success: Boolean!
    images: [PropertyImage!]!
    successCount: Int!
    failureCount: Int!
    errors: [String!]!
  }

  type ImageDeleteResponse {
    success: Boolean!
    deletedPublicId: String
    error: String
  }

  type ImageReorderResponse {
    success: Boolean!
    reorderedImages: [PropertyImage!]
    error: String
  }

  input ImageUploadInput {
    file: Upload!
    order: Int
  }

  input ImageReorderInput {
    publicId: String!
    newOrder: Int!
  }

  extend type Query {
    getPropertyImages(propertyId: String!): [PropertyImage!]!
    getImageInfo(publicId: String!): PropertyImage
  }

  extend type Mutation {
    uploadPropertyImage(
      propertyId: String!
      file: Upload!
      order: Int
    ): ImageUploadResponse!

    uploadMultiplePropertyImages(
      propertyId: String!
      images: [ImageUploadInput!]!
    ): MultipleImageUploadResponse!

    deletePropertyImage(
      propertyId: String!
      publicId: String!
    ): ImageDeleteResponse!

    reorderPropertyImages(
      propertyId: String!
      imageOrders: [ImageReorderInput!]!
    ): ImageReorderResponse!

    replacePropertyImage(
      propertyId: String!
      oldPublicId: String!
      newFile: Upload!
      order: Int
    ): ImageUploadResponse!

    # Utility mutations
    compressPropertyImages(
      propertyId: String!
      quality: Int = 85
    ): MultipleImageUploadResponse!

    generateImageVariants(
      propertyId: String!
      publicId: String!
    ): ImageUploadResponse!
  }

  extend type Subscription {
    imageUploadProgress(propertyId: String!): ImageUploadProgress!
    imageProcessingComplete(propertyId: String!): PropertyImage!
  }

  type ImageUploadProgress {
    propertyId: String!
    publicId: String!
    progress: Float!
    stage: String!
    completed: Boolean!
  }
`;