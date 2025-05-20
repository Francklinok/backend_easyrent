import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';

/**
 * Types d'événements de sécurité audités
 */
export enum SecurityEventType {
  // Authentification
  USER_REGISTERED = 'USER_REGISTERED',
  SUCCESSFUL_LOGIN = 'SUCCESSFUL_LOGIN',
  FAILED_LOGIN = 'FAILED_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',

  // Mot de passe
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',

  // Email
  EMAIL_VERIFICATION_SENT = 'EMAIL_VERIFICATION_SENT',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',

  // 2FA
  TWO_FACTOR_ENABLED = 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
  SUCCESSFUL_2FA = 'SUCCESSFUL_2FA',
  FAILED_2FA = 'FAILED_2FA',

  // Session
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_REVOKED = 'SESSION_REVOKED',

  // Profil et paramètres
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  SECURITY_SETTINGS_CHANGED = 'SECURITY_SETTINGS_CHANGED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',

  // Accès & sécurité
  API_ACCESS = 'API_ACCESS',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  SUSPICIOUS_ACTIVITY_DETECTED = 'SUSPICIOUS_ACTIVITY_DETECTED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',

  // Actions admin
  ADMIN_ACTION = 'ADMIN_ACTION',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',

  // Autres
  DATA_EXPORT = 'DATA_EXPORT'
}

/**
 * Niveaux de sévérité pour les événements d'audit
 */
export enum AuditEventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Détails spécifiques aux événements de sécurité
 */
export type SecurityEventDetails = {
  description?: string;
  status?: 'success' | 'failure' | 'warning' | 'info';
  severity?: 'low' | 'medium' | 'high' | 'critical';

  // Authentification
  email?: string;
  loginMethod?: 'password' | 'oauth' | 'sso' | 'api_key';
  failureReason?: string;

  // Session
  sessionId?: string;
  sessionDuration?: number;

  // Modifications de compte
  changedFields?: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;

  // Accès non autorisé
  targetResource?: string;
  requiredPermissions?: string[];

  // Admin
  adminId?: string;
  targetUserId?: string;
  actionTaken?: string;

  // Géolocalisation & device
  geolocation?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  deviceInfo?: {
    type?: string;
    osName?: string;
    osVersion?: string;
    browser?: string;
    browserVersion?: string;
  };

  // Extensible
  [key: string]: any;
};

/**
 * Représentation d'un événement d'audit de sécurité (persisté)
 */
export interface SecurityAuditEvent extends Document {
  _id: ObjectId;
  eventType: string | SecurityEventType;
  userId?: ObjectId;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  details: SecurityEventDetails;
}

/**
 * Données utilisées lors de la création d’un événement d’audit
 */
export interface AuditEventData {
  eventType: string | SecurityEventType;
  severity?: AuditEventSeverity;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  targetResource?: string;
  targetUserId?: string;
  sessionId?: string;
  details?: SecurityEventDetails;
}

/**
 * Résultat d'une détection d'activité suspecte
 */
export interface SuspiciousActivityResult {
  detected: boolean;
  activities: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  recommendations?: string[];
}

/**
 * Critères de recherche pour les événements
 */
export interface SecurityEventSearchCriteria {
  userId?: string;
  eventType?: string | SecurityEventType | (string | SecurityEventType)[];
  startDate?: Date | string;
  endDate?: Date | string;
  ipAddress?: string;
  keywords?: string[];
  minSeverity?: 'low' | 'medium' | 'high' | 'critical';
  [key: string]: any;
}

/**
 * Résultats paginés des événements
 */
export interface PaginatedSecurityEvents {
  events: SecurityAuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Options de recherche avancées
 */
export interface SecuritySearchOptions {
  userId?: string;
  eventType?: string | string[];
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  severity?: AuditEventSeverity;
  targetResource?: string;
  targetUserId?: string;
  sessionId?: string;
  sort?: { field: string; order: 'asc' | 'desc' };
  limit?: number;
  skip?: number;
}

/**
 * Configuration d'application
 */
export interface AppConfig {
  port: number;
  env: string;
  host?: string;
}

// Interface pour le document MongoDB
export  interface SecurityAuditDocument extends Document, SecurityAuditEvent {
  _id: ObjectId;
  eventType: string;
  timestamp: Date;
  userId?: ObjectId;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  severity: AuditEventSeverity;
  targetResource?: string;
  targetUserId?: ObjectId;
  sessionId?: string;
}
