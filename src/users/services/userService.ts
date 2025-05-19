import User from "../models/userModel"
import { IUser } from "../types/userTypes";
import createLogger from  "../../utils/logger/logger"
import { CreateUserDto } from '../types/userTypes';
import { UpdateUserDto } from '../types/userTypes';
import { SearchUsersParams } from '../types/userTypes';
import { VerificationStatus } from '../types/userTypes';
import { UserRole } from '../types/userTypes';
import { NotificationService } from "../../services/notificationServices";
import { FilterQuery } from 'mongoose';
const logger = createLogger;


export class UserService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Crée un nouvel utilisateur
   */
  async createUser(userData: CreateUserDto, sendVerificationEmail = true): Promise<IUser> {
    try {
      logger.info('Creating new user', { email: userData.email });
      
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        logger.warn('User already exists', { email: userData.email });
        throw new Error('Un utilisateur avec cet email existe déjà');
      }

      // Créer le nouvel utilisateur
      const user = new User(userData);
      
      // Générer un jeton de vérification si demandé
      if (sendVerificationEmail) {
        const verificationToken = user.generateVerificationToken();
        await this.notificationService.sendVerificationEmail(user.email, verificationToken, user.firstName);
      }

      // Enregistrer l'utilisateur
      await user.save();
      logger.info('User created successfully', { id: user.id });
      
      return user;
    } catch (error) {
      logger.error('Error creating user', { error, userData });
      throw error;
    }
  }

  /**
   * Retrouve un utilisateur par son ID
   */
  async getUserById(id: string): Promise<IUser | null> {
    try {
      return await User.findById(id);
    } catch (error) {
      logger.error('Error fetching user by ID', { error, id });
      throw error;
    }
  }

  /**
   * Retrouve un utilisateur par son email
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    try {
      return await User.findOne({ email: email.toLowerCase() });
    } catch (error) {
      logger.error('Error fetching user by email', { error, email });
      throw error;
    }
  }

  /**
   * Met à jour un utilisateur existant
   */
  async updateUser(id: string, updateData: UpdateUserDto): Promise<IUser | null> {
    try {
      logger.info('Updating user', { id });
      const user = await User.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!user) {
        logger.warn('User not found for update', { id });
      } else {
        logger.info('User updated successfully', { id });
      }
      
      return user;
    } catch (error) {
      logger.error('Error updating user', { error, id, updateData });
      throw error;
    }
  }

  /**
   * Désactive un compte utilisateur
   */
  async deactivateUser(id: string): Promise<IUser | null> {
    try {
      logger.info('Deactivating user', { id });
      const user = await User.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { new: true }
      );

      if (user) {
        // Envoyer une notification d'inactivation
        await this.notificationService.sendAccountDeactivationEmail(user.email, user.firstName);
        logger.info('User deactivated successfully', { id });
      } else {
        logger.warn('User not found for deactivation', { id });
      }

      return user;
    } catch (error) {
      logger.error('Error deactivating user', { error, id });
      throw error;
    }
  }

  /**
   * Réactive un compte utilisateur
   */
  async reactivateUser(id: string): Promise<IUser | null> {
    try {
      logger.info('Reactivating user', { id });
      const user = await User.findByIdAndUpdate(
        id,
        { $set: { isActive: true } },
        { new: true }
      );

      if (user) {
        // Envoyer une notification de réactivation
        await this.notificationService.sendAccountReactivationEmail(user.email, user.firstName);
        logger.info('User reactivated successfully', { id });
      } else {
        logger.warn('User not found for reactivation', { id });
      }

      return user;
    } catch (error) {
      logger.error('Error reactivating user', { error, id });
      throw error;
    }
  }

  /**
   * Vérifie un compte utilisateur
   */
  async verifyUser(verificationToken: string): Promise<boolean> {
    try {
      logger.info('Verifying user account');
      const user = await User.findOne({ verificationToken });

      if (!user) {
        logger.warn('Invalid verification token', { verificationToken });
        return false;
      }

      // Effacer le jeton et enregistrer l'utilisateur
      user.verificationToken = undefined;
      await user.save();
      
      // Si c'est un agent, mettre à jour le statut de vérification
      if (user.role === UserRole.AGENT && user.agentDetails) {
        user.agentDetails.verificationStatus = VerificationStatus.PENDING;
        await user.save();
      }

      logger.info('User verified successfully', { id: user.id });
      await this.notificationService.sendWelcomeEmail(user.email, user.firstName);
      
      return true;
    } catch (error) {
      logger.error('Error verifying user', { error, verificationToken });
      throw error;
    }
  }

  /**
   * Initialise le processus de réinitialisation de mot de passe
   */
  async initiatePasswordReset(email: string): Promise<boolean> {
    try {
      logger.info('Initiating password reset', { email });
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        logger.warn('User not found for password reset', { email });
        return false;
      }

      const resetToken = await user.generatePasswordResetToken();
      await this.notificationService.sendPasswordResetEmail(email, resetToken, user.firstName);
      
      logger.info('Password reset initiated successfully', { email });
      return true;
    } catch (error) {
      logger.error('Error initiating password reset', { error, email });
      throw error;
    }
  }

  /**
   * Réinitialise le mot de passe avec un jeton
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      logger.info('Resetting password');
      const user = await User.findOne({ 
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      });

      if (!user) {
        logger.warn('Invalid or expired password reset token', { token });
        return false;
      }

      // Mettre à jour le mot de passe et effacer le jeton
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      // Invalider tous les jetons d'actualisation
      user.refreshTokens = [];
      await user.save();

      logger.info('Password reset successfully', { id: user.id });
      await this.notificationService.sendPasswordChangeConfirmationEmail(user.email, user.firstName);
      
      return true;
    } catch (error) {
      logger.error('Error resetting password', { error, token });
      throw error;
    }
  }

  /**
   * Change le mot de passe d'un utilisateur
   */
  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      logger.info('Changing password', { id });
      const user = await User.findById(id);

      if (!user) {
        logger.warn('User not found for password change', { id });
        return false;
      }

      // Vérifier le mot de passe actuel
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        logger.warn('Invalid current password', { id });
        return false;
      }

      // Mettre à jour le mot de passe
      user.password = newPassword;
      await user.save();

      // Invalider tous les jetons d'actualisation sauf le dernier utilisé
      const latestToken = user.refreshTokens.pop();
      user.refreshTokens = latestToken ? [latestToken] : [];
      await user.save();

      logger.info('Password changed successfully', { id });
      await this.notificationService.sendPasswordChangeConfirmationEmail(user.email, user.firstName);
      
      return true;
    } catch (error) {
      logger.error('Error changing password', { error, id });
      throw error;
    }
  }

  /**
   * Recherche avancée d'utilisateurs
   */
  async searchUsers(params: SearchUsersParams): Promise<{ users: IUser[], total: number }> {
    try {
      const { 
        query, role, isActive, city, country, 
        page = 1, limit = 10,
        sortBy = 'createdAt', sortDirection = 'desc'
      } = params;

      // Construire les filtres
      const filter: FilterQuery<IUser> = {};
      
      if (role) {
        filter.role = role;
      }
      
      if (isActive !== undefined) {
        filter.isActive = isActive;
      }
      
      if (city) {
        filter['address.city'] = new RegExp(city, 'i');
      }
      
      if (country) {
        filter['address.country'] = new RegExp(country, 'i');
      }
      
      // Recherche textuelle
      if (query) {
        filter.$text = { $search: query };
      }

      // Calculer le nombre total de résultats
      const total = await User.countDocuments(filter);

      // Exécuter la requête paginée
      const users = await User.find(filter)
        .sort({ [sortBy]: sortDirection === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      return { users, total };
    } catch (error) {
      logger.error('Error searching users', { error, params });
      throw error;
    }
  }

  /**
   * Active l'authentification à deux facteurs
   */
  async enableTwoFactorAuth(userId: string): Promise<{ secret: string, qrCodeUrl: string } | null> {
    try {
      // Implémentation d'authentification à deux facteurs
      // Utiliser un service comme Speakeasy pour générer un secret et un QR code
      
      // Mise à jour des préférences de l'utilisateur
      await User.findByIdAndUpdate(userId, {
        'preferences.twoFactorEnabled': true
      });
      
      // Retourne des données factices pour l'exemple
      return {
        secret: 'GENERATED_SECRET',
        qrCodeUrl: 'URL_TO_QR_CODE'
      };
    } catch (error) {
      logger.error('Error enabling 2FA', { error, userId });
      throw error;
    }
  }

  /**
   * Désactive l'authentification à deux facteurs
   */
  async disableTwoFactorAuth(userId: string): Promise<boolean> {
    try {
      const result = await User.findByIdAndUpdate(userId, {
        'preferences.twoFactorEnabled': false
      });
      
      return !!result;
    } catch (error) {
      logger.error('Error disabling 2FA', { error, userId });
      throw error;
    }
  }

  /**
   * Met à jour le statut de vérification d'un agent
   */
  async updateAgentVerificationStatus(
    agentId: string, 
    status: VerificationStatus, 
    comment?: string
  ): Promise<IUser | null> {
    try {
      const agent = await User.findOne({ 
        _id: agentId, 
        role: UserRole.AGENT
      });

      if (!agent || !agent.agentDetails) {
        return null;
      }

      agent.agentDetails.verificationStatus = status;
      if (status === VerificationStatus.VERIFIED) {
        agent.agentDetails.verificationDate = new Date();
      }
      
      await agent.save();

      // Envoyer une notification du changement de statut
      await this.notificationService.sendAgentVerificationStatusEmail(
        agent.email, 
        agent.firstName, 
        status,
        comment
      );
      
      return agent;
    } catch (error) {
      logger.error('Error updating agent verification status', { error, agentId, status });
      throw error;
    }
  }

  /**
   * Stocke temporairement le secret 2FA avant confirmation
   */
  async storeTempTwoFactorSecret(userId: string, secret: string): Promise<boolean> {
    try {
      logger.info('Storing temporary 2FA secret', { userId });
      
      const result = await User.findByIdAndUpdate(userId, {
        'security.tempTwoFactorSecret': secret,
        'security.tempTwoFactorSecretExpires': new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      });
      
      return !!result;
    } catch (error) {
      logger.error('Error storing temp 2FA secret', { error, userId });
      throw error;
    }
  }

  /**
   * Alias pour enableTwoFactorAuth pour compatibilité
   */
  async enableTwoFactor(userId: string): Promise<{ secret: string, qrCodeUrl: string } | null> {
    return this.enableTwoFactorAuth(userId);
  }

  /**
   * Alias pour disableTwoFactorAuth pour compatibilité
   */
  async disableTwoFactor(userId: string): Promise<boolean> {
    return this.disableTwoFactorAuth(userId);
  }

  /**
   * Met à jour les codes de sauvegarde 2FA
   */
  async updateBackupCodes(userId: string, backupCodes: string[]): Promise<boolean> {
    try {
      logger.info('Updating backup codes', { userId });
      
      const result = await User.findByIdAndUpdate(userId, {
        'security.backupCodes': backupCodes.map(code => ({
          code,
          used: false,
          createdAt: new Date()
        }))
      });
      
      return !!result;
    } catch (error) {
      logger.error('Error updating backup codes', { error, userId });
      throw error;
    }
  }

  /**
   * Vérifie et consomme un code de sauvegarde 2FA
   */
  async verifyAndConsumeBackupCode(userId: string, backupCode: string): Promise<boolean> {
    try {
      logger.info('Verifying backup code', { userId });
      
      const user = await User.findById(userId);
      if (!user || !user.security?.backupCodes) {
        return false;
      }

      const backupCodeIndex = user.security.backupCodes.findIndex(
        bc => bc.code === backupCode && !bc.used
      );

      if (backupCodeIndex === -1) {
        logger.warn('Invalid or used backup code', { userId });
        return false;
      }

      // Marquer le code comme utilisé
      user.security.backupCodes[backupCodeIndex].used = true;
      user.security.backupCodes[backupCodeIndex].usedAt = new Date();
      await user.save();

      logger.info('Backup code consumed successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Error verifying backup code', { error, userId });
      throw error;
    }
  }

  /**
   * Récupère les sessions actives d'un utilisateur
   */
  async getActiveSessions(userId: string): Promise<any[]> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return [];
      }

      // Filtrer les tokens de rafraîchissement actifs (non expirés)
      const currentTime = new Date();
      const activeSessions = user.refreshTokens?.filter(token => 
        token.expiresAt > currentTime
      ) || [];

      return activeSessions.map(session => ({
        id: session.tokenId,
        device: session.device || 'Unknown device',
        ipAddress: session.ipAddress || 'Unknown IP',
        lastActive: session.lastUsed || session.createdAt,
        createdAt: session.createdAt
      }));
    } catch (error) {
      logger.error('Error getting active sessions', { error, userId });
      throw error;
    }
  }

  /**
   * Révoque une session spécifique
   */
  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      logger.info('Revoking session', { userId, sessionId });
      
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      const initialLength = user.refreshTokens?.length || 0;
      if (user.refreshTokens) {
        user.refreshTokens = user.refreshTokens.filter(token => token.tokenId !== sessionId);
      }

      await user.save();
      
      const wasRevoked = (user.refreshTokens?.length || 0) < initialLength;
      if (wasRevoked) {
        logger.info('Session revoked successfully', { userId, sessionId });
      } else {
        logger.warn('Session not found', { userId, sessionId });
      }

      return wasRevoked;
    } catch (error) {
      logger.error('Error revoking session', { error, userId, sessionId });
      throw error;
    }
  }

  /**
   * Révoque toutes les sessions sauf celle en cours
   */
  async revokeAllSessionsExceptCurrent(userId: string, currentSessionId: string): Promise<boolean> {
    try {
      logger.info('Revoking all sessions except current', { userId, currentSessionId });
      
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }

      const currentSession = user.refreshTokens?.find(token => token.tokenId === currentSessionId);
      user.refreshTokens = currentSession ? [currentSession] : [];
      
      await user.save();
      
      logger.info('All sessions revoked except current', { userId, currentSessionId });
      return true;
    } catch (error) {
      logger.error('Error revoking all sessions except current', { error, userId, currentSessionId });
      throw error;
    }
  }

  /**
   * Compte les tentatives de connexion récentes
   */
  async getRecentLoginAttemptsCount(email: string, timeWindow = 15): Promise<number> {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user || !user.security?.loginAttempts) {
        return 0;
      }

      const cutoffTime = new Date(Date.now() - timeWindow * 60 * 1000);
      const recentAttempts = user.security.loginAttempts.filter(
        attempt => attempt.timestamp > cutoffTime
      );

      return recentAttempts.length;
    } catch (error) {
      logger.error('Error getting recent login attempts count', { error, email });
      throw error;
    }
  }

  /**
   * Compte les sessions actives d'un utilisateur
   */
  async getActiveSessionsCount(userId: string): Promise<number> {
    try {
      const activeSessions = await this.getActiveSessions(userId);
      return activeSessions.length;
    } catch (error) {
      logger.error('Error getting active sessions count', { error, userId });
      throw error;
    }
  }

  /**
   * Invalide toutes les sessions d'un utilisateur
   */
  async invalidateAllUserSessions(userId: string): Promise<boolean> {
    try {
      logger.info('Invalidating all user sessions', { userId });
      
      const result = await User.findByIdAndUpdate(userId, {
        $set: { refreshTokens: [] }
      });

      if (result) {
        logger.info('All user sessions invalidated successfully', { userId });
        
        // Envoyer une notification de sécurité
        await this.notificationService.sendSecurityAlertEmail(
          result.email,
          result.firstName,
          'Toutes vos sessions ont été invalidées'
        );
      }

      return !!result;
    } catch (error) {
      logger.error('Error invalidating all user sessions', { error, userId });
      throw error;
    }
  }

  /**
   * Enregistre une tentative de connexion
   */
  async recordLoginAttempt(email: string, success: boolean, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return;
      }

      if (!user.security) {
        user.security = {} as any;
      }

      if (!user.security.loginAttempts) {
        user.security.loginAttempts = [];
      }

      // Ajouter la nouvelle tentative
      user.security.loginAttempts.push({
        timestamp: new Date(),
        success,
        ipAddress: ipAddress || 'Unknown',
        userAgent: userAgent || 'Unknown'
      });

      // Garder seulement les 50 dernières tentatives
      if (user.security.loginAttempts.length > 50) {
        user.security.loginAttempts = user.security.loginAttempts.slice(-50);
      }

      await user.save();
    } catch (error) {
      logger.error('Error recording login attempt', { error, email });
    }
  }

  /**
   * Vérifie si le compte est verrouillé
   */
  async isAccountLocked(email: string): Promise<boolean> {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user || !user.security) {
        return false;
      }

      // Vérifier si le compte est verrouillé
      if (user.security.lockUntil && user.security.lockUntil > new Date()) {
        return true;
      }

      // Vérifier le nombre de tentatives récentes échouées
      const recentFailedAttempts = await this.getRecentLoginAttemptsCount(email);
      if (recentFailedAttempts >= 5) {
        // Verrouiller le compte pour 30 minutes
        user.security.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
        await user.save();
        
        // Envoyer une notification de sécurité
        await this.notificationService.sendSecurityAlertEmail(
          user.email,
          user.firstName,
          'Votre compte a été temporairement verrouillé en raison de multiples tentatives de connexion échouées'
        );
        
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error checking if account is locked', { error, email });
      return false;
    }
  }

  /**
   * Déverrouille un compte utilisateur
   */
  async unlockAccount(email: string): Promise<boolean> {
    try {
      logger.info('Unlocking account', { email });
      
      const result = await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { 
          $unset: { 'security.lockUntil': 1 },
          $set: { 'security.loginAttempts': [] }
        },
        { new: true }
      );

      if (result) {
        logger.info('Account unlocked successfully', { email });
        
        // Envoyer une notification
        await this.notificationService.sendSecurityAlertEmail(
          result.email,
          result.firstName,
          'Votre compte a été déverrouillé'
        );
      }

      return !!result;
    } catch (error) {
      logger.error('Error unlocking account', { error, email });
      throw error;
    }
  }

  /**
   * Met à jour la dernière activité d'un utilisateur
   */
  async updateLastActivity(userId: string, ipAddress?: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, {
        $set: { 
          lastLoginAt: new Date(),
          lastLoginIP: ipAddress || 'Unknown'
        }
      });
    } catch (error) {
      logger.error('Error updating last activity', { error, userId });
    }
  }

  /**
   * Génère des codes de sauvegarde 2FA
   */
  async generateBackupCodes(count = 10): Promise<string[]> {
    const codes: string[] = [];
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    for (let i = 0; i < count; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      codes.push(code);
    }
    
    return codes;
  }

  /**
   * Active l'authentification à deux facteurs avec vérification
   */
  async confirmTwoFactorSetup(userId: string, code: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.security?.tempTwoFactorSecret) {
        return false;
      }

      // Vérifier le code 2FA (implémentation simplifiée)
      // Dans un vrai projet, utilisez speakeasy ou une bibliothèque similaire
      const isValidCode = this.verifyTOTPCode(user.security.tempTwoFactorSecret, code);
      
      if (!isValidCode) {
        return false;
      }

      // Générer des codes de sauvegarde
      const backupCodes = await this.generateBackupCodes();

      // Activer 2FA définitivement
      user.security.twoFactorSecret = user.security.tempTwoFactorSecret;
      user.security.tempTwoFactorSecret = undefined;
      user.security.tempTwoFactorSecretExpires = undefined;
      user.preferences.twoFactorEnabled = true;
      
      await this.updateBackupCodes(userId, backupCodes);
      await user.save();

      logger.info('2FA setup confirmed successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Error confirming 2FA setup', { error, userId });
      throw error;
    }
  }

  /**
   * Vérifie un code TOTP (implémentation simplifiée)
   */
  private verifyTOTPCode(secret: string, code: string): boolean {
    // Dans un vrai projet, utilisez speakeasy.totp.verify()
    // Ceci est une implémentation simplifiée pour l'exemple
    return code.length === 6 && /^\d+$/.test(code);
  }

  /**
   * Obtient les statistiques d'un utilisateur
   */
  async getUserStats(userId: string): Promise<{
    activeSessionsCount: number;
    recentLoginAttempts: number;
    twoFactorEnabled: boolean;
    accountCreatedAt: Date;
    lastLoginAt?: Date;
  } | null> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return null;
      }

      const activeSessionsCount = await this.getActiveSessionsCount(userId);
      const recentLoginAttempts = await this.getRecentLoginAttemptsCount(user.email);

      return {
        activeSessionsCount,
        recentLoginAttempts,
        twoFactorEnabled: user.preferences?.twoFactorEnabled || false,
        accountCreatedAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      };
    } catch (error) {
      logger.error('Error getting user stats', { error, userId });
      throw error;
    }
  }

  /**
   * Exporte les données d'un utilisateur (RGPD)
   */
  async exportUserData(userId: string): Promise<any> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return null;
      }

      // Retourner une version anonymisée des données
      const userData = user.toObject();
      
      // Supprimer les données sensibles
      delete userData.password;
      delete userData.refreshTokens;
      delete userData.security;
      delete userData.verificationToken;
      delete userData.passwordResetToken;

      return userData;
    } catch (error) {
      logger.error('Error exporting user data', { error, userId });
      throw error;
    }
  }

  /**
   * Supprime définitivement un utilisateur (RGPD)
   */
  async deleteUserPermanently(userId: string): Promise<boolean> {
    try {
      logger.info('Permanently deleting user', { userId });
      
      const result = await User.findByIdAndDelete(userId);
      
      if (result) {
        logger.info('User permanently deleted', { userId });
        
        // Optionnel: nettoyer les données liées dans d'autres collections
        // await this.cleanupRelatedData(userId);
      }

      return !!result;
    } catch (error) {
      logger.error('Error permanently deleting user', { error, userId });
      throw error;
    }
  }
}