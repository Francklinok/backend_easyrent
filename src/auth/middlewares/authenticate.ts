// import { Request, Response, NextFunction } from 'express';
// import { createLogger } from '../../utils/logger/logger';
// import { AuthService } from '../../users/services/authService';
// import { UserService } from '../../users/services/userService';

// const logger = createLogger('AuthMiddleware');

// // Crée une seule instance partagée
// const authService = new AuthService(new UserService());

// const authenticate = async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const authHeader = req.headers.authorization;
    
//     // Debug: Log the raw authorization header
//     logger.debug('Authorization header debug', {
//       hasAuthHeader: !!authHeader,
//       authHeaderLength: authHeader?.length,
//       authHeaderStart: authHeader?.substring(0, 20),
//       ip: req.ip,
//       path: req.path
//     });
    
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       logger.warn('Missing or invalid authorization header', {
//         authHeader: authHeader || 'undefined',
//         ip: req.ip,
//         path: req.path
//       });
      
//       res.status(401).json({
//         success: false,
//         message: 'Accès non autorisé : token manquant'
//       });
//       return;
//     }

//     const token = authHeader.split(' ')[1];
    
//     // Debug: Log token info
//     logger.debug('Token extraction debug', {
//       tokenLength: token?.length,
//       tokenStart: token?.substring(0, 20),
//       tokenEnd: token?.substring(token.length - 20),
//       isValidJWTFormat: token?.split('.').length === 3
//     });
    
//     if (!token) {
//       logger.warn('Token extraction failed', {
//         authHeader: authHeader.substring(0, 50) + '...',
//         ip: req.ip
//       });
      
//       res.status(401).json({
//         success: false,
//         message: 'Accès non autorisé : token invalide'
//       });
//       return;
//     }

//     // Validate JWT format before trying to decode
//     const tokenParts = token.split('.');
//     if (tokenParts.length !== 3) {
//       logger.warn('Invalid JWT format', {
//         tokenParts: tokenParts.length,
//         token: token.substring(0, 50) + '...',
//         ip: req.ip
//       });
      
//       res.status(401).json({
//         success: false,
//         message: 'Accès non autorisé : format de token invalide'
//       });
//       return;
//     }

//     const decoded = authService.validateToken(token);
//     logger.debug('the token  is  ', {decoded})   
//      if (!decoded || !decoded.userId) {
//       logger.warn('Token validation failed', {
//         hasDecoded: !!decoded,
//         hasUserId: decoded?.userId,
//         decodedData: decoded ? Object.keys(decoded) : 'null',
//         ip: req.ip
//       });
      
//       res.status(401).json({
//         success: false,
//         message: 'Accès non autorisé : token invalide'
//       });
//       return;
//     }

//     // Debug: Log decoded token info
//     logger.debug('Token decoded successfully', {
//       userId: decoded.userId,
//       tokenExp: decoded.exp?? '',
//       tokenIat: decoded.iat?? '',
//       currentTime: Math.floor(Date.now() / 1000)
//     });

//     // Get user by ID
//     const user = await authService['userService'].getUserById(decoded.userId);
    
//     if (!user) {
//       logger.warn('User not found', {
//         userId: decoded.userId,
//         ip: req.ip
//       });
      
//       res.status(403).json({
//         success: false,
//         message: 'Utilisateur non trouvé'
//       });
//       return;
//     }

//     if (!user.isActive) {
//       logger.warn('Inactive user attempted access', {
//         userId: user._id?.toString(),
//         email: user.email?.substring(0, 5) + '***',
//         ip: req.ip
//       });
      
//       res.status(403).json({
//         success: false,
//         message: 'Utilisateur inactif'
//       });
//       return;
//     }

//     // Inject user into request
//     (req as any).user = user;
    
//     logger.info('Authentication successful', {
//       userId: user._id?.toString(),
//       email: user.email?.substring(0, 5) + '***',
//       path: req.path
//     });
    
//     next();
    
//   } catch (error) {
//     logger.error("Erreur d'authentification", {
//       error: error instanceof Error ? error.message : 'Erreur inconnue',
//       stack: error instanceof Error ? error.stack : undefined,
//       ip: req.ip,
//       path: req.path
//     });
    
//     res.status(401).json({
//       success: false,
//       message: 'Accès non autorisé'
//     });
//     return;
//   }
// };

// export default authenticate;

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../utils/logger/logger';
import { AuthService } from '../../users/services/authService';
import { UserService } from '../../users/services/userService';

const logger = createLogger('AuthMiddleware');

// Crée une seule instance partagée
const authService = new AuthService(new UserService());

const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Debug: Log the raw authorization header
    logger.debug('Authorization header debug', {
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader?.length,
      authHeaderStart: authHeader?.substring(0, 20),
      ip: req.ip,
      path: req.path
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header', {
        authHeader: authHeader || 'undefined',
        ip: req.ip,
        path: req.path
      });
      
      res.status(401).json({
        success: false,
        message: 'Accès non autorisé : token manquant'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    // Debug: Log token info
    logger.debug('Token extraction debug', {
      tokenLength: token?.length,
      tokenStart: token?.substring(0, 20),
      tokenEnd: token?.substring(token.length - 20),
      isValidJWTFormat: token?.split('.').length === 3
    });
    
    if (!token) {
      logger.warn('Token extraction failed', {
        authHeader: authHeader.substring(0, 50) + '...',
        ip: req.ip
      });
      
      res.status(401).json({
        success: false,
        message: 'Accès non autorisé : token invalide'
      });
      return;
    }

    // Validate JWT format before trying to decode
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      logger.warn('Invalid JWT format', {
        tokenParts: tokenParts.length,
        token: token.substring(0, 50) + '...',
        ip: req.ip
      });
      
      res.status(401).json({
        success: false,
        message: 'Accès non autorisé : format de token invalide'
      });
      return;
    }

    const decoded = authService.validateToken(token);
    
    if (!decoded || !decoded.userId) {
      logger.warn('Token validation failed', {
        hasDecoded: !!decoded,
        hasUserId: decoded?.userId,
        decodedData: decoded ? Object.keys(decoded) : 'null',
        ip: req.ip
      });
      
      res.status(401).json({
        success: false,
        message: 'Accès non autorisé : token invalide'
      });
      return;
    }

    // Debug: Log decoded token info
    logger.debug('Token decoded successfully', {
      userId: decoded.userId,
      tokenExp: decoded.exp,
      tokenIat: decoded.iat,
      currentTime: Math.floor(Date.now() / 1000)
    });

    // Get user by ID
    const user = await authService['userService'].getUserById(decoded.userId);
    
    if (!user) {
      logger.warn('User not found', {
        userId: decoded.userId,
        ip: req.ip
      });
      
      res.status(403).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    if (!user.isActive) {
      logger.warn('Inactive user attempted access', {
        userId: user._id?.toString(),
        email: user.email?.substring(0, 5) + '***',
        ip: req.ip
      });
      
      res.status(403).json({
        success: false,
        message: 'Utilisateur inactif'
      });
      return;
    }

    // Inject user into request
    (req as any).user = user;
    
    logger.info('Authentication successful', {
      userId: user._id?.toString(),
      email: user.email?.substring(0, 5) + '***',
      path: req.path
    });
    
    next();
    
  } catch (error) {
    logger.error("Erreur d'authentification", {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      stack: error instanceof Error ? error.stack : undefined,
      ip: req.ip,
      path: req.path
    });
    
    res.status(401).json({
      success: false,
      message: 'Accès non autorisé'
    });
    return;
  }
};

export default authenticate;