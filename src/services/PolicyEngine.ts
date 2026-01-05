import CountryPolicy from '../models/CountryPolicy';
import PropertyPolicy from '../models/PropertyPolicy';
import { GeoLocationService } from './GeoLocationService';
import { Types } from 'mongoose';

export interface ResolvedPolicy {
  paymentTiming: 'BEFORE_ACCEPTANCE' | 'AFTER_ACCEPTANCE';
  allowMultipleRequests: boolean;
  holdDurationHours: number;
  depositRequired: boolean;
  cancellationGraceHours: number;
  visitRequired: boolean;
  paymentMethods: string[];
  requiredDocuments: string[];
  requiredFields: {
    fieldName: string;
    fieldType: 'text' | 'number' | 'date' | 'file' | 'select';
    required: boolean;
    label: string;
    options?: string[];
  }[];
}

export class PolicyEngine {
  private static defaultPolicy: ResolvedPolicy = {
    paymentTiming: 'AFTER_ACCEPTANCE',
    allowMultipleRequests: false,
    holdDurationHours: 48,
    depositRequired: true,
    cancellationGraceHours: 24,
    visitRequired: false,
    paymentMethods: ['stripe'],
    requiredDocuments: [],
    requiredFields: []
  };

  static async resolvePolicy(
    propertyId: Types.ObjectId,
    countryCode?: string,
    req?: any
  ): Promise<ResolvedPolicy> {
    
    if (!countryCode && req) {
      const clientIP = GeoLocationService.getClientIP(req);
      countryCode = await GeoLocationService.detectCountryFromIP(clientIP);
    }
    
    countryCode = countryCode || 'TG';
    let policy = { ...this.defaultPolicy };

    const countryPolicy = await CountryPolicy.findOne({ 
      countryCode, 
      isActive: true 
    });
    if (countryPolicy) {
      policy = {
        ...policy,
        paymentTiming: countryPolicy.paymentTiming,
        allowMultipleRequests: countryPolicy.allowMultipleRequests,
        holdDurationHours: countryPolicy.holdDurationHours,
        depositRequired: countryPolicy.depositRequired,
        cancellationGraceHours: countryPolicy.cancellationGraceHours,
        visitRequired: countryPolicy.visitRequired,
        paymentMethods: countryPolicy.paymentMethods,
        requiredDocuments: countryPolicy.requiredDocuments || [],
        requiredFields: countryPolicy.requiredFields || []
      };
    }

    const propertyPolicy = await PropertyPolicy.findOne({ 
      propertyId, 
      isActive: true 
    });
    if (propertyPolicy?.override) {
      Object.keys(propertyPolicy.override).forEach(key => {
        if (propertyPolicy.override[key] !== undefined) {
          policy[key] = propertyPolicy.override[key];
        }
      });
    }

    return policy;
  }

  static async getPaymentMethods(countryCode?: string, req?: any): Promise<string[]> {
    if (!countryCode && req) {
      const clientIP = GeoLocationService.getClientIP(req);
      countryCode = await GeoLocationService.detectCountryFromIP(clientIP);
    }
    
    countryCode = countryCode || 'TG';
    const countryPolicy = await CountryPolicy.findOne({ 
      countryCode, 
      isActive: true 
    });
    return countryPolicy?.paymentMethods || this.defaultPolicy.paymentMethods;
  }
}