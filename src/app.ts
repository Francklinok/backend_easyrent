const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const routes = require('./routes'); // routes/index.js
const { errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Sécurité & performance
app.use(helmet());
app.use(cors());
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Logging
app.use(morgan(config.logging.format));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Connexion MongoDB
mongoose.connect(config.database.uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Connecté à MongoDB'))
  .catch(err => {
    console.error('❌ Erreur MongoDB:', err);
    process.exit(1);
  });

// Routes
app.use('/api/v1', routes);

// Route de test
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Bienvenue sur l’API EasyRent',
    version: '1.0.0',
  });
});

// Route inconnue
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `La route ${req.originalUrl} est introuvable`,
  });
});

// Gestion d’erreurs
app.use(errorHandler);

module.exports = app;
