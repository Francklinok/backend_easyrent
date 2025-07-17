import http from 'http';
import config from './config';
import  normalizePort  from './src/utils/normalize/normalizePort';
import onError from './src/utils/normalize/onError';
import { createLogger } from './src/utils/logger/logger';
import { PresenceWebSocketHandler } from './src/utils/socket/webSocket';
import app from './src/app';
import chatRouter from './src/chat/routers/chatRouter';
import { Server as IOServer } from 'socket.io';

const logger = createLogger('server');
console.log('🚀 Démarrage du fichier server.ts');

// Normalisation du port
const port = normalizePort(config.app.port || process.env.PORT || '3000');

// Création du serveur HTTP
const server = http.createServer(app);

// Initialisation de Socket.io avec CORS
const io = new IOServer(server, {
  cors: {
    origin: '*', // ✅ Pour tests, sinon spécifier l'URL Expo ex: http://192.168.1.X:8081
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  }
});

console.log('✅ Serveur HTTP créé');

// Ajout des routes avant démarrage
app.use('/api/chat', chatRouter(io));

// Initialisation WebSocket (présence)
new PresenceWebSocketHandler(server);

// Fonction appelée quand le serveur écoute
const onListening = (): void => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr?.port}`;
  logger.info(`🚀 Serveur démarré sur ${bind} en mode ${config.app.env}`);
  logger.info(`🌐 URL locale: http://${config.network.host}:${port}`);
};

// ✅ Démarrage du serveur sur 0.0.0.0 (pour accès depuis téléphone)
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Serveur prêt sur http://${config.network.host}:${port}`);
});

// Gestion des erreurs serveur
server.on('error', (error) => {
  console.error('❌ Erreur serveur détectée :', error);
  onError(error);
});

server.on('listening', onListening);

// === Gestion arrêt propre ===
const gracefulShutdown = (signal: string): void => {
  logger.info(`${signal} reçu. Arrêt gracieux du serveur...`);
  server.close(() => {
    logger.info('✅ Serveur arrêté proprement');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('⏰ Fermeture forcée après 10 secondes');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => {
  logger.info('SIGUSR2 reçu (nodemon). Redémarrage propre...');
  server.close(() => process.exit(0));
});

// === Gestion des erreurs globales ===
process.on('unhandledRejection', (reason: any) => {
  logger.error('💥 Rejection NON GÉRÉE !');
  logger.error(reason);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (error: Error) => {
  logger.error('💥 Exception NON CAPTURÉE !');
  onError(error);
  process.exit(1);
});
