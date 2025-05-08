import  app from '../src/app'
import  config from './src/config/index'
import logger from '../src/utils/logger/logger'
import  http from  'http'
import port from './normalizePort'
import  onError from './onError'

interface appConfig {
  port:number,
  env:string,
  host?:string,
}

// Configuration du port
app.set('port', port)


//creation d  un serveur  http
const  server = http.createServer(app)


const onListening = ():void =>{
  const addr = server.address();
  const bind = typeof addr ==='string'
  ? `pipe ${addr}` 
  : `port ${addr?.port}`;

  logger.info(`🚀 Serveur démarré sur ${bind} en mode ${config.app.env}`);
  logger.info(`🌐 URL locale: http://${config.app.host || 'localhost'}:${port}`);
}

server.listen(port);
server.on('error', onError);
server.on('listening', onListening)

// gestion des signau  d arret 
const gracefulShutdown = (signal:string):void =>{
  logger.info(`${signal} reçu. Arrêt gracieux du serveur...`);
server.close(() =>{
  logger.info('Serveur arrêté avec succès');
  process.exit(0)

});
  // Si le serveur ne se ferme pas dans les 10 secondes, on force l'arrêt
  setTimeout(() => {
    logger.error('Fermeture forcée du serveur après délai dépassé');
    process.exit(1);
  }, 10000);
}

// Gestion des erreurs non gérées
process.on('unhandledRejection', (reason: Error) => {
  logger.error('ERREUR NON GÉRÉE ! Fermeture du serveur...');
  logger.error(`${reason.name}: ${reason.message}`);
  logger.error(reason.stack || 'Pas de stack trace disponible');
  
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('EXCEPTION NON CAPTURÉE ! Fermeture du serveur...');
  logger.error(`${error.name}: ${error.message}`);
  logger.error(error.stack || 'Pas de stack trace disponible');
  
  process.exit(1); // Il est dangereux de continuer après une exception non capturée
});

// Gestion des signaux d'arrêt
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Pour le développement avec nodemon
process.on('SIGUSR2', () => {
  logger.info('SIGUSR2 reçu (probablement nodemon). Arrêt gracieux...');
  server.close(() => {
    process.exit(0);
  });
});

export default server;






