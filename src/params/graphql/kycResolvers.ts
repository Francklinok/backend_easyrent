import { Types } from 'mongoose';
import { kycService } from '../services/KYCService';
import {
  KYCVerificationStatus,
  KYCRiskLevel,
  KYCVerificationLevel
} from '../types/kycTypes';

// ================================
// HELPER FUNCTIONS
// ================================

interface GraphQLContext {
  user?: {
    _id?: string;
    userId?: string;
    email?: string;
    role?: string;
    twoFactorAuthenticated?: boolean;
  };
  req?: {
    ip?: string;
    headers?: {
      'user-agent'?: string;
    };
  };
}

const requireAuth = (context: GraphQLContext): void => {
  if (!context.user) {
    throw new Error('Authentification requise');
  }
};

const getUserId = (context: GraphQLContext): string => {
  if (!context.user || (!context.user.userId && !context.user._id)) {
    throw new Error('Non authentifié');
  }
  return (context.user.userId || context.user._id)!.toString();
};

const requireAdmin = (context: GraphQLContext): void => {
  requireAuth(context);
  const role = context.user?.role;
  if (role !== 'admin' && role !== 'super_admin') {
    throw new Error('Accès administrateur requis');
  }
};

const getMetadata = (context: GraphQLContext) => ({
  ipAddress: context.req?.ip,
  userAgent: context.req?.headers?.['user-agent']
});

// ================================
// RESOLVERS
// ================================

