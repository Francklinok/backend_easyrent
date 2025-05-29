import bcrypt from 'bcrypt';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from "../models/userModel";
import { IUser } from "../types/userTypes";
import { CreateUserDto } from '../types/userTypes';
import { UpdateUserDto } from '../types/userTypes';
import { SearchUsersParams } from '../types/userTypes';
import { VerificationStatus } from '../types/userTypes';
import { UserRole } from '../types/userTypes';
import { UserFilterOptions, UserSearchOptions } from '../types/userTypes';
import { NotificationService } from "../../services/notificationServices";
import { SecurityAuditService } from '../../security/services/securityAuditServices';
import { createLogger } from '../../utils/logger/logger';
import { AppError } from '../../auth/utils/AppError';
import { FilterQuery } from 'mongoose';
import { SecurityDetails } from '../types/userTypes';
import { DeleteUserOptions, DeleteUserResult } from '../types/userTypes';
const logger = createLogger('UserService');

export class UserService {
  private notificationService: NotificationService;
  // private securityAuditService: SecurityAuditService;

  constructor() {
    this.notificationService = new NotificationService();
    // this.securityAuditService = new SecurityAuditService();
  }

  /**
   * Crée un nouvel utilisateur
   * 
   */
  async createUser(userData: Partial<IUser>, sendVerificationEmail: boolean = false): Promise<IUser> {
  try {
    logger.info('Creating new user', { 
      email: userData.email?.substring(0, 5) + '***',
      sendVerificationEmail 
    });

    // Hasher le mot de passe
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 12);
    }

    // ✅ CORRECTION : Ne générer le token que si nécessaire
    if (sendVerificationEmail) {
      userData.emailVerificationToken = crypto.randomBytes(32).toString('hex');
      userData.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Créer l'utilisateur
    const user = await User.create(userData);

    // ✅ CORRECTION : N'envoyer l'email que si demandé ET si le token existe
    if (sendVerificationEmail && userData.emailVerificationToken && user.email && user.firstName) {
      try {
        await this.notificationService.sendVerificationEmail(
          user.email,
          user.firstName,
          userData.emailVerificationToken
        );
        logger.info('Email de vérification envoyé depuis createUser', {
          userId: user.id.toString(),
          email: user.email.substring(0, 5) + '***'
        });
      } catch (emailError) {
        logger.warn('Erreur lors de l\'envoi de l\'email depuis createUser', {
          error: emailError instanceof Error ? emailError.message : 'Erreur inconnue',
          userId: user.id.toString()
        });
      }
    }

    logger.info('User created successfully', { 
      userId: user.id.toString(),
      emailSentFromCreate: sendVerificationEmail 
    });
    
    return user;
  } catch (error) {
    logger.error('Error creating user', { 
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      email: userData.email?.substring(0, 5) + '***'
    });
    throw error;
  }
}

  /**
   * Retrouve un utilisateur par son ID
   */
  async getUserById(id: string): Promise<IUser | null> {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        logger.warn('Invalid user ID format', { id });
        return null;
      }
        try {
          return await User.findById(id).select('-password -resetPasswordToken -emailVerificationToken');
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
    // The issue is here - you need to include the password field explicitly
    // since it's marked as select: false in the schema
    const  user = await User.findOne({ 
      email: email.toLowerCase(),
      isDeleted: { $ne: true } // Also check if user is not deleted
    }).select('+password');
    console.log('les  utilisateur  sont', user)

    return user  // This is the correct way to include password
  } catch (error) {
    logger.error('Error fetching user by email', { error, email });
    throw error;
  }
}

