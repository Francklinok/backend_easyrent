// CORRECTED ACTIVITY QUERIES
// These fix the GraphQL validation errors

export const GET_VISIT_REQUEST = `
  query GetVisitRequest($id: ID!) {
    getVisitRequest(id: $id) {
      id
      propertyId
      clientId
      message
      isVisited
      visitDate
      isVisiteAccepted
      isReservation
      reservationDate
      isReservationAccepted
      isPayment
      paymentDate
      uploadedFiles
      status
      type
      duration
      nextStep
      priorityScore
      isCancelled
      cancelReason
      cancelDate
      createdAt
      updatedAt
      property {
        id
        title
        address
        images
      }
      client {
        id
        firstName
        lastName
        email
        profilePicture
      }
    }
  }
`;

export const GET_ACTIVITIES_BY_PROPERTY = `
  query GetActivitiesByProperty($propertyId: ID!, $filters: ActivityFilters) {
    activities(propertyId: $propertyId, filters: $filters) {
      edges {
        node {
          id
          propertyId
          clientId
          message
          isVisited
          visitDate
          isVisiteAccepted
          isReservation
          reservationDate
          isReservationAccepted
          status
          type
          createdAt
          property {
            id
            title
            address
          }
          client {
            id
            firstName
            lastName
            profilePicture
          }
        }
      }
      totalCount
    }
  }
`;

export const GET_VISIT_REQUESTS_ONLY = `
  query GetVisitRequests($propertyId: ID) {
    activities(propertyId: $propertyId, filters: { type: VISIT }) {
      edges {
        node {
          id
          propertyId
          clientId
          message
          visitDate
          isVisiteAccepted
          status
          createdAt
          property {
            id
            title
          }
          client {
            id
            firstName
            lastName
          }
        }
      }
    }
  }
`;

export const GET_USER_VISIT_FOR_PROPERTY = `
  query GetUserVisitForProperty($userId: ID!, $propertyId: ID!) {
    getUserVisitForProperty(userId: $userId, propertyId: $propertyId) {
      id
      visitDate
      visitTime
      visitType
      isVisiteAccepted
      status
      createdAt
      property {
        id
        title
      }
      client {
        id
        firstName
        lastName
      }
    }
  }
`;

export const CHECK_VISIT_TIME_SLOT = `
  query CheckVisitTimeSlot($propertyId: ID!, $visitDate: String!) {
    checkVisitTimeSlot(propertyId: $propertyId, visitDate: $visitDate)
  }
`;

// Usage examples with variables
export const QUERY_VARIABLES = {
  // For getVisitRequest - use activity ID
  getVisitRequest: {
    id: "activity_id_here"
  },
  
  // For activities by property
  getActivitiesByProperty: {
    propertyId: "property_id_here",
    filters: {
      type: "VISIT",
      status: "PENDING"
    }
  },
  
  // For visit requests only
  getVisitRequests: {
    propertyId: "property_id_here"
  },
  
  // For getUserVisitForProperty
  getUserVisitForProperty: {
    userId: "user_id_here",
    propertyId: "property_id_here"
  },
  
  // For checkVisitTimeSlot
  checkVisitTimeSlot: {
    propertyId: "property_id_here",
    visitDate: "2024-01-15T10:00:00Z"
  }
};