
/**
 * Middleware pour la gestion des erreurs des propriétés
 */
export const propertyErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Erreur de propriété:', err);
  
  if (err.name === 'ValidationError') {
    // Gestion des erreurs de validation Mongoose
    const errors = Object.values(err.errors).map((error: any) => ({
      field: error.path,
      message: error.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors
    });
  }
  
  if (err.name === 'CastError' && err.path === '_id') {
    return res.status(400).json({
      success: false,
      message: 'ID de propriété invalide'
    });
  }
  
  if (err.code === 11000) {
    // Gestion des erreurs de duplicate key
    return res.status(409).json({
      success: false,
      message: 'Une propriété avec ces données existe déjà'
    });
  }
  
  // Passer à d'autres gestionnaires d'erreurs si nécessaire
  next(err);
};
