import User from '../models/userModel';
import Property from '../../property/model/propertyModel';
import Activity from '../../activity/model/activitySchema';
import { Wallet } from '../../wallet/models/Wallet';
import { ServiceSubscription } from '../../service-marketplace/models/ServiceSubscription';
import { ServiceProvider } from '../../service-marketplace/models/ServiceProvider';

export const userResolvers = {
  Query: {
    user: async (_, { id }) => {
      return await User.findById(id);
    },
    
    me: async (_, __, { user }) => {
      if (!user) throw new Error('Authentication required');
      return await User.findById(user.userId);
    }
  },

  User: {
    fullName: (user) => {
      return `${user.firstName} ${user.lastName}`.trim();
    },
    
    properties: async (user) => {
      return await Property.find({ ownerId: user._id, isActive: true });
    },
    
    activities: async (user) => {
      return await Activity.find({ clientId: user._id }).sort({ createdAt: -1 });
    },
    
    wallet: async (user) => {
      return await Wallet.findOne({ userId: user._id.toString() });
    },
    
    conversations: async (user) => {
      // À implémenter avec le modèle Conversation
      return [];
    },
    
    serviceSubscriptions: async (user) => {
      return await ServiceSubscription.find({ userId: user._id.toString() });
    },
    
    serviceProvider: async (user) => {
      return await ServiceProvider.findOne({ userId: user._id.toString() });
    }
  }
};