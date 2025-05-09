import User from "../models/userModel"
import { IUser } from "../userTypes/userTypes";
import createLogger from  "../../utils/logger/logger"
import { CreateUserDto } from '../userTypes/userTypes';
import { UpdateUserDto } from '../userTypes/userTypes';
import { SearchUsersParams } from '../userTypes/userTypes';
import { VerificationStatus } from '../userTypes/userTypes';
import { UserRole } from '../userTypes/userTypes';

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
}