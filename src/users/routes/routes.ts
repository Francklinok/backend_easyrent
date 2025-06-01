import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();
const userController = new UserController();

// Liste des utilisateurs
router.get('/users', authenticate, userController.getUsers.bind(userController));

// Détails d'un utilisateur
router.get('/users/:id', authenticate, userController.getUserById.bind(userController));

// Recherche avancée
router.post('/users/search', authenticate, userController.searchUsers.bind(userController));

// Mise à jour d'un utilisateur
router.put('/users/:id', authenticate, userController.updateUser.bind(userController));

// Activer un utilisateur
router.put('/users/:id/activate', authenticate, userController.activateUser.bind(userController));

// Désactiver un utilisateur
router.put('/users/:id/deactivate', authenticate, userController.deactivateUser.bind(userController));

// Supprimer un utilisateur (soft delete)
router.delete('/users/:id', authenticate, userController.deleteUser.bind(userController));

// Logs d'activité
router.get('/users/:id/activity-logs', authenticate, userController.getUserActivityLogs.bind(userController));

export default router;
