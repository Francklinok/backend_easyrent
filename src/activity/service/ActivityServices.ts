import Activity from "../model/activitySchema";
import { ActivityType } from "../types/activityType";
import { NotificationService } from "../../services/notificationServices";
import Property from "../../property/model/propertyModel";
import mongoose from "mongoose";
import { createLogger } from "../../utils/logger/logger";
import { VisiteData } from "../types/activityType";
import { PropertyStatus } from "../../property/types/propertyType";
import ChatService from "../../chat/services/chatService";
import { Server as IOServer } from 'socket.io';
import { SendMessageParams } from "../../chat/types/chatTypes";
import { Types } from "mongoose";
import { AtivityData } from "../types/activityType";
import User from "../../users/models/userModel";
import { ActiviytyPayement } from "../types/activityType";
import { AccepteReservation } from "../types/activityType";
import { RefusReservation } from "../types/activityType";
import Conversation from "../../chat/model/conversationModel";

const logger = createLogger("ActivityLogger");

class ActivityServices {
  private Notification: NotificationService;
  private chatService: ChatService;

  constructor(io: IOServer) {
    this.Notification = new NotificationService();
    this.chatService = new ChatService(io);
  }

  async createVisite(visitData: VisiteData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { propertyId, visitDate, message, clientId } = visitData;
      const property = await Property.findById(propertyId).session(session);
      if (!property || property.status !== PropertyStatus.AVAILABLE) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no property available");
        return;
      }

      const now = visitDate ? new Date(visitDate) : new Date();
      const createVisite = new Activity({
        propertyId,
        visitDate: now,
        clientId,
        message,
      });

      await createVisite.save({ session });

      const user = await User.findById(clientId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no user found");
        return;
      }

      // Notification (en supposant que sendVisitNotification est async)
      const visiteNotifcation = await this.Notification.sendVisitNotification(property.ownerId, createVisite);
      if (!visiteNotifcation) {
        logger.warn("no notification sent");
      }

      // Trouver conversation existante (champ participants supposé)
      const conversation = await Conversation.findOne({ participants: { $all: [clientId, property.ownerId] } }).session(session);

      if (!conversation) {
        const newConversation = new Conversation({
          participants: [clientId, property.ownerId],
        });
        const savedConversation = await newConversation.save({ session });
        await session.commitTransaction();
        session.endSession();
        return savedConversation;
      }

      const messageParams: SendMessageParams = {
        conversationId: conversation._id.toString(),
        content: `Visite demandée par ${user.firstName} ${user.lastName} pour la propriété ${property.title} le ${now.toLocaleDateString()}`,
        messageType: 'text',
        userId: (clientId as mongoose.Types.ObjectId).toString(),
      };

      const chat = await this.chatService.sendMessage(messageParams);
      if (!chat) {
        logger.warn("no chat sent");
      }

      await session.commitTransaction();
      session.endSession();
      logger.info("visite created");

      const activityResult = {
        data: createVisite,
        message: "visite demandée",
        conversationId: conversation._id.toString(),
      };
      return activityResult;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("no activity created", error);
      throw error;
    }
  }

  async createReservation(activity: AtivityData) {
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

      const visiteNotifcation = await this.Notification.sendReservationNotification(reservation);
      if (!visiteNotifcation) {
        logger.warn("no notification sent");
      }

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

  async acceptReservation(activity: AccepteReservation) {
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

      const visiteNotifcation = await this.Notification.sendReservationAcceptedNotification(activityDoc.clientId);
      if (!visiteNotifcation) {
        logger.warn("no notification sent");
      }

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

  async refuseReservation(activity: RefusReservation) {
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

      const visiteNotifcation = await this.Notification.sendReservationRefusedNotification(activityDoc.clientId);
      if (!visiteNotifcation) {
        logger.warn("no notification sent");
      }

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

  async payReservation(activity: ActiviytyPayement) {
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
          payementDate: pdate,
        },
        { new: true, session }
      );

      const newStatus = property.actionType === "rent" ? PropertyStatus.RENTED : PropertyStatus.SOLD;
      await Property.findByIdAndUpdate(
        activityDoc.propertyId,
        { status: newStatus, acquiredBy: activityDoc.clientId },
        { new: true, session }
      );

      const sendPayementNotification = await this.Notification.sendPayementNotification(property.ownerId);
      const propertyAcquireNotification = await this.Notification.sendAcquireNotification(activityDoc.clientId);
      if (!sendPayementNotification && !propertyAcquireNotification) {
        logger.warn("no notification sent");
      }

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

      await this.Notification.sendVisiteAccpeted(activityDoc.clientId);

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

      await this.Notification.sendVisiteRejection(activityDoc.clientId);

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
}

export default ActivityServices;
