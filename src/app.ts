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
import propertyRouter from './property/propertyRoute/propertyrouters';
// import router from '../auth/routers/authrouters';
import { errorHandler } from './auth/utils/errorHandler';
// import { UserPresenceService } from './users/services/userPresence';
import { trackUserActivity } from './users/middleware/trackUserActivity';
import { createLogger } from './utils/logger/logger';
import chatRouter from './chat/routers/chatRouter';
import userRouter from './users/routes/routes';
import walletRouter from './wallet/routes/walletRoutes';
import serviceRouter from './service-marketplace/routes/serviceRoutes';
// import { initializeGraphQLServer } from './graphql/server';

const logger = createLogger("app");
console.log('📱 Initialisation de l\'application Express...');
// import { propertyErrorHandler } from './property/middlewares/propertyErrorHandler';

// Configuration pour ES modules avec __dirname
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Création et configuration de l'application Express
logger.info('🏗️ Création de l\'instance Express...');
const app = express();
logger.info('✅ Application Express créée avec succès');

// Middleware pour traquer l'activité sur les requêtes HTTP
// const userPresenceService = new UserPresenceService();

// app.use(trackUserActivity(userPresenceService));

// Middlewares de sécurité et d'optimisation

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.cors.origin.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS non autorisé'), false);
  },
  credentials: true,
  methods: config.cors.methods,
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

app.get('/verify-account', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify-account.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(__dirname + '/public/reset-password.html');
});

// Connexion à MongoDB avec gestion des événements
logger.info('🌱 Tentative de connexion à MongoDB...', {
  url: config.database.url?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'), // Masquer les credentials
  options: config.database.options
});

mongoose.connect(config.database.url)
  .then(() => {
    console.log('✅ Connecté à MongoDB');
    logger.info('✅ Connexion MongoDB établie avec succès', {
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      dbName: mongoose.connection.name
    });
  })
  .catch(err => {
    console.error('❌ Erreur de connexion MongoDB:', err);
    logger.error('💥 Échec de la connexion MongoDB', {
      error: err.message,
      stack: err.stack,
      code: err.code,
      codeName: err.codeName,
      url: config.database.url?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
    });
    process.exit(1);
  });

// Surveillance de la connexion MongoDB
mongoose.connection.on('error', err => {
  logger.error('❌ Erreur MongoDB détectée:', {
    error: err.message,
    stack: err.stack,
    code: err.code,
    readyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  });
});

mongoose.connection.on('connecting', () => {
  logger.info('🔄 Connexion à MongoDB en cours...');
});

mongoose.connection.on('connected', () => {
  logger.info('✅ MongoDB connecté');
});

mongoose.connection.on('reconnected', () => {
  logger.info('🔄 MongoDB reconnecté');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB déconnecté', {
    readyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  });
});

mongoose.connection.on('close', () => {
  logger.info('🔒 Connexion MongoDB fermée');
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

// Routes API
logger.info('🛣️ Configuration des routes API...');
try {
  app.use('/api/v1/auth', auThrouter);
  logger.debug('✅ Route auth configurée');

  //property  routes
  app.use('/api/properties', propertyRouter);
  logger.debug('✅ Route properties configurée');

  // user routes
  app.use('/api', userRouter);
  logger.debug('✅ Route users configurée');

  // wallet routes
  app.use('/api/wallet', walletRouter);
  logger.debug('✅ Route wallet configurée');

  // service marketplace routes
  app.use('/api/services', serviceRouter);
  logger.debug('✅ Route services configurée');

  logger.info('✅ Toutes les routes API sont configurées');
} catch (error) {
  logger.error('💥 Erreur lors de la configuration des routes:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  throw error;
}

// Note: GraphQL Server will be initialized in server.ts with HTTP server



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


