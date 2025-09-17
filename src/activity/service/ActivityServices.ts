import Activity from "../model/activitySchema";
import { ActivityType } from "../types/activityType";
import { IntegratedNotificationService } from "../../notification/services/IntegratedNotificationService";
import Property from "../../property/model/propertyModel";
import mongoose from "mongoose";
import { createLogger } from "../../utils/logger/logger";
import { VisiteData } from "../types/activityType";
import { PropertyStatus } from "../../property/types/propertyType";
import ChatService from "../../chat/services/chatService";
import { Server as IOServer } from 'socket.io';
import { SendMessageParams } from "../../chat/types/chatTypes";
import { Types } from "mongoose";
import { ActivityData } from "../types/activityType";
import User from "../../users/models/userModel";
import { ActivityPayment } from "../types/activityType";
import { AcceptReservation } from "../types/activityType";
import { RefuseReservation } from "../types/activityType";
import Conversation from "../../chat/model/conversationModel";
import { ActivityValidator } from "../utils/validation";
import { ActivityOptimization } from "../utils/optimization";
import {
  ActivityError,
  ActivityNotFoundError,
  PropertyNotFoundError,
  PropertyNotAvailableError,
  UserNotFoundError,
  InvalidPaymentAmountError,
  DocumentsRequiredError,
  TransactionError,
  ConversationCreationError,
  NotificationError,
  isActivityError,
  logActivityError
} from "../utils/errors";

const logger = createLogger("ActivityLogger");

class ActivityServices {
  private notificationService: IntegratedNotificationService;
  private chatService: ChatService;

  constructor(io: IOServer) {
    this.notificationService = new IntegratedNotificationService(io);
    this.chatService = new ChatService(io);
  }

