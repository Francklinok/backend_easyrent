// src/config/upload.ts

import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Chemin dynamique en fonction du champ
const getUploadPath = (fieldname: string): string => {
  const uploadDir = `uploads/${fieldname}s`;
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadPath = getUploadPath(file.fieldname);
    cb(null, uploadPath);
  },
  filename: (req: Request, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Types MIME autorisés
const allowedTypes = /\.(jpeg|jpg|png|gif|mp4|avi|mov|mp3|wav|pdf|doc|docx|txt|zip)$/i;

// Filtrage des fichiers
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const isValid = allowedTypes.test(file.originalname.toLowerCase()) && allowedTypes.test(file.mimetype);
  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé !'));
  }
};

// Export de l'instance Multer
export const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter,
});
