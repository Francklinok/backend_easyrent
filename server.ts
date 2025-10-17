import http from 'http';
import config from './config';
import  normalizePort  from './src/utils/normalize/normalizePort';
import onError from './src/utils/normalize/onError';
import { createLogger } from './src/utils/logger/logger';
import { PresenceWebSocketHandler } from './src/utils/socket/webSocket';
import app from './src/app';
// import chatRouter from './src/chat/routers/chatRouter'; // TEMPORAIREMENT COMMENTÉ POUR DEBUG
import { Server as IOServer } from 'socket.io';
// GraphQL loaded dynamically to prevent initialization issues

console.log('\n========================================');
console.log('🚀 SERVEUR HTTP - Démarrage');
console.log('========================================\n');
const logger = createLogger('server');

// Déclaration du serveur en dehors du try pour qu'il soit accessible partout
let server: http.Server;

try {
  // Normalisation du port
  console.log('1. Normalisation du port...');
  const port = normalizePort(config.app.port || process.env.PORT || '3000');
  console.log('✅ Port normalisé:', port);

  // Création du serveur HTTP
  console.log('2. Création du serveur HTTP...');
  logger.info('🏗️ Création du serveur HTTP...');
  server = http.createServer(app);
  logger.info('✅ Serveur HTTP créé avec succès');
  console.log('✅ Serveur HTTP créé');

  // Initialisation de Socket.io avec CORS
  console.log('3. Initialisation de Socket.io...');
  const io = new IOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
    }
  });
  console.log('✅ Socket.io initialisé');

  // Ajout des routes avant démarrage
  console.log('4. Ajout des routes chat...');
  // app.use('/api/chat', chatRouter(io)); // TEMPORAIREMENT COMMENTÉ
  console.log('✅ Routes chat ajoutées (SKIPPED)');

  // Initialisation WebSocket (présence)
  console.log('5. Initialisation WebSocket...');
  new PresenceWebSocketHandler(server);
  console.log('✅ WebSocket initialisé');

  // GraphQL will be loaded dynamically
  console.log('6. GraphQL sera chargé dynamiquement après le démarrage...');

  // Fonction appelée quand le serveur écoute
  const onListening = (): void => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr?.port}`;
  logger.info(`🚀 Serveur démarré sur ${bind} en mode ${config.app.env}`);
  logger.info(`🌐 URL locale: http://${config.network.host}:${port}`);
  logger.info(`🚀 GraphQL Playground: http://${config.network.host}:${port}/graphql`);
};

  // ✅ Démarrage du serveur sur 0.0.0.0 (pour accès depuis téléphone)
  console.log('7. Démarrage du serveur HTTP...');
  logger.info('🚀 Démarrage du serveur HTTP...', { port, host: '0.0.0.0' });
  server.listen(port, '0.0.0.0', () => {
    console.log(`✅ Serveur prêt sur http://${config.network.host}:${port}`);
    logger.info('🎉 Serveur démarré avec succès!', {
      port,
      host: config.network.host,
      env: config.app.env,
      pid: process.pid
    });

    // Load GraphQL dynamically after server starts
    setTimeout(async () => {
      try {
        console.log('🚀 Chargement dynamique de GraphQL...');
        logger.info('🚀 Chargement dynamique du serveur GraphQL...');
        
        const { initializeGraphQLServer } = await import('./src/graphql/server');
        
        await initializeGraphQLServer(app, server);
        logger.info('✅ GraphQL Server ready at /graphql');
        console.log(`✅ GraphQL disponible sur http://${config.network.host}:${port}/graphql`);
      } catch (err: any) {
        logger.error('❌ Failed to initialize GraphQL Server:', {
          error: err.message,
          stack: err.stack
        });
        console.error('❌ Erreur GraphQL:', err.message);
        console.log('⚠️ Le serveur continue sans GraphQL');
      }
    }, 2000);
  });

  // Gestion des erreurs serveur
  server.on('error', (error) => {
    console.error('❌ Erreur serveur détectée :', error);
    onError(error);
  });

  server.on('listening', onListening);
  
  console.log('✅ Tous les gestionnaires d\'erreurs configurés');
  
} catch (error) {
  console.error('💥 ERREUR FATALE lors de l\'initialisation:', error);
  logger.error('💥 Erreur fatale:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
}

// === Gestion arrêt propre ===
const gracefulShutdown = (signal: string): void => {
  logger.info(`${signal} reçu. Arrêt gracieux du serveur...`);

  if (server) {
    server.close(() => {
      logger.info('✅ Serveur arrêté proprement');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('⏰ Fermeture forcée après 10 secondes');
      process.exit(1);
    }, 10000);
  } else {
    logger.warn('⚠️ Serveur non initialisé, arrêt immédiat');
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => {
  logger.info('SIGUSR2 reçu (nodemon). Redémarrage propre...');
  server.close(() => process.exit(0));
});

// === Gestion des erreurs globales ===
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('💥 UNHANDLED PROMISE REJECTION DÉTECTÉE !', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
    pid: process.pid
  });

  // Log additional context if available
  if (reason instanceof Error) {
    logger.error('Détails de l\'erreur:', {
      name: reason.name,
      message: reason.message,
      stack: reason.stack
    });
  }

  logger.info('🔄 Tentative d\'arrêt gracieux du serveur...');

  if (server) {
    server.close(() => {
      logger.error('💀 Serveur arrêté suite à une rejection non gérée');
      process.exit(1);
    });
  } else {
    logger.error('💀 Serveur non initialisé, arrêt immédiat');
    process.exit(1);
  }
});

process.on('uncaughtException', (error: Error) => {
  logger.error('💥 UNCAUGHT EXCEPTION DÉTECTÉE !', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    pid: process.pid
  });

  logger.error('Contexte de l\'exception:', {
    cwd: process.cwd(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: process.uptime()
  });

  onError(error);
  logger.error('💀 Arrêt forcé du processus...');
  process.exit(1);
});
