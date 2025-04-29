import winston from 'winston';
import path from 'path';
import fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Request } from 'express';

// Définition des niveaux de log personnalisés
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Définition des couleurs pour les différents niveaux de log
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Ajout des couleurs dans winston
winston.addColors(colors);

// Détermine le niveau de log selon l'environnement
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Format pour les logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  ),
  winston.format.errors({ stack: true })
);

// Format colorisé pour la console
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  ),
  winston.format.errors({ stack: true })
);

// Assurez-vous que le répertoire de logs existe
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Options pour la rotation quotidienne des fichiers de log
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(logDir, '%DATE%-app.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'info',
});

// Création d'un formateur personnalisé pour masquer les données sensibles
const maskSensitiveData = winston.format((info) => {
  // Masquer les informations sensibles si présentes dans le message
  if (typeof info.message === 'string') {
    // Masquer les mots de passe
    info.message = info.message.replace(/("password"\s*:\s*")([^"]+)(")/g, '$1********$3');
    // Masquer les tokens d'authentification
    info.message = info.message.replace(/(Bearer\s+)[^\s]+/g, '$1********');
    // Masquer les numéros de cartes de crédit
    info.message = info.message.replace(/(\d{4})[- ]?(\d{4})[- ]?(\d{4})[- ]?(\d{4})/g, '****-****-****-$4');
  }
  return info;
});

// Création du logger avec les transports appropriés
const logger = winston.createLogger({
  level: level(),
  levels,
  format: winston.format.combine(
    maskSensitiveData(),
    format
  ),
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    dailyRotateFileTransport,
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log')
    })
  ]
});

// Interface pour exporter un logger nommé
export interface ILogger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  http(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * Crée un logger pour un module spécifique
 * @param module Nom du module qui utilise le logger
 * @returns Une instance du logger configurée pour le module
 */
export const createLogger = (module: string): ILogger => {
  return {
    error: (message: string, meta?: any) => {
      logger.error(`[${module}] ${message}`, meta);
    },
    warn: (message: string, meta?: any) => {
      logger.warn(`[${module}] ${message}`, meta);
    },
    info: (message: string, meta?: any) => {
      logger.info(`[${module}] ${message}`, meta);
    },
    http: (message: string, meta?: any) => {
      logger.http(`[${module}] ${message}`, meta);
    },
    debug: (message: string, meta?: any) => {
      logger.debug(`[${module}] ${message}`, meta);
    }
  };
};

/**
 * Middleware pour logger les requêtes HTTP
 * @returns Middleware Express pour logger les requêtes entrantes
 */
export const requestLogger = () => {
  const httpLogger = createLogger('http');
  
  return (req: Request, _: any, next: () => void) => {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    
    httpLogger.http(`${method} ${originalUrl} - ${ip} - ${userAgent}`);
    
    if (next) {
      next();
    }
  };
};

/**
 * Utilitaire pour logger les performances
 * @param operationName Nom de l'opération dont on mesure la performance
 * @returns Fonction pour terminer la mesure et logger le résultat
 */
export const measurePerformance = (operationName: string) => {
  const perfLogger = createLogger('performance');
  const start = process.hrtime();
  
  return () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds * 1000 + nanoseconds / 1000000;
    perfLogger.debug(`${operationName} a pris ${duration.toFixed(2)}ms`);
    return duration;
  };
};

export default logger;