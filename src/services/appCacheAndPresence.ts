
import Redis from 'ioredis';
import NodeCache from 'node-cache';
import { createLogger } from '../utils/logger/logger'; 
import config from '../../config';
import { UserPresence, PresenceStatus } from '../users/types/presenceType';

const logger = createLogger('AppCacheAndPresenceService');

class UserPresenceService {
  private redisClient: Redis | null = null;
  private memoryCache: NodeCache;
  private redisConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isReconnecting: boolean = false;

  // Configurations spécifiques à la présence
  private readonly PRESENCE_REDIS_PREFIX = 'user:presence:';
  private readonly AWAY_TIMEOUT = 120; // 2 minutes (au lieu de 5, pour une réactivité mobile)
  private readonly OFFLINE_TIMEOUT = 900; // 15 minutes
  private readonly PRESENCE_TTL = 86400; // 24 heures pour les entrées de présence

  // Configurations spécifiques au cache générique
  private readonly CACHE_REDIS_PREFIX = 'app_cache:';
  private readonly DEFAULT_CACHE_TTL = 600; // 10 minutes par défaut pour le cache générique

  constructor() {
    this.initRedisClient();
    // this.initMemoryCache();
    this.memoryCache = new NodeCache({
      stdTTL: this.DEFAULT_CACHE_TTL, // TTL par défaut pour le cache mémoire
      checkperiod: 60,
      maxKeys: 100000, // Augmenter le nombre de clés pour un gros projet
      deleteOnExpire: true
    });

    this.memoryCache.on('expired', (key: string, value: any) => {
      logger.debug(`Memory cache key expired: ${key}`);
    });
    // this.memoryCache = new NodeCache();

  }
  /**
   * Initialise la connexion Redis avec ioredis.
   * Gère les reconnexions et le statut de connexion.
  //  */
  
