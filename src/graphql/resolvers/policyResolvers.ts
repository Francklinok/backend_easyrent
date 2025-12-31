import { Types } from 'mongoose';
import CountryPolicy from '../../models/CountryPolicy';
import { PolicyEngine } from '../../services/PolicyEngine';
import { SmartReservationService } from '../../services/SmartReservationService';
import { GeoLocationService } from '../../services/GeoLocationService';

export const policyResolvers = {
  Query: {
    getCountryPolicy: async (_: any, { countryCode }: any) => {
      return await CountryPolicy.findOne({ countryCode, isActive: true });
    },

    getPaymentMethods: async (_: any, { countryCode }: any, { req }: any) => {
      return await PolicyEngine.getPaymentMethods(countryCode, req);
    },

    getReservationRequirements: async (_: any, { propertyId, countryCode }: any, { req }: any) => {
      const policy = await PolicyEngine.resolvePolicy(
        new Types.ObjectId(propertyId),
        countryCode,
        req
      );
      
      return {
        requiredDocuments: policy.requiredDocuments,
        requiredFields: policy.requiredFields,
        paymentMethods: policy.paymentMethods,
        visitRequired: policy.visitRequired,
        depositRequired: policy.depositRequired
      };
    },

    detectCountry: async (_: any, __: any, { req }: any) => {
      const clientIP = GeoLocationService.getClientIP(req);
      return await GeoLocationService.detectCountryFromIP(clientIP);
    }
  },

  Mutation: {
    smartReservation: async (_: any, { input }: any, { user, req }: any) => {
      if (!user) throw new Error('Authentication required');

      return await SmartReservationService.requestReservation(
        new Types.ObjectId(input.propertyId),
        new Types.ObjectId(user.userId),
        input.message,
        input.countryCode,
        req
      );
    },

    smartAcceptReservation: async (_: any, { activityId, countryCode }: any, { user, req }: any) => {
      if (!user) throw new Error('Authentication required');

      return await SmartReservationService.acceptReservation(
        new Types.ObjectId(activityId),
        countryCode,
        req
      );
    }
  }
};