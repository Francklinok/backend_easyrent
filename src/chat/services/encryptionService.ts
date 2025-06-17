import  config from "../../../config"

class EncryptionService {
  private static readonly crypto = require('crypto');
  private static readonly secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production';

  static async encrypt(content: string): Promise<string> {
    try {
      const iv = this.crypto.randomBytes(config.encryption.ivLength);
      const cipher = this.crypto.createCipher(config.encryption.algorithm, this.secretKey);
      
      let encrypted = cipher.update(content, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag?.()?.toString('hex') || '';
      
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
      
      const decipher = this.crypto.createDecipher(config.encryption.algorithm, this.secretKey);
      if (decipher.setAuthTag) {
        decipher.setAuthTag(authTag);
      }
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Erreur de déchiffrement:', error);
      return encryptedContent; // Retourner le contenu original en cas d'erreur
    }
  }
}

export default  EncryptionService