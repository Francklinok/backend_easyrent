import { v2 as cloudinary } from 'cloudinary';
import { ImageOptimizer } from '../../property/utils/imageOptimization';

const MANDATORY_DOCUMENT_CATEGORIES = ['wellness', 'security', 'insurance', 'emergency'];
const OPTIONAL_DOCUMENT_CATEGORIES = ['maintenance', 'cleaning', 'gardening', 'utilities', 'tech', 'eco', 'collaborative'];

export interface DocumentUploadResult {
  url: string;
  publicId: string;
  format: string;
  size: number;
}

export class ServiceDocumentUploadService {
  static areDocumentsMandatory(category: string): boolean {
    return MANDATORY_DOCUMENT_CATEGORIES.includes(category);
  }

  static validateDocuments(category: string, documents: any) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredDocuments: string[] = [];

    if (category === 'wellness') {
      requiredDocuments.push('professionalLicense', 'insurance');
      if (!documents.professionalLicense?.length) errors.push('Licence professionnelle médicale obligatoire');
      if (!documents.insurance?.length) errors.push('Assurance responsabilité civile obligatoire');
    }

    if (category === 'security') {
      requiredDocuments.push('professionalLicense', 'certifications');
      if (!documents.professionalLicense?.length) errors.push('Licence de sécurité obligatoire');
      if (!documents.certifications?.length) errors.push('Certifications obligatoires');
    }

    if (OPTIONAL_DOCUMENT_CATEGORIES.includes(category)) {
      if (!documents.identityProof?.length) warnings.push('Pièce d\'identité recommandée');
    }

    return { isValid: errors.length === 0, errors, warnings, requiredDocuments };
  }

  static async uploadJustificationImage(buffer: Buffer, serviceId: string, category: string): Promise<DocumentUploadResult> {
    const optimized = await ImageOptimizer.smartOptimize(buffer);

    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `services/${category}/${serviceId}/justifications`,
          resource_type: 'image',
          transformation: [{ width: 1200, crop: 'limit' }, { quality: 'auto:good' }],
          tags: ['service', 'justification', category]
        },
        (error, result) => error ? reject(error) : resolve(result)
      ).end(optimized.buffer);
    });

    return { url: result.secure_url, publicId: result.public_id, format: result.format, size: result.bytes };
  }

  static async uploadDocument(buffer: Buffer, serviceId: string, category: string, documentType: string): Promise<DocumentUploadResult> {
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `services/${category}/${serviceId}/documents/${documentType}`,
          resource_type: 'raw',
          tags: ['service', 'document', documentType, category]
        },
        (error, result) => error ? reject(error) : resolve(result)
      ).end(buffer);
    });

    return { url: result.secure_url, publicId: result.public_id, format: result.format, size: result.bytes };
  }

  static async deleteFile(publicId: string, resourceType: 'image' | 'raw' = 'image'): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }
}
