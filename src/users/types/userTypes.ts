

import { Document } from 'mongoose';
import { Types } from 'mongoose';

export enum UserRole {
  CLIENT = "client",
  AGENT = "agent",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin"
}

export enum VerificationStatus {
  UNVERIFIED = "unverified",
  PENDING = "pending",
  VERIFIED = "verified",
  REJECTED = "rejected"
}

export interface LoginHistory {
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  location?: string;
  deviceId?: string;
  successful: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
  };
  twoFactorEnabled: boolean;
  marketingCommunications: boolean;
  updatedAt?: Date;
  [key: string]: any;
}

export interface PreferenceHistoryEntry {
  preferences: UserPreferences;
  timestamp: Date;
}

export interface Address {
  street?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  }
}

export interface AgentDetails {
  licenseNumber: string;
  licenseExpiryDate: Date;
  agency: string;
  specializations: string[];
  yearsOfExperience: number;
  verificationStatus: VerificationStatus;
  verificationDocuments: string[];
  verificationDate?: Date;
  rating?: number;
  reviewCount?: number;
}

export interface RefreshToken {
  tokenId: string;
  expiresAt: Date;
  lastUsed?: Date;
  device?: string;
  ipAddress?: string;
  createdAt: Date;
}

export interface LoginAttempt {
  timestamp: Date;
  success: boolean;
  ipAddress: string;
  userAgent: string;
}

export interface BackupCode {
  code: string;
  used: boolean;
  usedAt?: Date;
  createdAt?: Date;
}

export interface TrustedDevice {
  deviceId: string;
  name?: string;
  userAgent?: string;
  ipAddress?: string;
  addedAt: Date;
  lastUsed: Date;
  [key: string]: any;
}

export interface RecoveryCode {
  code: string;
  used: boolean;
  usedAt?: Date;
  createdAt: Date;
}

export interface SecurityDetails {
  question?: string;
  answer?: string;
  backupCodes?: BackupCode[];
  loginAttempts?: LoginAttempt[];
  accountLocked?: boolean;
  lockExpiresAt?: Date;
  recoveryCodes?: RecoveryCode[];
  trustedDevices?: TrustedDevice[];
  twoFactorSecret?: string;
  tempTwoFactorSecret?: string;
  tempTwoFactorSecretExpires?: Date;
}

export interface UserNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
  link?: string;
  [key: string]: any;
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  profilePicture?: string;
  phoneNumber?: string;
  address?: Address;
  dateOfBirth?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  lastLoginAt?: Date;
  lastIp?: string;
  lastUserAgent?: string;
  presenceStatus: string;
  lastActive: Date;
  loginAttempts: LoginHistory[];
  isActive: boolean;
  refreshTokens: RefreshToken[];
  loginHistory: LoginHistory[];
  preferences: UserPreferences;
  preferencesHistory?: PreferenceHistoryEntry[];
  agentDetails?: AgentDetails;
  security?: SecurityDetails;
  notifications?: UserNotification[];
  avatarUrl?: string;
  phone?: string | null;
  getFullName(): string;
  
  // Propriétés pour la vérification d'email
  emailVerified?:boolean,
  isEmailVerified?: boolean;
  verificationToken?: string;
  emailVerificationToken?: string |null;
  emailVerificationTokenExpires?: Date | null;
  
  // Propriétés pour la réinitialisation de mot de passe
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  passwordChangedAt?: Date;
  
  // Propriétés pour la gestion de la suppression
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  
  comparePassword: (candidatePassword: string) => Promise<boolean>;
  generateVerificationToken: () => string;
  generatePasswordResetToken: () => Promise<string>;
  isPasswordResetTokenValid: (token: string) => boolean;
  recordLoginAttempt: (data: Omit<LoginHistory, 'timestamp'>) => void;
  updateLastLogin: (ipAddress: string, userAgent: string) => void;
  updatePresenceStatus(status: string): void;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  phoneNumber?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  dateOfBirth?: Date;
  agentDetails?: {
    licenseNumber: string;
    licenseExpiryDate: Date;
    agency: string;
    specializations: string[];
    yearsOfExperience: number;
  };
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    smsNotifications?: boolean;
    marketingCommunications?: boolean;
  };
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  dateOfBirth?: Date;
  secret:string;
  tempTwoFactorSecret?:string;
  profilePicture?: string;
  preferences?: Partial<IUser['preferences']>;
  agentDetails?: Partial<NonNullable<IUser['agentDetails']>>;
}

export interface SearchUsersParams {
  query?: string;
  role?: UserRole;
  isActive?: boolean;
  city?: string;
  country?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Interface pour les options d'authentification
 */
export interface AuthOptions {
  rememberMe?: boolean;
  deviceInfo?: {
    deviceId: string;
    deviceName: string;
    platform: string;
    version: string;
  };
}

/**
 * Interface pour la configuration 2FA
 */
export interface TwoFactorSetup {
  // secret: string;
  tempTwoFactorSecret:string,
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 * Interface pour les informations de sécurité
 */
export interface SecurityInfo {
  twoFactorEnabled: boolean;
  lastPasswordChange: Date;
  activeSessions: number;
  recentLoginAttempts: number;
  accountLockout?: {
    isLocked: boolean;
    lockUntil?: Date;
  };
}

/**
 * Interface pour les sessions actives
 */
export interface ActiveSession {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  isCurrent: boolean;
}

/**
 * Interface pour le payload des tokens JWT
 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId?: string;
  deviceId?: string;
  temp?: boolean; // For temporary tokens (2FA)

}

/**
 * Interface pour les tokens d'authentification
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  sessionId?: string;
}

/**
 * Interface pour les détails de connexion
 */
export interface LoginDetails {
  ipAddress: string;
  userAgent: string;
  successful: boolean;
  timestamp?: Date;
}

/**
 * Interface pour les informations utilisateur étendues
 */
export interface UserInfo {
  _id: string| Types.ObjectId;
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  preferences?: {
    twoFactorEnabled?: boolean;
  };
  twoFactorSecret?: string;
  tempTwoFactorSecret?: string;
  lastPasswordChange?: Date;
  passwordChangedAt?: Date; // Alternative field name
  createdAt: Date;
  accountLockout?: {
    isLocked: boolean;
    lockUntil?: Date;
  };
  emailVerified:Boolean;
   lockUntil?: Date; // Alternative structure
  isLocked?: boolean;
  comparePassword(password: string): Promise<boolean>;
  updateLastLogin(ip: string, userAgent: string): void;
  recordLoginAttempt(details: LoginDetails): void;
  addDeviceInfo?(deviceInfo: any): void;
  save(): Promise<void>;
}

export interface UserFilterOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isActive?: boolean;
  role?: string;
  [key: string]: any; // Pour autoriser d'autres filtres dynamiques
}

export interface UserSearchOptions {
  query?: string;
  fields?: string[];
  page?: number;
  limit?: number;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}


/**
 * Interface for deletion options
 */
export interface DeleteUserOptions {
  softDelete?: boolean;
  reason?: string;
  deletedBy?: string;
  preserveData?: boolean;
}

/**
 * Interface for user deletion result
 */
export interface DeleteUserResult {
  success: boolean;
  userId: string;
  deletionType: 'soft' | 'hard';
  deletedAt: Date;
  message?: string;
}

 export  interface TwoFactorValidationResult {
    success: boolean;
    message?: string;
    userId?: string;
    tokens?: AuthTokens;
  }