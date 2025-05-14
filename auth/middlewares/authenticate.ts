import { RequestHandler } from 'express';
import { createLogger } from '../../src/utils/logger/logger';
import { AuthService } from '../../src/users/services/authService';// votre service JWT (ex: jwt.verify)

const logger = createLogger('AuthMiddleware');

const authenticate: RequestHandler = (req, res, next) => {
  (async () => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Accès non autorisé: token manquant'
        });
      }

      const token = authHeader.split(' ')[1];
      const decoded = await AuthService.validateToken(token);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Accès non autorisé: token invalide'
        });
      }

      // Si vous voulez typer req.user :
      (req as any).user = decoded;

      next();
    } catch (error) {
      logger.error("Erreur d'authentification", {
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      });

      return res.status(401).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }
  })();
};

export default authenticate;
