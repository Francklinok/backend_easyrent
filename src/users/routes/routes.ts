import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';

const userRouter = Router();
const userController = new UserController();

// Liste des utilisateurs
userRouter.get('/users', authenticate, userController.getUsers.bind(userController));

//user connected

userRouter.get('/users/me', authenticate, userController.getCurrentUser.bind(userController));

// Détails d'un utilisateur
userRouter.get('/users/:id', authenticate, userController.getUserById.bind(userController));

// Recherche avancée
userRouter.post('/users/search', authenticate, userController.searchUsers.bind(userController));

// Mise à jour d'un utilisateur
userRouter.put('/users/:id', authenticate, userController.updateUser.bind(userController));

// Activer un utilisateur
userRouter.put('/users/:id/activate', authenticate, userController.activateUser.bind(userController));

// Désactiver un utilisateur
userRouter.put('/users/:id/deactivate', authenticate, userController.deactivateUser.bind(userController));

// Supprimer un utilisateur (soft delete)
userRouter.delete('/users/:id', authenticate, userController.deleteUser.bind(userController));

// Logs d'activité
userRouter.get('/users/:id/activity-logs', authenticate, userController.getUserActivityLogs.bind(userController));

export default userRouter;
