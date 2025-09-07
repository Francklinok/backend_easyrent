

// import { Document, Types } from 'mongoose';

// export enum PropertyStatus {
//   AVAILABLE = 'disponible',
//   RENTED = 'loué',
//   MAINTENANCE = 'en maintenance',
//   REMOVED = 'retiré'
// }

// export interface IProperty {
//   title: string;
//   description: string;
//   address: string;
//   monthlyRent: number;
//   depositAmount: number;
//   maxOccupants: number;
//   bedrooms: number;
//   bathrooms: number;
//   area: string;
//   ownerId: Types.ObjectId;
//   images: string[];
//   amenities: string[];
//   availableFrom: Date;
//   surface: number;
//   rooms: number;
//   status: PropertyStatus;
//   isActive: boolean;
//   createdAt?: Date;
//   updatedAt?: Date;
// }

// export interface IPropertyDocument extends IProperty, Document {
//   pricePerSquareMeter: number;
//   isAvailableAt(date: Date): boolean;
// }
// export interface PropertyParams{
//     pagination:PaginationOptions,
//     status:PropertyStatus
//     ownerId:PropertyQueryFilters
// }
// export interface PropertyCreateDTO {
//   title: string;
//   description: string;
//   address: string;
//   monthlyRent: number;
//   depositAmount?: number;
//   maxOccupants?: number;
//   bedrooms: number;
//   bathrooms: number;
//   area: string;
//   ownerId: string;
//   images: string[];
//   amenities?: string[];
//   availableFrom?: Date;
//   surface: number;
//   rooms?: number;
//   status?: PropertyStatus;
// }

// export interface PropertyUpdateDTO extends Partial<PropertyCreateDTO> {
//   isActive?: boolean;
// }

// export interface PropertyQueryFilters {
//   area?: string;
//   minRent?: number;
//   maxRent?: number;
//   minBedrooms?: number;
//   ownerId?: string;
//   status?: PropertyStatus;
//   isActive?: boolean;
//   availableFrom?: Date;
// }

// export interface PaginationOptions {
//   page?: number;
//   limit?: number;
//   sortBy?: string;
//   sortOrder?: 'asc' | 'desc';
// }

// export interface PropertyPaginatedResponse {
//   properties: IProperty[];
//   total: number;
//   page: number;
//   limit: number;
//   totalPages: number;
// }

// export interface SimilarPropertyType{
//   pagination:PaginationOptions,
//   propertyId:string
// }
// export interface SearchPropertyParams{
//   pagination:PaginationOptions,
//   q:string
// }
// export interface UpdatePropertyParams{
//   propertyId:string, 
//    data: Partial<PropertyCreateDTO>;
// }


import { Document, Types } from 'mongoose';

export enum PropertyStatus {
  AVAILABLE = 'disponible',
  RENTED = 'loué',
  MAINTENANCE = 'en maintenance',
  REMOVED = 'retiré'
}

// 🎯 Atouts (avantages / points forts du bien)
export interface PropertyAtout {
  id: string;
  type: 'predefined' | 'custom_text' | 'custom_icon';
  text: string;
  icon?: string;
  lib?: string;
  category: string;
  verified?: boolean;
  priority: number;
  customIcon?: boolean;
}

// 🎯 Équipements (ex: ascenseur, parking…)
export interface PropertyEquipment {
  id: string;
  name: string;
  icon: string;
  lib: string;
  category: string;
}

// 🎯 Documents requis (client et garant)
export interface PropertyRequiredDocuments {
  client: string[];
  guarantor: string[];
}

// 🎯 Infos générales (ex: animaux, fumeur, meublé)
export interface GeneralInfo {
  furnished?: boolean;
  pets?: boolean;
  smoking?: boolean;
}

export type PropertyType =
  | 'villa'
  | 'apartment'
  | 'home'
  | 'penthouse'
  | 'studio'
  | 'loft'
  | 'bureau'
  | 'chalet'
  | 'hotel'
  | 'terrain'
  | 'commercial';

  export type AcTionType = 'rent'|'sell'

export interface GeneralHInfo {
  rooms: number;         // nombre de pièces
  bedrooms: number;      // nombre de chambres
  bathrooms: number;     // nombre de salles de bain
  toilets: number;       // nombre de toilettes
  surface: number;       // surface en m²
  area: string;          // quartier/zone
  furnished: boolean;    // meublé ?
  pets: boolean;         // animaux acceptés ?
  smoking: boolean;      // fumeur ?
  maxOccupants: number;  // nombre maximum d'occupants
}

// Infos générales pour terrains
export interface GeneralLandInfo {
  surface:number
  constructible: boolean; // terrain constructible ?
  cultivable: boolean;    // terrain cultivable ?
  fence: boolean;         // terrain clôturé ?
}

export type SolvabilityType = 'instant' | 'date';

// Type pour l’emplacement du garant
export type GuarantorLocationType = 'same' | 'different';

// Documents requis pour locataire et garant
export interface RequiredDocuments {
  client: string[];
  guarantor: string[];
}

// Owner criteria (conditions du propriétaire)
export interface OwnerCriteria {
  monthlyRent: number;               // Loyer mensuel
  isGarantRequired?: boolean;       // Garant requis
  depositAmount?: number;            // Montant de la caution
  minimumDuration?: number;          // Durée minimale (mois)
  solvability?: SolvabilityType;     // Instant / Date
  guarantorRequired?: boolean;       // Garant requis
  guarantorLocation?: GuarantorLocationType; // Emplacement du garant
  acceptedSituations?: string[];     // Situations acceptées (ex: salarié, cadre…)
  isDocumentRequired?: boolean;      // Documents requis ?
  requiredDocuments?: RequiredDocuments; // Documents détaillés
}

// === Property Model principal ===
export interface IProperty {
  propertyId: Types.ObjectId;
  actionType: AcTionType;
  propertyType: PropertyType
  island:boolean,
  ishome:boolean,
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
  iserviceAvalaible:boolean,
  services: Types.ObjectId;

  // ✅ Ajouts
  generalHInfo:GeneralHInfo;
  generalLandinfo:GeneralLandInfo;
  ownerCriteria: OwnerCriteria;
  atouts?: PropertyAtout[];
  equipments?: PropertyEquipment[];
  acceptedSituations?: string[];
  isDocumentRequired?: boolean;
  requiredDocuments?: PropertyRequiredDocuments;
  generalInfo?: GeneralInfo;

  createdAt?: Date;
  updatedAt?: Date;
}

// === Document Mongoose enrichi ===
export interface IPropertyDocument extends IProperty, Document {
  pricePerSquareMeter: number;
  isAvailableAt(date: Date): boolean;
}

// === DTOs et Query Types ===
export interface PropertyParams {
  pagination: PaginationOptions;
  status?: PropertyStatus;
  ownerId?: string;
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

  // ✅ Ajouts
  atouts?: PropertyAtout[];
  equipments?: PropertyEquipment[];
  acceptedSituations?: string[];
  isDocumentRequired?: boolean;
  requiredDocuments?: PropertyRequiredDocuments;
  generalInfo?: GeneralInfo;
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

export interface SimilarPropertyType {
  pagination: PaginationOptions;
  propertyId: string;
}

export interface SearchPropertyParams {
  pagination: PaginationOptions;
  q: string;
}

export interface UpdatePropertyParams {
  propertyId: string;
  data: Partial<PropertyCreateDTO>;
}
