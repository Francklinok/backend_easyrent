import crypto, { CipherGCM, DecipherGCM } from 'crypto';
import config from '../../../config';

class EncryptionService {
  static async encrypt(content: string): Promise<string> {
    try {
      const iv = crypto.randomBytes(config.encryption.ivLength);
      // Cast en CipherGCM pour accéder à getAuthTag
      const cipher = crypto.createCipheriv(
        config.encryption.algorithm,
        config.encryption.secretKey,
        iv
      ) as CipherGCM;

      let encrypted = cipher.update(content, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex');

      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      console.error('Erreur de chiffrement:', error);
      throw new Error('Échec du chiffrement');
    }
  }

  static async decrypt(encryptedContent: string): Promise<string> {
    try {
      const parts = encryptedContent.split(':');
      if (parts.length !== 3) {
        return encryptedContent; // Pas chiffré
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Cast en DecipherGCM pour accéder à setAuthTag
      const decipher = crypto.createDecipheriv(
        config.encryption.algorithm,
        config.encryption.secretKey,
        iv
      ) as DecipherGCM;

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Erreur de déchiffrement:', error);
      return encryptedContent; // Retourner le contenu original en cas d'erreur
    }
  }
}

export default EncryptionService;
