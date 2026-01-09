import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import KYCVerificationModel, { IKYCVerification } from '../models/kycSchema';
import {
  KYCVerificationStatus,
  KYCDocumentType,
  KYCDocumentStatus,
  KYCRiskLevel,
  KYCVerificationLevel,
  KYCReviewAction,
  SubmitKYCPersonalInfoDto,
  SubmitKYCAddressDto,
  SubmitKYCDocumentDto,
  SubmitAddressProofDto,
  UpdateKYCSettingsDto,
  AdminReviewKYCDto,
  AdminReviewDocumentDto,
  KYCStatusResponse,
  KYCDocumentUploadResponse,
  KYCVerificationResult,
  KYCDocument,
  KYCAddress
} from '../types/kycTypes';

// ================================
// KYC SERVICE CLASS
// ================================

export class KYCService {
  private static instance: KYCService;

  private constructor() {}

  public static getInstance(): KYCService {
    if (!KYCService.instance) {
      KYCService.instance = new KYCService();
    }
    return KYCService.instance;
  }

  // ================================
  // USER OPERATIONS
  // ================================

  /**
   * Get or create KYC verification record for a user
   */
  async getOrCreateKYCVerification(userId: string | Types.ObjectId): Promise<IKYCVerification> {
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    let kyc = await KYCVerificationModel.findOne({ userId: userObjectId });

    if (!kyc) {
      kyc = new KYCVerificationModel({
        userId: userObjectId,
        status: KYCVerificationStatus.UNVERIFIED,
        verificationLevel: KYCVerificationLevel.BASIC,
        riskLevel: KYCRiskLevel.LOW,
        addresses: [],
        documents: [],
        reviews: [],
        auditLogs: [],
        progress: {
          emailVerified: false,
          phoneVerified: false,
          identityVerified: false,
          addressVerified: false,
          livenessVerified: false,
          overallProgress: 0
        },
        settings: {
          notifyOnStatusChange: true,
          notifyOnExpiry: true,
          expiryReminderDays: 30,
          autoResubmitOnExpiry: false,
          shareVerificationWithAgents: true,
          shareVerificationWithLandlords: true
        }
      });

      await kyc.save();

      kyc.addAuditLog(
        'KYC_RECORD_CREATED',
        'system',
        null,
        { status: KYCVerificationStatus.UNVERIFIED }
      );
      await kyc.save();
    }

    return kyc;
  }

  /**
   * Get KYC verification status for a user
   */
  async getKYCStatus(userId: string | Types.ObjectId): Promise<KYCStatusResponse> {
    const kyc = await this.getOrCreateKYCVerification(userId);

    const nextSteps = kyc.getNextSteps();

    let estimatedReviewTime: string | undefined;
    if (kyc.status === KYCVerificationStatus.PENDING) {
      estimatedReviewTime = '24-48 heures';
    } else if (kyc.status === KYCVerificationStatus.UNDER_REVIEW) {
      estimatedReviewTime = '1-2 heures';
    }

    return {
      status: kyc.status,
      verificationLevel: kyc.verificationLevel,
      progress: kyc.progress,
      nextSteps,
      estimatedReviewTime,
      expiresAt: kyc.expiresAt
    };
  }

  /**
   * Get full KYC verification details for a user
   */
  async getKYCVerification(userId: string | Types.ObjectId): Promise<IKYCVerification> {
    return this.getOrCreateKYCVerification(userId);
  }