async debugUser(email: string): Promise<void> {
    try {
      const userWithoutPassword = await User.findOne({ email: email.toLowerCase() });
      const userWithPassword = await User.findOne({ email: email.toLowerCase() }).select('+password');
      
      console.log('User without password select:', {
        email: userWithoutPassword?.email,
        hasPassword: !!userWithoutPassword?.password
      });
      
      console.log('User with password select:', {
        email: userWithPassword?.email,
        hasPassword: !!userWithPassword?.password,
        passwordLength: userWithPassword?.password?.length
      });
    } catch (error) {
      console.error('Debug error:', error);
    }
  }
   /**
   * Retrouve un utilisateur par son email
   */
  async getUserByUsername(username: string): Promise<IUser | null> {
    try {
      return await User.findOne({ username: username.toLowerCase() }).select('-resetPasswordToken -emailVerificationToken');
    } catch (error) {
      logger.error('Error fetching user by username', { error, username });
      throw error;
    }
  }

  /**
   * Obtenir la liste des utilisateurs avec pagination et filtres
   */
  async getUsers(options: UserFilterOptions): Promise<{
    data: IUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        isActive,
        role,
        ...otherFilters 
      } = options;
      
      // Construire les critères de filtrage
      const filters: Record<string, any> = {
        isDeleted: { $ne: true },
        ...otherFilters
      };
      
      if (isActive !== undefined) {
        filters.isActive = isActive;
      }
      
      if (role) {
        filters.role = role;
      }
      
      // Construire l'objet de tri
      const sort: Record<string, 1 | -1> = {
        [sortBy]: sortOrder === 'asc' ? 1 : -1
      };
      
      // Exécuter la requête avec pagination
      const users = await User.find(filters)
        .select('-password -resetPasswordToken -emailVerificationToken')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);
      
      // Compter le nombre total d'utilisateurs correspondant aux filtres
      const total = await User.countDocuments(filters);
      
      return {
        data: users,
        total,
        page,
        limit
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des utilisateurs', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        options
      });
      throw error;
    }
  }
  
  /**
   * Recherche avancée d'utilisateurs
   */
  async searchUsers(options: UserSearchOptions): Promise<{
    data: IUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { 
        query, 
        fields = ['firstName', 'lastName', 'email'],
        page = 1, 
        limit = 10,
        filters = {},
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;
      
      // Construire les critères de recherche
      const searchCriteria: Record<string, any> = {
        isDeleted: { $ne: true },
        ...filters
      };
      
      // Ajouter la recherche textuelle si une requête est fournie
      if (query) {
        const orConditions = fields.map((field:string)  => ({
          [field]: { $regex: query, $options: 'i' }
        }));
        
        searchCriteria.$or = orConditions;
      }
      
      // Construire l'objet de tri
      const sort: Record<string, 1 | -1> = {
        [sortBy]: sortOrder === 'asc' ? 1 : -1
      };
      
      // Exécuter la requête avec pagination
      const users = await User.find(searchCriteria)
        .select('-password -resetPasswordToken -emailVerificationToken')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);
      
      // Compter le nombre total d'utilisateurs correspondant aux critères
      const total = await User.countDocuments(searchCriteria);
      
      return {
        data: users,
        total,
        page,
        limit
      };
    } catch (error) {
      logger.error('Erreur lors de la recherche d\'utilisateurs', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        query: options.query
      });
      throw error;
    }
  }
    
  
  async updateUserLoginInfo(user: IUser, loginDetails: { ipAddress: string; userAgent: string }, successful: boolean): Promise<void> {
    try {
      // Enregistrer la tentative de connexion
      if (typeof user.recordLoginAttempt === 'function') {
        user.recordLoginAttempt({
          ...loginDetails,
          successful
        });
      }

      // Mettre à jour le dernier login si succès
      if (successful && typeof user.updateLastLogin === 'function') {
        user.updateLastLogin(loginDetails.ipAddress, loginDetails.userAgent);
      }

      if (typeof user.save === 'function') {
        await user.save();
      }
    } catch (error) {
      logger.warn('Failed to update user login info', { error});
    }
  }


  /**
   * Met à jour un utilisateur existant
    */

  async updateUser(id: string, updateData: UpdateUserDto | Partial<IUser>): Promise<IUser | null> {
  try {
    logger.info('Updating user', { id });
   
    // Supprimer les champs sensibles ou spéciaux
    const { password, email, isDeleted, ...safeUpdateData } = updateData as any;
   
    // Si le mot de passe est fourni, le hasher
    let updateObject: Record<string, any> = { ...safeUpdateData };
    if (password) {
      updateObject.password = await bcrypt.hash(password, 12);
    }
   
    // Si l'email est fourni, vérifier qu'il n'est pas déjà utilisé
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        throw new AppError('Cet email est déjà utilisé par un autre compte', 409);
      }
     
      // Réinitialiser le statut de vérification d'email
      updateObject.email = email;
      updateObject.isEmailVerified = false;
      updateObject.emailVerificationToken = crypto.randomBytes(32).toString('hex');
      updateObject.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
     
      try {
        await this.notificationService.sendVerificationEmail(
          email,                                   
          updateObject.firstName || "",            
          updateObject.emailVerificationToken  
        );
        logger.info('Email de vérification envoyé lors de la mise à jour', {
          userId: id,
          newEmail: email.substring(0, 5) + '***'
        });
      } catch (emailError) {
        logger.warn('Erreur lors de l\'envoi de l\'email de vérification', {
          error: emailError instanceof Error ? emailError.message : 'Erreur inconnue',
          userId: id
        });
      }
    }
   
    const user = await User.findByIdAndUpdate(
      id,
      {
        $set: updateObject,
        $currentDate: { updatedAt: true }
      },
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -emailVerificationToken');
   
    if (!user) {
      logger.warn('User not found for update', { id });
      throw new AppError('Utilisateur non trouvé', 404);
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
   * Vérifie un compte utilisateur avec token
   */

  async verifyUser(verificationToken: string): Promise<{
  success: boolean;
  message?: string;
  userId?: string;
}> {
  try {
    logger.info('Verifying user account');
    const user = await User.findOne({ emailVerificationToken: verificationToken });

    if (!user) {
      logger.warn('Invalid verification token', { verificationToken });
      return {
        success: false,
        message: 'Token invalide ou expiré'
      };
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    user.isActive = true;

    await user.save();

    if (user.role === UserRole.AGENT && user.agentDetails) {
      user.agentDetails.verificationStatus = VerificationStatus.PENDING;
      await user.save();
    }

    logger.info('User verified successfully', { id: user.id });
    await this.notificationService.sendWelcomeEmail(user.email, user.firstName);

    return {
      success: true,
      userId: user.id
    };
  } catch (error) {
    logger.error('Error verifying user', { error, verificationToken });
    throw error;
  }
}

  /**
   * Retrouve un utilisateur par son token de vérification
   */
  async getUserByVerificationToken(verificationToken: string): Promise<IUser | null> {
    try {
      logger.info('Fetching user by verification token');
      
      const user = await User.findOne({ 
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpires: { $gt: new Date() } // Vérifier que le token n'est pas expiré
      }).select('-password -resetPasswordToken');
      
      if (!user) {
        logger.warn('User not found or token expired', { verificationToken });
        return null;
      }
      
      logger.info('User found by verification token', { userId: user.id });
      return user;
    } catch (error) {
      logger.error('Error fetching user by verification token', { error, verificationToken });
      throw error;
    }
  }

  /**
   * Met à jour le token de vérification d'un utilisateur
   */

async updateVerificationToken(userId: string, sendNewEmail = true): Promise<{
  success: boolean;
  verificationToken?: string;
  message?: string;
}> {
  try {
    logger.info('Updating verification token', { userId });
   
    const user = await User.findById(userId);
    if (!user) {
      logger.warn('User not found for verification token update', { userId });
      return {
        success: false,
        message: 'Utilisateur non trouvé'
      };
    }
   
    // Générer un nouveau token de vérification
    const newVerificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
   
    // Mettre à jour l'utilisateur avec le nouveau token
    user.emailVerificationToken = newVerificationToken;
    user.emailVerificationTokenExpires = tokenExpiration;
   
    await user.save();
   
    // ✅ FIX: Envoyer le nouvel email de vérification avec les bons paramètres
    if (sendNewEmail) {
      await this.notificationService.sendVerificationEmail(
        user.email,
        user.firstName,      // ✅ firstName en 2ème position
        newVerificationToken // ✅ token en 3ème position
      );
      logger.info('New verification email sent', { userId, email: user.email });
    }
   
    logger.info('Verification token updated successfully', { userId });
   
    return {
      success: true,
      verificationToken: newVerificationToken
    };
  } catch (error) {
    logger.error('Error updating verification token', { error, userId });
    throw error;
  }
}

 /**
   * Vérifie si le mot de passe fourni est correct pour l'utilisateur donné
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    try {
      logger.info('Vérification du mot de passe en cours', { userId });

      const user = await User.findById(userId).select('+password');
      if (!user) {
        logger.warn('Utilisateur non trouvé lors de la vérification du mot de passe', { userId });
        return false;
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        logger.warn('Mot de passe incorrect', { userId });
        return false;
      }

      logger.info('Mot de passe valide', { userId });
      return true;
    } catch (error) {
      logger.error('Erreur lors de la vérification du mot de passe', { error, userId });
      throw error;
    }
  }
  /**
   * Initialise le processus de réinitialisation de mot de passe
   */
  async initiatePasswordReset(email: string, redirectUrl:string): Promise<boolean> {
    try {
      logger.info('Initiating password reset', { email });
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        logger.warn('User not found for password reset', { email });
        return false;
      }

      // Générer un token de réinitialisation
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Stocker le token hash
      user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
      
      await user.save();
      const resetLink = `${redirectUrl}?token=${resetToken}&email=${encodeURIComponent(email)}`;

      // Envoyer l'email de réinitialisation
      await this.notificationService.sendPasswordResetEmail(email, resetLink, user.firstName);

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
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string; userId?: string }> {
    try {
      logger.info('Resetting password');
      
      // Hasher le token fourni pour le comparer avec celui stocké
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Trouver l'utilisateur avec le token de réinitialisation
      const user = await User.findOne({ 
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        logger.warn('Invalid or expired password reset token', { token });
        return {
          success: false,
          message: 'Token de réinitialisation invalide ou expiré'
        };
      }

      // Mettre à jour le mot de passe et effacer le jeton
      user.password = await bcrypt.hash(newPassword, 12);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.passwordChangedAt = new Date();
      
      // Invalider tous les jetons d'actualisation
      user.refreshTokens = [];
      await user.save();

      logger.info('Password reset successfully', { id: user.id });
      await this.notificationService.sendPasswordChangeConfirmationEmail(user.email, user.firstName);
      
      return {
        success: true,
        userId: user.id.toString()
      };
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
      const user = await User.findById(id).select('+password');

      if (!user) {
        logger.warn('User not found for password change', { id });
        return false;
      }

      // Vérifier le mot de passe actuel
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        logger.warn('Invalid current password', { id });
        return false;
      }

      // Mettre à jour le mot de passe
      user.password = await bcrypt.hash(newPassword, 12);
      user.passwordChangedAt = new Date();
      await user.save();

      // Invalider tous les jetons d'actualisation sauf le dernier utilisé
      const latestToken = user.refreshTokens?.pop();
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
   * Recherche avancée d'utilisateurs avec paramètres spécifiques
   */
  async searchUsersParams(params: SearchUsersParams): Promise<{ users: IUser[], total: number }> {
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
//   async storeTempTwoFactorSecret(userId: string, secret: string): Promise<void> {
//   // Stocker le secret temporaire dans votre base de données
//   await this.userRepository.update(userId, { 
//     tempTwoFactorSecret: secret,
//     tempSecretExpires: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
//   });
// }

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
  async revokeSession(userId: string, sessionId?: string): Promise<boolean> {
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
  async revokeAllSessionsExceptCurrent(userId: string, currentSessionId: string): Promise<number> {
  try {
    logger.info('Revoking all sessions except current', { userId, currentSessionId });

    const user = await User.findById(userId);
    if (!user) return 0;

    const originalCount = user.refreshTokens?.length || 0;
    const currentSession = user.refreshTokens?.find(token => token.tokenId === currentSessionId);
    user.refreshTokens = currentSession ? [currentSession] : [];

    await user.save();

    const revokedCount = originalCount - user.refreshTokens.length;
    logger.info('All sessions revoked except current', { userId, revokedCount });

    return revokedCount;
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
        await this.notificationService.sendSecurityNotification(
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
    
    // Initialize security object if it doesn't exist
    if (!user.security) {
      user.security = {} as SecurityDetails;
    }
    
    // Initialize loginAttempts array if it doesn't exist
   
   
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
    if (!user) {
      return false;
    }
    
    // Vérifier si le compte est explicitement verrouillé
    if (user.security?.accountLocked) {
      // Check if lock has expired
      if (user.security.lockExpiresAt && user.security.lockExpiresAt < new Date()) {
        // Lock has expired, unlock the account
        await this.unlockAccount(email);
        return false;
      }
      return true;
    }
    
    // Vérifier si le compte doit être verrouillé en raison de trop nombreuses tentatives
    const maxAttempts = 5; // Configurable
    const recentFailedAttempts = await this.getRecentFailedLoginAttemptsCount(email);
   
    if (recentFailedAttempts >= maxAttempts) {
      // Verrouiller le compte
      await this.lockAccount(email);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking if account is locked', { error, email });
    return false;
  }
}

/**
 * Obtient le nombre de tentatives échouées récentes
 */
async getRecentFailedLoginAttemptsCount(email: string, timeWindow = 15): Promise<number> {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.security?.loginAttempts) {
      return 0;
    }
    
    const cutoffTime = new Date(Date.now() - timeWindow * 60 * 1000);
    const recentFailedAttempts = user.security.loginAttempts.filter(
      attempt => attempt.timestamp > cutoffTime && !attempt.success
    );
    
    return recentFailedAttempts.length;
  } catch (error) {
    logger.error('Error getting recent failed login attempts count', { error, email });
    return 0;
  }
}

/**
 * Verrouille un compte utilisateur
 */
async lockAccount(email: string, duration = 30): Promise<boolean> {
  try {
    logger.info('Locking account', { email });
   
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return false;
    }
    
    // Initialize security object if it doesn't exist
    if (!user.security) {
      user.security = {} as SecurityDetails;
    }
    
    // Verrouiller le compte pour la durée spécifiée (en minutes)
    user.security.accountLocked = true;
    user.security.lockExpiresAt = new Date(Date.now() + duration * 60 * 1000);
   
    await user.save();
   
    // Envoyer une notification de verrouillage
    await this.notificationService.sendAccountLockedEmail(
      user.email,
      user.firstName,
      // duration
    );
   
    logger.info('Account locked successfully', { email });
    return true;
  } catch (error) {
    logger.error('Error locking account', { error, email });
    return false;
  }
}

/**
 * Déverrouille un compte utilisateur
 */
async unlockAccount(email: string): Promise<boolean> {
  try {
    logger.info('Unlocking account', { email });
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return false;
    }
    
    if (!user.security) {
      return true; // Account is already effectively unlocked
    }
    
    // Déverrouiller le compte
    user.security.accountLocked = false;
    user.security.lockExpiresAt = undefined;
    
    await user.save();
    
    logger.info('Account unlocked successfully', { email });
    return true;
  } catch (error) {
    logger.error('Error unlocking account', { error, email });
    return false;
  }
}

/**
 * Vérifie si un compte est marqué comme supprimé
 */
async isAccountDeleted(id: string): Promise<boolean> {
  try {
    const user = await User.findById(id);
    return !!user?.isDeleted;
  } catch (error) {
    logger.error('Error checking if account is deleted', { error, id });
    return false;
  }
}

/**
 * Suppression logique d'un utilisateur
 */


/**
 * Restaure un utilisateur supprimé logiquement
 */
async restoreDeletedUser(id: string, email: string): Promise<IUser | null> {
  try {
    logger.info('Restoring deleted user', { id });
    
    // Vérifier si l'email est disponible
    const existingUser = await User.findOne({ email, _id: { $ne: id } });
    if (existingUser) {
      logger.warn('Email already in use', { email });
      throw new AppError('Cet email est déjà utilisé par un autre compte', 409);
    }
    
    // Restaurer l'utilisateur
    const user = await User.findByIdAndUpdate(
      id,
      { 
        $set: { 
          isDeleted: false,
          email,
          deletedAt: undefined
        }
      },
      { new: true }
    );

    if (!user) {
      logger.warn('User not found for restoration', { id });
      return null;
    }
    
    logger.info('User restored successfully', { id });
    
    // Envoyer une notification de restauration de compte
    await this.notificationService.sendAccountRestoredEmail(
      email,
      user.firstName
    );
    
    return user;
  } catch (error) {
    logger.error('Error restoring deleted user', { error, id });
    throw error;
  }
}

/**
 * Enregistre l'historique des préférences utilisateur
 */
async updateUserPreferences(id: string, preferences: any): Promise<IUser | null> {
  try {
    logger.info('Updating user preferences', { id });
    
    const user = await User.findById(id);
    if (!user) {
      logger.warn('User not found for preference update', { id });
      return null;
    }
    
    // Sauvegarder l'ancienne version dans l'historique
    if (!user.preferencesHistory) {
      user.preferencesHistory = [];
    }
    
    if (user.preferences) {
      user.preferencesHistory.push({
        preferences: { ...user.preferences },
        timestamp: new Date()
      });
    }
    
    // Limiter la taille de l'historique
    if (user.preferencesHistory.length > 10) {
      user.preferencesHistory = user.preferencesHistory.slice(-10);
    }
    
    // Mettre à jour les préférences
    user.preferences = {
      ...user.preferences,
      ...preferences,
      updatedAt: new Date()
    };
    
    await user.save();
    logger.info('User preferences updated successfully', { id });
    
    return user;
  } catch (error) {
    logger.error('Error updating preferences', { error, id });
    throw error;
  }
}

/**
 * Génère de nouveaux codes de récupération
 */
async generateRecoveryCodes(userId: string): Promise<string[]> {
  try {
    logger.info('Generating recovery codes', { userId });
    
    // Générer 10 codes de récupération aléatoires
    const recoveryCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      recoveryCodes.push(crypto.randomBytes(5).toString('hex'));
    }
    
    // Hasher et stocker les codes
    const hashedCodes = await Promise.all(
      recoveryCodes.map(async code => ({
        code: await bcrypt.hash(code, 8),
        used: false,
        createdAt: new Date()
      }))
    );
    
    // Mettre à jour l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.security) {
      user.security = { recoveryCodes: hashedCodes };
    } else {
      user.security.recoveryCodes = hashedCodes;
    }

    await user.save();
    
    logger.info('Recovery codes generated successfully', { userId });
    
    // Retourner les codes en clair pour affichage unique
    return recoveryCodes;
  } catch (error) {
    logger.error('Error generating recovery codes', { error, userId });
    throw error;
  }
}

/**
 * Vérifie et utilise un code de récupération
 */
async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
  try {
    logger.info('Verifying recovery code', { userId });
    
    const user = await User.findById(userId);
    if (!user || !user.security?.recoveryCodes || user.security.recoveryCodes.length === 0) {
      logger.warn('No recovery codes found', { userId });
      return false;
    }
    
    // Vérifier chaque code
    let codeIndex = -1;
    for (let i = 0; i < user.security.recoveryCodes.length; i++) {
      const storedCode = user.security.recoveryCodes[i];
      if (!storedCode.used && await bcrypt.compare(code, storedCode.code)) {
        codeIndex = i;
        break;
      }
    }
    
    if (codeIndex === -1) {
      logger.warn('Invalid recovery code', { userId });
      return false;
    }
    
    // Marquer le code comme utilisé
    user.security.recoveryCodes[codeIndex].used = true;
    user.security.recoveryCodes[codeIndex].usedAt = new Date();
    await user.save();
    
    logger.info('Recovery code verified successfully', { userId });
    return true;
  } catch (error) {
    logger.error('Error verifying recovery code', { error, userId });
    return false;
  }
}

/**
 * Ajoute un appareil de confiance
 */
async addTrustedDevice(userId: string, deviceInfo: any): Promise<boolean> {
  try {
    logger.info('Adding trusted device', { userId });
    
    const user = await User.findById(userId);
    if (!user) {
      return false;
    }
    
    if (!user.security) {
      user.security = {} as any;
    }
    
    if (!user.security?.trustedDevices) {
      user.security?.trustedDevices 
    }
    
    // Ajouter l'appareil
    user.security?.trustedDevices?.push({
      ...deviceInfo,
      deviceId: crypto.randomBytes(16).toString('hex'),
      addedAt: new Date(),
      lastUsed: new Date()
    });
    
    await user.save();
    logger.info('Trusted device added successfully', { userId });
    
    return true;
  } catch (error) {
    logger.error('Error adding trusted device', { error, userId });
    return false;
  }
}

/**
 * Supprime un appareil de confiance
 */
async removeTrustedDevice(userId: string, deviceId: string): Promise<boolean> {
  try {
    logger.info('Removing trusted device', { userId, deviceId });
    
    const user = await User.findById(userId);
    if (!user || !user.security?.trustedDevices) {
      return false;
    }
    
    const initialLength = user.security.trustedDevices.length;
    user.security.trustedDevices = user.security.trustedDevices.filter(
      device => device.deviceId !== deviceId
    );
    
    if (user.security.trustedDevices.length === initialLength) {
      logger.warn('Device not found', { userId, deviceId });
      return false;
    }
    
    await user.save();
    logger.info('Trusted device removed successfully', { userId, deviceId });
    
    return true;
  } catch (error) {
    logger.error('Error removing trusted device', { error, userId, deviceId });
    return false;
  }
}

/**
 * Vérifie si un appareil est de confiance
 */
async isTrustedDevice(userId: string, deviceId: string): Promise<boolean> {
  try {
    const user = await User.findById(userId);
    if (!user || !user.security?.trustedDevices) {
      return false;
    }
    
    const device = user.security.trustedDevices.find(d => d.deviceId === deviceId);
    if (device) {
      // Mettre à jour la date de dernière utilisation
      device.lastUsed = new Date();
      await user.save();
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking trusted device', { error, userId, deviceId });
    return false;
  }
}

/**
 * Exporte les données utilisateur (conformité RGPD)
 */
async exportUserData(userId: string): Promise<any> {
  try {
    logger.info('Exporting user data (GDPR)', { userId });
    
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('Utilisateur non trouvé', 404);
    }
    
    // Récupérer toutes les données de l'utilisateur
    // Omettre les informations sensibles comme le mot de passe
    const userData = {
      personalInfo: {
        id: user.id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      accountInfo: {
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        preferences: user.preferences
      },
      agentDetails: user.agentDetails,
      securityInfo: {
        passwordLastChanged: user.passwordChangedAt,
        twoFactorEnabled: user.preferences?.twoFactorEnabled
      },
      sessions: user.refreshTokens?.map(session => ({
        device: session.device,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsed: session.lastUsed
      }))
    };
    
    // Note: Dans un système réel, il faudrait également récupérer
    // les données associées à l'utilisateur dans d'autres collections
    
    return userData;
  } catch (error) {
    logger.error('Error exporting user data', { error, userId });
    throw error;
  }
}

/**
 * Met à jour l'avatar de l'utilisateur
 */
async updateUserAvatar(userId: string, avatarUrl: string): Promise<IUser | null> {
  try {
    logger.info('Updating user avatar', { userId });
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { avatarUrl } },
      { new: true }
    );
    
    return user;
  } catch (error) {
    logger.error('Error updating user avatar', { error, userId });
    throw error;
  }
}

/**
 * Ajoute une notification à l'utilisateur
 */
async addUserNotification(userId: string, notification: any): Promise<boolean> {
  try {
    logger.info('Adding user notification', { userId });
    
    const user = await User.findById(userId);
    if (!user) {
      return false;
    }
    
    if (!user.notifications) {
      user.notifications = [];
    }
    
    user.notifications.push({
      ...notification,
      id: crypto.randomBytes(8).toString('hex'),
      createdAt: new Date(),
      read: false
    });
    
    // Limiter le nombre de notifications stockées
    if (user.notifications.length > 100) {
      user.notifications = user.notifications.slice(-100);
    }
    
    await user.save();
    return true;
  } catch (error) {
    logger.error('Error adding user notification', { error, userId });
    return false;
  }
}

/**
 * Marque une notification comme lue
 */
async markNotificationAsRead(userId: string, notificationId: string): Promise<boolean> {
  try {
    logger.info('Marking notification as read', { userId, notificationId });
    
    const user = await User.findById(userId);
    if (!user || !user.notifications) {
      return false;
    }
    
    const notification = user.notifications.find(n => n.id === notificationId);
    if (!notification) {
      return false;
    }
    
    notification.read = true;
    notification.readAt = new Date();
    
    await user.save();
    return true;
  } catch (error) {
    logger.error('Error marking notification as read', { error, userId, notificationId });
    return false;
  }
}

/**
 * Obtient toutes les notifications de l'utilisateur
 */
async getUserNotifications(userId: string, includeRead = false): Promise<any[]> {
  try {
    const user = await User.findById(userId);
    if (!user || !user.notifications) {
      return [];
    }
    
    return user.notifications
      .filter(n => includeRead || !n.read)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    logger.error('Error getting user notifications', { error, userId });
    return [];
  }
}


/**
 * Supprime un utilisateur (soft delete par défaut)
 */
async deleteUser(userId: string, options: DeleteUserOptions = {}): Promise<DeleteUserResult> {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    logger.info('Initiating user deletion', { userId, options });

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const { softDelete = true, reason, deletedBy, preserveData = false } = options;

    if (softDelete) {
      return await this.softDeleteUser(userId, reason, deletedBy);
    } else {
      return await this.hardDeleteUser(userId, preserveData);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting user', { error: errorMessage, userId });
    throw new Error(`User deletion failed: ${errorMessage}`);
  }
}

/**
 * Suppression logique (soft delete) - marque l'utilisateur comme supprimé
 */
async softDeleteUser(userId: string, reason?: string, deletedBy?: string): Promise<DeleteUserResult> {
  try {
    const deletedAt = new Date();
    
    // Update user document to mark as deleted
    const updateData: any = {
      isActive: false,
      isDeleted: true,
      deletedAt,
      deletionReason: reason,
      deletedBy,
      // Optionally anonymize email to prevent conflicts
      email: `deleted_${userId}_${Date.now()}@deleted.local`
    };

    // Assuming you have a User model/collection
    // Adjust this based on your database implementation
    await this.updateUser(userId, updateData);

    // Revoke all active sessions
    try {
      await this.revokeSession(userId);
    } catch (error) {
      logger.warn('Could not revoke all sessions during soft delete', { userId });
    }

    // Log the deletion
    await this.logUserAction(userId, 'USER_SOFT_DELETED', {
      reason,
      deletedBy,
      deletedAt
    });

    logger.info('User soft deleted successfully', { userId, deletedBy, reason });

    return {
      success: true,
      userId,
      deletionType: 'soft',
      deletedAt,
      message: 'User soft deleted successfully'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in soft delete', { error: errorMessage, userId });
    throw error;
  }
}

/**
 * Suppression physique (hard delete) - supprime définitivement l'utilisateur
 */
async hardDeleteUser(userId: string, preserveData: boolean = false): Promise<DeleteUserResult> {
  try {
    const deletedAt = new Date();

    if (preserveData) {
      // Archive user data before deletion
      await this.archiveUserData(userId);
    }

    // Delete user from database
    // Adjust this based on your database implementation
    const deleteResult = await this.removeUserFromDatabase(userId);
    
    if (!deleteResult) {
      throw new Error('Failed to delete user from database');
    }

    // Clean up related data
    await this.cleanupUserRelatedData(userId);

    // Log the deletion (you might want to log this in a separate audit table)
    await this.logUserAction(userId, 'USER_HARD_DELETED', {
      preserveData,
      deletedAt
    });

    logger.info('User hard deleted successfully', { userId, preserveData });

    return {
      success: true,
      userId,
      deletionType: 'hard',
      deletedAt,
      message: 'User permanently deleted'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in hard delete', { error: errorMessage, userId });
    throw error;
  }
}

/**
 * Restaure un utilisateur supprimé logiquement
 */
async restoreUser(userId: string, restoredBy?: string): Promise<boolean> {
  try {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isDeleted) {
      throw new Error('User is not deleted');
    }

    const updateData: any = {
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      deletionReason: null,
      deletedBy: null,
      restoredAt: new Date(),
      restoredBy
    };

    // Restore original email if it was anonymized
    if (user.email && user.email.startsWith('deleted_')) {
      // You might need to handle email restoration differently
      // This is a simplified example
      logger.warn('Email restoration needed for user', { userId });
    }

    await this.updateUser(userId, updateData);

    // Log the restoration
    await this.logUserAction(userId, 'USER_RESTORED', {
      restoredBy,
      restoredAt: updateData.restoredAt
    });

    logger.info('User restored successfully', { userId, restoredBy });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error restoring user', { error: errorMessage, userId });
    throw new Error(`User restoration failed: ${errorMessage}`);
  }
}

/**
 * Archive user data before hard deletion
 */
private async archiveUserData(userId: string): Promise<void> {
  try {
    const user = await this.getUserById(userId);
    if (!user) {
      return;
    }

    // Create archive record
    const archiveData = {
      originalUserId: userId,
      userData: user,
      archivedAt: new Date(),
      archiveReason: 'USER_DELETION'
    };

    // Store in archive collection/table
    // Adjust based on your database implementation
    await this.createArchiveRecord(archiveData);

    logger.info('User data archived successfully', { userId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error archiving user data', { error: errorMessage, userId });
    throw error;
  }
}

/**
 * Clean up user-related data after hard deletion
 */
private async cleanupUserRelatedData(userId: string): Promise<void> {
  try {
    // Clean up sessions
    await this.revokeSession(userId).catch(err => 
      logger.warn('Error cleaning up sessions', { userId, error: err.message })
    );

    // Clean up user preferences
    await this.deleteUserPreferences(userId).catch(err => 
      logger.warn('Error cleaning up preferences', { userId, error: err.message })
    );

    // Clean up user files/uploads
    await this.deleteUserFiles(userId).catch(err => 
      logger.warn('Error cleaning up files', { userId, error: err.message })
    );

    // Add more cleanup operations as needed for your application
    // Examples: notifications, subscriptions, relationships, etc.

    logger.info('User related data cleaned up', { userId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error cleaning up user data', { error: errorMessage, userId });
    // Don't throw here, as the main deletion might have succeeded
  }
}

/**
 * Remove user from database (implement based on your database)
 */
private async removeUserFromDatabase(userId: string): Promise<boolean> {
  try {
    // MongoDB example:
    // const result = await this.userModel.deleteOne({ _id: userId });
    // return result.deletedCount > 0;

    // SQL example:
    // const result = await this.db.query('DELETE FROM users WHERE id = ?', [userId]);
    // return result.affectedRows > 0;

    // Placeholder - implement based on your database
    logger.info('Removing user from database', { userId });
    
    // You'll need to implement this based on your database setup
    // For now, returning true as placeholder
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error removing user from database', { error: errorMessage, userId });
    return false;
  }
}

/**
 * Create archive record (implement based on your needs)
 */
private async createArchiveRecord(archiveData: any): Promise<void> {
  try {
    // Implement based on your database
    // This might be a separate archive table/collection
    logger.info('Creating archive record', { userId: archiveData.originalUserId });
    
    // Placeholder implementation
    // You'll need to implement this based on your database setup
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating archive record', { error: errorMessage });
    throw error;
  }
}

/**
 * Delete user preferences
 */
private async deleteUserPreferences(userId: string): Promise<void> {
  try {
    // Implement based on your preferences storage
    logger.info('Deleting user preferences', { userId });
    
    // Example implementations:
    // await this.preferencesModel.deleteMany({ userId });
    // await this.db.query('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting user preferences', { error: errorMessage, userId });
    throw error;
  }
}

/**
 * Delete user files
 */
private async deleteUserFiles(userId: string): Promise<void> {
  try {
    // Implement based on your file storage system
    logger.info('Deleting user files', { userId });
    
    // Examples:
    // - Delete from filesystem
    // - Delete from cloud storage (AWS S3, Google Cloud, etc.)
    // - Remove file references from database
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error deleting user files', { error: errorMessage, userId });
    throw error;
  }
}

/**
 * Log user actions for audit trail
 */
private async logUserAction(userId: string, action: string, details: any): Promise<void> {
  try {
    const logEntry = {
      userId,
      action,
      details,
      timestamp: new Date(),
      ip: null, // You might want to pass this from the request
      userAgent: null // You might want to pass this from the request
    };

    // Store in audit log
    // Implement based on your logging system
    logger.info('User action logged', { userId, action, details });
    
    // Example:
    // await this.auditLogModel.create(logEntry);
    // await this.db.query('INSERT INTO audit_logs ...', [logEntry]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error logging user action', { error: errorMessage, userId, action });
    // Don't throw here, as logging failure shouldn't break the main operation
  }
}

/**
 * Get deleted users (for admin purposes)
 */
async getDeletedUsers(page: number = 1, limit: number = 10): Promise<any[]> {
  try {
    // Implement based on your database
    // Return soft-deleted users for potential restoration
    
    logger.info('Getting deleted users', { page, limit });
    
    // Placeholder - implement based on your database
    return [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting deleted users', { error: errorMessage });
    throw new Error(`Failed to get deleted users: ${errorMessage}`);
  }
}

/**
 * Bulk delete users
 */
async bulkDeleteUsers(userIds: string[], options: DeleteUserOptions = {}): Promise<DeleteUserResult[]> {
  try {
    if (!userIds || userIds.length === 0) {
      throw new Error('User IDs array is required');
    }

    logger.info('Starting bulk user deletion', { count: userIds.length, options });

    const results: DeleteUserResult[] = [];
    
    for (const userId of userIds) {
      try {
        const result = await this.deleteUser(userId, options);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          success: false,
          userId,
          deletionType: options.softDelete ? 'soft' : 'hard',
          deletedAt: new Date(),
          message: `Failed: ${errorMessage}`
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info('Bulk deletion completed', { 
      total: userIds.length, 
      successful: successCount, 
      failed: userIds.length - successCount 
    });

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in bulk delete', { error: errorMessage });
    throw new Error(`Bulk deletion failed: ${errorMessage}`);
  }
}



}