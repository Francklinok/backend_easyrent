import Activity from '../model/activitySchema';
import Property from '../../property/model/propertyModel';
import User from '../../users/models/userModel';
import { IntegratedNotificationService } from '../../notification/services/IntegratedNotificationService';
import { Transaction } from '../../wallet/models/Transaction';
import Conversation from '../../chat/model/conversationModel';
import Message from '../../chat/model/chatModel';
import ActivityServices from '../service/ActivityServices';
import { Types } from 'mongoose';
import { GraphQLError } from 'graphql';
import { ActivityError } from '../utils/errors';


export const activityResolvers = {

  Query: {
    getVisitRequest: async (_: any, { id, visitId, propertyId }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');

      // Backward compatibility: use visitId if id is not provided
      const activityId = id || visitId;

      console.log('[getVisitRequest] Called with:', { activityId, propertyId, userId: user.userId });

      if (!activityId && !propertyId) {
        throw new Error('Either id/visitId or propertyId is required');
      }

      let activity;

      if (activityId) {
        // Check if this is an offline ID (temporary ID that starts with visit_offline_)
        if (typeof activityId === 'string' && activityId.startsWith('visit_offline_')) {
          console.log('[getVisitRequest] Offline ID detected, searching by propertyId and userId');

          // For offline IDs, we need to find by propertyId and clientId
          // since the offline ID doesn't exist in the database yet
          if (!propertyId) {
            throw new Error('PropertyId is required for offline visit requests');
          }

          // Find the most recent visit request for this property and user
          // isVisited: false means it's a visit request (not yet completed)
          const query = {
            propertyId,
            clientId: user.userId
          };
          console.log('[getVisitRequest] Query:', query);

          activity = await Activity.findOne(query)
            .populate('propertyId')
            .populate('clientId', 'firstName lastName profilePicture email')
            .sort({ createdAt: -1 });

          console.log('[getVisitRequest] Activity found:', activity ? 'YES' : 'NO');
        } else {
          // Validate that it's a valid ObjectId before querying
          if (!Types.ObjectId.isValid(activityId)) {
            throw new Error('Invalid activity ID format');
          }

          console.log('[getVisitRequest] Valid ObjectId, searching by ID');
          // Find by activity ID (normal MongoDB ObjectId)
          activity = await Activity.findById(activityId)
            .populate('propertyId')
            .populate('clientId', 'firstName lastName profilePicture email');
        }
      } else if (propertyId) {
        console.log('[getVisitRequest] Searching by propertyId only');
        // Find by property ID (get latest visit request for the current user)
        activity = await Activity.findOne({
          propertyId,
          clientId: user.userId
        })
          .populate('propertyId')
          .populate('clientId', 'firstName lastName profilePicture email')
          .sort({ createdAt: -1 });
      }

      if (!activity) {
        console.log('[getVisitRequest] No activity found');
        // Instead of throwing an error, return null to indicate no visit found
        return null;
      }

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
              { isVisited: true, isVisiteAcepted: { $ne: true } },
              { isReservation: true, isReservationAccepted: { $ne: true } }
            ];
            break;
          case 'ACCEPTED':
            query.$or = [
              { isVisiteAccepted: true },
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

      // Validate that it's a valid ObjectId before querying
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid activity ID format');
      }

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
        Activity.countDocuments({ ...query, isVisitAccepted: true }),
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
    },

    // Récupérer l'historique complet des activités de l'utilisateur
    getUserActivities: async (_: any, { userId }: any, { user }: any) => {
      // Sécurité: Un utilisateur ne peut voir que ses propres activités
      if (!user) throw new Error('Authentication required');
      
      // Si userId est fourni, vérifier qu'il correspond à l'utilisateur connecté
      // Sinon utiliser l'ID de l'utilisateur connecté
      const targetUserId = userId || user.userId;
      
      if (userId && userId !== user.userId) {
         throw new Error('Access denied: You can only view your own activities');
      }

      console.log(`[Resolver] Fetching activities for user: ${targetUserId}`);
      const activityService = new ActivityServices(null as any);
      return await activityService.getUserProgressHistory(targetUserId);
    },

    // Obtenir la visite d'un utilisateur pour une propriété
    getUserVisitForProperty: async (_: any, { userId, propertyId }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');

      console.log('[getUserVisitForProperty] Called with:', { userId, propertyId });

      // ✅ IMPORTANT: Filtrer par isReservation: false pour retourner UNIQUEMENT les visites
      // Ne pas retourner les réservations (isReservation: true)
      const activity = await Activity.findOne({
        clientId: userId,
        propertyId: propertyId,
        isReservation: false  // ← FILTRE CRITIQUE: Uniquement les visites
      })
        .populate('propertyId')
        .populate('clientId', 'firstName lastName profilePicture email')
        .sort({ createdAt: -1 });

      console.log('[getUserVisitForProperty] Visit found:', activity ? 'YES' : 'NO');
      if (activity) {
        console.log('[getUserVisitForProperty] Visit details:', {
          id: activity._id,
          isReservation: activity.isReservation,
          isVisitAccepted: activity.isVisitAccepted,
          status: activity.status
        });
      }

      return activity;
    },

    // Vérifier la disponibilité d'un créneau de visite
    checkVisitTimeSlot: async (_: any, { propertyId, visitDate }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');
      
      // Vérifier s'il y a déjà une visite programmée à cette date
      const existingVisit = await Activity.findOne({
        propertyId: propertyId,
        visitDate: visitDate,
        isVisited: true,
        isVisitAccepted: true
      });
      
      // Retourner true si le créneau est disponible (pas de visite existante)
      return !existingVisit;
    }
  },

  Mutation: {
    createActivity: async (_: any, { input }: any, { user }: any) => {
      try {
        if (!user) throw new Error('Authentication required');

        // Debug logging
        console.log('[createActivity] Received input:', {
          propertyId: input.propertyId,
          isVisited: input.isVisited,
          message: input.message,
          userId: user.userId
        });

        // Validate propertyId
        if (!input.propertyId) {
          throw new Error('Property ID is required');
        }

        const activityService = new ActivityServices(null as any);

        if (input.isVisited) {
          const result = await activityService.createVisite({
            propertyId: new Types.ObjectId(input.propertyId),
            clientId: new Types.ObjectId(user.userId),
            message: input.message,
            visitDate: input.visitDate
          });
          return result.data;
        }

        if (input.isReservation) {
          // Verify property exists
          const property = await Property.findById(input.propertyId);
          if (!property) {
            throw new Error('Property not found');
          }

          // D'abord créer l'activité de base
          const activity = new Activity({
            propertyId: new Types.ObjectId(input.propertyId),
            clientId: new Types.ObjectId(user.userId),
            message: input.message,
            isReservation: true,
            reservationDate: input.reservationDate || new Date()
          });

          const savedActivity = await activity.save();

          const reservation = await activityService.createReservation({
            activityId: savedActivity._id as Types.ObjectId,
            reservationDate: input.reservationDate || new Date(),
            documentsUploaded: !!input.uploadedFiles && input.uploadedFiles.length > 0,
            uploadedFiles: input.uploadedFiles
          });

          if (!reservation) {
            throw new Error('Failed to create reservation');
          }

          return reservation;
        }

        // Verify property exists for general activity
        const property = await Property.findById(input.propertyId);
        if (!property) {
          throw new Error('Property not found');
        }

        // Activité générale
        const activity = new Activity({
          propertyId: new Types.ObjectId(input.propertyId),
          clientId: new Types.ObjectId(user.userId),
          message: input.message,
          isVisited: input.isVisited || false,
          visitDate: input.visitDate,
          isReservation: input.isReservation || false
        });

        return await activity.save();
      } catch (error) {
        // Gestion spécifique des erreurs d'activité
        if (error instanceof ActivityError) {
          throw new GraphQLError(error.message, {
            extensions: {
              code: error.code,
              statusCode: error.statusCode,
              context: error.context
            }
          });
        }
        throw error;
      }
    },

    createVisitRequest: async (_: any, { input }: any, { user }: any) => {
      try {
        if (!user) throw new Error('Authentication required');

        console.log('[createVisitRequest] Received input:', {
          propertyId: input.propertyId,
          message: input.message,
          visitDate: input.visitDate,
          userId: user.userId
        });

        // Validate propertyId
        if (!input.propertyId) {
          throw new Error('Property ID is required');
        }

        const activityService = new ActivityServices(null as any);

        const result = await activityService.createVisite({
          propertyId: new Types.ObjectId(input.propertyId),
          clientId: new Types.ObjectId(user.userId),
          message: input.message,
          visitDate: input.visitDate
        });

        return result.data;
      } catch (error) {
        // Gestion spécifique des erreurs d'activité
        if (error instanceof ActivityError) {
          throw new GraphQLError(error.message, {
            extensions: {
              code: error.code,
              statusCode: error.statusCode,
              context: error.context
            }
          });
        }
        throw error;
      }
    },

    createBooking: async (_: any, { input }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');

      console.log('[createBooking] Received input:', {
        propertyId: input.propertyId,
        message: input.message,
        reservationDate: input.reservationDate,
        userId: user.userId
      });

      // Validate propertyId
      if (!input.propertyId) {
        throw new Error('Property ID is required');
      }

      // Verify property exists
      const property = await Property.findById(input.propertyId);
      if (!property) {
        throw new Error('Property not found');
      }

      // Vérification que l'utilisateur ne réserve pas sa propre propriété
      if (property.ownerId.toString() === user.userId.toString()) {
        throw new Error('Cannot create booking for your own property');
      }

      const activityService = new ActivityServices(null as any);

      // ✅ NOUVELLE LOGIQUE: Chercher une visite existante
      console.log('[createBooking] Recherche d\'une visite existante...');
      const existingVisit = await Activity.findOne({
        propertyId: new Types.ObjectId(input.propertyId),
        clientId: new Types.ObjectId(user.userId),
        isReservation: false  // Chercher uniquement les visites
      });

      let activityToUpdate: any;

      if (existingVisit) {
        // ✅ VISITE TROUVÉE: Réutiliser l'activité existante
        console.log('[createBooking] ✅ Visite existante trouvée:', existingVisit._id);
        console.log('[createBooking] Mise à jour de la visite avec les données de réservation...');
        
        // Mettre à jour le message avec celui de la réservation
        existingVisit.message = input.message;
        await existingVisit.save();
        
        activityToUpdate = existingVisit;
      } else {
        // ❌ PAS DE VISITE: Créer une nouvelle activité
        console.log('[createBooking] ❌ Aucune visite trouvée - Création d\'une nouvelle activité');
        
        const activity = new Activity({
          propertyId: new Types.ObjectId(input.propertyId),
          clientId: new Types.ObjectId(user.userId),
          message: input.message,
          isReservation: false,  // Sera mis à true par createReservation
          reservationDate: input.reservationDate || new Date()
        });

        activityToUpdate = await activity.save();
      }

      // Appeler createReservation pour mettre à jour l'activité avec les données de réservation
      const reservation = await activityService.createReservation({
        activityId: activityToUpdate._id as Types.ObjectId,
        reservationDate: input.reservationDate || new Date(),
        documentsUploaded: !!input.uploadedFiles && input.uploadedFiles.length > 0,
        uploadedFiles: input.uploadedFiles
      });

      if (!reservation) {
        throw new Error('Failed to create reservation');
      }

      return reservation;
    },

    updateActivityStatus: async (_: any, { id, status, reason }: any, { user }: any) => {
      if (!user) throw new Error('Authentication required');

      // Validate that it's a valid ObjectId before querying
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid activity ID format');
      }

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

      // Validate that it's a valid ObjectId before querying
      if (!Types.ObjectId.isValid(activityId)) {
        throw new Error('Invalid activity ID format');
      }

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

      // Validate that it's a valid ObjectId before querying
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid activity ID format');
      }

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
    id: (activity: any) => activity._id.toString(),

    propertyId: (activity: any) => {
      // Ensure propertyId is never null
      return activity.propertyId ? activity.propertyId.toString() : null;
    },

    clientId: (activity: any) => {
      // If clientId is populated (object), return its _id, otherwise return the ID directly
      if (activity.clientId && typeof activity.clientId === 'object') {
        return activity.clientId._id ? activity.clientId._id.toString() : activity.clientId.toString();
      }
      return activity.clientId ? activity.clientId.toString() : null;
    },

    // Map GraphQL field isVisiteAccepted to MongoDB field isVisitAccepted
    isVisiteAccepted: (activity: any) => {
      return activity.isVisitAccepted !== undefined ? activity.isVisitAccepted : null;
    },

    property: async (activity: any) => {
      if (!activity.propertyId) return null;
      return await Property.findById(activity.propertyId);
    },

    client: async (activity: any) => {
      // If already populated, return it; otherwise fetch it
      if (activity.clientId && typeof activity.clientId === 'object' && activity.clientId._id) {
        return activity.clientId;
      }
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
      // Priority 1: Use status field from DB if it exists
      if (activity.status) return activity.status;

      // Priority 2: Calculate status from other fields (legacy support)
      if (activity.isCancelled) return 'CANCELLED';
      if (activity.isPayment) return 'COMPLETED';
      if (activity.isReservationAccepted || activity.isVisitAccepted === true) return 'ACCEPTED';
      if (activity.isVisitAccepted === false) return 'REFUSED';
      // isVisited: false means visit request is pending
      // isVisitAccepted: undefined/null means pending, true means accepted
      if (activity.isReservation || (activity.isVisited === false)) return 'PENDING';
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
      
      if (activity.isVisited && !activity.isVisiteAcepted) {
        return 'AWAITING_VISIT_APPROVAL';
      }
      
      if (activity.isVisited && activity.isVisiteAcepted) {
        return 'VISIT_SCHEDULED';
      }
      
      return 'AWAITING_RESPONSE';
    },

    // Champs de compatibilité
    visitTime: (activity: any) => activity.visitDate,
    visitType: (activity: any) => activity.isVisited ? 'VISIT' : null,
    rejectionReason: (activity: any) => activity.cancelReason,
    
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