  /**
   * Submit personal information for KYC
   */
  async submitPersonalInfo(
    userId: string | Types.ObjectId,
    data: SubmitKYCPersonalInfoDto,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<KYCVerificationResult> {
    const kyc = await this.getOrCreateKYCVerification(userId);

    const previousInfo = kyc.personalInfo ? { ...kyc.personalInfo.toObject?.() || kyc.personalInfo } : null;

    kyc.personalInfo = {
      firstName: data.firstName.trim(),
      middleName: data.middleName?.trim(),
      lastName: data.lastName.trim(),
      dateOfBirth: new Date(data.dateOfBirth),
      placeOfBirth: data.placeOfBirth?.trim(),
      nationality: data.nationality,
      secondNationality: data.secondNationality,
      gender: data.gender,
      phoneNumber: data.phoneNumber,
      alternativePhone: data.alternativePhone,
      occupation: data.occupation?.trim(),
      employer: data.employer?.trim()
    };

    // Update phone verification status
    kyc.progress.phoneVerified = true;

    // Update status if needed
    if (kyc.status === KYCVerificationStatus.UNVERIFIED) {
      kyc.status = KYCVerificationStatus.PENDING;
      kyc.submittedAt = new Date();
    }

    kyc.addAuditLog(
      'PERSONAL_INFO_SUBMITTED',
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
      previousInfo,
      kyc.personalInfo,
      metadata
    );

    await kyc.save();

    return {
      success: true,
      status: kyc.status,
      verificationLevel: kyc.verificationLevel,
      message: 'Informations personnelles soumises avec succès',
      nextSteps: kyc.getNextSteps()
    };
  }

  /**
   * Submit address for KYC
   */
  async submitAddress(
    userId: string | Types.ObjectId,
    data: SubmitKYCAddressDto,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<KYCVerificationResult> {
    const kyc = await this.getOrCreateKYCVerification(userId);

    const newAddress: KYCAddress = {
      id: uuidv4(),
      type: data.type,
      isPrimary: data.isPrimary ?? kyc.addresses.length === 0,
      streetAddress: data.streetAddress.trim(),
      streetAddress2: data.streetAddress2?.trim(),
      city: data.city.trim(),
      state: data.state?.trim(),
      postalCode: data.postalCode?.trim(),
      country: data.country,
      coordinates: data.coordinates,
      verified: false,
      residenceDuration: data.residenceDuration
    };

    // If this is set as primary, unset other primary addresses
    if (newAddress.isPrimary) {
      kyc.addresses.forEach(addr => {
        addr.isPrimary = false;
      });
    }

    kyc.addresses.push(newAddress as any);

    kyc.addAuditLog(
      'ADDRESS_ADDED',
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
      null,
      newAddress,
      metadata
    );

    await kyc.save();

    return {
      success: true,
      status: kyc.status,
      verificationLevel: kyc.verificationLevel,
      message: 'Adresse ajoutée avec succès',
      nextSteps: kyc.getNextSteps()
    };
  }

  /**
   * Update an existing address
   */
  async updateAddress(
    userId: string | Types.ObjectId,
    addressId: string,
    data: Partial<SubmitKYCAddressDto>,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<KYCVerificationResult> {
    const kyc = await this.getOrCreateKYCVerification(userId);

    const addressIndex = kyc.addresses.findIndex(a => a.id === addressId);
    if (addressIndex === -1) {
      return {
        success: false,
        status: kyc.status,
        verificationLevel: kyc.verificationLevel,
        message: 'Adresse non trouvée',
        errors: ['ADDRESS_NOT_FOUND']
      };
    }

    const previousAddress = { ...kyc.addresses[addressIndex] };

    // Update fields
    if (data.type) kyc.addresses[addressIndex].type = data.type;
    if (data.streetAddress) kyc.addresses[addressIndex].streetAddress = data.streetAddress.trim();
    if (data.streetAddress2 !== undefined) kyc.addresses[addressIndex].streetAddress2 = data.streetAddress2?.trim();
    if (data.city) kyc.addresses[addressIndex].city = data.city.trim();
    if (data.state !== undefined) kyc.addresses[addressIndex].state = data.state?.trim();
    if (data.postalCode !== undefined) kyc.addresses[addressIndex].postalCode = data.postalCode?.trim();
    if (data.country) kyc.addresses[addressIndex].country = data.country;
    if (data.coordinates) kyc.addresses[addressIndex].coordinates = data.coordinates;
    if (data.residenceDuration) kyc.addresses[addressIndex].residenceDuration = data.residenceDuration;

    // Handle isPrimary
    if (data.isPrimary === true) {
      kyc.addresses.forEach((addr, idx) => {
        addr.isPrimary = idx === addressIndex;
      });
    }

    // Reset verification if address changed significantly
    kyc.addresses[addressIndex].verified = false;
    kyc.addresses[addressIndex].verifiedAt = undefined;

    kyc.addAuditLog(
      'ADDRESS_UPDATED',
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
      previousAddress,
      kyc.addresses[addressIndex],
      metadata
    );

    await kyc.save();

    return {
      success: true,
      status: kyc.status,
      verificationLevel: kyc.verificationLevel,
      message: 'Adresse mise à jour avec succès',
      nextSteps: kyc.getNextSteps()
    };
  }

  /**
   * Delete an address
   */
  async deleteAddress(
    userId: string | Types.ObjectId,
    addressId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<KYCVerificationResult> {
    const kyc = await this.getOrCreateKYCVerification(userId);

    const addressIndex = kyc.addresses.findIndex(a => a.id === addressId);
    if (addressIndex === -1) {
      return {
        success: false,
        status: kyc.status,
        verificationLevel: kyc.verificationLevel,
        message: 'Adresse non trouvée',
        errors: ['ADDRESS_NOT_FOUND']
      };
    }

    const deletedAddress = kyc.addresses[addressIndex];
    kyc.addresses.splice(addressIndex, 1);

    // If deleted address was primary, make the first remaining address primary
    if (deletedAddress.isPrimary && kyc.addresses.length > 0) {
      kyc.addresses[0].isPrimary = true;
    }

    // Update address verification status
    kyc.progress.addressVerified = kyc.addresses.some(a => a.verified);

    kyc.addAuditLog(
      'ADDRESS_DELETED',
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
      deletedAddress,
      null,
      metadata
    );

    await kyc.save();

    return {
      success: true,
      status: kyc.status,
      verificationLevel: kyc.verificationLevel,
      message: 'Adresse supprimée avec succès',
      nextSteps: kyc.getNextSteps()
    };
  }

  /**
   * Submit a KYC document (ID, passport, etc.)
   */
  async submitDocument(
    userId: string | Types.ObjectId,
    data: SubmitKYCDocumentDto,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<KYCDocumentUploadResponse> {
    const kyc = await this.getOrCreateKYCVerification(userId);

    const newDocument: KYCDocument = {
      id: uuidv4(),
      type: data.type,
      status: KYCDocumentStatus.PENDING,
      documentNumber: data.documentNumber,
      issuingCountry: data.issuingCountry,
      issuingAuthority: data.issuingAuthority,
      issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      frontImageUrl: data.frontImageUrl,
      backImageUrl: data.backImageUrl,
      selfieImageUrl: data.selfieImageUrl,
      uploadedAt: new Date()
    };

    // Validate document expiry
    if (newDocument.expiryDate && newDocument.expiryDate < new Date()) {
      return {
        documentId: '',
        status: KYCDocumentStatus.REJECTED,
        message: 'Le document a expiré. Veuillez soumettre un document valide.'
      };
    }

    kyc.documents.push(newDocument as any);

    // Update status if needed
    if (kyc.status === KYCVerificationStatus.UNVERIFIED) {
      kyc.status = KYCVerificationStatus.PENDING;
      kyc.submittedAt = new Date();
    }

    kyc.addAuditLog(
      'DOCUMENT_SUBMITTED',
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
      null,
      { id: newDocument.id, type: newDocument.type },
      metadata
    );

    await kyc.save();

    // Trigger automatic verification (OCR, face matching, etc.)
    // This would integrate with external verification services
    await this.processDocumentVerification(kyc, newDocument.id);

    return {
      documentId: newDocument.id,
      status: KYCDocumentStatus.PENDING,
      message: 'Document soumis avec succès. La vérification est en cours.'
    };
  }

  /**
   * Submit address proof document
   */
  async submitAddressProof(
    userId: string | Types.ObjectId,
    data: SubmitAddressProofDto,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<KYCVerificationResult> {
    const kyc = await this.getOrCreateKYCVerification(userId);

    const addressIndex = kyc.addresses.findIndex(a => a.id === data.addressId);
    if (addressIndex === -1) {
      return {
        success: false,
        status: kyc.status,
        verificationLevel: kyc.verificationLevel,
        message: 'Adresse non trouvée',
        errors: ['ADDRESS_NOT_FOUND']
      };
    }

    kyc.addresses[addressIndex].proofDocument = {
      type: data.proofType,
      documentUrl: data.documentUrl,
      issueDate: new Date(data.issueDate),
      verificationStatus: KYCDocumentStatus.PENDING
    };

    kyc.addAuditLog(
      'ADDRESS_PROOF_SUBMITTED',
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
      null,
      { addressId: data.addressId, proofType: data.proofType },
      metadata
    );

    await kyc.save();

    return {
      success: true,
      status: kyc.status,
      verificationLevel: kyc.verificationLevel,
      message: 'Preuve d\'adresse soumise avec succès',
      nextSteps: kyc.getNextSteps()
    };
  }

  /**
   * Delete a document
   */
  async deleteDocument(
    userId: string | Types.ObjectId,
    documentId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<KYCVerificationResult> {
    const kyc = await this.getOrCreateKYCVerification(userId);

    const docIndex = kyc.documents.findIndex(d => d.id === documentId);
    if (docIndex === -1) {
      return {
        success: false,
        status: kyc.status,
        verificationLevel: kyc.verificationLevel,
        message: 'Document non trouvé',
        errors: ['DOCUMENT_NOT_FOUND']
      };
    }

    const deletedDoc = kyc.documents[docIndex];

    // Don't allow deletion of approved documents unless admin
    if (deletedDoc.status === KYCDocumentStatus.APPROVED) {
      return {
        success: false,
        status: kyc.status,
        verificationLevel: kyc.verificationLevel,
        message: 'Impossible de supprimer un document approuvé',
        errors: ['CANNOT_DELETE_APPROVED_DOCUMENT']
      };
    }

    kyc.documents.splice(docIndex, 1);

    // Update identity verification status
    const hasApprovedIdDoc = kyc.documents.some(
      d => d.status === KYCDocumentStatus.APPROVED &&
        [KYCDocumentType.NATIONAL_ID, KYCDocumentType.PASSPORT, KYCDocumentType.DRIVERS_LICENSE].includes(d.type)
    );
    kyc.progress.identityVerified = hasApprovedIdDoc;

    kyc.addAuditLog(
      'DOCUMENT_DELETED',
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
      { id: deletedDoc.id, type: deletedDoc.type },
      null,
      metadata
    );

    await kyc.save();

    return {
      success: true,
      status: kyc.status,
      verificationLevel: kyc.verificationLevel,
      message: 'Document supprimé avec succès',
      nextSteps: kyc.getNextSteps()
    };
  }

  /**
   * Update KYC settings
   */
  async updateSettings(
    userId: string | Types.ObjectId,
    data: UpdateKYCSettingsDto,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<KYCVerificationResult> {
    const kyc = await this.getOrCreateKYCVerification(userId);

    const previousSettings = { ...kyc.settings.toObject?.() || kyc.settings };

    if (data.notifyOnStatusChange !== undefined) kyc.settings.notifyOnStatusChange = data.notifyOnStatusChange;
    if (data.notifyOnExpiry !== undefined) kyc.settings.notifyOnExpiry = data.notifyOnExpiry;
    if (data.expiryReminderDays !== undefined) kyc.settings.expiryReminderDays = data.expiryReminderDays;
    if (data.autoResubmitOnExpiry !== undefined) kyc.settings.autoResubmitOnExpiry = data.autoResubmitOnExpiry;
    if (data.shareVerificationWithAgents !== undefined) kyc.settings.shareVerificationWithAgents = data.shareVerificationWithAgents;
    if (data.shareVerificationWithLandlords !== undefined) kyc.settings.shareVerificationWithLandlords = data.shareVerificationWithLandlords;

    kyc.addAuditLog(
      'SETTINGS_UPDATED',
      typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
      previousSettings,
      kyc.settings,
      metadata
    );

    await kyc.save();

    return {
      success: true,
      status: kyc.status,
      verificationLevel: kyc.verificationLevel,
      message: 'Paramètres mis à jour avec succès'
    };
  }

  /**
   * Update email verification status (called from auth service)
   */
  async updateEmailVerification(
    userId: string | Types.ObjectId,
    verified: boolean
  ): Promise<void> {
    const kyc = await this.getOrCreateKYCVerification(userId);
    kyc.progress.emailVerified = verified;

    kyc.addAuditLog(
      'EMAIL_VERIFICATION_UPDATED',
      'system',
      { emailVerified: !verified },
      { emailVerified: verified }
    );

    await kyc.save();
  }

  /**
   * Update phone verification status
   */
  async updatePhoneVerification(
    userId: string | Types.ObjectId,
    verified: boolean
  ): Promise<void> {
    const kyc = await this.getOrCreateKYCVerification(userId);
    kyc.progress.phoneVerified = verified;

    kyc.addAuditLog(
      'PHONE_VERIFICATION_UPDATED',
      'system',
      { phoneVerified: !verified },
      { phoneVerified: verified }
    );

    await kyc.save();
  }

  // ================================
  // ADMIN OPERATIONS
  // ================================

  /**
   * Admin: Review and update KYC status
   */
  async adminReviewKYC(
    targetUserId: string | Types.ObjectId,
    adminUserId: string | Types.ObjectId,
    data: AdminReviewKYCDto,
    adminInfo?: { name?: string; role?: string },
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<KYCVerificationResult> {
    const kyc = await KYCVerificationModel.findOne({
      userId: typeof targetUserId === 'string' ? new Types.ObjectId(targetUserId) : targetUserId
    });

    if (!kyc) {
      return {
        success: false,
        status: KYCVerificationStatus.UNVERIFIED,
        verificationLevel: KYCVerificationLevel.BASIC,
        message: 'Vérification KYC non trouvée',
        errors: ['KYC_NOT_FOUND']
      };
    }

    const previousStatus = kyc.status;
    let newStatus = kyc.status;

    switch (data.action) {
      case KYCReviewAction.APPROVED:
        newStatus = KYCVerificationStatus.VERIFIED;
        kyc.verifiedAt = new Date();
        kyc.expiresAt = new Date();
        kyc.expiresAt.setFullYear(kyc.expiresAt.getFullYear() + 1); // Expires in 1 year
        kyc.progress.identityVerified = true;
        kyc.progress.addressVerified = true;
        this.updateVerificationLevel(kyc);
        break;

      case KYCReviewAction.REJECTED:
        newStatus = KYCVerificationStatus.REJECTED;
        break;

      case KYCReviewAction.REQUEST_MORE_INFO:
        newStatus = KYCVerificationStatus.PENDING;
        break;

      case KYCReviewAction.ESCALATED:
        newStatus = KYCVerificationStatus.UNDER_REVIEW;
        break;
    }

    kyc.status = newStatus;

    if (data.riskLevel) {
      kyc.riskLevel = data.riskLevel;
    }

    kyc.addReview(
      typeof adminUserId === 'string' ? new Types.ObjectId(adminUserId) : adminUserId,
      data.action,
      previousStatus,
      newStatus,
      {
        reviewerName: adminInfo?.name,
        reviewerRole: adminInfo?.role,
        notes: data.notes,
        rejectionReasons: data.rejectionReasons,
        requiredActions: data.requiredActions
      }
    );

    kyc.addAuditLog(
      `ADMIN_REVIEW_${data.action.toUpperCase()}`,
      typeof adminUserId === 'string' ? new Types.ObjectId(adminUserId) : adminUserId,
      { status: previousStatus },
      { status: newStatus, riskLevel: kyc.riskLevel },
      { ...metadata, performedByName: adminInfo?.name }
    );

    await kyc.save();

    return {
      success: true,
      status: kyc.status,
      verificationLevel: kyc.verificationLevel,
      message: `KYC ${data.action === KYCReviewAction.APPROVED ? 'approuvé' :
                       data.action === KYCReviewAction.REJECTED ? 'rejeté' :
                       data.action === KYCReviewAction.REQUEST_MORE_INFO ? 'en attente d\'informations' :
                       'escaladé'} avec succès`
    };
  }

  /**
   * Admin: Review a specific document
   */
  async adminReviewDocument(
    targetUserId: string | Types.ObjectId,
    adminUserId: string | Types.ObjectId,
    data: AdminReviewDocumentDto,
    adminInfo?: { name?: string; role?: string },
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<KYCVerificationResult> {
    const kyc = await KYCVerificationModel.findOne({
      userId: typeof targetUserId === 'string' ? new Types.ObjectId(targetUserId) : targetUserId
    });

    if (!kyc) {
      return {
        success: false,
        status: KYCVerificationStatus.UNVERIFIED,
        verificationLevel: KYCVerificationLevel.BASIC,
        message: 'Vérification KYC non trouvée',
        errors: ['KYC_NOT_FOUND']
      };
    }

    const docIndex = kyc.documents.findIndex(d => d.id === data.documentId);
    if (docIndex === -1) {
      return {
        success: false,
        status: kyc.status,
        verificationLevel: kyc.verificationLevel,
        message: 'Document non trouvé',
        errors: ['DOCUMENT_NOT_FOUND']
      };
    }

    const previousStatus = kyc.documents[docIndex].status;
    kyc.documents[docIndex].status = data.status;
    kyc.documents[docIndex].reviewedAt = new Date();
    kyc.documents[docIndex].reviewedBy = typeof adminUserId === 'string' ? new Types.ObjectId(adminUserId) : adminUserId;

    if (data.rejectionReason) {
      kyc.documents[docIndex].rejectionReason = data.rejectionReason;
    }
    if (data.notes) {
      kyc.documents[docIndex].notes = data.notes;
    }
    if (data.verificationScore !== undefined) {
      kyc.documents[docIndex].verificationScore = data.verificationScore;
    }

    // Update identity verification status
    if (data.status === KYCDocumentStatus.APPROVED) {
      const docType = kyc.documents[docIndex].type;
      if ([KYCDocumentType.NATIONAL_ID, KYCDocumentType.PASSPORT, KYCDocumentType.DRIVERS_LICENSE].includes(docType)) {
        kyc.progress.identityVerified = true;
      }
    }

    kyc.addAuditLog(
      'DOCUMENT_REVIEWED',
      typeof adminUserId === 'string' ? new Types.ObjectId(adminUserId) : adminUserId,
      { documentId: data.documentId, status: previousStatus },
      { documentId: data.documentId, status: data.status },
      { ...metadata, performedByName: adminInfo?.name }
    );

    await kyc.save();

    return {
      success: true,
      status: kyc.status,
      verificationLevel: kyc.verificationLevel,
      message: `Document ${data.status === KYCDocumentStatus.APPROVED ? 'approuvé' :
                          data.status === KYCDocumentStatus.REJECTED ? 'rejeté' :
                          'mis à jour'} avec succès`
    };
  }

  /**
   * Admin: Get all pending KYC reviews
   */
  async getPendingReviews(
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: KYCVerificationStatus[];
      riskLevel?: KYCRiskLevel[];
      verificationLevel?: KYCVerificationLevel[];
    }
  ): Promise<{ data: IKYCVerification[]; total: number; page: number; totalPages: number }> {
    const query: any = {};

    if (filters?.status?.length) {
      query.status = { $in: filters.status };
    } else {
      query.status = { $in: [KYCVerificationStatus.PENDING, KYCVerificationStatus.UNDER_REVIEW] };
    }

    if (filters?.riskLevel?.length) {
      query.riskLevel = { $in: filters.riskLevel };
    }

    if (filters?.verificationLevel?.length) {
      query.verificationLevel = { $in: filters.verificationLevel };
    }

    const total = await KYCVerificationModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const data = await KYCVerificationModel.find(query)
      .sort({ submittedAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'firstName lastName email profilePicture');

    return {
      data,
      total,
      page,
      totalPages
    };
  }

  /**
   * Admin: Get KYC statistics
   */
  async getKYCStatistics(): Promise<{
    total: number;
    byStatus: Record<KYCVerificationStatus, number>;
    byLevel: Record<KYCVerificationLevel, number>;
    pendingCount: number;
    averageReviewTime: number;
    expiringSoon: number;
  }> {
    const [statusCounts, levelCounts, total, pendingCount, expiringSoon] = await Promise.all([
      KYCVerificationModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      KYCVerificationModel.aggregate([
        { $group: { _id: '$verificationLevel', count: { $sum: 1 } } }
      ]),
      KYCVerificationModel.countDocuments(),
      KYCVerificationModel.countDocuments({
        status: { $in: [KYCVerificationStatus.PENDING, KYCVerificationStatus.UNDER_REVIEW] }
      }),
      KYCVerificationModel.countDocuments({
        status: KYCVerificationStatus.VERIFIED,
        expiresAt: {
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          $gt: new Date()
        }
      })
    ]);

    const byStatus = {} as Record<KYCVerificationStatus, number>;
    statusCounts.forEach(item => {
      byStatus[item._id as KYCVerificationStatus] = item.count;
    });

    const byLevel = {} as Record<KYCVerificationLevel, number>;
    levelCounts.forEach(item => {
      byLevel[item._id as KYCVerificationLevel] = item.count;
    });

    // Calculate average review time (simplified)
    const reviewedKYCs = await KYCVerificationModel.find({
      status: KYCVerificationStatus.VERIFIED,
      submittedAt: { $exists: true },
      verifiedAt: { $exists: true }
    }).limit(100);

    let totalReviewTime = 0;
    reviewedKYCs.forEach(kyc => {
      if (kyc.submittedAt && kyc.verifiedAt) {
        totalReviewTime += kyc.verifiedAt.getTime() - kyc.submittedAt.getTime();
      }
    });
    const averageReviewTime = reviewedKYCs.length > 0
      ? Math.round(totalReviewTime / reviewedKYCs.length / (1000 * 60 * 60)) // in hours
      : 0;

    return {
      total,
      byStatus,
      byLevel,
      pendingCount,
      averageReviewTime,
      expiringSoon
    };
  }

  // ================================
  // INTERNAL METHODS
  // ================================

  /**
   * Process document verification (OCR, face matching, etc.)
   * In production, this would integrate with external services like:
   * - AWS Rekognition
   * - Onfido
   * - Jumio
   * - Stripe Identity
   */
  private async processDocumentVerification(
    kyc: IKYCVerification,
    documentId: string
  ): Promise<void> {
    const docIndex = kyc.documents.findIndex(d => d.id === documentId);
    if (docIndex === -1) return;

    // Simulate automatic verification checks
    // In production, this would call external verification APIs

    // For now, we'll set up the structure for future integration
    kyc.documents[docIndex].authenticityCheck = {
      passed: true, // Would be determined by actual verification
      checks: [
        {
          checkType: 'document_quality',
          passed: true,
          confidence: 95,
          details: 'Image quality meets requirements'
        },
        {
          checkType: 'document_authenticity',
          passed: true,
          confidence: 90,
          details: 'Document appears authentic'
        },
        {
          checkType: 'data_extraction',
          passed: true,
          confidence: 85,
          details: 'Data successfully extracted'
        }
      ]
    };

    // Auto-extract data (placeholder)
    kyc.documents[docIndex].extractedData = {
      fullName: kyc.personalInfo?.firstName + ' ' + kyc.personalInfo?.lastName,
      dateOfBirth: kyc.personalInfo?.dateOfBirth?.toISOString().split('T')[0],
      nationality: kyc.personalInfo?.nationality
    };

    kyc.documents[docIndex].verificationScore = 85;

    await kyc.save();
  }

  /**
   * Update verification level based on completed verifications
   */
  private updateVerificationLevel(kyc: IKYCVerification): void {
    const progress = kyc.progress;

    if (progress.emailVerified && progress.phoneVerified &&
        progress.identityVerified && progress.addressVerified &&
        progress.livenessVerified) {
      kyc.verificationLevel = KYCVerificationLevel.PREMIUM;
    } else if (progress.emailVerified && progress.phoneVerified &&
               progress.identityVerified && progress.addressVerified) {
      kyc.verificationLevel = KYCVerificationLevel.ENHANCED;
    } else if (progress.emailVerified && progress.phoneVerified &&
               progress.identityVerified) {
      kyc.verificationLevel = KYCVerificationLevel.STANDARD;
    } else {
      kyc.verificationLevel = KYCVerificationLevel.BASIC;
    }
  }

  /**
   * Check if user is verified
   */
  async isUserVerified(userId: string | Types.ObjectId): Promise<boolean> {
    const kyc = await KYCVerificationModel.findOne({
      userId: typeof userId === 'string' ? new Types.ObjectId(userId) : userId
    });

    return kyc?.status === KYCVerificationStatus.VERIFIED;
  }

  /**
   * Get user's verification status (simple)
   */
  async getSimpleVerificationStatus(userId: string | Types.ObjectId): Promise<{
    status: KYCVerificationStatus;
    level: KYCVerificationLevel;
    isVerified: boolean;
  }> {
    const kyc = await this.getOrCreateKYCVerification(userId);

    return {
      status: kyc.status,
      level: kyc.verificationLevel,
      isVerified: kyc.status === KYCVerificationStatus.VERIFIED
    };
  }
}

// Export singleton instance
export const kycService = KYCService.getInstance();
export default kycService;
