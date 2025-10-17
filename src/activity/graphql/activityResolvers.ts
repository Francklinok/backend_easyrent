import Activity from '../model/activitySchema';
import Property from '../../property/model/propertyModel';
import User from '../../users/models/userModel';
import { IntegratedNotificationService } from '../../notification/services/IntegratedNotificationService';
import { Transaction } from '../../wallet/models/Transaction';
import Conversation from '../../chat/model/conversationModel';
import Message from '../../chat/model/chatModel';
import ActivityServices from '../service/ActivityServices';
import { Types } from 'mongoose';


export const activityResolvers = {

  Query: {
    activities: async (_: any, { propertyId, userId, pagination, filters }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const query: any = {};

      if (propertyId) {
        // Vérifier que l'utilisateur a accès à cette propriété
        const property = await Property.findById(propertyId);
        const propertyOwnerId = property?.ownerId instanceof Types.ObjectId
          ? property.ownerId.toString()
          : String(property?.ownerId);

        if (!property || (propertyOwnerId !== user.userId && userId !== user.userId)) {
          throw new Error('Access denied');
        }
        query.propertyId = propertyId;
      }
      
      if (userId) {
        if (userId !== user.userId && user.role !== 'ADMIN') {
          throw new Error('Access denied');
        }
        query.clientId = userId;
      }
      
      // Filtres additionnels
      if (filters?.status) {
        switch (filters.status) {
          case 'PENDING':
            query.$or = [
              { isVisited: true, isVisiteAcccepted: { $ne: true } },
              { isReservation: true, isReservationAccepted: { $ne: true } }
            ];
            break;
          case 'ACCEPTED':
            query.$or = [
              { isVisiteAcccepted: true },
              { isReservationAccepted: true }
            ];
            break;
          case 'COMPLETED':
            query.isPayment = true;
            break;
        }
      }
      
      if (filters?.type) {
        if (filters.type === 'VISIT') query.isVisited = true;
        if (filters.type === 'RESERVATION') query.isReservation = true;
      }
      
      if (filters?.dateRange) {
        query.createdAt = {};
        if (filters.dateRange.start) query.createdAt.$gte = new Date(filters.dateRange.start);
        if (filters.dateRange.end) query.createdAt.$lte = new Date(filters.dateRange.end);
      }
      
      const limit = pagination?.first || 20;
      const skip = pagination?.after ? parseInt(Buffer.from(pagination.after, 'base64').toString()) : 0;
      
      const activities = await Activity.find(query)
        .populate('propertyId')
        .populate('clientId', 'firstName lastName profilePicture email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit + 1);
      
      const hasNextPage = activities.length > limit;
      const nodes = hasNextPage ? activities.slice(0, -1) : activities;
      
      const edges = nodes.map((activity, index) => ({
        node: activity,
        cursor: Buffer.from((skip + index).toString()).toString('base64')
      }));
      
      const totalCount = await Activity.countDocuments(query);
      
      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: skip > 0,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor
        },
        totalCount
      };
    },
    
    activity: async (_: any, { id }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const activity = await Activity.findById(id)
        .populate('propertyId')
        .populate('clientId', 'firstName lastName profilePicture email');
      
      if (!activity) throw new Error('Activity not found');

      // Vérifier l'accès
      const property = await Property.findById(activity.propertyId);
      const propertyOwnerId = property?.ownerId instanceof Types.ObjectId
        ? property.ownerId.toString()
        : String(property?.ownerId);

      const activityClientId = activity.clientId instanceof Types.ObjectId
        ? activity.clientId.toString()
        : (activity.clientId as any)?._id?.toString() || String(activity.clientId);

      if (!property || (propertyOwnerId !== user.userId && activityClientId !== user.userId)) {
        throw new Error('Access denied');
      }
      
      return activity;
    },
    
    // Statistiques des activités
    activityStats: async (_: any, { propertyId, userId, timeRange }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      const query: any = {};
      
      if (propertyId) {
        const property = await Property.findById(propertyId);
        const propertyOwnerId = property?.ownerId instanceof Types.ObjectId
          ? property.ownerId.toString()
          : String(property?.ownerId);

        if (!property || propertyOwnerId !== user.userId) {
          throw new Error('Access denied');
        }
        query.propertyId = propertyId;
      }
      
      if (userId && userId === user.userId) {
        query.clientId = userId;
      }
      
      if (timeRange) {
        query.createdAt = {};
        if (timeRange.start) query.createdAt.$gte = new Date(timeRange.start);
        if (timeRange.end) query.createdAt.$lte = new Date(timeRange.end);
      }
      
      const [
        totalActivities,
        visitRequests,
        reservationRequests,
        acceptedVisits,
        acceptedReservations,
        completedPayments,
        averageResponseTime
      ] = await Promise.all([
        Activity.countDocuments(query),
        Activity.countDocuments({ ...query, isVisited: true }),
        Activity.countDocuments({ ...query, isReservation: true }),
        Activity.countDocuments({ ...query, isVisiteAcccepted: true }),
        Activity.countDocuments({ ...query, isReservationAccepted: true }),
        Activity.countDocuments({ ...query, isPayment: true }),
        Activity.aggregate([
          { $match: query },
          { $group: { _id: null, avgTime: { $avg: { $subtract: ['$updatedAt', '$createdAt'] } } } }
        ])
      ]);
      
      return {
        totalActivities,
        visitRequests,
        reservationRequests,
        acceptedVisits,
        acceptedReservations,
        completedPayments,
        acceptanceRate: visitRequests > 0 ? (acceptedVisits / visitRequests) * 100 : 0,
        conversionRate: visitRequests > 0 ? (completedPayments / visitRequests) * 100 : 0,
        averageResponseTime: averageResponseTime[0]?.avgTime || 0
      };
    },
    
    // Activités par propriétaire
    ownerActivities: async (_: any, { pagination, filters }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');

      const activityService = new ActivityServices(null as any);
      return await activityService.getOwnerActivities(user.userId, {
        page: pagination?.page || 1,
        limit: pagination?.limit || 20
      });
    }
  },

  Mutation: {
    createActivity: async (_: any, { input }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');

      const activityService = new ActivityServices(null as any);
      
      if (input.isVisited) {
        return await activityService.createVisite({
          propertyId: input.propertyId,
          clientId: user.userId,
          message: input.message,
          visitDate: input.visitDate
        });
      }
      
      if (input.isReservation) {
        // D'abord créer l'activité de base
        const activity = new Activity({
          propertyId: input.propertyId,
          clientId: user.userId,
          message: input.message,
          isReservation: true,
          reservationDate: input.reservationDate || new Date()
        });

        await activity.save();

        return await activityService.createReservation({
          activityId: activity._id as Types.ObjectId,
          reservationDate: input.reservationDate || new Date(),
          documentsUploaded: !!input.uploadedFiles && input.uploadedFiles.length > 0,
          uploadedFiles: input.uploadedFiles
        });
      }
      
      // Activité générale
      const activity = new Activity({
        propertyId: input.propertyId,
        clientId: user.userId,
        message: input.message,
        isVisited: input.isVisited || false,
        visitDate: input.visitDate,
        isReservation: input.isReservation || false
      });
      
      return await activity.save();
    },
    
    updateActivityStatus: async (_: any, { id, status, reason }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');

      const activity = await Activity.findById(id);
      if (!activity) throw new Error('Activity not found');

      const property = await Property.findById(activity.propertyId);
      const propertyOwnerId = property?.ownerId instanceof Types.ObjectId
        ? property.ownerId.toString()
        : String(property?.ownerId);

      if (!property || propertyOwnerId !== user.userId) {
        throw new Error('Unauthorized');
      }

      const activityService = new ActivityServices(null as any);
      
      switch (status) {
        case 'ACCEPTED':
          if (activity.isVisited) {
            return await activityService.acceptVisitRequest(id);
          } else if (activity.isReservation) {
            return await activityService.acceptReservation({
              activityId: new Types.ObjectId(id)
            });
          }
          break;

        case 'REFUSED':
          if (activity.isVisited) {
            return await activityService.refuseVisitRequest(id);
          } else if (activity.isReservation) {
            return await activityService.refuseReservation({
              activityId: new Types.ObjectId(id),
              reason: reason || 'Refusé par le propriétaire'
            });
          }
          break;

        case 'COMPLETED':
          if (activity.isReservation && activity.isReservationAccepted) {
            return await activityService.processPayment({
              activityId: new Types.ObjectId(id),
              amount: property.ownerCriteria?.depositAmount || 0,
              isBookingAccepted: true,
              paymentDate: new Date()
            });
          }
          break;
      }
      
      return await Activity.findById(id);
    },
    
    // Traiter un paiement
    processPayment: async (_: any, { activityId, amount }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');

      const activity = await Activity.findById(activityId);
      const activityClientId = activity?.clientId instanceof Types.ObjectId
        ? activity.clientId.toString()
        : String(activity?.clientId);

      if (!activity || activityClientId !== user.userId) {
        throw new Error('Activity not found or unauthorized');
      }

      const activityService = new ActivityServices(null as any);
      return await activityService.processPayment({
        activityId: new Types.ObjectId(activityId),
        amount,
        isBookingAccepted: true,
        paymentDate: new Date()
      });
    },
    
    // Annuler une activité
    cancelActivity: async (_: any, { id, reason }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');

      const activity = await Activity.findById(id);
      if (!activity) throw new Error('Activity not found');

      // Seul le client peut annuler son activité
      const activityClientId = activity.clientId instanceof Types.ObjectId
        ? activity.clientId.toString()
        : String(activity.clientId);

      if (activityClientId !== user.userId) {
        throw new Error('Unauthorized');
      }

      // Marquer comme annulée
      (activity as any).isCancelled = true;
      (activity as any).cancelReason = reason;
      (activity as any).cancelDate = new Date();

      await activity.save();

      // Notifier le propriétaire
      const property = await Property.findById(activity.propertyId);

      if (property) {
        const propertyOwnerId = property.ownerId instanceof Types.ObjectId
          ? property.ownerId.toString()
          : String(property.ownerId);

        try {
          const notificationService = new IntegratedNotificationService(null as any);
          // Utiliser la méthode d'activité annulée ou créer une notification générique
          // Pour l'instant, on log juste car la méthode n'existe pas encore
          console.log('Activity cancelled notification:', {
            userId: propertyOwnerId,
            activityId: id,
            propertyId: String(property._id),
            reason
          });
        } catch (err) {
          console.error('Failed to send cancellation notification:', err);
        }
      }
      
      return activity;
    }
  },

  Activity: {
    property: async (activity: any) => {
      return await Property.findById(activity.propertyId);
    },

    client: async (activity: any) => {
      return await User.findById(activity.clientId);
    },

    uploadedFiles: (activity: any) => {
      return activity.uploadedFiles || [];
    },

    // Conversation liée à l'activité
    conversation: async (activity: any) => {
      const property = await Property.findById(activity.propertyId);
      if (!property) return null;
      
      return await Conversation.findOne({
        participants: { $all: [activity.clientId, property.ownerId] }
      });
    },
    
    // Messages liés à l'activité
    messages: async (activity: any) => {
      const property = await Property.findById(activity.propertyId);
      if (!property) return [];

      const conversation = await Conversation.findOne({
        participants: { $all: [activity.clientId, property.ownerId] }
      });

      if (!conversation) return [];

      return await Message.find({ conversationId: conversation._id })
        .populate('senderId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10);
    },

    // Transactions liées
    relatedTransactions: async (activity: any) => {
      return await Transaction.find({
        'metadata.activityId': activity._id.toString()
      }).sort({ createdAt: -1 });
    },

    // Statut global de l'activité
    status: (activity: any) => {
      if (activity.isCancelled) return 'CANCELLED';
      if (activity.isPayment) return 'COMPLETED';
      if (activity.isReservationAccepted || activity.isVisiteAcccepted) return 'ACCEPTED';
      if (activity.isReservation || activity.isVisited) return 'PENDING';
      return 'DRAFT';
    },
    
    // Type d'activité
    type: (activity: any) => {
      if (activity.isReservation) return 'RESERVATION';
      if (activity.isVisited) return 'VISIT';
      return 'INQUIRY';
    },

    // Durée depuis la création
    duration: (activity: any) => {
      const now = new Date();
      const created = new Date(activity.createdAt);
      return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)); // en jours
    },

    // Prochaine étape suggérée
    nextStep: async (activity: any) => {
      if (activity.isCancelled) return null;
      if (activity.isPayment) return 'COMPLETED';
      
      if (activity.isReservation && activity.isReservationAccepted && !activity.isPayment) {
        return 'PAYMENT_REQUIRED';
      }
      
      if (activity.isReservation && !activity.isReservationAccepted) {
        return 'AWAITING_RESERVATION_APPROVAL';
      }
      
      if (activity.isVisited && !activity.isVisiteAcccepted) {
        return 'AWAITING_VISIT_APPROVAL';
      }
      
      if (activity.isVisited && activity.isVisiteAcccepted) {
        return 'VISIT_SCHEDULED';
      }
      
      return 'AWAITING_RESPONSE';
    },
    
    // Score de priorité
    priorityScore: async (activity: any) => {
      let score = 0;

      // Plus récent = plus prioritaire
      const daysSinceCreation = Math.floor((Date.now() - activity.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      score += Math.max(0, 10 - daysSinceCreation);

      // Réservation = plus prioritaire que visite
      if (activity.isReservation) score += 5;
      if (activity.isVisited) score += 3;

      // Paiement en attente = très prioritaire
      if (activity.isReservationAccepted && !activity.isPayment) score += 8;

      return Math.min(10, score);
    }
  },

  // Subscriptions pour les mises à jour en temps réel
  Subscription: {
    activityUpdated: {
      subscribe: async function* (_: any, { propertyId, userId }: any, { user }: any) {
        if (!user) throw new Error('Authentication required');
        
        // Vérifier l'accès
        if (propertyId) {
          const property = await Property.findById(propertyId);
          const propertyOwnerId = property?.ownerId instanceof Types.ObjectId
            ? property.ownerId.toString()
            : String(property?.ownerId);

          if (!property || propertyOwnerId !== user.userId) {
            throw new Error('Access denied');
          }
        }

        if (userId && userId !== user.userId) {
          throw new Error('Access denied');
        }
        
        const activity = await Activity.findOne({ 
          $or: [
            { propertyId },
            { clientId: userId }
          ]
        }).sort({ createdAt: -1 });
        
        yield { activityUpdated: activity };
      }
    }
  },

  // Resolvers pour les types complexes
  ActivityStats: {
    totalActivities: (stats: any) => stats.totalActivities || 0,
    visitRequests: (stats: any) => stats.visitRequests || 0,
    reservationRequests: (stats: any) => stats.reservationRequests || 0,
    acceptedVisits: (stats: any) => stats.acceptedVisits || 0,
    acceptedReservations: (stats: any) => stats.acceptedReservations || 0,
    completedPayments: (stats: any) => stats.completedPayments || 0,
    acceptanceRate: (stats: any) => stats.acceptanceRate || 0,
    conversionRate: (stats: any) => stats.conversionRate || 0,
    averageResponseTime: (stats: any) => stats.averageResponseTime || 0
  }
};