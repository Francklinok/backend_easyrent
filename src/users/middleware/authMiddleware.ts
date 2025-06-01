import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/authService';
import { UserService } from '../services/userService'; 
import config from '../../../config';


const authService = new AuthService(new UserService());

type JwtPayload = {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
};


export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1]; // format: Bearer <token>

  if (!token) {
     res.status(401).json({ message: 'Token manquant' });
     return
  }

  try {
     const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;

    // Récupération de l'utilisateur
    const user = await authService['userService'].getUserById(decoded.userId);

    if (!user || !user.isActive) {
       res.status(403).json({ message: 'Utilisateur inactif ou non trouvé' });
       return
    }

    // Attache l'utilisateur à la requête
    (req as any).user = user;


    next();
  } catch (err) {
     res.status(401).json({ message: 'Token invalide ou expiré' });
     return
  }
};
