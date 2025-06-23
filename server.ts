import http from 'http';
import config from './config';
import port from './src/utils/normalize/normalizePort';
import onError from './src/utils/normalize/onError';
import { createLogger } from './src/utils/logger/logger';
import { PresenceWebSocketHandler } from './src/utils/socket/webSocket';
import app from './src/app'
import chatRouter from './src/chat/routers/chatRouter';
import { Server as IOServer } from 'socket.io';

const logger = createLogger('server');
// === Log pour confirmer le chargement initial ===
console.log('🚀 Démarrage du fichier server.ts');

let server: http.Server;


try {
      // Création du serveur HTTP
      server = http.createServer(app);
      const io = new IOServer(server, {
          cors: {
            origin: config.cors.origin || '*',
            methods: ['GET', 'POST', 'PATCH', 'DELETE'],
            credentials: true,
          }
        });

      // Log si la création est OK
      console.log('✅ Serveur HTTP créé');

      // Initialisation des services WebSocket et présence
      const wsHandler = new PresenceWebSocketHandler(server);

      // Fonction appelée au démarrage réussi
      const onListening = (): void => {
        const addr = server.address();
        const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr?.port}`;
        logger.info(`🚀 Serveur démarré sur ${bind} en mode ${config.app.env}`);
        logger.info(`🌐 URL locale: http://${'localhost'}:${port}`);
      };

      // Démarrage du serveur
      server.listen(port, ()=> console.log("start server"));
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
          logger.error('⏰ Fermeture forcée du serveur après 10 secondes');
          process.exit(1);
        }, 10000);
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      process.on('SIGUSR2', () => {
        logger.info('SIGUSR2 reçu (nodemon). Redémarrage propre...');
        server.close(() => process.exit(0));
      });

      // === Gestion des erreurs non attrapées ===
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
      

      app.use('/api/chat', chatRouter(io))

} catch (e) {
  console.error('🔥 Erreur fatale au lancement du serveur :', e);
  process.exit(1);
}


