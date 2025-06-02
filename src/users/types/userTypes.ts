import { Document, Model } from 'mongoose';
import { Types } from 'mongoose';

// ================================
// ENUMS
// ================================

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

export enum DeviceType {
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
  TABLET = 'tablet',
  UNKNOWN = 'unknown'
}

// ================================
// BASE INTERFACES - COMMON
// ================================

export interface ILocation {
  country?: string;
  city?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
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

// ================================
// USER RELATED INTERFACES
// ================================

export interface LoginHistory {
  timestamp: Date;
  ipAddress: string;
  userAgent?: string;
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

// ================================
// SECURITY RELATED INTERFACES
// ================================

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

// ================================
// REFRESH TOKEN INTERFACES
// ================================
export interface RefreshToken {
  tokenId:string,
  token: string;
  hashedToken: string;
  device?: string;
  userAgent?: string;
  ip?: string;
  location?: ILocation;
  user: Types.ObjectId;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  sessionId?: string;
  ipAddress:string,
}

export interface IRefreshToken {
  token: string;
  hashedToken: string;
  device?: string;
  userAgent?: string;
  ip?: string;
  location?: ILocation;
  user: Types.ObjectId;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  sessionId?: string;
}

export interface IRefreshTokenMethods {
  isExpired(): boolean;
  revoke(): Promise<IRefreshTokenDocument>;
  updateLastUsed(): Promise<IRefreshTokenDocument>;
}

export interface IRefreshTokenStatics {
  revokeAllForUser(userId: string | Types.ObjectId): Promise<any>;
  findActiveByUser(userId: string | Types.ObjectId): Promise<IRefreshTokenDocument[]>;
  cleanupExpired(): Promise<any>;
}

export interface IRefreshTokenDocument extends RefreshToken, IRefreshTokenMethods, Document {
  _id: Types.ObjectId;
}

export interface IRefreshTokenModel extends Model<IRefreshTokenDocument>, IRefreshTokenStatics {}

export interface IRefreshTokenPopulated extends Omit<IRefreshToken, 'user'> {
  _id: Types.ObjectId;
  user: {
    _id: Types.ObjectId;
    email: string;
    name?: string;
  };
}

export interface ITokenStats {
  totalTokens: number;
  activeTokens: number;
  expiredTokens: number;
  revokedTokens: number;
  deviceBreakdown: Record<string, number>;
  recentActivity: {
    date: Date;
    count: number;
  }[];
}

// ================================
// MAIN USER INTERFACE
// ================================

export interface IUser extends Document {
  // Basic Info
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  profilePicture?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  phone?: string | null;
  address?: Address;
  dateOfBirth?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  lastLoginAt?: Date;
  lastActive: Date;
  
  // Session Info
  lastIp?: string;
  lastUserAgent?: string;
  presenceStatus: string;
  
  // Status
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  
  // Authentication & Security
  refreshTokens: RefreshToken[];
  loginHistory: LoginHistory[];
  loginAttempts: LoginHistory[];
  security?: SecurityDetails;
  
  // Email Verification
  emailVerified?: boolean;
  isEmailVerified?: boolean;
  verificationToken?: string;
  emailVerificationToken?: string | null;
  emailVerificationTokenExpires?: Date | null;
  
  // Password Reset
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  passwordChangedAt?: Date;
  
  // User Data
  preferences: UserPreferences;
  preferencesHistory?: PreferenceHistoryEntry[];
  agentDetails?: AgentDetails;
  notifications?: UserNotification[];
  