export const kycResolvers = {
  // ================================
  // QUERIES
  // ================================
  Query: {
    /**
     * Get current user's KYC status (simplified)
     */
    myKYCStatus: async (_: any, __: any, context: GraphQLContext) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.getKYCStatus(userId);
    },

    /**
     * Get current user's full KYC verification details
     */
    myKYCVerification: async (_: any, __: any, context: GraphQLContext) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.getKYCVerification(userId);
    },

    /**
     * Get simple verification status for current user
     */
    mySimpleVerificationStatus: async (_: any, __: any, context: GraphQLContext) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.getSimpleVerificationStatus(userId);
    },

    /**
     * Check if a user is verified (public)
     */
    isUserVerified: async (_: any, { userId }: { userId: string }, context: GraphQLContext) => {
      requireAuth(context);
      return kycService.isUserVerified(userId);
    },

    /**
     * Admin: Get KYC verification for a specific user
     */
    kycVerification: async (_: any, { userId }: { userId: string }, context: GraphQLContext) => {
      requireAdmin(context);
      return kycService.getKYCVerification(userId);
    },

    /**
     * Admin: Get pending KYC reviews
     */
    pendingKYCReviews: async (
      _: any,
      { page, limit, filters }: {
        page?: number;
        limit?: number;
        filters?: {
          status?: KYCVerificationStatus[];
          riskLevel?: KYCRiskLevel[];
          verificationLevel?: KYCVerificationLevel[];
        };
      },
      context: GraphQLContext
    ) => {
      requireAdmin(context);
      return kycService.getPendingReviews(page || 1, limit || 20, filters);
    },

    /**
     * Admin: Get KYC statistics
     */
    kycStatistics: async (_: any, __: any, context: GraphQLContext) => {
      requireAdmin(context);
      const stats = await kycService.getKYCStatistics();

      // Transform the byStatus and byLevel objects for GraphQL
      return {
        ...stats,
        byStatus: {
          unverified: stats.byStatus[KYCVerificationStatus.UNVERIFIED] || 0,
          pending: stats.byStatus[KYCVerificationStatus.PENDING] || 0,
          under_review: stats.byStatus[KYCVerificationStatus.UNDER_REVIEW] || 0,
          verified: stats.byStatus[KYCVerificationStatus.VERIFIED] || 0,
          rejected: stats.byStatus[KYCVerificationStatus.REJECTED] || 0,
          expired: stats.byStatus[KYCVerificationStatus.EXPIRED] || 0,
          suspended: stats.byStatus[KYCVerificationStatus.SUSPENDED] || 0
        },
        byLevel: {
          basic: stats.byLevel[KYCVerificationLevel.BASIC] || 0,
          standard: stats.byLevel[KYCVerificationLevel.STANDARD] || 0,
          enhanced: stats.byLevel[KYCVerificationLevel.ENHANCED] || 0,
          premium: stats.byLevel[KYCVerificationLevel.PREMIUM] || 0
        }
      };
    }
  },

  // ================================
  // MUTATIONS
  // ================================
  Mutation: {
    /**
     * Submit personal information for KYC
     */
    submitKYCPersonalInfo: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.submitPersonalInfo(userId, input, getMetadata(context));
    },

    /**
     * Submit a new address
     */
    submitKYCAddress: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.submitAddress(userId, input, getMetadata(context));
    },

    /**
     * Update an existing address
     */
    updateKYCAddress: async (
      _: any,
      { addressId, input }: { addressId: string; input: any },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.updateAddress(userId, addressId, input, getMetadata(context));
    },

    /**
     * Delete an address
     */
    deleteKYCAddress: async (
      _: any,
      { addressId }: { addressId: string },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.deleteAddress(userId, addressId, getMetadata(context));
    },

    /**
     * Submit address proof document
     */
    submitAddressProof: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.submitAddressProof(userId, input, getMetadata(context));
    },

    /**
     * Submit an identity document
     */
    submitKYCDocument: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.submitDocument(userId, input, getMetadata(context));
    },

    /**
     * Delete a document
     */
    deleteKYCDocument: async (
      _: any,
      { documentId }: { documentId: string },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.deleteDocument(userId, documentId, getMetadata(context));
    },

    /**
     * Update KYC settings
     */
    updateKYCSettings: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      requireAuth(context);
      const userId = getUserId(context);
      return kycService.updateSettings(userId, input, getMetadata(context));
    },

    /**
     * Admin: Review and update KYC status
     */
    adminReviewKYC: async (
      _: any,
      { userId, input }: { userId: string; input: any },
      context: GraphQLContext
    ) => {
      requireAdmin(context);
      const adminUserId = getUserId(context);
      const adminInfo = {
        name: context.user?.email,
        role: context.user?.role
      };
      return kycService.adminReviewKYC(
        userId,
        adminUserId,
        input,
        adminInfo,
        getMetadata(context)
      );
    },

    /**
     * Admin: Review a specific document
     */
    adminReviewKYCDocument: async (
      _: any,
      { userId, input }: { userId: string; input: any },
      context: GraphQLContext
    ) => {
      requireAdmin(context);
      const adminUserId = getUserId(context);
      const adminInfo = {
        name: context.user?.email,
        role: context.user?.role
      };
      return kycService.adminReviewDocument(
        userId,
        adminUserId,
        input,
        adminInfo,
        getMetadata(context)
      );
    }
  },

  // ================================
  // FIELD RESOLVERS
  // ================================
  KYCVerification: {
    id: (parent: any) => parent._id?.toString() || parent.id,
    userId: (parent: any) => parent.userId?.toString(),
    isExpired: (parent: any) => {
      if (!parent.expiresAt) return false;
      return new Date() > new Date(parent.expiresAt);
    },
    daysUntilExpiry: (parent: any) => {
      if (!parent.expiresAt) return null;
      const now = new Date();
      const expiry = new Date(parent.expiresAt);
      const diffTime = expiry.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },
    submittedAt: (parent: any) => parent.submittedAt?.toISOString(),
    verifiedAt: (parent: any) => parent.verifiedAt?.toISOString(),
    expiresAt: (parent: any) => parent.expiresAt?.toISOString(),
    lastUpdatedAt: (parent: any) => parent.lastUpdatedAt?.toISOString(),
    createdAt: (parent: any) => parent.createdAt?.toISOString(),
    updatedAt: (parent: any) => parent.updatedAt?.toISOString()
  },

  KYCDocument: {
    issueDate: (parent: any) => parent.issueDate?.toISOString(),
    expiryDate: (parent: any) => parent.expiryDate?.toISOString(),
    uploadedAt: (parent: any) => parent.uploadedAt?.toISOString(),
    reviewedAt: (parent: any) => parent.reviewedAt?.toISOString()
  },

  KYCAddress: {
    verifiedAt: (parent: any) => parent.verifiedAt?.toISOString()
  },

  KYCPersonalInfo: {
    dateOfBirth: (parent: any) => parent.dateOfBirth?.toISOString()
  },

  AddressProofDocument: {
    issueDate: (parent: any) => parent.issueDate?.toISOString()
  },

  KYCReview: {
    createdAt: (parent: any) => parent.createdAt?.toISOString()
  },

  KYCAuditLog: {
    createdAt: (parent: any) => parent.createdAt?.toISOString(),
    previousValue: (parent: any) => parent.previousValue ? JSON.stringify(parent.previousValue) : null,
    newValue: (parent: any) => parent.newValue ? JSON.stringify(parent.newValue) : null
  },

  RiskAssessment: {
    lastAssessedAt: (parent: any) => parent.lastAssessedAt?.toISOString()
  },

  KYCStatusResponse: {
    expiresAt: (parent: any) => parent.expiresAt?.toISOString()
  }
};

export default kycResolvers;