    getRedisClient(): Redis | null {
      return this.redisClient;
    }
 /**
   * Initialise la connexion Redis avec ioredis.
   */
  private initRedisClient(): void {
    if (!config.redis?.url) {
      logger.warn('Redis URL not configured, using memory cache only for cache operations.');
      this.redisConnected = false;
      return;
    }

    // Prevent multiple initialization
    if (this.redisClient) {
      logger.warn('Redis client already initialized');
      return;
    }

    try {
      this.redisClient = new Redis(config.redis.url, {
        connectTimeout: 15000,
        lazyConnect: true, // Don't connect immediately
        enableReadyCheck: true,

        maxRetriesPerRequest: 3, // Réduit pour éviter les boucles
        enableOfflineQueue: false, // Désactiver la queue en mode offline

        keepAlive: 30000,
        family: 4,

        retryStrategy: (times: number) => {
          // Ne JAMAIS retry automatiquement pour éviter les crashes
          logger.warn(`Redis connection attempt ${times} failed, NOT retrying automatically`);
          this.redisConnected = false;
          return null; // Arrêter les retries
        },
        reconnectOnError: () => {
          // Ne JAMAIS reconnecter automatiquement
          return false;
        },
        tls: config.redis.url.startsWith('rediss://') ? {
          rejectUnauthorized: false
        } : undefined,
        commandTimeout: 5000,
      });

      this.setupRedisEventHandlers();
      // Connecter de manière asynchrone sans bloquer le constructeur
      this.connectToRedis().catch(err => {
        logger.error('Error in initial Redis connection', {
          error: err instanceof Error ? err.message : 'Unknown error'
        });
        // Ne PAS re-throw, ne PAS appeler scheduleReconnection()
      });

    } catch (error) {
      logger.error('Error initializing Redis client', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.redisConnected = false;
      // Ne PAS appeler scheduleReconnection() ici
    }
  }

  /**
   * Configure les gestionnaires d'événements Redis
   */
  private setupRedisEventHandlers(): void {
    if (!this.redisClient) return;

    this.redisClient.on('connect', () => {
      logger.info('Redis client connected successfully');
      this.redisConnected = true;
      this.connectionAttempts = 0;
       this.isReconnecting = false;
      this.clearReconnectionTimeout();
    });

    this.redisClient.on('ready', () => {
      logger.info('Redis client ready');
      this.redisConnected = true;
      this.connectionAttempts = 0;
    });

    this.redisClient.on('error', (err) => {
      logger.error('Redis client error', { 
        error: err.message,
        type: err.name,
        code: (err as any).code
      });
      this.redisConnected = false;
    });

    this.redisClient.on('close', () => {
      logger.warn('Redis client connection closed');
      this.redisConnected = false;
      // Ne PAS appeler scheduleReconnection() pour éviter les boucles infinies
    });

    this.redisClient.on('reconnecting', (delay: number) => {
      this.connectionAttempts++;
      this.isReconnecting = true;
      logger.info(`Redis client reconnecting... (attempt ${this.connectionAttempts}, delay: ${delay}ms)`);
    });

    this.redisClient.on('end', () => {
      logger.warn('Redis client connection ended');
      this.redisConnected = false;
      // Ne PAS appeler scheduleReconnection() pour éviter les boucles infinies
    });
  }
  private isTemporaryError(err: Error): boolean {
    const temporaryErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH'];
    return temporaryErrors.some(errorType => 
      err.message.includes(errorType) || (err as any).code === errorType
    );
  }
   /**
   * Programme une reconnexion différée
   */
  private scheduleReconnection(): void {
    if (this.reconnectTimeout || this.isReconnecting) {
      return;
    }

    const delay = Math.min(this.connectionAttempts * 2000, 30000); // Max 30 seconds
    logger.info(`Scheduling Redis reconnection in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.attemptReconnection();
    }, delay);
  }

  /**
   * Tente une reconnexion manuelle
   */
  private async attemptReconnection(): Promise<void> {
    if (this.isReconnecting || this.redisConnected) {
      return;
    }

    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      logger.error('Max reconnection attempts reached, giving up');
      return;
    }

    this.isReconnecting = true;
    logger.info('Attempting manual Redis reconnection...');

    try {
      // Cleanup existing client
      if (this.redisClient) {
        this.redisClient.removeAllListeners();
        await this.redisClient.disconnect();
      }

      // Create new client
      this.redisClient = null;
      this.initRedisClient();

    } catch (error) {
      logger.error('Manual reconnection failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.isReconnecting = false;
      // Ne PAS appeler scheduleReconnection() pour éviter les boucles infinies
    }
  }
  
  /**
   * Nettoie le timeout de reconnexion
   */
  private clearReconnectionTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Connecte à Redis de manière asynchrone
   */
  private async connectToRedis(): Promise<void> {
    if (!this.redisClient) return;

    try {
      // Vérifier l'état avant de tenter la connexion
      if (this.redisClient.status === 'end' || this.redisClient.status === 'close') {
        logger.warn('Redis client already closed, skipping connection attempt');
        this.redisConnected = false;
        return;
      }

      await this.redisClient.connect();
      logger.info('Redis connection established successfully');
      this.redisConnected = true;
    } catch (error) {
      logger.error('Failed to connect to Redis during initial connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: this.connectionAttempts,
        status: this.redisClient?.status
      });
      this.redisConnected = false;
      // Ne pas re-throw l'erreur pour éviter le crash
    }
  }

  
  /**
   * Exécute une opération Redis avec retry automatique
   */
  private async executeRedisOperation<T>(
    operation: () => Promise<T>,
    fallback?: () => T,
    operationName: string = 'Redis operation'
  ): Promise<T | null> {
    if (!this.isRedisConnected() || !this.redisClient) {
      if (fallback) {
        logger.debug(`${operationName}: Redis not available, using fallback`);
        return fallback();
      }
      return null;
    }

    try {
      return await operation();
    } catch (error) {
      logger.error(`${operationName} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // If it's a connection error, mark as disconnected
      if (this.isConnectionError(error)) {
        this.redisConnected = false;
        // Ne PAS appeler scheduleReconnection() pour éviter les boucles infinies
      }

      if (fallback) {
        logger.debug(`Using fallback for ${operationName}`);
        return fallback();
      }

      return null;
    }
  }
 /**
   * Vérifie si l'erreur est liée à la connexion
   */
  private isConnectionError(error: any): boolean {
    const connectionErrors = [
      'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH',
      'Connection is closed', 'Connection timeout'
    ];
    
    return connectionErrors.some(errorType => 
      error.message?.includes(errorType) || error.code === errorType
    );
  }



  /**
   * Met à jour le statut de présence d'un utilisateur.
   * Utilise Redis pour la persistance.
   * @param userId - ID de l'utilisateur
   * @param status - Nouveau statut (optionnel, par défaut ONLINE)
   * @param deviceInfo - Informations sur l'appareil
   */
  // async updatePresence(
  //   userId: string,
  //   status: PresenceStatus = PresenceStatus.ONLINE,
  //   deviceInfo?: { ip?: string; userAgent?: string; deviceId?: string }
  // ): Promise<void> {
  //   if (!userId) {
  //     logger.warn('Cannot update presence for undefined userId');
  //     return;
  //   }

  //   const presenceKey = `${this.PRESENCE_REDIS_PREFIX}${userId}`;
  //   const now = new Date();

  //   const presenceData: UserPresence = {
  //     userId,
  //     status,
  //     lastActive: now, // Stockage comme Date object
  //     deviceInfo
  //   };
  //   const serializedData = JSON.stringify({
  //     ...presenceData,
  //     lastActive: presenceData.lastActive.toISOString()
  //   });

  //   try {
  //     if (this.isRedisConnected() && this.redisClient) {
  //       await this.redisClient.setex(
  //         presenceKey,
  //         this.PRESENCE_TTL,
  //         serializedData
  //       );
  //       logger.debug('User presence updated in Redis', { userId, status });
  //     } else {
  //       // En cas de déconnexion Redis, stocker aussi dans le cache mémoire pour un fallback très court terme
  //       this.memoryCache.set(presenceKey,serializedData, this.PRESENCE_TTL);
  //       logger.warn('Redis disconnected, user presence updated in memory cache (non-persistent)', { userId, status });
  //     }
  //   } catch (error) {
  //     logger.error('Error updating user presence in Redis', {
  //       userId,
  //       error: error instanceof Error ? error.message : 'Unknown error'
  //     });
  //     // Fallback vers le cache mémoire en cas d'erreur Redis pendant l'opération
  //     this.memoryCache.set(presenceKey, serializedData, this.PRESENCE_TTL);
  //   }
  // }
async updatePresence(
    userId: string,
    status: PresenceStatus = PresenceStatus.ONLINE,
    deviceInfo?: { ip?: string; userAgent?: string; deviceId?: string }
  ): Promise<void> {
    if (!userId) {
      logger.warn('Cannot update presence for undefined userId');
      return;
    }

    const presenceKey = `${this.PRESENCE_REDIS_PREFIX}${userId}`;
    const now = new Date();

    const presenceData: UserPresence = {
      userId,
      status,
      lastActive: now,
      deviceInfo
    };
    
    const serializedData = JSON.stringify({
      ...presenceData,
      lastActive: presenceData.lastActive.toISOString()
    });

    await this.executeRedisOperation(
      async () => {
        await this.redisClient!.setex(presenceKey, this.PRESENCE_TTL, serializedData);
        logger.debug('User presence updated in Redis', { userId, status });
      },
      () => {
        this.memoryCache.set(presenceKey, serializedData, this.PRESENCE_TTL);
        logger.warn('Redis unavailable, user presence updated in memory cache', { userId, status });
      },
      'updatePresence'
    );
  }
  /**
   * Récupère les informations de présence d'un utilisateur.
   * Vérifie d'abord Redis, puis le cache mémoire.
   * @param userId - ID de l'utilisateur
   * @returns Informations de présence ou null si non trouvées
   */
  async getUserPresence(userId: string): Promise<UserPresence | null> {
    if (!userId) {
      logger.warn('Cannot get presence for undefined userId');
      return null;
    }

    const presenceKey = `${this.PRESENCE_REDIS_PREFIX}${userId}`;
    let presenceData: string | null = null;

    try {
      if (this.isRedisConnected() && this.redisClient) {
        presenceData = await this.redisClient.get(presenceKey);
        if (presenceData) {
          logger.debug('User presence retrieved from Redis', { userId });
        }
      }
    } catch (error) {
      logger.error('Error getting user presence from Redis, trying memory cache', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Si pas trouvé dans Redis ou erreur Redis, chercher dans le cache mémoire
    if (!presenceData) {
      presenceData = this.memoryCache.get(presenceKey) as string | null;
      if (presenceData) {
        logger.debug('User presence retrieved from memory cache', { userId });
      }
    }

    if (!presenceData) {
      return null;
    }

    try {
      const parsedData = JSON.parse(presenceData);
      const presence: UserPresence = {
        ...parsedData,
        lastActive: new Date(parsedData.lastActive) // Convertir en Date object
      };

      // Mettre à jour automatiquement le statut en fonction du temps d'inactivité
      return this.calculateCurrentStatus(presence);;
    } catch (parseError) {
      logger.error('Error parsing user presence data', {
        userId,
        data: presenceData,
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      });
      return null;
    }
  }
  
  /**
   * Vérifie si un utilisateur est en ligne.
   * MISSING METHOD - This is what was causing the error
   */
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const presence = await this.getUserPresence(userId);
      return presence?.status === PresenceStatus.ONLINE || presence?.status === PresenceStatus.AWAY;
    } catch (error) {
      logger.error('Error checking if user is online', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Version synchrone pour vérifier si un utilisateur est en ligne (utilise le cache mémoire uniquement)
   */
  isUserOnlineSync(userId: string): boolean {
    try {
      const presenceKey = `${this.PRESENCE_REDIS_PREFIX}${userId}`;
      const presenceData = this.memoryCache.get(presenceKey) as string | null;
      
      if (!presenceData) return false;
      
      const parsedData = JSON.parse(presenceData);
      const presence: UserPresence = {
        ...parsedData,
        lastActive: new Date(parsedData.lastActive)
      };
      
      const updatedPresence = this.calculateCurrentStatus(presence);
      return updatedPresence.status === PresenceStatus.ONLINE || updatedPresence.status === PresenceStatus.AWAY;
    } catch (error) {
      logger.error('Error checking if user is online (sync)', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
  /**
   * Marque un utilisateur comme hors ligne.
   * @param userId - ID de l'utilisateur
   */
  async setUserOffline(userId: string): Promise<void> {
    try {
      await this.updatePresence(userId, PresenceStatus.OFFLINE);
      logger.info('User marked as offline', { userId });
    } catch (error) {
      logger.error('Error setting user offline', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Récupère les utilisateurs en ligne (et potentiellement "away").
   * @param userIds - Liste d'IDs d'utilisateurs à vérifier (optionnel)
   * @returns Map d'utilisateurs avec leur statut de présence
   */
  async getOnlineUsers(userIds?: string[]): Promise<Map<string, UserPresence>> {
    const onlineUsers = new Map<string, UserPresence>();

    try {
      if (userIds && userIds.length > 0) {
        // Utiliser mget pour récupérer plusieurs clés en une seule requête si possible
        const presenceKeys = userIds.map(id => `${this.PRESENCE_REDIS_PREFIX}${id}`);
        let values: (string | null)[] = [];

        if (this.isRedisConnected() && this.redisClient) {
          values = await this.redisClient.mget(...presenceKeys);
          logger.debug(`Retrieved ${values.length} user presences from Redis (mget)`);
        } else {
          // Fallback pour NodeCache pour les userIds spécifiques
          values = presenceKeys.map(key => this.memoryCache.get(key) as string | null);
          logger.warn('Redis disconnected, retrieving specific user presences from memory cache');
        }

        userIds.forEach((id, index) => {
          const presenceData = values[index];
          if (presenceData) {
            try {
              const parsedData = JSON.parse(presenceData);
              const presence: UserPresence = {
                ...parsedData,
                lastActive: new Date(parsedData.lastActive)
              };
              const updatedPresence = this.calculateCurrentStatus(presence);

              if (updatedPresence.status !== PresenceStatus.OFFLINE) {
                onlineUsers.set(updatedPresence.userId, updatedPresence);
              }
            } catch (parseError) {
              logger.error('Error parsing presence data for online users', {
                userId: id,
                data: presenceData,
                error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
              });
            }
          }
        });
      } else {
        // Récupérer tous les utilisateurs
        let keys: string[] = [];
        if (this.isRedisConnected() && this.redisClient) {
          keys = await this.redisClient.keys(`${this.PRESENCE_REDIS_PREFIX}*`);
          logger.debug(`Found ${keys.length} presence keys in Redis`);
        } else {
          keys = this.memoryCache.keys().filter((key: string) => key.startsWith(this.PRESENCE_REDIS_PREFIX));
          logger.warn('Redis disconnected, cannot get all online users from Redis. Limited to memory cache.');
        }

        if (keys.length > 0) {
          let values: (string | null)[] = [];
          if (this.isRedisConnected() && this.redisClient) {
            values = await this.redisClient.mget(...keys);
          } else {
            values = keys.map(key => this.memoryCache.get(key) as string | null);
          }

          keys.forEach((key, index) => {
            if (values[index]) {
              try {
                const parsedData = JSON.parse(values[index]!);
                const presence: UserPresence = {
                  ...parsedData,
                  lastActive: new Date(parsedData.lastActive)
                };

                const updatedPresence = this.calculateCurrentStatus(presence);

                if (updatedPresence.status !== PresenceStatus.OFFLINE) {
                  onlineUsers.set(updatedPresence.userId, updatedPresence);
                }
              } catch (parseError) {
                logger.error('Error parsing presence data for all users', {
                  key,
                  data: values[index],
                  error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
                });
              }
            }
          });
        }
      }

      return onlineUsers;
    } catch (error) {
      logger.error('Error getting online users', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return onlineUsers;
    }
  }

  /**
   * Calcule le statut actuel en fonction du temps d'inactivité.
   * @param presence - Informations de présence enregistrées
   * @returns Informations de présence mises à jour
   */
  private calculateCurrentStatus(presence: UserPresence): UserPresence {
    const now = new Date();
    const lastActive = presence.lastActive;
    const inactiveSeconds = Math.floor((now.getTime() - lastActive.getTime()) / 1000);

    // Si l'utilisateur est déjà marqué comme hors ligne, ne pas changer son statut
    if (presence.status === PresenceStatus.OFFLINE) {
      return presence;
    }

    // Mettre à jour le statut en fonction du temps d'inactivité
    if (inactiveSeconds > this.OFFLINE_TIMEOUT) {
      presence.status = PresenceStatus.OFFLINE;
    } else if (inactiveSeconds > this.AWAY_TIMEOUT) {
      presence.status = PresenceStatus.AWAY;
    }

    return presence;
  }

  // --- Méthodes de Gestion du Cache Générique ---

  /**
   * Construit la clé de cache avec le préfixe.
   */
  private getCacheKey(key: string): string {
    return `${this.CACHE_REDIS_PREFIX}${key}`;
  }

  /**
   * Stocke une valeur dans le cache (Redis > NodeCache).
   * @param key - Clé de cache
   * @param value - Valeur à stocker
   * @param ttl - Durée de vie en secondes (par défaut: DEFAULT_CACHE_TTL)
   */
  async set<T>(key: string, value: T, ttl: number = this.DEFAULT_CACHE_TTL): Promise<boolean> {
    const prefixedKey = this.getCacheKey(key);
    const serializedValue = JSON.stringify(value);

    try {
      if (this.isRedisConnected() && this.redisClient) {
        await this.redisClient.setex(prefixedKey, ttl, serializedValue);
        logger.debug(`Cache set in Redis: ${key}`);
        return  true
      } else {
        this.memoryCache.set(prefixedKey, serializedValue, ttl);
        logger.warn(`Redis disconnected, cache set in memory: ${key}`);
        return   false
      }
    } catch (error) {
      logger.error(`Error setting cache for ${key}`, { error: error instanceof Error ? error.message : 'Unknown error' });
      // Fallback au cache mémoire en cas d'échec Redis
      this.memoryCache.set(prefixedKey, serializedValue, ttl);
      return false;
    }
  }

  /**
   * Récupère une valeur du cache (Redis > NodeCache).
   * @param key - Clé de cache
   * @returns Valeur ou null si non trouvée
   */
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.getCacheKey(key);
    let value: string | null = null;

    try {
      if (this.isRedisConnected() && this.redisClient) {
        value = await this.redisClient.get(prefixedKey);
        if (value) {
          logger.debug(`Cache retrieved from Redis: ${key}`);
        }
      }
    } catch (error) {
      logger.error(`Error getting cache from Redis for ${key}, trying memory cache`, { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    // Si pas trouvé dans Redis ou erreur Redis, chercher dans le cache mémoire
    if (!value) {
      value = this.memoryCache.get(prefixedKey) as string | null;
      if (value) {
        logger.debug(`Cache retrieved from memory: ${key}`);
      }
    }

    return value ? JSON.parse(value) as T : null;
  }

  /**
   * Supprime une clé du cache.
   * @param key - Clé à supprimer
   */
  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.getCacheKey(key);
    let success = false
    try {
      if (this.redisConnected && this.redisClient) {
        await this.redisClient.del(prefixedKey);
        success = true
        logger.debug(`Cache deleted from Redis: ${key}`);
      }
     
    } catch (error) {
      logger.error(`Error deleting cache for ${key}`, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
     this.memoryCache.del(prefixedKey);
      logger.debug(`Cache deleted from memory: ${key}`);
      return success;
  }

  /**
   * Supprime plusieurs clés du cache selon un pattern.
   * @param pattern - Pattern de clés (ex: 'user:*')
   */
  async deletePattern(pattern: string): Promise<boolean> {
    const prefixedPattern = `${this.CACHE_REDIS_PREFIX}${pattern}`;
    let totalDeletedKeys = 0;
    
    try {
      if (this.redisConnected && this.redisClient) {
        let cursor = '0';
        const batchSize = 100;
        const deleteBatchSize = 50;
        let keysBuffer: string[] = [];
        
        do {
          const scanResult = await this.redisClient.scan(
            cursor,
            'MATCH', prefixedPattern,
            'COUNT', batchSize
          );
          
          cursor = scanResult[0];
          const matchedKeys = scanResult[1];
          
          if (matchedKeys && matchedKeys.length > 0) {
            keysBuffer.push(...matchedKeys);
            
            // Traitement par batch pour la suppression
            while (keysBuffer.length >= deleteBatchSize) {
              const batchToDelete = keysBuffer.splice(0, deleteBatchSize);
              const deletedCount = await this.redisClient.del(...batchToDelete);
              
              totalDeletedKeys += deletedCount;
              logger.debug(`Deleted batch: ${deletedCount}/${batchToDelete.length} keys from Redis`);
            }
          }
          
          // Petite pause pour éviter de surcharger Redis
          if (cursor !== '0') {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          
        } while (cursor !== '0');
        
        // Supprimer les clés restantes dans le buffer
        if (keysBuffer.length > 0) {
          const deletedCount = await this.redisClient.del(...keysBuffer);
          totalDeletedKeys += deletedCount;
          logger.debug(`Deleted final batch: ${deletedCount}/${keysBuffer.length} keys from Redis`);
        }
        
        logger.info(`Successfully deleted ${totalDeletedKeys} keys from Redis matching pattern: ${pattern}`);
      } else {
        logger.warn('Redis disconnected, only processing memory cache.');
      }
      
      // Suppression dans le cache mémoire
      try {
        const memKeys = this.memoryCache.keys();
        const regex = new RegExp(prefixedPattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        const matchingMemKeys = memKeys.filter(k => regex.test(k));
        matchingMemKeys.forEach(k => this.memoryCache.del(k));
        
        logger.info(`Cache cleanup completed - Redis: ${totalDeletedKeys} keys, Memory: ${matchingMemKeys.length} keys for pattern: ${pattern}`);
      } catch (memError) {
        logger.warn('Error cleaning memory cache, continuing...', { error: memError });
      }
      
      return true;
    } catch (error) {
      logger.error(`Error deleting cache by pattern ${pattern}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        deletedSoFar: totalDeletedKeys
      });
      return false;
    }
  }

  /**
   * Vérifie si une clé existe.
   * @param key - Clé à vérifier
   */
  async exists(key: string): Promise<boolean> {
    const prefixedKey = this.getCacheKey(key);
    try {
      if (this.isRedisConnected() && this.redisClient) {
        const exists = await this.redisClient.exists(prefixedKey);
        return exists === 1;
      }
      return this.memoryCache.has(prefixedKey);
    } catch (error) {
      logger.error(`Error checking existence for ${key}`, { error: error instanceof Error ? error.message : 'Unknown error' });
      return this.memoryCache.has(prefixedKey);

    }
  }

  /**
   * Incrémente une valeur numérique.
   * @param key - Clé numérique
   * @param value - Valeur à incrémenter (par défaut: 1)
   * @param ttl - Durée de vie en secondes (par défaut: DEFAULT_CACHE_TTL)
   * @returns Nouvelle valeur ou null en cas d'erreur
   */
  async increment(key: string, value: number = 1, ttl: number = this.DEFAULT_CACHE_TTL): Promise<number | null> {
    const prefixedKey = this.getCacheKey(key);
    try {
      if (this.redisConnected && this.redisClient) {
        const result = await this.redisClient.incrby(prefixedKey, value);
        if (ttl) {
          await this.redisClient.expire(prefixedKey, ttl);
        }
        return result;
      } else {
        let current = this.memoryCache.get(prefixedKey) || '0';
        if (typeof current === 'string') {
          current = parseInt(current, 10);
        }
        const newValue = (current as number) + value;
        this.memoryCache.set(prefixedKey, newValue.toString(), ttl);
        return newValue;
      }
    } catch (error) {
      logger.error(`Error incrementing ${key}`, { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  /**
   * Récupère ou définit une valeur avec un callback de génération.
   * @param key - Clé de cache
   * @param generator - Fonction asynchrone pour générer la valeur si elle n'existe pas
   * @param ttl - Durée de vie en secondes
   * @returns Valeur récupérée ou générée
   */
  async getOrSet<T>(key: string, generator: () => Promise<T>, ttl: number = this.DEFAULT_CACHE_TTL): Promise<T | null> {
    try {
      const existing = await this.get<T>(key);
      if (existing !== null) {
        return existing;
      }

      const value = await generator();
      await this.set(key, value, ttl);
      return value;
    } catch (error) {
      logger.error(`Error in getOrSet for ${key}`, { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  /**
   * Stockage en lot (batch) pour plusieurs clés.
   * @param keyValuePairs - Objet de paires clé-valeur
   * @param ttl - Durée de vie en secondes
   */
  async mSet<T extends Record<string, any>>(keyValuePairs: T, ttl: number = this.DEFAULT_CACHE_TTL): Promise<boolean> {
    try {
      if (this.redisConnected && this.redisClient) {
        const pipeline = this.redisClient.pipeline();
        
        for (const [key, value] of Object.entries(keyValuePairs)) {
          const prefixedKey = this.getCacheKey(key);
          const serializedValue = JSON.stringify(value);
          pipeline.setex(prefixedKey, ttl, serializedValue);
        }
        
        await pipeline.exec();
        logger.debug(`Batch set in Redis for ${Object.keys(keyValuePairs).length} keys`);
      } else {
        for (const [key, value] of Object.entries(keyValuePairs)) {
          const prefixedKey = this.getCacheKey(key);
          const serializedValue = JSON.stringify(value);
          this.memoryCache.set(prefixedKey, serializedValue, ttl);
        }
        logger.warn(`Redis disconnected, batch set in memory for ${Object.keys(keyValuePairs).length} keys`);
      }
      
      return true;
    } catch (error) {
      logger.error('Error during batch set', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Récupération en lot (batch) pour plusieurs clés.
   * @param keys - Tableau de clés à récupérer
   */
  async mGet<T = any>(keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};
    const prefixedKeys = keys.map(key => this.getCacheKey(key));

    try {
      let values: (string | null)[] = [];
      if (this.redisConnected && this.redisClient) {
        values = await this.redisClient.mget(...prefixedKeys);
        logger.debug(`Batch get from Redis for ${keys.length} keys`);
      } else {
        values = prefixedKeys.map(key => this.memoryCache.get(key) as string | null);
        logger.warn(`Redis disconnected, batch get from memory for ${keys.length} keys`);
      }

      keys.forEach((originalKey, index) => {
        const value = values[index];
        result[originalKey] = value ? JSON.parse(value) as T : null;
      });
      return result;
    } catch (error) {
      logger.error('Error during batch get', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {};
    }
  }

  /**
   * Ferme les connexions Redis et le cache mémoire.
   */
  async close(): Promise<void> {
    try {
      this.clearReconnectionTimeout();
      
      if (this.redisClient) {
        this.redisClient.removeAllListeners();
        await this.redisClient.quit();
        logger.info('Redis client connection closed');
      }
      
      if (this.memoryCache) {
        this.memoryCache.close();
        logger.info('Memory cache closed');
      }
    } catch (error) {
      logger.error('Error closing cache connections', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Supprime une valeur du cache.
   */
  async del(key: string): Promise<boolean> {
    const prefixedKey = this.getCacheKey(key);
    let success = false;

    try {
      if (this.isRedisConnected() && this.redisClient) {
        await this.redisClient.del(prefixedKey);
        success = true;
        logger.debug(`Cache deleted from Redis: ${key}`);
      }
    } catch (error) {
      logger.error(`Error deleting cache from Redis for ${key}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    this.memoryCache.del(prefixedKey);
    return success;
  }
  
  /**
   * Vérifie le statut de connexion Redis.
   */
   isRedisConnected(): boolean {
    return this.redisConnected && 
           this.redisClient?.status === 'ready' && 
           !this.isReconnecting;
  }
  
  /**
   * Obtient des statistiques de connexion Redis
   */
  getRedisStats(): {
    connected: boolean;
    status: string;
    connectionAttempts: number;
    isReconnecting: boolean;
  } {
    return {
      connected: this.redisConnected,
      status: this.redisClient?.status || 'not_initialized',
      connectionAttempts: this.connectionAttempts,
      isReconnecting: this.isReconnecting
    };
  }
  
  /**
   * Force une reconnexion Redis
   */
  async forceReconnect(): Promise<boolean> {
    logger.info('Forcing Redis reconnection...');
    this.connectionAttempts = 0;
    await this.attemptReconnection();
    return this.isRedisConnected();
  }

}
export  default  UserPresenceService;
