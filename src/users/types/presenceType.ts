
/**
 * Énumération des statuts de présence possibles
 */
export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline',
  BUSY = 'busy'
}


/*
 * Interface pour les informations de présence
 */
export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastActive: Date;
  deviceInfo?: {
    ip?: string;
    userAgent?: string;
    deviceId?: string;
  };
}