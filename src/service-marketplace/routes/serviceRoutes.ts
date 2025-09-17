import { Router } from 'express';
import { ServiceController, upload } from '../controllers/ServiceController';
import authenticate from '../../auth/middlewares/authenticate';

const router = Router();
const serviceController = new ServiceController();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes pour les prestataires
router.post('/provider', serviceController.createServiceProvider.bind(serviceController));
router.get('/provider/services', serviceController.getProviderServices.bind(serviceController));

// Routes pour les services
router.post('/', upload.array('photos', 5), serviceController.createService.bind(serviceController));
router.get('/', serviceController.getServices.bind(serviceController));
router.get('/:serviceId/stats', serviceController.getServiceStats.bind(serviceController));

// Routes pour les abonnements
router.post('/subscribe', serviceController.subscribeToService.bind(serviceController));
router.get('/subscriptions', serviceController.getUserSubscriptions.bind(serviceController));
router.patch('/subscriptions/:subscriptionId/pause', serviceController.pauseSubscription.bind(serviceController));
router.patch('/subscriptions/:subscriptionId/share', serviceController.shareService.bind(serviceController));

// Routes pour les recommandations
router.post('/recommendations', serviceController.getRecommendations.bind(serviceController));

export default router;