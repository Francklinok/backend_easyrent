import { Document, Types } from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import User from '../users/models/userModel';
import { NotificationService } from './notificationServices';
import { SecurityAuditService } from './auditservices';
import { createLogger } from '../utils/logger/logger';
import { AppError } from '../../auth/utils/AppError';
import { UserDocument, UserFilterOptions, UserSearchOptions } from '../types/userTypes';
const logger = createLogger('UserService');
const notificationService = new NotificationService();
const securityAuditService = new SecurityAuditService();

/**
 * Service pour la gestion des utilisateurs
 */
export class UserService {
  /**
   * Créer un nouvel utilisateur
   */
  async createUser(userData: Partial<UserDocument>, sendVerificationEmail: boolean = true): Promise<UserDocument> {
    try {
      // Vérifier si l'email existe déjà
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new AppError('Cet email est déjà utilisé', 409);
      }
      
      // Hasher le mot de passe
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 12);
      }
      
      // Générer un token de vérification d'email
      if (sendVerificationEmail) {
        userData.emailVerificationToken = crypto.randomBytes(32).toString('hex');
        userData.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
      }
      
      // Créer l'utilisateur
      const user = await User.create({
        ...userData,
        isActive: !sendVerificationEmail, // Actif immédiatement si pas de vérification d'email
        createdAt: new Date()
      });
      
      // Envoyer l'email de vérification
      if (sendVerificationEmail && user.email && user.emailVerificationToken) {
        await notificationService.sendVerificationEmail(
          user.email,
          user.emailVerificationToken
        );
      }
      
      logger.info('Nouvel utilisateur créé', { userId: user._id });
      
      return user;
    } catch (error) {
      logger.error('Erreur lors de la création d\'un utilisateur', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        email: userData.email
      });
      throw error;
    }
  }
  
  /**
   * Obtenir un utilisateur par son ID
   */
  async getUserById(userId: string): Promise<UserDocument | null> {
    try {
      return await User.findById(userId).select('-password -resetPasswordToken -emailVerificationToken');
    } catch (error) {
      logger.error('Erreur lors de la récupération d\'un utilisateur par ID', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        userId
      });
      throw error;
    }
  }
  
  /**
   * Obtenir un utilisateur par son email
   */
  async getUserByEmail(email: string): Promise<UserDocument | null> {
    try {
      return await User.findOne({ email }).select('-resetPasswordToken -emailVerificationToken');
    } catch (error) {
      logger.error('Erreur lors de la récupération d\'un utilisateur par email', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        email
      });
      throw error;
    }
  }
  
  /**
   * Obtenir la liste des utilisateurs avec pagination et filtres
   */
  async getUsers(options: UserFilterOptions): Promise<{
    data: UserDocument[];
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
    data: UserDocument[];
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
        const orConditions = fields.map(field => ({
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
  
  /**
   * Mettre à jour un utilisateur
   */
  async updateUser(userId: string, updateData: Partial<UserDocument>): Promise<UserDocument | null> {
    try {
      // Supprimer les champs sensibles ou spéciaux
      const { password, email, isDeleted, ...safeUpdateData } = updateData;
      
      // Si le mot de passe est fourni, le hasher
      let updateObject: Record<string, any> = { ...safeUpdateData };
      if (password) {
        updateObject.password = await bcrypt.hash(password, 12);
      }
      
      // Si l'email est fourni, vérifier qu'il n'est pas déjà utilisé
      if (email) {
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
          throw new AppError('Cet email est déjà utilisé par un autre compte', 409);
        }
        
        // Réinitialiser le statut de vérification d'email
        updateObject.email = email;
        updateObject.isEmailVerified = false;
        updateObject.emailVerificationToken = crypto.randomBytes(32).toString('hex');
        updateObject.emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        // Envoyer un email de vérification
        await notificationService.sendVerificationEmail(
          email,
          updateObject.emailVerificationToken
        );
      }
      
      // Mettre à jour l'utilisateur
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { 
          $set: updateObject,
          $currentDate: { updatedAt: true }
        },
        { new: true, runValidators: true }
      ).select('-password -resetPasswordToken -emailVerificationToken');
      
      if (!updatedUser) {
        throw new AppError('Utilisateur non trouvé', 404);
      }
      
      logger.info('Utilisateur mis à jour', { userId });
      
      return updatedUser;
    } catch (error) {
      logger.error('Erreur lors de la mise à jour d\'un utilisateur', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        userId
      });
      throw error;
    }
  }
  
  /**
   * Vérifier un email avec le token de vérification
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message?: string; userId?: string }> {
    try {
      // Trouver l'utilisateur avec le token de vérification
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationTokenExpires: { $gt: Date.now() }
      });
      
      if (!user) {
        return {
          success: false,
          message: 'Token de vérification invalide ou expiré'
        };
      }
      
      // Mettre à jour le statut de vérification
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationTokenExpires = undefined;
      user.isActive = true; // Activer l'utilisateur après vérification
      
      await user.save();
      
      logger.info('Email vérifié avec succès', { userId: user._id });
      
      return {
        success: true,
        userId: user._id.toString()
      };
    } catch (error) {
      logger.error('Erreur lors de la vérification d\'email', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        token
      });
      throw error;
    }
  }
  
  /**
   * Initier une réinitialisation de mot de passe
   */
  async initiatePasswordReset(email: string): Promise<boolean> {
    try {
      // Trouver l'utilisateur par email
      const user = await User.findOne({ email });
      
      if (!user) {
        // Ne pas révéler si l'email existe ou non
        return false;
      }
      
      // Générer un token de réinitialisation
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Stocker le token hash
      user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
      
      await user.save();
      
      // Envoyer l'email de réinitialisation
      await notificationService.sendPasswordResetEmail(
        email,
        resetToken
      );
      
      logger.info('Demande de réinitialisation de mot de passe initiée', { userId: user._id });
      
      return true;
    } catch (error) {
      logger.error('Erreur lors de l\'initiation de réinitialisation de mot de passe', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        email
      });
      throw error;
    }
  }
  
  /**
   * Réinitialiser le mot de passe avec un token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message?: string; userId?: string }> {
    try {
      // Hasher le token fourni pour le comparer avec celui stocké
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Trouver l'utilisateur avec le token de réinitialisation
      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      });
      
      if (!user) {
        return {
          success: false,
          message: 'Token de réinitialisation invalide ou expiré'
        };
      }
      
      // Hasher et mettre à jour le mot de passe
      user.password = await bcrypt.hash(newPassword, 12);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.passwordChangedAt = new Date();
      
      await user.save();
      
      logger.info('Mot de passe réinitialisé avec succès', { userId: user._id });
      
      return {
        success: true,
        userId: user._id.toString()
      };
    } catch (error) {
      logger.error('Erreur lors de la réinitialisation du mot de passe', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      throw error;
    }
  }
  
  /**
   * Vérifier le mot de passe d'un utilisateur
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    try {
      const user = await User.findById(userId).select('+password');
      
      if (!user || !user.password) {
        return false;
      }
      
      return await bcrypt.compare(password, user.password);
    } catch (error) {
      logger.error('Erreur lors de la vérification du mot de passe', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        userId
      });
      throw error;
    }
  }
  
  /**
   * Soft delete d'un utilisateur
   */
  async softDeleteUser(userId: string, deletedBy: string): Promise<boolean> {
    try {
      const result = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            isDeleted: true,
            isActive: false,
            deletedAt: new Date(),
            deletedBy
          }
        }
      );
      
      if (!result) {
        return false;
      }
      
      logger.info('Utilisateur supprimé (soft delete)', { 
        userId,
        deletedBy
      });
      
      return true;
    } catch (error) {
      logger.error('Erreur lors de la suppression d\'un utilisateur', { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        userId
      });
      throw error;
    }
  }
}