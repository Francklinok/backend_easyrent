import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import User from '../../users/models/userModel'; // Assurez-vous d’avoir un modèle User Mongoose
import { createLogger } from '../../utils/logger/logger';
import { IUser } from '../../users/types/userTypes';
const  logger  =  createLogger('register')

import { UserService } from '../../users/services/userService';
const userService  = new UserService()


// export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
//     const startTime = Date.now();
//     logger.info('Début de la tentative d\'inscription', { 
//       ip: req.ip, 
//       userAgent: req.headers['user-agent'],
//       email: req.body.email?.substring(0, 5) + '***' // Log partiel pour sécurité
//     });

  
//     try {
//         const { firstName, lastName, username, email, password, phoneNumber, dateOfBirth, address, ...userData }: IUser = req.body;
            
//             // Validation des données requises
//             if (!email || !password || !username) {
//                 logger.warn('Tentative d\'inscription avec données manquantes', { 
//                 hasEmail: !!email, 
//                 hasPassword: !!password, 
//                 hasUsername: !!username,
//                 ip: req.ip 
//                 });
                
//                 res.status(400).json({
//                 success: false,
//                 message: 'Email, mot de passe et nom d\'utilisateur sont requis'
//                 });
//                 return;
//             }
        
//             const [existingUserByEmail, existingUserByUsername] = await Promise.all([
//                 userService.getUserByEmail(email),
//                 userService.getUserByUsername(username)
//             ]);
        
//             if (existingUserByEmail) {
//                 logger.warn('Tentative d\'inscription avec email déjà utilisé', { 
//                 email: email.substring(0, 5) + '***',
//                 ip: req.ip 
//                 });
                
//                 res.status(409).json({
//                 success: false,
//                 message: 'Cet email est déjà utilisé'
//                 });
//                 return;
//             }
        
//             if (existingUserByUsername) {
//                 logger.warn('Tentative d\'inscription avec nom d\'utilisateur déjà utilisé', { 
//                 username: username.substring(0, 3) + '***',
//                 ip: req.ip 
//                 });
                
//                 res.status(409).json({
//                 success: false,
//                 message: 'Ce nom d\'utilisateur est déjà utilisé'
//                 });
//                 return;
//             }
        
//    const user: IUser = await userService.createUser({
//         firstName,
//         lastName,
//         username,
//         email,
//         password,
//         phoneNumber,
//         dateOfBirth,
//         ...userData
//       }, true);



//     if (!email || !password || !username) {
//       res.status(400).json({
//         success: false,
//         message: "Email, mot de passe et nom d'utilisateur sont requis"
//       });
//       return;
//     }


//     const existingEmail = await User.findOne({ email });
//     if (existingEmail) {
//       res.status(409).json({
//         success: false,
//         message: 'Cet email est déjà utilisé'
//       });
//       return;
//     }

//     const existingUsername = await User.findOne({ username });
//     if (existingUsername) {
//       res.status(409).json({
//         success: false,
//         message: 'Ce nom d\'utilisateur est déjà utilisé'
//       });
//       return;
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const newUser = new User({
//       firstName,
//       lastName,
//       username,
//       email,
//       password: hashedPassword,
//       phoneNumber,
//       dateOfBirth,
//       address
//     });

//     await newUser.save();

//     res.status(201).json({
//       success: true,
//       message: 'Inscription réussie',
//       data: {
//         userId: newUser._id,
//         email: newUser.email,
//         username: newUser.username
//       }
//     });

//   } catch (error) {
//     console.error('Erreur lors de l\'inscription:', error);
//     next(error);
//   }
// }

import { SecurityAuditService } from '../../security/services/securityAuditServices';
 const  securityAuditService = new SecurityAuditService()

   export const register = async(req: Request, res: Response, next: NextFunction): Promise<void> =>{
    const startTime = Date.now();
    logger.info('Début de la tentative d\'inscription', { 
      ip: req.ip, 
      userAgent: req.headers['user-agent'],
      email: req.body.email?.substring(0, 5) + '***' // Log partiel pour sécurité
    });

    try {
      const { firstName, lastName, username, email, password, phoneNumber, dateOfBirth, address, ...userData }: IUser = req.body;
      
      // Validation des données requises
      if (!email || !password || !username) {
        logger.warn('Tentative d\'inscription avec données manquantes', { 
          hasEmail: !!email, 
          hasPassword: !!password, 
          hasUsername: !!username,
          ip: req.ip 
        });
        
        res.status(400).json({
          success: false,
          message: 'Email, mot de passe et nom d\'utilisateur sont requis'
        });
        return;
      }

      // Vérifications parallèles pour optimiser les performances
      const [existingUserByEmail, existingUserByUsername] = await Promise.all([
        userService.getUserByEmail(email),
        userService.getUserByUsername(username)
      ]);

      if (existingUserByEmail) {
        logger.warn('Tentative d\'inscription avec email déjà utilisé', { 
          email: email.substring(0, 5) + '***',
          ip: req.ip 
        });
        
        res.status(409).json({
          success: false,
          message: 'Cet email est déjà utilisé'
        });
        return;
      }

      if (existingUserByUsername) {
        logger.warn('Tentative d\'inscription avec nom d\'utilisateur déjà utilisé', { 
          username: username.substring(0, 3) + '***',
          ip: req.ip 
        });
        
        res.status(409).json({
          success: false,
          message: 'Ce nom d\'utilisateur est déjà utilisé'
        });
        return;
      }

      // Créer l'utilisateur avec tous les champs validés
      const user: IUser = await userService.createUser({
        firstName,
        lastName,
        username,
        email,
        password,
        phoneNumber,
        dateOfBirth,
        ...userData
      }, true);

      // Vérifier que l'utilisateur a été créé avec succès
      if (!user || (!user.id && !user._id)) {
        logger.error('Échec de la création de l\'utilisateur - utilisateur null ou sans ID', { 
          email: email.substring(0, 5) + '***',
          username: username.substring(0, 3) + '***'
        });
        // throw new AppError('Échec de la création de l\'utilisateur', 500);
      }

      const userId = user._id || user.id;

      // Opérations asynchrones non bloquantes
      const asyncOperations = [
        // Journalisation de sécurité
        securityAuditService.logEvent({
          eventType: 'USER_REGISTERED',
          userId: userId.toString(),
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: { email, username }
        }).catch(auditError => {
          logger.warn('Erreur lors de la journalisation d\'inscription', { 
            error: auditError.message,
            userId: userId.toString()
          });
        })
      ];

    //   // Exécuter les opérations asynchrones sans attendre
      Promise.all(asyncOperations);

      const executionTime = Date.now() - startTime;
      logger.info('Nouvel utilisateur inscrit avec succès', { 
        userId: userId.toString(),
        email: email.substring(0, 5) + '***',
        username: username.substring(0, 3) + '***',
        executionTime: `${executionTime}ms`
      });

      res.status(201).json({
        success: true,
        message: 'Inscription réussie. Veuillez vérifier votre email pour activer votre compte',
        data: {
          userId: userId.toString(),
          email: user.email,
          username: user.username
        }
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('Erreur lors de l\'inscription', { 
        error: error.message,
        stack: error.stack,
        email: req.body.email?.substring(0, 5) + '***',
        executionTime: `${executionTime}ms`,
        ip: req.ip
      });
      next(error);
    }
  }
  