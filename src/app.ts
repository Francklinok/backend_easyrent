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
import path from 'path';t
import { fileURLToPath } from 'url';
import config from './config/index.ts';
import routes from './routes/index.ts';
import { errorHandler } from './property/middlewares/errorHandler.js';
import logger from './utils/logger/logger.js';


// Configuration pour ES modules avec __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Création et configuration de l'application Express
const app = express();

// Middlewares de sécurité et d'optimisation
app.use(helmet());
app.use(cors({
  origin: config.corsOptions?.origin || '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
}));
app.use(compression());

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

// Connexion à MongoDB avec gestion des événements
mongoose.connect(config.database.uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
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
    version: config.version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes API
app.use('/api/v1', routes);

// Gestion des routes inconnues
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `La route ${req.originalUrl} est introuvable`
  });
});

// Middlewares de gestion d'erreurs - doivent être en dernier
// app.use(propertyErrorHandler);
app.use(errorHandler);

// Export de l'application pour le serveur
export default app;
