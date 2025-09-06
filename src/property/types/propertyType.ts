

import { Document, Types } from 'mongoose';

export enum PropertyStatus {
  AVAILABLE = 'disponible',
  RENTED = 'loué',
  MAINTENANCE = 'en maintenance',
  REMOVED = 'retiré'
}

export interface IProperty {
  title: string;
  description: string;
  address: string;
  monthlyRent: number;
  depositAmount: number;
  maxOccupants: number;
  bedrooms: number;
  bathrooms: number;
  area: string;
  ownerId: Types.ObjectId;
  images: string[];
  amenities: string[];
  availableFrom: Date;
  surface: number;
  rooms: number;
  status: PropertyStatus;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPropertyDocument extends IProperty, Document {
  pricePerSquareMeter: number;
  isAvailableAt(date: Date): boolean;
}
export interface PropertyParams{
    pagination:PaginationOptions,
    status:PropertyStatus
    ownerId:PropertyQueryFilters
}
export interface PropertyCreateDTO {
  title: string;
  description: string;
  address: string;
  monthlyRent: number;
  depositAmount?: number;
  maxOccupants?: number;
  bedrooms: number;
  bathrooms: number;
  area: string;
  ownerId: string;
  images: string[];
  amenities?: string[];
  availableFrom?: Date;
  surface: number;
  rooms?: number;
  status?: PropertyStatus;
}

export interface PropertyUpdateDTO extends Partial<PropertyCreateDTO> {
  isActive?: boolean;
}

export interface PropertyQueryFilters {
  area?: string;
  minRent?: number;
  maxRent?: number;
  minBedrooms?: number;
  ownerId?: string;
  status?: PropertyStatus;
  isActive?: boolean;
  availableFrom?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PropertyPaginatedResponse {
  properties: IProperty[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SimilarPropertyType{
  pagination:PaginationOptions,
  propertyId:string
}
export interface SearchPropertyParams{
  pagination:PaginationOptions,
  q:string
}
export interface UpdatePropertyParams{
  propertyId:string, 
   data: Partial<PropertyCreateDTO>;
}