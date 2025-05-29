// src/utils/comparePasswordHelper.ts (or similar)
import bcrypt from 'bcrypt';
import { createLogger } from '../../utils/logger/logger'; // Adjust path if needed

const logger = createLogger('comparePasswordHelper');

export async function comparePasswordHelper(candidatePassword: string, hashedPasswordFromDb: string): Promise<boolean> {
    try {
        if (!candidatePassword) {
            logger.warn('[comparePasswordHelper] No candidate password provided');
            return false;
        }

        if (!hashedPasswordFromDb) {
            logger.error('[comparePasswordHelper] No password hash found to compare against');
            return false;
        }

        logger.info('[comparePasswordHelper] candidatePassword length:', candidatePassword.length);
        logger.info('[comparePasswordHelper] password hash exists:', !!hashedPasswordFromDb);
        logger.info('[comparePasswordHelper] password hash length:', hashedPasswordFromDb.length);

        const result = await bcrypt.compare(candidatePassword, hashedPasswordFromDb);
        logger.info('[comparePasswordHelper] comparison result:', result);

        return result;
    } catch (error) {
        logger.error('[comparePasswordHelper] Error during password comparison:', error);
        throw new Error('Erreur lors de la comparaison des mots de passe');
    }
}