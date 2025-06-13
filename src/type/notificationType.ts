export  interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}
export  interface QueuedEmail extends EmailOptions {
  id: string;
  priority: 'high' | 'normal' | 'low';
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
}

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string | number;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
  renotify?: boolean;
  timestamp?: string;
  
  // Options Firebase spécifiques
  androidChannelId?: string;
  androidIcon?: string;
  androidColor?: string;
  sound?: string;
  category?: string;
  
  // Options Web Push spécifiques
  ttl?: number; // Time to live en secondes
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  topic?: string;
}

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}