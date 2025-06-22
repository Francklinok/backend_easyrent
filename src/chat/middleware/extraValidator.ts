import { Request, Response, NextFunction } from 'express';
import { MediaFile, MessageType } from '../types/chatTypes';
import { ApiError } from '../utils/apiError';

// Configuration de validation par type de fichier
interface FileValidationRule {
  maxSizeMB: number;
  allowedMimetypes?: string[];
  mimetypePrefix?: string;
  requiredFile: boolean;
  customValidator?: (file: MediaFile) => void;
}

const fileValidationConfig: Record<MessageType, FileValidationRule> = {
  text: {
    maxSizeMB: 0,
    requiredFile: false
  },
  image: {
    maxSizeMB: 10,
    mimetypePrefix: 'image/',
    requiredFile: true,
    allowedMimetypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ]
  },
  video: {
    maxSizeMB: 100,
    mimetypePrefix: 'video/',
    requiredFile: true,
    allowedMimetypes: [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-msvideo'
    ]
  },
  audio: {
    maxSizeMB: 25,
    mimetypePrefix: 'audio/',
    requiredFile: true,
    allowedMimetypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp4',
      'audio/webm'
    ]
  },
  voice_note: {
    maxSizeMB: 10,
    mimetypePrefix: 'audio/',
    requiredFile: true,
    allowedMimetypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm'
    ],
    customValidator: (file: MediaFile) => {
      // Validation spécifique pour les notes vocales
      if (file.size < 1024) { // Moins de 1KB
        throw new Error('Note vocale trop courte');
      }
    }
  },
  document: {
    maxSizeMB: 50,
    requiredFile: true,
    allowedMimetypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv'
    ]
  },
  location: {
    maxSizeMB: 0,
    requiredFile: false
  },
  contact: {
    maxSizeMB: 1,
    requiredFile: false,
    allowedMimetypes: [
      'text/vcard',
      'text/x-vcard'
    ]
  },
  property: {
    maxSizeMB: 20,
    mimetypePrefix: 'image/',
    requiredFile: false,
    allowedMimetypes: [
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
  },
  ar_preview: {
    maxSizeMB: 30,
    requiredFile: true,
    allowedMimetypes: [
      'model/gltf+json',
      'model/gltf-binary',
      'application/octet-stream'
    ]
  },
  virtual_tour: {
    maxSizeMB: 50,
    requiredFile: true,
    allowedMimetypes: [
      'application/json',
      'text/html',
      'application/zip'
    ]
  }
};

// Middleware de validation des fichiers
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  try {
    const messageType = req.body.messageType as MessageType || 'text';
    const file = req.file as MediaFile;
    
    const validationRule = fileValidationConfig[messageType];
    
    if (!validationRule) {
      throw new ApiError(400, 'Type de message non supporté');
    }

    // Vérification si un fichier est requis
    if (validationRule.requiredFile && !file) {
      throw new ApiError(400, `Fichier requis pour les messages de type ${messageType}`);
    }

    // Si pas de fichier et pas requis, passer au suivant
    if (!file && !validationRule.requiredFile) {
      return next();
    }

    // Validation de la taille
    if (file && file.size > validationRule.maxSizeMB * 1024 * 1024) {
      throw new ApiError(400, `Fichier trop volumineux (max ${validationRule.maxSizeMB}MB)`);
    }

    // Validation du type MIME par préfixe
    if (file && validationRule.mimetypePrefix) {
      if (!file.mimetype.startsWith(validationRule.mimetypePrefix)) {
        throw new ApiError(400, `Le fichier doit être de type ${validationRule.mimetypePrefix.replace('/', '')}`);
      }
    }

    // Validation des types MIME spécifiques
    if (file && validationRule.allowedMimetypes) {
      if (!validationRule.allowedMimetypes.includes(file.mimetype)) {
        throw new ApiError(400, `Type de fichier non supporté. Types autorisés: ${validationRule.allowedMimetypes.join(', ')}`);
      }
    }

    // Validations personnalisées
    if (file && validationRule.customValidator) {
      try {
        validationRule.customValidator(file);
      } catch (error: any) {
        throw new ApiError(400, error.message);
      }
    }

    // Validation supplémentaire pour les images
    if (file && messageType === 'image') {
      validateImageFile(file);
    }

    // Validation supplémentaire pour les vidéos
    if (file && messageType === 'video') {
      validateVideoFile(file);
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur de validation du fichier'
      });
    }
  }
};

// Validation spécifique pour les images
const validateImageFile = (file: MediaFile) => {
  // Vérification de l'extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    throw new ApiError(400, 'Extension d\'image non supportée');
  }

  // Vérification de la taille minimale (éviter les pixels invisibles)
  if (file.size < 100) { // 100 bytes minimum
    throw new ApiError(400, 'Image trop petite');
  }
};

// Validation spécifique pour les vidéos
const validateVideoFile = (file: MediaFile) => {
  const allowedExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    throw new ApiError(400, 'Extension vidéo non supportée');
  }

  // Vérification de la taille minimale
  if (file.size < 1024) { // 1KB minimum
    throw new ApiError(400, 'Vidéo trop petite');
  }
};

// Middleware pour valider les métadonnées des fichiers media
export const validateMediaMetadata = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messageType } = req.body;
    const file = req.file as MediaFile;

    if (!file) return next();

    // Validation des métadonnées selon le type
    switch (messageType) {
      case 'image':
        if (req.body.dimensions) {
          const dimensions = JSON.parse(req.body.dimensions);
          if (dimensions.width <= 0 || dimensions.height <= 0) {
            throw new ApiError(400, 'Dimensions d\'image invalides');
          }
        }
        break;

      case 'video':
      case 'audio':
      case 'voice_note':
        if (req.body.duration) {
          const duration = parseFloat(req.body.duration);
          if (duration <= 0 || duration > 3600) { // Max 1 heure
            throw new ApiError(400, 'Durée invalide');
          }
        }
        break;
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur de validation des métadonnées'
      });
    }
  }
};

// Middleware pour nettoyer les noms de fichiers
export const sanitizeFileName = (req: Request, res: Response, next: NextFunction) => {
  if (req.file) {
    // Nettoyer le nom du fichier
    req.file.originalname = req.file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Remplacer les caractères spéciaux
      .replace(/_{2,}/g, '_') // Réduire les underscores multiples
      .substring(0, 100); // Limiter la longueur
  }
  next();
};

export { fileValidationConfig };