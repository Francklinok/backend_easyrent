/**
 * @file app.js - Configuration principale du serveur Express
 * @description Point d'entrée pour l'API EasyRent, gère la configuration du serveur et les middlewares
 */

import express from 'express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config';
import auThrouter from './auth/routers/authrouters';
import propertyRouter from './routers/propertyRouters/propertyrouters';
// import router from '../auth/routers/authrouters';
import { errorHandler } from './auth/utils/errorHandler';
import { UserPresenceService } from './users/services/userPresence';
import { trackUserActivity } from './users/middleware/trackUserActivity';
import { createLogger } from './utils/logger/logger';
import chatRouter from './chat/routers/chatRouter';

const logger = createLogger("app")
// import { propertyErrorHandler } from './property/middlewares/propertyErrorHandler';

// Configuration pour ES modules avec __dirname
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Création et configuration de l'application Express
const app = express();

// Middleware pour traquer l'activité sur les requêtes HTTP
// const userPresenceService = new UserPresenceService();

// app.use(trackUserActivity(userPresenceService));

// Middlewares de sécurité et d'optimisation

app.use(helmet());
app.use(cors({
  origin: config.cors.origin|| '*',
  methods: config.cors.methods,
  credentials: true,
  optionsSuccessStatus: 204
}));
app.use(compression());

app.use(express.json());

// Configuration du rate limiter pour prévenir les attaques par force brute
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit?.max || 100, // limite par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Trop de requêtes, veuillez réessayer plus tard'
  }
});
app.use('/api/', limiter); // Appliquer uniquement aux routes API

// Logging des requêtes
app.use(morgan(config.logging.format || 'dev'));

// Parsers pour les requêtes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

app.get('/verify-account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify-account.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(__dirname + '/public/reset-password.html');
});

// Connexion à MongoDB avec gestion des événements
mongoose.connect(config.database.url, {})
  .then(() => console.log('✅ Connecté à MongoDB'))
  .catch(err => {
    console.error('❌ Erreur de connexion MongoDB:', err);
    process.exit(1);
  });

// Surveillance de la connexion MongoDB
mongoose.connection.on('error', err => {
  logger.error('❌ Erreur MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB déconnecté');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('📴 Connexion MongoDB fermée suite à l\'arrêt de l\'application');
  process.exit(0);
});

// Route de test/santé
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Bienvenue sur l\'API EasyRent',
    // version: config.version || '1.0.0',
    environment: config.app.env,
  });
});

// // Routes API
app.use('/api/v1/auth', auThrouter);
//property  routes
app.use('/api/properties', propertyRouter);
// chat routes

// Middlewares de gestion d'erreurs - doivent être en dernier
// app.use(propertyErrorHandler);
// app.use(errorHandler);
// Gestion des routes inconnues

// app.all('*', async (req, res, next) => {
//   try {
//     res.status(404).json({
//       status: 'fail',
//       message: `La route ${req.originalUrl} est introuvable`
//     });
//   } catch (err) {
//     next(err); // pass error to Express error handler
//   }
// });


export default app;