  // Methods
  getFullName(): string;
  comparePassword: (candidatePassword: string) => Promise<boolean>;
  generateVerificationToken: () => string;
  generatePasswordResetToken: () => Promise<string>;
  isPasswordResetTokenValid: (token: string) => boolean;
  recordLoginAttempt: (data: Omit<LoginHistory, 'timestamp'>) => void;
  updateLastLogin: (ipAddress: string, userAgent: string) => void;
  updatePresenceStatus(status: string): void;
}

// ================================
// AUTHENTICATION INTERFACES
// ================================

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId?: string;
  deviceId?: string;
  temp?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  sessionId?: string;
}

export interface LoginDetails {
  ipAddress: string;
  userAgent: string;
  successful: boolean;
  timestamp?: Date;
}

export interface AuthOptions {
  rememberMe?: boolean;
  deviceInfo?: {
    deviceId: string;
    deviceName: string;
    platform: string;
    version: string;
    userAgent?: string;  
    ip?: string; 
  };
}

export interface TwoFactorSetup {
  tempTwoFactorSecret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorValidationResult {
  success: boolean;
  message?: string;
  userId?: string;
  tokens?: AuthTokens;
}

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

export interface ActiveSession {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  isCurrent: boolean;
}

export interface UserInfo {
  _id: string | Types.ObjectId;
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
  passwordChangedAt?: Date;
  createdAt: Date;
  accountLockout?: {
    isLocked: boolean;
    lockUntil?: Date;
  };
  emailVerified: Boolean;
  lockUntil?: Date;
  isLocked?: boolean;
  comparePassword(password: string): Promise<boolean>;
  updateLastLogin(ip: string, userAgent: string): void;
  recordLoginAttempt(details: LoginDetails): void;
  addDeviceInfo?(deviceInfo: any): void;
  save(): Promise<void>;
}

// ================================
// DTO INTERFACES (Data Transfer Objects)
// ================================

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
  secret: string;
  tempTwoFactorSecret?: string;
  profilePicture?: string;
  preferences?: Partial<IUser['preferences']>;
  agentDetails?: Partial<NonNullable<IUser['agentDetails']>>;
}

export interface ICreateRefreshToken {
  token: string;
  device?: string;
  userAgent?: string;
  ip?: string;
  location?: ILocation;
  user: string | Types.ObjectId;
  expiresAt: Date;
  sessionId?: string;
}

export interface IUpdateRefreshToken {
  device?: string;
  userAgent?: string;
  ip?: string;
  location?: ILocation;
  isActive?: boolean;
  lastUsedAt?: Date;
  revokedAt?: Date;
  sessionId?: string;
}

// ================================
// QUERY & SEARCH INTERFACES
// ================================

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

export interface UserFilterOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isActive?: boolean;
  role?: string;
  [key: string]: any;
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

export interface IRefreshTokenQuery {
  user?: string | Types.ObjectId;
  isActive?: boolean;
  sessionId?: string;
  device?: string;
  ip?: string;
  expiresAt?: {
    $gt?: Date;
    $lt?: Date;
    $gte?: Date;
    $lte?: Date;
  };
  createdAt?: {
    $gt?: Date;
    $lt?: Date;
    $gte?: Date;
    $lte?: Date;
  };
}

// ================================
// DELETION INTERFACES
// ================================

export interface DeleteUserOptions {
  softDelete?: boolean;
  reason?: string;
  deletedBy?: string;
  preserveData?: boolean;
}

export interface DeleteUserResult {
  success: boolean;
  userId: string;
  deletionType: 'soft' | 'hard';
  deletedAt: Date;
  message?: string;
}


// Type for audit event data
export interface AuditEventData {
  eventType: string;
  userId: string;
  performedBy?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
}

// Extended interface for user updates that includes deactivation fields
export interface ExtendedUpdateUserDto {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: any;
  dateOfBirth?: Date;
  secret?: string;
  tempTwoFactorSecret?: string;
  profilePicture?: string;
  preferences?: any;
  agentDetails?: any;
  // Additional fields for deactivation
  isActive?: boolean;
  deactivationReason?: string;
  deactivatedAt?: Date;
  deactivatedBy?: string;
}


// Interface pour le payload du JWT
export interface TokenPayload {
  userId: string;
  iat?: number;  // Issued at (timestamp)
  exp?: number;  // Expiration time (timestamp)
  iss?: string;  // Issuer
  sub?: string;  // Subject
}

// Interface étendue pour les JWT avec toutes les propriétés standard
export interface JWTPayload extends TokenPayload {
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
  sub?: string;
  nbf?: number;
  jti?: string;
}