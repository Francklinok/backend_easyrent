import { Router } from 'express';
import ActivityController from '../controllers/activityController';
import { authenticateToken } from '../../auth/middleware/authMiddleware';
import { Server as IOServer } from 'socket.io';

const createActivityRoutes = (io: IOServer): Router => {
  const router = Router();
  const activityController = new ActivityController(io);

  // Toutes les routes nécessitent une authentification
  router.use(authenticateToken);

  // Routes pour les visites
  router.post('/visit', activityController.createVisite.bind(activityController));

  // Routes pour les réservations
  router.post('/reservation', activityController.createReservation.bind(activityController));
  router.patch('/reservation/accept', activityController.acceptReservation.bind(activityController));
  router.patch('/reservation/refuse', activityController.refuseReservation.bind(activityController));

  // Routes pour les visites
  router.patch('/visit/accept', activityController.acceptVisit.bind(activityController));
  router.patch('/visit/refuse', activityController.refuseVisit.bind(activityController));

  // Routes pour les paiements
  router.post('/payment', activityController.processPayment.bind(activityController));

  // Routes pour récupérer les activités
  router.get('/', activityController.getActivities.bind(activityController));
  router.get('/owner', activityController.getOwnerActivities.bind(activityController));
  router.get('/:id', activityController.getActivityById.bind(activityController));

  return router;
};

export default createActivityRoutes;