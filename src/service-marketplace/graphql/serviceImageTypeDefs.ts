import { gql } from 'graphql-tag';

export const serviceImageTypeDefs = gql`
  extend type Mutation {
    uploadServiceImage(
      serviceId: ID!
      file: Upload!
      order: Int
    ): ImageUploadResponse!

    uploadMultipleServiceImages(
      serviceId: ID!
      images: [ImageUploadInput!]!
    ): MultipleImageUploadResponse!

    deleteServiceImage(
      serviceId: ID!
      publicId: String!
    ): ImageDeleteResponse!
  }

  extend type Query {
    getServiceImages(serviceId: ID!): [PropertyImage!]!
  }
`;
