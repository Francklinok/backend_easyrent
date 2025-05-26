
// 2. Fix the comparePassword function
import bcrypt from 'bcrypt';
import { IUser } from '../types/userTypes';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('comparepassword');

export async function comparePassword(this: IUser, candidatePassword: string): Promise<boolean> {
  try {
    // Add validation checks
    if (!candidatePassword) {
      logger.warn('[comparepassword] No candidate password provided');
      return false;
    }
    
    if (!this.password) {
      logger.error('[comparepassword] No password hash found on user object');
      return false;
    }

    logger.info('[comparepassword] candidatePassword length:', candidatePassword.length);
    logger.info('[comparepassword] password hash exists:', !!this.password);
    logger.info('[comparepassword] password hash length:', this.password.length);
 
    const result = await bcrypt.compare(candidatePassword, this.password);
    logger.info('[comparepassword] comparison result:', result);
    
    return result;
  } catch (error) {
    logger.error('[comparepassword] Error during password comparison:', error);
    throw new Error('Erreur lors de la comparaison des mots de passe');
  }
}
