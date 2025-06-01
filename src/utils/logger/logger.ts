import winston from 'winston';
import path from 'path';
import fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Request } from 'express';
import config from '../../../config';
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

winston.addColors(colors);

// Détermine le niveau de log selon l'environnement
const level = () => {
  const  env = config.app.env
  return env === 'development' ? 'debug' : 'info';
};

// Création d'un formateur personnalisé pour afficher les meta-données
const customPrintf = winston.format.printf((info) => {
  const { timestamp, level, message, ...meta } = info;
  const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} ${level}: ${message}${metaString}`;
});

// Création d'un formateur pour la console avec couleurs
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  customPrintf
);

// Création d’un formateur générique pour les fichiers
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  customPrintf
);

// Création d'un formateur pour masquer les données sensibles
const maskSensitiveData = winston.format((info: any) => {
  if (typeof info.message === 'string') {
    info.message = info.message.replace(/("password"\s*:\s*")([^"]+)(")/g, '$1********$3');
    info.message = info.message.replace(/(Bearer\s+)[^\s]+/g, '$1********');
    info.message = info.message.replace(/(\d{4})[- ]?(\d{4})[- ]?(\d{4})[- ]?(\d{4})/g, '****-****-****-$4');
  }
  return info;
});

// Assurez-vous que le dossier de logs existe
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Transport fichier rotatif
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(logDir, '%DATE%-app.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'info',
});

// Création du logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: winston.format.combine(
    maskSensitiveData(),
    fileFormat
  ),
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    dailyRotateFileTransport,
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'rejections.log') })
  ]
});

// Interface pour le logger
export interface ILogger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  http(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

// Logger par module
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

// Middleware de log des requêtes HTTP
export const requestLogger = () => {
  const httpLogger = createLogger('http');
  return (req: Request, _: any, next: () => void) => {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    httpLogger.http(`${method} ${originalUrl} - ${ip} - ${userAgent}`);
    if (next) next();
  };
};

// Utilitaire pour mesurer les performances
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
