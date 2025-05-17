import { Document } from 'mongoose';
import { ObjectId } from 'mongodb';

/**
 * Types d'événements de sécurité audités
 * Utilisé pour assurer la cohérence des types d'événements dans l'application
 */
export enum SecurityEventType {
  // Événements d'authentification
  USER_REGISTERED = 'USER_REGISTERED',
  SUCCESSFUL_LOGIN = 'SUCCESSFUL_LOGIN',
  FAILED_LOGIN = 'FAILED_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  
  // Événements liés au mot de passe
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  
  // Événements liés à l'email
  EMAIL_VERIFICATION_SENT = 'EMAIL_VERIFICATION_SENT',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',
  
  // Événements 2FA
  TWO_FACTOR_ENABLED = 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
  SUCCESSFUL_2FA = 'SUCCESSFUL_2FA',
  FAILED_2FA = 'FAILED_2FA',
  
  // Événements de session
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  
  // Événements de profil et paramètres
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  SECURITY_SETTINGS_CHANGED = 'SECURITY_SETTINGS_CHANGED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  
  // Événements administratifs
  ADMIN_ACTION = 'ADMIN_ACTION',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  
  // Événements liés aux accès
  API_ACCESS = 'API_ACCESS',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  SUSPICIOUS_ACTIVITY_DETECTED = 'SUSPICIOUS_ACTIVITY_DETECTED'
}

/**
 * Types de détails spécifiques pour les événements d'audit
 */
export type SecurityEventDetails = {
  // Détails de base qui peuvent être présents dans tous les événements
  description?: string;
  status?: 'success' | 'failure' | 'warning' | 'info';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  
  // Détails spécifiques aux événements d'authentification
  email?: string;
  loginMethod?: 'password' | 'oauth' | 'sso' | 'api_key';
  failureReason?: string;
  
  // Détails liés aux sessions
  sessionId?: string;
  sessionDuration?: number;
  
  // Détails liés aux modifications de compte
  changedFields?: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  
  // Détails liés aux tentatives d'accès non autorisés
  targetResource?: string;
  requiredPermissions?: string[];
  
  // Détails liés aux actions administratives
  adminId?: string;
  targetUserId?: string;
  actionTaken?: string;
  
  // Autres détails qui pourraient être enregistrés
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
  
  // Extensions ouvertes pour d'autres types de détails spécifiques
  [key: string]: any;
};

/**
 * Interface représentant un événement d'audit de sécurité
 */
export interface SecurityAuditEvent extends Document {
  _id: ObjectId;
  
  /**
   * Type d'événement de sécurité
   */
  eventType: string | SecurityEventType;
  
  /**
   * ID de l'utilisateur concerné par l'événement, si applicable
   */
  userId?: ObjectId;
  
  /**
   * Horodatage de l'événement
   */
  timestamp: Date;
  
  /**
   * Adresse IP à l'origine de l'événement
   */
  ipAddress: string;
  
  /**
   * Chaîne d'identification du navigateur/client
   */
  userAgent: string;
  
  /**
   * Détails supplémentaires spécifiques à l'événement
   */
  details: SecurityEventDetails;
}

/**
 * Interface pour les événements de sécurité à auditer
 * Utilisée lors de la création d'un nouvel événement
 */
export interface AuditEventData {
  /**
   * Type d'événement de sécurité à enregistrer
   */
  eventType: string | SecurityEventType;
  
  /**
   * ID de l'utilisateur concerné, si applicable
   */
  userId?: string;
  
  /**
   * Adresse IP à l'origine de l'événement
   */
  ipAddress?: string;
  
  /**
   * Chaîne d'identification du navigateur/client
   */
  userAgent?: string;
  
  /**
   * Détails supplémentaires spécifiques à l'événement
   */
  details?: SecurityEventDetails;
}

/**
 * Interface représentant le résultat d'une détection d'activité suspecte
 */
export interface SuspiciousActivityResult {
  /**
   * Indique si une activité suspecte a été détectée
   */
  detected: boolean;
  
  /**
   * Liste des types d'activités suspectes détectées
   */
  activities: string[];
  
  /**
   * Niveau de risque évalué (optionnel)
   */
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * Recommandations d'actions à entreprendre (optionnel)
   */
  recommendations?: string[];
}

/**
 * Interface pour les critères de recherche d'événements de sécurité
 */
export interface SecurityEventSearchCriteria {
  /**
   * ID de l'utilisateur pour filtrer les événements
   */
  userId?: string;
  
  /**
   * Type d'événement pour filtrer les résultats
   */
  eventType?: string | SecurityEventType | (string | SecurityEventType)[];
  
  /**
   * Date de début pour la période de recherche
   */
  startDate?: Date | string;
  
  /**
   * Date de fin pour la période de recherche
   */
  endDate?: Date | string;
  
  /**
   * Adresse IP pour filtrer les résultats
   */
  ipAddress?: string;
  
  /**
   * Mots-clés à rechercher dans les détails
   */
  keywords?: string[];
  
  /**
   * Niveau de sévérité minimum pour les événements
   */
  minSeverity?: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * Autres critères personnalisés
   */
  [key: string]: any;
}

/**
 * Interface pour les résultats paginés de recherche d'événements
 */
export interface PaginatedSecurityEvents {
  /**
   * Liste des événements correspondant aux critères
   */
  events: SecurityAuditEvent[];
  
  /**
   * Nombre total d'événements correspondant aux critères
   */
  total: number;
  
  /**
   * Page actuelle
   */
  page: number;
  
  /**
   * Nombre d'événements par page
   */
  limit: number;
  
  /**
   * Nombre total de pages
   */
  totalPages: number;
}