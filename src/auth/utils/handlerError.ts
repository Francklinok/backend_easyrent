import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../utils/logger/logger';

const logger = createLogger('ErrorHandler');

// Interface pour les erreurs personnalisées
interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

// Middleware de gestion d'erreurs global
export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log complet de l'erreur
  logger.error('Erreur capturée par le gestionnaire global', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      body: req.body ? JSON.stringify(req.body).substring(0, 1000) : undefined,
      params: req.params,
      query: req.query,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? '[REDACTED]' : undefined
      }
    },
    timestamp: new Date().toISOString()
  });

  // Déterminer le code de statut
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Erreur interne du serveur';

  // Gestion spécifique des erreurs communes
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Données de validation invalides';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Format de données invalide';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service temporairement indisponible';
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    statusCode = 500;
    message = 'Erreur de base de données';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token d\'authentification invalide';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token d\'authentification expiré';
  } else if (error.code === '11000') {
    // Erreur de duplication MongoDB
    statusCode = 409;
    message = 'Ressource déjà existante';
  } else if (error.name === 'SyntaxError') {
    statusCode = 400;
    message = 'Format JSON invalide';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Accès non autorisé';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Accès interdit';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Ressource non trouvée';
  } else if (error.name === 'RateLimitError') {
    statusCode = 429;
    message = 'Trop de requêtes, veuillez réessayer plus tard';
  }

  // En mode développement, inclure plus de détails
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse: any = {
    success: false,
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString()
    }
  };

  // Ajouter des détails supplémentaires en développement
  if (isDevelopment) {
    errorResponse.error.stack = error.stack;
    errorResponse.error.name = error.name;
    errorResponse.error.code = error.code;
    errorResponse.request = {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query
    };
  }

  // Envoyer la réponse d'erreur
  res.status(statusCode).json(errorResponse);
};

// Middleware pour gérer les routes non trouvées (404)
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new Error(`Route non trouvée: ${req.method} ${req.originalUrl}`) as CustomError;
  error.statusCode = 404;
  error.isOperational = true;
  next(error);
};

// Gestionnaire d'erreurs asynchrones
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Classes d'erreurs personnalisées
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Erreur de validation') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Ressource non trouvée') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Accès non autorisé') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Accès interdit') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflit de ressources') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Limite de taux dépassée') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// Gestionnaire d'arrêt gracieux pour les erreurs non gérées
export const handleUncaughtExceptions = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Exception non capturée détectée', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    });
    
    // Arrêt gracieux du processus
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Promesse rejetée non gérée détectée', {
      reason: reason?.toString(),
      promise: promise?.toString(),
      timestamp: new Date().toISOString()
    });
    
    // Arrêt gracieux du processus
    process.exit(1);
  });
};