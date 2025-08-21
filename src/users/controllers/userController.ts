import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService';
import { SecurityAuditService } from '../../security/services/securityAuditServices';
import { NotificationService } from '../../services/notificationServices';
import { createLogger } from '../../utils/logger/logger';
import { UserFilterOptions, UserSearchOptions } from '../types/userTypes';
import { AuditEventData } from '../types/userTypes';
import { ExtendedUpdateUserDto } from '../types/userTypes';


const logger = createLogger('UserController');
const userService = new UserService();
const securityAuditService = SecurityAuditService.getInstance();
const notificationService = new NotificationService();

/**
 * Contrôleur pour les opérations liées aux utilisateurs
 */
export class UserController {
    // ----------------------------
  // Méthode frontend : utilisateur connecté
  // ----------------------------
  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = (req.user as { userId: string }).userId;

      const user = await userService.getUserById(currentUserId);

      if (!user) {
        res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        return;
      }

      // Champs exposés au frontend
      const userData = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        photo: user.profilePicture,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        preferences: user.preferences
      };

      res.status(200).json({
        success: true,
        message: 'Informations utilisateur récupérées avec succès',
        data: userData
      });
    } catch (error) {
      next(error);
    }}
  /**
   * Obtenir la liste des utilisateurs avec pagination et filtres
   */
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', ...filters } = req.query;
      
      // Ensure sortOrder is properly typed
      const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
      
      const filterOptions: UserFilterOptions = {
        page: Number(page),
        limit: Number(limit),
        sortBy: String(sortBy),
        sortOrder: validSortOrder,
        ...filters
      };
      
      const users = await userService.getUsers(filterOptions);
      
      res.status(200).json({
        success: true,
        message: 'Utilisateurs récupérés avec succès',
        data: users.data,
        pagination: {
          total: users.total,
          page: users.page,
          limit: users.limit,
          totalPages: Math.ceil(users.total / users.limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Obtenir les détails d'un utilisateur spécifique
   */
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      const user = await userService.getUserById(id);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Utilisateur récupéré avec succès',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Recherche avancée d'utilisateurs
   */
  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        query, 
        page = 1, 
        limit = 10, 
        fields = [],
        filters = {},
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.body;
      
      // Ensure sortOrder is properly typed
      const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
      
      const searchOptions: UserSearchOptions = {
        query,
        page: Number(page),
        limit: Number(limit),
        fields: Array.isArray(fields) ? fields : [fields],
        filters,
        sortBy: String(sortBy),
        sortOrder: validSortOrder
      };
      
      const searchResults = await userService.searchUsers(searchOptions);
      
      res.status(200).json({
        success: true,
        message: 'Recherche effectuée avec succès',
        data: searchResults.data,
        pagination: {
          total: searchResults.total,
          page: searchResults.page,
          limit: searchResults.limit,
          totalPages: Math.ceil(searchResults.total / searchResults.limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Mettre à jour un utilisateur
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const currentUserId = (req.user as { userId: string }).userId;
      
      // Vérifier que l'utilisateur existe
      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }
      
      // Mettre à jour l'utilisateur
      const updatedUser = await userService.updateUser(id, updateData);
      
      // Journaliser l'événement
      const auditData: AuditEventData = {
        eventType: 'USER_UPDATED',
        userId: id,
        performedBy: currentUserId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { updatedFields: Object.keys(updateData) }
      };
      
      await securityAuditService.logEvent(auditData);
      
      logger.info('Utilisateur mis à jour', { 
        userId: id, 
        updatedBy: currentUserId,
        updatedFields: Object.keys(updateData)
      });
      
      res.status(200).json({
        success: true,
        message: 'Utilisateur mis à jour avec succès',
        data: updatedUser
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Activer un compte utilisateur
   */
  async activateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUserId = (req.user as { userId: string }).userId;
      
      // Vérifier que l'utilisateur existe
      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }
      
      // Activer l'utilisateur
      const activatedUser = await userService.updateUser(id, { isActive: true });
      
      // Journaliser l'événement
      const auditData: AuditEventData = {
        eventType: 'USER_ACTIVATED',
        userId: id,
        performedBy: currentUserId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };
      
      await securityAuditService.logEvent(auditData);
      
      // Envoyer une notification à l'utilisateur
      await notificationService.sendAccountStatusNotification(
        existingUser.email,
        existingUser.firstName,
        'activated'
      );
      
      logger.info('Utilisateur activé', { 
        userId: id, 
        activatedBy: currentUserId 
      });
      
      res.status(200).json({
        success: true,
        message: 'Utilisateur activé avec succès',
        data: activatedUser
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Désactiver un compte utilisateur
   */
  async deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const currentUserId = (req.user as { userId: string }).userId;
      
      // Vérifier que l'utilisateur existe
      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }
      
      // Préparer les données de mise à jour avec le bon typage
      const updateData: ExtendedUpdateUserDto = { 
        isActive: false,
        deactivationReason: reason,
        deactivatedAt: new Date(),
        deactivatedBy: currentUserId
      };
      
      // Désactiver l'utilisateur
      const deactivatedUser = await userService.updateUser(id, updateData);
      
      // Journaliser l'événement
      const auditData: AuditEventData = {
        eventType: 'USER_DEACTIVATED',
        userId: id,
        performedBy: currentUserId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { reason }
      };
      
      await securityAuditService.logEvent(auditData);
      
      // Envoyer une notification à l'utilisateur
      await notificationService.sendAccountStatusNotification(
        existingUser.email,
        existingUser.firstName,
        'deactivated',
        reason // Optional comment parameter
      );
      
      logger.info('Utilisateur désactivé', { 
        userId: id, 
        deactivatedBy: currentUserId,
        reason
      });
      
      res.status(200).json({
        success: true,
        message: 'Utilisateur désactivé avec succès',
        data: deactivatedUser
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer un utilisateur (soft delete)
   */
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUserId = (req.user as { userId: string }).userId;
      
      // Vérifier que l'utilisateur existe
      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }
      
      // Effectuer le soft delete
      await userService.softDeleteUser(id, currentUserId);
      
      // Journaliser l'événement
      const auditData: AuditEventData = {
        eventType: 'USER_DELETED',
        userId: id,
        performedBy: currentUserId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };
      
      await securityAuditService.logEvent(auditData);
      
      logger.info('Utilisateur supprimé', { 
        userId: id, 
        deletedBy: currentUserId 
      });
      
      res.status(200).json({
        success: true,
        message: 'Utilisateur supprimé avec succès'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Obtenir l'historique des activités d'un utilisateur
   */
  async getUserActivityLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, eventType } = req.query;
      
      // Vérifier que l'utilisateur existe
      const existingUser = await userService.getUserById(id);
      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
        return;
      }
      
      // Obtenir les logs d'activité
      const activityLogs = await securityAuditService.getUserActivityLogs(
        id,
        {
          page: Number(page),
          limit: Number(limit),
          eventType: eventType ? String(eventType) : undefined
        }
      );
      
      res.status(200).json({
        success: true,
        message: 'Logs d\'activité récupérés avec succès',
        data: activityLogs.data,
        pagination: {
          total: activityLogs.total,
          page: activityLogs.page,
          limit: activityLogs.limit,
          totalPages: Math.ceil(activityLogs.total / activityLogs.limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}