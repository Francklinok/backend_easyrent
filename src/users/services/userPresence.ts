// // userPresenceService.ts
// import { createClient, RedisClientType } from 'redis';
// import { createLogger } from '../../utils/logger/logger';
// import config from '../../../config';
// import { UserPresence,PresenceStatus } from '../types/presenceType';
// const logger = createLogger('UserPresenceService');

// /**
//  * Service de gestion de la présence des utilisateurs
//  */
// export class UserPresenceService {
//   private redisClient: RedisClientType;
//   // Clé du prefix pour Redis
//   private readonly REDIS_PREFIX = 'user:presence:';
//   // Durée en secondes avant qu'un utilisateur soit considéré comme "away"
//   private readonly AWAY_TIMEOUT = 120; // 5 minutes
//   // Durée en secondes avant qu'un utilisateur soit considéré comme "offline"
//   private readonly OFFLINE_TIMEOUT = 900; // 15 minutes
//   // Durée d'expiration des entrées Redis en secondes
//   private readonly PRESENCE_TTL = 86400; // 24 heures

//   constructor() {
//     this.redisClient = createClient({
//       url: config.redis?.url || 'redis://localhost:6379'
//     });
//     this.initRedisConnection();
//   }

//     getRedisClient(): RedisClientType {
//     return this.redisClient;
//   }
//   /**
//    * Initialise la connexion Redis
//    */
//   private async initRedisConnection(): Promise<void> {
//     try {
//       this.redisClient.on('error', (err) => {
//         logger.error('Redis client error', { error: err.message });
//       });

//       await this.redisClient.connect();
//       logger.info('Redis client connected successfully');
//     } catch (error) {
//       logger.error('Failed to connect to Redis', { 
//         error: error instanceof Error ? error.message : 'Unknown error' 
//       });
//     }
//   }

//   /**
//    * Met à jour le statut de présence d'un utilisateur
//    * @param userId - ID de l'utilisateur
//    * @param status - Nouveau statut (optionnel, par défaut ONLINE)
//    * @param deviceInfo - Informations sur l'appareil
//    */
//   async updatePresence(
//     userId: string, 
//     status: PresenceStatus = PresenceStatus.ONLINE,
//     deviceInfo?: { ip?: string; userAgent?: string; deviceId?: string }
//   ): Promise<void> {
//     try {
//       if (!userId) {
//         logger.warn('Cannot update presence for undefined userId');
//         return;
//       }

//       const presenceKey = `${this.REDIS_PREFIX}${userId}`;
//       const now = new Date();
      
//       const presenceData: UserPresence = {
//         userId,
//         status,
//         lastActive: now,
//         deviceInfo
//       };

//       // Stocker les données au format JSON dans Redis
//       await this.redisClient.set(
//         presenceKey, 
//         JSON.stringify(presenceData), 
//         { EX: this.PRESENCE_TTL }
//       );

//       logger.info('User presence updated', { userId, status });
//     } catch (error) {
//       logger.error('Error updating user presence', { 
//         userId, 
//         error: error instanceof Error ? error.message : 'Unknown error' 
//       });
//     }
//   }

//   /**
//    * Récupère les informations de présence d'un utilisateur
//    * @param userId - ID de l'utilisateur
//    * @returns Informations de présence ou null si non trouvées
//    */
//   async getUserPresence(userId: string): Promise<UserPresence | null> {
//     try {
//       if (!userId) {
//         logger.warn('Cannot get presence for undefined userId');
//         return null;
//       }

//       const presenceKey = `${this.REDIS_PREFIX}${userId}`;
//       const presenceData = await this.redisClient.get(presenceKey);

//       if (!presenceData) {
//         return null;
//       }

//       const presence = JSON.parse(presenceData) as UserPresence;
//       presence.lastActive = new Date(presence.lastActive);

//       // Mettre à jour automatiquement le statut en fonction du temps d'inactivité
//       const updatedPresence = this.calculateCurrentStatus(presence);
      
//       return updatedPresence;
//     } catch (error) {
//       logger.error('Error getting user presence', { 
//         userId, 
//         error: error instanceof Error ? error.message : 'Unknown error' 
//       });
//       return null;
//     }
//   }

//   /**
//    * Marque un utilisateur comme hors ligne
//    * @param userId - ID de l'utilisateur
//    */
//   async setUserOffline(userId: string): Promise<void> {
//     try {
//       await this.updatePresence(userId, PresenceStatus.OFFLINE);
//       logger.info('User marked as offline', { userId });
//     } catch (error) {
//       logger.error('Error setting user offline', { 
//         userId, 
//         error: error instanceof Error ? error.message : 'Unknown error' 
//       });
//     }
//   }

//   /**
//    * Récupère les utilisateurs en ligne
//    * @param userIds - Liste d'IDs d'utilisateurs à vérifier (optionnel)
//    * @returns Map d'utilisateurs avec leur statut de présence
//    */
//   async getOnlineUsers(userIds?: string[]): Promise<Map<string, UserPresence>> {
//     const onlineUsers = new Map<string, UserPresence>();
    
//     try {
//       // Si des IDs spécifiques sont fournis
//       if (userIds && userIds.length > 0) {
//         const presencePromises = userIds.map(id => this.getUserPresence(id));
//         const presenceResults = await Promise.all(presencePromises);
        
//         presenceResults.forEach(presence => {
//           if (presence && presence.status !== PresenceStatus.OFFLINE) {
//             onlineUsers.set(presence.userId, presence);
//           }
//         });
//       } 
//       // Sinon, récupérer tous les utilisateurs avec un pattern Redis
//       else {
//         const keys = await this.redisClient.keys(`${this.REDIS_PREFIX}*`);
        
//         if (keys.length > 0) {
//           const values = await this.redisClient.mGet(keys);
          
//           keys.forEach((key, index) => {
//             if (values[index]) {
//               const presence = JSON.parse(values[index]!) as UserPresence;
//               presence.lastActive = new Date(presence.lastActive);
              
//               const updatedPresence = this.calculateCurrentStatus(presence);
              
//               if (updatedPresence.status !== PresenceStatus.OFFLINE) {
//                 onlineUsers.set(updatedPresence.userId, updatedPresence);
//               }
//             }
//           });
//         }
//       }
      
//       return onlineUsers;
//     } catch (error) {
//       logger.error('Error getting online users', { 
//         error: error instanceof Error ? error.message : 'Unknown error' 
//       });
//       return onlineUsers;
//     }
//   }

//   /**
//    * Calcule le statut actuel en fonction du temps d'inactivité
//    * @param presence - Informations de présence enregistrées
//    * @returns Informations de présence mises à jour
//    */
//   private calculateCurrentStatus(presence: UserPresence): UserPresence {
//     const now = new Date();
//     const lastActive = new Date(presence.lastActive);
//     const inactiveSeconds = Math.floor((now.getTime() - lastActive.getTime()) / 1000);

//     // Si l'utilisateur est déjà marqué comme hors ligne, ne pas changer son statut
//     if (presence.status === PresenceStatus.OFFLINE) {
//       return presence;
//     }

//     // Mettre à jour le statut en fonction du temps d'inactivité
//     if (inactiveSeconds > this.OFFLINE_TIMEOUT) {
//       presence.status = PresenceStatus.OFFLINE;
//     } else if (inactiveSeconds > this.AWAY_TIMEOUT) {
//       presence.status = PresenceStatus.AWAY;
//     }

//     return presence;
//   }

//   /**
//    * Ferme la connexion Redis
//    */
//   async close(): Promise<void> {
//     await this.redisClient.quit();
//     logger.info('Redis client connection closed');
//   }
// }
