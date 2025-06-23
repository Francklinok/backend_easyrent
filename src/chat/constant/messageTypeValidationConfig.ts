
import { MediaValidationRule } from "../types/chatTypes";

export const mediaValidationConfig: Record<string, MediaValidationRule> = {
  text: {
    requiredContent: true,
    maxSizeMB: 0,
    contentValidator: (content) => {
      if (content.trim().length === 0) {
        throw new Error("Le contenu est requis pour les messages texte");
      }
      if (content.length > 10000) {
        throw new Error("Le message est trop long (max 10000 caractères)");
      }
    },
  },
  image: {
    requiredFile: true,
    mimetypePrefix: "image/",
    maxSizeMB: 10,
  },
  video: {
    requiredFile: true,
    mimetypePrefix: "video/",
    maxSizeMB: 100,
  },
  audio: {
    requiredFile: true,
    mimetypePrefix: "audio/",
    maxSizeMB: 25,
  },
  document: {
    requiredFile: true,
    allowedMimetypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ],
    maxSizeMB: 50,
  },
  location: {
    requiredContent: true,
    maxSizeMB: 0,
    contentValidator: (content) => {
      const data = JSON.parse(content);
      if (!data.latitude || !data.longitude) {
        throw new Error("Latitude et longitude requises");
      }
    },
  },
};
