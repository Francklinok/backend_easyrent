import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../chat/utils/apiError';
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Une erreur interne est survenue';
  let errors = undefined;

  // Si c'est une erreur personnalisée
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Erreur de validation';
    errors = err.errors;
  }

  res.status(statusCode).json({
    statusCode,
    message,
    ...(errors && { errors })
  });
};
