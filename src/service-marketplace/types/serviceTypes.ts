export type ServiceCategory = 'maintenance' | 'cleaning' | 'security' | 'gardening' | 'insurance' | 'utilities' | 'wellness' | 'emergency' | 'eco' | 'tech' | 'collaborative';

export type ContractType = 'short_term' | 'long_term' | 'seasonal' | 'on_demand' | 'emergency';

export type ServiceStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export type PropertyType = 'apartment' | 'house' | 'studio' | 'villa' | 'commercial';

export interface ServiceProvider {
  id: string;
  userId: string;
  companyName?: string;
  description: string;
  certifications: string[];
  rating: number;
  totalReviews: number;
  isVerified: boolean;
  availableZones: string[];
  createdAt: Date;
}

export interface Service {
  id: string;
  providerId: string;
  title: string;
  description: string;
  category: ServiceCategory;
  contractTypes: ContractType[];
  pricing: {
    basePrice: number;
    currency: string;
    billingPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'one_time';
    discounts?: {
      longTerm?: number;
      seasonal?: number;
      bulk?: number;
    };
  };
  requirements: {
    propertyTypes: PropertyType[];
    minContractDuration?: number;
    maxContractDuration?: number;
    isMandatory: boolean;
    isOptional: boolean;
  };
  availability: {
    zones: string[];
    schedule: {
      days: string[];
      hours: string;
    };
    isEmergency: boolean;
  };
  media: {
    photos: string[];
    videos?: string[];
    documents?: string[];
  };
  tags: string[];
  status: ServiceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceSubscription {
  id: string;
  userId: string;
  propertyId: string;
  serviceId: string;
  contractType: ContractType;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  startDate: Date;
  endDate?: Date;
  pricing: {
    amount: number;
    currency: string;
    billingPeriod: string;
  };
  autoRenewal: boolean;
  sharedWith?: string[]; // Pour les services collaboratifs
  createdAt: Date;
}

export interface ServiceReview {
  id: string;
  userId: string;
  serviceId: string;
  subscriptionId: string;
  rating: number;
  comment: string;
  photos?: string[];
  isVerified: boolean;
  createdAt: Date;
}

export interface RecommendationInput {
  propertyType: PropertyType;
  location: {
    city: string;
    district: string;
    coordinates?: [number, number];
  };
  userProfile: {
    userId: string;
    preferences: string[];
    budget: number;
    lifestyle: string[];
  };
  servicesAlreadySubscribed: string[];
  seasonalContext?: string;
  neighborhoodData?: {
    popularServices: string[];
    averageRating: number;
  };
}

export interface ServiceRecommendation {
  serviceId: string;
  score: number;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
  category: ServiceCategory;
  estimatedPrice: number;
}

export interface CreateServiceRequest {
  title: string;
  description: string;
  category: ServiceCategory;
  contractTypes: ContractType[];
  pricing: {
    basePrice: number;
    currency: string;
    billingPeriod: string;
    discounts?: any;
  };
  requirements: {
    propertyTypes: PropertyType[];
    minContractDuration?: number;
    maxContractDuration?: number;
    isMandatory: boolean;
    isOptional: boolean;
  };
  availability: {
    zones: string[];
    schedule: any;
    isEmergency: boolean;
  };
  tags: string[];
}

export interface SubscribeServiceRequest {
  serviceId: string;
  propertyId: string;
  contractType: ContractType;
  startDate: Date;
  endDate?: Date;
  autoRenewal: boolean;
  sharedWith?: string[];
}