  async createVisite(visitData: VisiteData) {
    // Validation des données d'entrée
    ActivityValidator.validateVisitData(visitData);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { propertyId, visitDate, message, clientId } = visitData;

      // Vérification de la propriété avec gestion d'erreur spécifique
      const property = await Property.findById(propertyId).session(session);
      if (!property) {
        throw new PropertyNotFoundError(propertyId.toString());
      }

      if (property.status !== PropertyStatus.AVAILABLE) {
        throw new PropertyNotAvailableError(propertyId.toString(), property.status);
      }

      // Vérification de l'utilisateur avec gestion d'erreur spécifique
      const user = await User.findById(clientId).session(session);
      if (!user) {
        throw new UserNotFoundError(clientId?.toString() || 'unknown');
      }

      // Vérification que l'utilisateur ne demande pas une visite pour sa propre propriété
      if (property.ownerId.toString() === clientId?.toString()) {
        throw new ActivityError("Cannot create visit for your own property", 400, 'CANNOT_VISIT_OWN_PROPERTY');
      }

      // Vérification qu'il n'y a pas déjà une demande de visite en attente
      const existingVisit = await Activity.findOne({
        propertyId,
        clientId,
        isVisitAccepted: { $ne: false }, // Pas encore refusée
        $or: [
          { isVisitAccepted: { $exists: false } }, // En attente
          { isVisitAccepted: true } // Acceptée
        ]
      }).session(session);

      if (existingVisit) {
        throw new ActivityError("A visit request already exists for this property", 400, 'VISIT_REQUEST_EXISTS');
      }

      const now = visitDate ? new Date(visitDate) : new Date();
      const createVisite = new Activity({
        propertyId,
        visitDate: now,
        clientId,
        message,
        isVisited: false,
        isVisitAccepted: undefined // En attente
      });

      await createVisite.save({ session });

      // Gestion de la conversation
      let conversation = await Conversation.findOne({
        participants: { $all: [clientId, property.ownerId] }
      }).session(session);

      if (!conversation) {
        try {
          conversation = new Conversation({
            participants: [clientId, property.ownerId],
            type: 'property_discussion',
            propertyId: property._id
          });
          await conversation.save({ session });
        } catch (convError) {
          throw new ConversationCreationError([clientId?.toString() || '', property.ownerId.toString()], convError);
        }
      }

      // Notification pour demande de visite (avec gestion d'erreur)
      try {
        await this.notificationService.onVisitRequested(createVisite);
      } catch (notifError) {
        logger.warn("Failed to send visit notification", notifError);
        // On continue même si la notification échoue
      }

      // Envoi du message dans la conversation
      try {
        const messageParams: SendMessageParams = {
          conversationId: conversation._id.toString(),
          content: `🏠 Demande de visite pour "${property.title}"\n📅 Date souhaitée: ${now.toLocaleDateString()}\n💬 Message: ${message}\n\n👤 Demandé par ${user.firstName} ${user.lastName}`,
          messageType: 'text',
          userId: (clientId as mongoose.Types.ObjectId).toString(),
        };

        await this.chatService.sendMessage(messageParams);
      } catch (chatError) {
        logger.warn("Failed to send chat message", chatError);
        // On continue même si le chat échoue
      }

      await session.commitTransaction();
      session.endSession();

      logger.info("Visit created successfully", {
        activityId: createVisite._id,
        propertyId,
        clientId
      });

      return {
        success: true,
        data: createVisite,
        message: "Demande de visite créée avec succès",
        conversationId: conversation._id.toString(),
        propertyDetails: {
          title: property.title,
          location: property.location
        }
      };

    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      // Log spécifique pour les erreurs d'activité
      if (isActivityError(error)) {
        logger.error("Activity error during visit creation", logActivityError(error, { propertyId, clientId }));
      } else {
        logger.error("Unexpected error during visit creation", {
          error: error instanceof Error ? error.message : error,
          propertyId,
          clientId,
          stack: error instanceof Error ? error.stack : undefined
        });
      }

      throw error;
    }
  }

  async createReservation(activity: ActivityData) {
    const { activityId, reservationDate, uploadedFiles } = activity;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const activityDoc = await Activity.findById(activityId).session(session);
      if (!activityDoc) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no activity found");
        return;
      }

      const property = await Property.findById(activityDoc.propertyId).session(session);
      if (!property || property.status !== PropertyStatus.AVAILABLE) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("you can't make the reservation");
        return;
      }

      logger.info("tentative de reservation");
      let files: any = undefined;
      let isdocumentUpload = false;

      if (property.ownerCriteria?.isDocumentRequired) {
        files = uploadedFiles;
        if (files && files.length > 0) {
          isdocumentUpload = true;
        }
      }

      const reservation = await Activity.findByIdAndUpdate(
        activityId,
        {
          isReservation: true,
          clientId: activityDoc.clientId,
          propertyId: activityDoc.propertyId,
          documentsUploaded: isdocumentUpload,
          uploadedFiles: files,
          reservationDate: reservationDate ? new Date(reservationDate) : new Date()
        },
        { new: true, session }
      );

      // Notification pour demande de réservation
      await this.notificationService.onReservationRequested(reservation);

      if (!activityDoc.conversationId) {
        const newConversation = new Conversation({
          participants: [activityDoc.clientId, property.ownerId],
        });
        const savedConv = await newConversation.save({ session });
        await session.commitTransaction();
        session.endSession();
        return savedConv;
      }

      const user = await User.findById(activityDoc.clientId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no user found");
        return;
      }

      const messageParams: SendMessageParams = {
        conversationId: (activityDoc.conversationId as mongoose.Types.ObjectId).toString(),
        content: `Réservation demandée par ${user.firstName} ${user.lastName} pour la propriété ${property.title} le ${reservationDate ? new Date(reservationDate).toLocaleDateString() : new Date().toLocaleDateString()}`,
        messageType: 'text',
        userId: (activityDoc.clientId as mongoose.Types.ObjectId).toString(),
      };

      const chat = await this.chatService.sendMessage(messageParams);
      if (!chat) {
        logger.warn("no chat sent");
      }

      await session.commitTransaction();
      session.endSession();
      return reservation;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("error during the reservation", error);
      throw error;
    }
  }

  async acceptReservation(activity: AcceptReservation) {
    const session = await mongoose.startSession();
    session.startTransaction();
    const { activityId } = activity;

    try {
      const activityDoc = await Activity.findById(activityId).session(session);
      if (!activityDoc) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no activity found");
        return;
      }

      const reservation = await Activity.findByIdAndUpdate(
        activityId,
        {
          isReservationAccepted: true,
          acceptDate: new Date()
        },
        { new: true, session }
      );

      await Property.findByIdAndUpdate(
        activityDoc.propertyId,
        { status: PropertyStatus.RESERVED },
        { new: true, session }
      );

      // Notification pour acceptation de réservation
      await this.notificationService.onReservationResponseGiven(reservation, true);

      const property = await Property.findById(activityDoc.propertyId).session(session);
      if (!property) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no property found");
        return;
      }

      // use the accept date from reservation if available
      const acceptDate = reservation?.acceptDate ?? new Date();

      let convId = activityDoc.conversationId;
      if (!convId) {
        const newConversation = new Conversation({
          participants: [activityDoc.clientId, property.ownerId]
        });
        const savedConv = await newConversation.save({ session });
        convId = savedConv._id;
      }

      const messageParams: SendMessageParams = {
        conversationId: (convId as mongoose.Types.ObjectId).toString(),
        content: `Réservation acceptée pour la propriété ${property.title} le ${acceptDate.toLocaleDateString()} — vous pouvez continuer pour le paiement.`,
        messageType: 'text',
        userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
      };

      const chat = await this.chatService.sendMessage(messageParams);
      if (!chat) {
        logger.warn("no chat sent");
      }

      await session.commitTransaction();
      session.endSession();
      return reservation;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("error during the reservation", error);
      throw error;
    }
  }

  async refuseReservation(activity: RefuseReservation) {
    const session = await mongoose.startSession();
    session.startTransaction();
    const { activityId, reason } = activity;

    try {
      const activityDoc = await Activity.findById(activityId).session(session);
      if (!activityDoc) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no activity found");
        return;
      }

      const reservation = await Activity.findByIdAndUpdate(
        activityId,
        {
          isReservationAccepted: false,
          refusDate: new Date(),
          reason
        },
        { new: true, session }
      );

      await Property.findByIdAndUpdate(
        activityDoc.propertyId,
        { status: PropertyStatus.AVAILABLE },
        { new: true, session }
      );

      // Notification pour refus de réservation
      await this.notificationService.onReservationResponseGiven(reservation, false, reason);

      const property = await Property.findById(activityDoc.propertyId).session(session);
      if (!property) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no property found");
        return;
      }

      let convId = activityDoc.conversationId;
      if (!convId) {
        const newConversation = new Conversation({
          participants: [activityDoc.clientId, property.ownerId]
        });
        const savedConv = await newConversation.save({ session });
        convId = savedConv._id;
      }

      const messageParams: SendMessageParams = {
        conversationId: (convId as mongoose.Types.ObjectId).toString(),
        content: `Réservation refusée pour la propriété ${property.title}. La raison : ${reason}`,
        messageType: 'text',
        userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
      };

      const chat = await this.chatService.sendMessage(messageParams);
      if (!chat) {
        logger.warn("no chat sent");
      }

      await session.commitTransaction();
      session.endSession();
      return reservation;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("error during the reservation", error);
      throw error;
    }
  }

  async payReservation(activity: ActivityPayment) {
    const session = await mongoose.startSession();
    session.startTransaction();
    const { activityId, amount } = activity;
    const pdate = new Date();

    try {
      const activityDoc = await Activity.findById(activityId).session(session);
      if (!activityDoc) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no activity found");
        return;
      }

      const property = await Property.findById(activityDoc.propertyId).session(session);
      if (!property || property.status !== PropertyStatus.AVAILABLE) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no property found or not available");
        return;
      }

      if (amount !== property?.ownerCriteria.depositAmount) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("the amount is not correct");
        return;
      }

      const payement = await Activity.findByIdAndUpdate(
        activityId,
        {
          isPayment: true,
          amount,
          paymentDate: pdate,
        },
        { new: true, session }
      );

      const newStatus = property.actionType === "rent" ? PropertyStatus.RENTED : PropertyStatus.SOLD;
      await Property.findByIdAndUpdate(
        activityDoc.propertyId,
        { status: newStatus, acquiredBy: activityDoc.clientId },
        { new: true, session }
      );

      // Notification pour paiement effectué
      await this.notificationService.onPaymentCompleted(payement);

      // Gestion de la conversation et du chat
      let convId = activityDoc.conversationId;
      if (!convId) {
        const newConversation = new Conversation({
          participants: [activityDoc.clientId, property.ownerId]
        });
        const savedConv = await newConversation.save({ session });
        convId = savedConv._id;
      }

      const messageParams: SendMessageParams = {
        conversationId: (convId as mongoose.Types.ObjectId).toString(),
        content: `Paiement effectué pour la propriété ${property.title} le ${pdate.toLocaleDateString()}`,
        messageType: 'text',
        userId: (activityDoc.clientId as mongoose.Types.ObjectId).toString(),
      };

      const chat = await this.chatService.sendMessage(messageParams);
      if (!chat) {
        logger.warn("no chat sent");
      }

      await session.commitTransaction();
      session.endSession();
      return payement;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("error during the reservation", error);
      throw error;
    }
  }

  async acceptVisit(activityId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const activityDoc = await Activity.findById(activityId).session(session);
      if (!activityDoc) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no activity found");
        return;
      }
      const property = await Property.findById(activityDoc.propertyId).session(session);
      if (!property) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no property found");
        return;
      }
      const acceptVisit = await Activity.findByIdAndUpdate(
        activityId,
        {
          isVisitAccepted: true,
        },
        { new: true, session }
      );

      // Notification pour acceptation de visite
      await this.notificationService.onVisitResponseGiven(acceptVisit, true);

      let convId = activityDoc.conversationId;
      if (!convId) {
        const newConversation = new Conversation({
          participants: [activityDoc.clientId, property.ownerId]
        });
        const savedConv = await newConversation.save({ session });
        convId = savedConv._id;
      }

      const messageParams: SendMessageParams = {
        conversationId: (convId as mongoose.Types.ObjectId).toString(),
        content: `Visite acceptée pour la propriété ${property.title}`,
        messageType: 'text',
        userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
      };
      const chat = await this.chatService.sendMessage(messageParams);
      if (!chat) {
        logger.warn("no chat sent");
      }

      await session.commitTransaction();
      session.endSession();
      return acceptVisit;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("error during the reservation", error);
      throw error;
    }
  }

  async refusVisit(activityId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const activityDoc = await Activity.findById(activityId).session(session);
      if (!activityDoc) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no activity found");
        return;
      }
      const property = await Property.findById(activityDoc.propertyId).session(session);
      if (!property) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no property found");
        return;
      }
      const refusVisit = await Activity.findByIdAndUpdate(
        activityId,
        {
          isVisitAccepted: false,
        },
        { new: true, session }
      );

      // Notification pour refus de visite
      await this.notificationService.onVisitResponseGiven(refusVisit, false);

      let convId = activityDoc.conversationId;
      if (!convId) {
        const newConversation = new Conversation({
          participants: [activityDoc.clientId, property.ownerId]
        });
        const savedConv = await newConversation.save({ session });
        convId = savedConv._id;
      }

      const messageParams: SendMessageParams = {
        conversationId: (convId as mongoose.Types.ObjectId).toString(),
        content: `Visite refusée pour la propriété ${property.title}`,
        messageType: 'text',
        userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
      };
      const chat = await this.chatService.sendMessage(messageParams);
      if (!chat) {
        logger.warn("no chat sent");
      }

      await session.commitTransaction();
      session.endSession();
      return refusVisit;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("error during the reservation", error);
      throw error;
    }
  }

  async getUserActivities(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      cursor?: string;
      status?: 'pending' | 'accepted' | 'rejected' | 'completed';
      type?: 'visit' | 'reservation' | 'payment';
      dateRange?: { start: Date; end: Date };
      useCache?: boolean;
    } = {}
  ) {
    try {
      // Validation des paramètres
      ActivityValidator.validateObjectId(userId, 'userId');
      const { page: validPage, limit: validLimit } = ActivityValidator.validatePagination(
        options.page || 1,
        options.limit || 20
      );

      // Vérification du cache
      const cacheKey = `user_activities_${userId}_${JSON.stringify(options)}`;
      if (options.useCache !== false) {
        const cachedResult = ActivityOptimization.getCacheResult(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      // Utilisation de la pagination par cursor si disponible
      if (options.cursor) {
        const result = await ActivityOptimization.getCursorPaginatedActivities(
          { clientId: new Types.ObjectId(userId) },
          options.cursor,
          validLimit
        );

        const populatedActivities = await Activity.populate(result.activities, [
          { path: 'propertyId', select: 'title images location price ownerCriteria' },
          { path: 'conversationId', select: 'participants type' }
        ]);

        const finalResult = {
          activities: populatedActivities,
          hasNext: result.hasNext,
          nextCursor: result.nextCursor,
          total: null // Non disponible avec la pagination par cursor
        };

        // Mise en cache
        if (options.useCache !== false) {
          ActivityOptimization.setCacheResult(cacheKey, finalResult, 300); // 5 minutes
        }

        return finalResult;
      }

      // Pagination classique avec filtres avancés
      const pipeline = ActivityOptimization.buildOptimizedQuery({
        userId,
        status: options.status,
        type: options.type,
        dateRange: options.dateRange
      });

      // Ajout du lookup pour population
      pipeline.push(
        {
          $lookup: {
            from: 'properties',
            localField: 'propertyId',
            foreignField: '_id',
            as: 'propertyDetails'
          }
        },
        {
          $unwind: {
            path: '$propertyDetails',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'conversations',
            localField: 'conversationId',
            foreignField: '_id',
            as: 'conversationDetails'
          }
        },
        {
          $unwind: {
            path: '$conversationDetails',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $sort: { createdAt: -1 }
        }
      );

      // Pagination
      const skip = (validPage - 1) * validLimit;
      const paginatedPipeline = [
        ...pipeline,
        { $skip: skip },
        { $limit: validLimit }
      ];

      const [activities, totalCount] = await Promise.all([
        Activity.aggregate(paginatedPipeline),
        Activity.aggregate([...pipeline, { $count: 'total' }])
      ]);

      const total = totalCount[0]?.total || 0;

      const result = {
        activities,
        pagination: {
          page: validPage,
          limit: validLimit,
          total,
          pages: Math.ceil(total / validLimit),
          hasNext: validPage * validLimit < total,
          hasPrev: validPage > 1
        }
      };

      // Mise en cache
      if (options.useCache !== false) {
        ActivityOptimization.setCacheResult(cacheKey, result, 300); // 5 minutes
      }

      return result;

    } catch (error) {
      logger.error("Error getting user activities", {
        error: error instanceof Error ? error.message : error,
        userId,
        options
      });
      throw error;
    }
  }

  async getActivityById(activityId: string) {
    try {
      const activity = await Activity.findById(activityId)
        .populate('propertyId')
        .populate('clientId');

      return activity;
    } catch (error) {
      logger.error("error getting activity by id", error);
      throw error;
    }
  }

  async getOwnerActivities(ownerId: string, options: { page: number; limit: number }) {
    try {
      const { page, limit } = options;
      const skip = (page - 1) * limit;

      const properties = await Property.find({ ownerId }).select('_id');
      const propertyIds = properties.map(p => p._id);

      const activities = await Activity.find({ propertyId: { $in: propertyIds } })
        .populate('propertyId')
        .populate('clientId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Activity.countDocuments({ propertyId: { $in: propertyIds } });

      return {
        activities,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error("error getting owner activities", error);
      throw error;
    }
  }

  async processPayment(activityId: string, paymentData: ActivityPayment) {
    try {
      const result = await this.payReservation({ activityId, ...paymentData });
      return result;
    } catch (error) {
      logger.error("error processing payment", error);
      throw error;
    }
  }

  async acceptVisitRequest(activityId: string) {
    try {
      const result = await this.acceptVisit(activityId);
      return result;
    } catch (error) {
      logger.error("error accepting visit", error);
      throw error;
    }
  }

  async refuseVisitRequest(activityId: string) {
    try {
      const result = await this.refusVisit(activityId);
      return result;
    } catch (error) {
      logger.error("error refusing visit", error);
      throw error;
    }
  }
}

export default ActivityServices;
