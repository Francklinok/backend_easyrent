import multer from 'multer';
import { Request } from 'express';

// Configuration pour le stockage en mémoire (temporaire)
const storage = multer.memoryStorage();

// Filtre pour valider les types de fichiers
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Types MIME autorisés pour les images
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non supporté. Utilisez JPG, PNG, WebP ou GIF.'));
  }
};

// Limites de fichier
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB max par fichier
  files: 10, // 10 fichiers max par upload
};

// Configuration multer pour les images de propriétés
export const propertyImageUpload = multer({
  storage,
  fileFilter,
  limits
});

// Middleware pour upload d'une seule image
export const singleImageUpload = propertyImageUpload.single('image');

// Middleware pour upload de plusieurs images
export const multipleImageUpload = propertyImageUpload.array('images', 10);

// Middleware pour upload d'images avec champs nommés
export const fieldsImageUpload = propertyImageUpload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'galleryImages', maxCount: 9 }
]);

// Gestion d'erreurs Multer
export const handleMulterError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'Fichier trop volumineux (max 10MB)'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Trop de fichiers (max 10)'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Champ de fichier inattendu'
        });
      default:
        return res.status(400).json({
          success: false,
          error: `Erreur d'upload: ${error.message}`
        });
    }
  }

  if (error.message.includes('Type de fichier non supporté')) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  next(error);
};

export default {
  propertyImageUpload,
  singleImageUpload,
  multipleImageUpload,
  fieldsImageUpload,
  handleMulterError
};