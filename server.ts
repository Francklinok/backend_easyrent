const app = require('./app');
const config = require('./config');

const server = app.listen(config.app.port, () => {
  console.log(`🚀 Serveur démarré sur le port ${config.app.port} en mode ${config.app.env}`);
});

// Gestion des erreurs non gérées
process.on('unhandledRejection', (err) => {
  console.error('ERREUR NON GÉRÉE ! Fermeture du serveur...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
