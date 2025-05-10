import { Document } from 'mongoose';

export enum UserRole {
  CLIENT = "client",
  AGENT = "agent",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin"

}

export enum  VerificationStatus{
  UNVERIFIED = "unverified",
  PENDING = "pending",
  VERIFIED = "verified",
  REJECTED = "rejected"
}

export interface LoginHistory{
  timestamp:Date;
  ipAddress:string;
  userAgent:string;
  location?:string;
  deviceId?:string;
  successful:boolean;
}

export interface UserPreferences{
  theme:'light'| 'dark'|'system';
  language:string;
  emailNotifications:boolean;
  pushNotifications:boolean;
  smsNotifications:boolean;
  twoFactorEnabled:boolean;
  marketingCommunications:boolean;
}

export interface Address{
  street?:string;
  city:string;
  state?:string;
  postalCode?:string;
  country:string;
  coordinates?:{
    latitude:number;
    longitude:number;
  }
}

export interface AgentDetails{
  licenseNumber:string;
  licenseExpiryDate:Date;
  agency:string;
  specializations:string[];
  yearsOfExperience: number;
  verificationStatus:VerificationStatus;
  verificationDocuments:string[];
  verificationDate?:Date;
  rating?:number;
  reviewCount?:number;
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  username:string;
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
  lastIp?: string;
  lastUserAgent?: string;
  presenceStatus: string;
  lastActive: Date;
  loginAttempts: LoginHistory[];
  isActive: boolean;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshTokens: string[];
  loginHistory: LoginHistory[];
  preferences: UserPreferences;
  agentDetails?: AgentDetails;
  getFullName(): string;
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

