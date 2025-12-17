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
import ActivityNotificationService from "./ActivityNotificationService";

const logger = createLogger("ActivityLogger");

class ActivityServices {
  private notificationService: IntegratedNotificationService;
  private chatService: ChatService;
  private activityNotificationService: ActivityNotificationService;
  private io: IOServer;

  constructor(io: IOServer) {
    this.io = io;
    this.notificationService = new IntegratedNotificationService(io);
    this.activityNotificationService = new ActivityNotificationService(io);
    // Initialiser chatService à null, sera initialisé plus tard si nécessaire
    this.chatService = null as any;
  }

  private async getChatService() {
    if (!this.chatService) {
      const { getChatService } = await import('../../chat/services/chatServiceInstance');
      this.chatService = getChatService();
    }
    return this.chatService;
  }

  async createVisite(visitData: VisiteData) {
    // Validation des données d'entrée
    ActivityValidator.validateVisitData(visitData);

    const session = await mongoose.startSession();
    session.startTransaction();
    const { propertyId, visitDate, message, clientId } = visitData;


    try {

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

      // Vérification qu'il n'y a pas déjà une demande de visite en attente ou acceptée
      const existingVisit = await Activity.findOne({
        propertyId,
        clientId,
        isVisited: false, // C'est une demande de visite
        $or: [
          { isVisitAccepted: { $exists: false } }, // En attente
          { isVisitAccepted: null }, // En attente (null)
          { isVisitAccepted: true } // Acceptée
        ]
      }).session(session);

      if (existingVisit) {
        const status = existingVisit.isVisitAccepted === true ? 'acceptée' : 'en attente';
        throw new ActivityError(
          `Vous avez déjà une demande de visite ${status} pour cette propriété`,
          400,
          'VISIT_REQUEST_EXISTS'
        );
      }

      const now = visitDate ? new Date(visitDate) : new Date();
      const createVisite = new Activity({
        propertyId,
        visitDate: now,
        clientId,
        message,
        isVisited: false,
        isVisitAccepted: null
      });

      await createVisite.save({ session });

      // Utiliser le ChatService pour créer ou récupérer la conversation (OBLIGATOIRE)
      let conversation;
      try {
        logger.info("Creating conversation for visit request", {
          userId: clientId?.toString(),
          participantId: property.ownerId.toString(),
          propertyId: property._id.toString()
        });

        // Obtenir l'instance du chat service
        const chatService = await this.getChatService();

        conversation = await chatService.createOrGetConversation({
          userId: clientId?.toString() || '',
          participantId: property.ownerId.toString(),
          type: 'property_discussion',
          propertyId: property._id.toString()
        });

        logger.info("Conversation created successfully", {
          conversationId: conversation._id.toString()
        });
      } catch (convError) {
        logger.error("CRITICAL: Failed to create conversation - rolling back visit creation", convError);
        // Rollback transaction
        await session.abortTransaction();
        session.endSession();
        throw new ConversationCreationError([clientId?.toString() || '', property.ownerId.toString()], convError);
      }

      // Notifications automatiques pour demande de visite (OBLIGATOIRE)
      try {
        logger.info("Sending visit request notifications");
        await this.activityNotificationService.sendVisitRequestNotifications(createVisite, property, user);
        logger.info("Visit notifications sent successfully");
      } catch (notifError) {
        logger.error("CRITICAL: Failed to send visit notifications - rolling back visit creation", notifError);
        // Rollback transaction
        await session.abortTransaction();
        session.endSession();
        throw new ActivityError(
          "Failed to send visit request notifications",
          500,
          'NOTIFICATION_SEND_FAILED',
          { propertyId: property._id.toString(), clientId: clientId?.toString() }
        );
      }

      // Envoi du message dans la conversation
      if (conversation) {
        try {
          const messageParams: SendMessageParams = {
            conversationId: conversation._id.toString(),
            content: `📋 **DEMANDE DE VISITE**\n\n🏠 **Propriété:** ${property.title}\n📍 **Adresse:** ${property.address || 'Non spécifiée'}\n📅 **Date souhaitée:** ${now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n⏰ **Heure:** ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\n\n💬 **Message du visiteur:**\n"${message}"\n\n👤 **Demandeur:** ${user.firstName} ${user.lastName}\n📧 **Contact:** ${user.email}\n\n---\n⚡ **Actions rapides:**\n✅ Tapez "ACCEPTER" pour accepter cette visite\n❌ Tapez "REFUSER" pour décliner cette visite`,
            messageType: 'visit_request',
            userId: (clientId as mongoose.Types.ObjectId).toString(),
            metadata: {
              activityId: createVisite._id.toString(),
              actionType: 'visit_request',
              propertyId: property._id.toString(),
              visitDate: now.toISOString()
            },
            visitData: {
              id: createVisite._id.toString(),
              date: now,
              time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              status: 'pending'
            },
            propertyData: {
              id: property._id.toString(),
              title: property.title,
              address: property.address
            }
          };

          const chatService = await this.getChatService();
          const sentMessage = await chatService.sendMessage(messageParams);
          logger.info('✅ Message de demande de visite envoyé:', {
            messageId: sentMessage?._id,
            conversationId: conversation._id.toString(),
            messageType: messageParams.messageType,
            activityId: createVisite._id.toString(),
            hasMetadata: !!messageParams.metadata
          });
        } catch (chatError) {
          logger.warn("Failed to send chat message", chatError);
          // On continue même si le chat échoue
        }
      } else {
        logger.warn("Skipping chat message - conversation not available");
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
          location: property.address
        }
      };

    } catch (error) {
      // Vérifier si la transaction est toujours active avant de l'annuler
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
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
        throw new Error("Activity not found");
      }

      const property = await Property.findById(activityDoc.propertyId).session(session);
      if (!property || property.status !== PropertyStatus.AVAILABLE) {
        throw new Error("Property not available for reservation");
      }

      // Vérification que l'utilisateur ne réserve pas sa propre propriété
      if (property.ownerId.toString() === activityDoc.clientId?.toString()) {
        throw new ActivityError("Cannot create reservation for your own property", 400, 'CANNOT_RESERVE_OWN_PROPERTY');
      }

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
          documentsUploaded: isdocumentUpload,
          uploadedFiles: files,
          reservationDate: reservationDate ? new Date(reservationDate) : new Date(),
          reservationStatus: 'PENDING'
        },
        { new: true, session }
      );

      if (!reservation) {
        throw new Error("Failed to update activity");
      }

      // Utiliser le ChatService pour créer ou récupérer la conversation
      const chatService = await this.getChatService();
      const conversation = await chatService.createOrGetConversation({
        userId: activityDoc.clientId.toString(),
        participantId: property.ownerId.toString(),
        type: 'property_discussion',
        propertyId: property._id.toString()
      });

      // Notifications automatiques pour demande de réservation
      try {
        const user = await User.findById(activityDoc.clientId).session(session);
        if (user) {
          await this.activityNotificationService.sendReservationRequestNotifications(reservation, property, user);
        }
      } catch (notifError) {
        logger.warn("Failed to send reservation notifications", notifError);
      }

      // Send chat message with the formatted booking request message
      try {
        const user = await User.findById(activityDoc.clientId).session(session);
        if (user && activityDoc.message) {
          const messageParams: SendMessageParams = {
            conversationId: conversation._id.toString(),
            content: activityDoc.message, // Use the formatted message from the activity
            messageType: 'reservation_request',
            userId: activityDoc.clientId.toString(),
            metadata: {
              activityId: reservation._id.toString(),
              actionType: 'reservation_request',
              propertyId: property._id.toString(),
              reservationDate: reservation.reservationDate?.toISOString()
            }
          };
          const chatService = await this.getChatService();
          const sentMessage = await chatService.sendMessage(messageParams);
          logger.info('✅ Message de réservation envoyé:', {
            messageId: sentMessage?._id,
            conversationId: conversation._id.toString(),
            messageType: messageParams.messageType,
            activityId: reservation._id.toString()
          });
        }
      } catch (chatError) {
        logger.warn("Failed to send chat message", chatError);
      }

      await session.commitTransaction();
      session.endSession();
      return reservation;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error("Error during reservation creation", error);
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
          acceptDate: new Date(),
          reservationStatus: 'ACCEPTED'
        },
        { new: true, session }
      );

      await Property.findByIdAndUpdate(
        activityDoc.propertyId,
        { status: PropertyStatus.RESERVED },
        { new: true, session }
      );

      // Notifications automatiques pour acceptation de réservation
      await this.activityNotificationService.sendReservationResponseNotifications(reservation, true);

      const property = await Property.findById(activityDoc.propertyId).session(session);
      if (!property) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no property found");
        return;
      }

      // use the accept date from reservation if available
      const acceptDate = reservation?.acceptedDate ?? new Date();

      // Utiliser le ChatService pour créer ou récupérer la conversation
      const chatService = await this.getChatService();
      const conversation = await chatService.createOrGetConversation({
        userId: activityDoc.clientId.toString(),
        participantId: property.ownerId.toString(),
        type: 'property_discussion',
        propertyId: property._id.toString()
      });

      const messageParams: SendMessageParams = {
        conversationId: conversation._id.toString(),
        content: `✅ **RÉSERVATION ACCEPTÉE**\n\n🏠 **Propriété:** ${property.title}\n📅 **Date d'acceptation:** ${acceptDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n💳 **Prochaine étape:** Vous pouvez maintenant procéder au paiement pour finaliser votre réservation.\n\n---\n⚡ Le propriétaire a accepté votre demande !`,
        messageType: 'reservation_response',
        userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
        metadata: {
          activityId: reservation._id.toString(),
          actionType: 'reservation_accepted',
          propertyId: property._id.toString(),
          accepted: true,
          acceptDate: acceptDate.toISOString()
        }
      };

      const chat = await chatService.sendMessage(messageParams);
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
          visiteStatus: 'REFUSED',
          reason
        },
        { new: true, session }
      );

      await Property.findByIdAndUpdate(
        activityDoc.propertyId,
        { status: PropertyStatus.AVAILABLE },
        { new: true, session }
      );

      // Notifications automatiques pour refus de réservation
      await this.activityNotificationService.sendReservationResponseNotifications(reservation, false, reason);

      const property = await Property.findById(activityDoc.propertyId).session(session);
      if (!property) {
        await session.abortTransaction();
        session.endSession();
        logger.warn("no property found");
        return;
      }

      // Utiliser le ChatService pour créer ou récupérer la conversation
      const chatService = await this.getChatService();
      const conversation = await chatService.createOrGetConversation({
        userId: activityDoc.clientId.toString(),
        participantId: property.ownerId.toString(),
        type: 'property_discussion',
        propertyId: property._id.toString()
      });

      const messageParams: SendMessageParams = {
        conversationId: conversation._id.toString(),
        content: `❌ **RÉSERVATION REFUSÉE**\n\n🏠 **Propriété:** ${property.title}\n📝 **Raison:** ${reason || 'Non spécifiée'}\n\nNous sommes désolés, le propriétaire a refusé votre demande de réservation.\n\n---\n💡 Vous pouvez rechercher d'autres propriétés similaires.`,
        messageType: 'reservation_response',
        userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
        metadata: {
          activityId: reservation._id.toString(),
          actionType: 'reservation_rejected',
          propertyId: property._id.toString(),
          accepted: false,
          rejectionReason: reason
        }
      };

      const chat = await chatService.sendMessage(messageParams);
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
          payementStatus: 'COMPLETED',
        },
        { new: true, session }
      );

      const newStatus = property.actionType === "rent" ? PropertyStatus.RENTED : PropertyStatus.SOLD;
      await Property.findByIdAndUpdate(
        activityDoc.propertyId,
        { status: newStatus, acquiredBy: activityDoc.clientId },
        { new: true, session }
      );

      // Notifications automatiques pour paiement effectué
      await this.activityNotificationService.sendPaymentNotifications(payement);

      // Utiliser le ChatService pour créer ou récupérer la conversation
      const chatService = await this.getChatService();
      const conversation = await chatService.createOrGetConversation({
        userId: activityDoc.clientId.toString(),
        participantId: property.ownerId.toString(),
        type: 'property_discussion',
        propertyId: property._id.toString()
      });

      const messageParams: SendMessageParams = {
        conversationId: conversation._id.toString(),
        content: `Paiement effectué pour la propriété ${property.title} le ${pdate.toLocaleDateString()}`,
        messageType: 'text',
        userId: (activityDoc.clientId as mongoose.Types.ObjectId).toString(),
      };

      const chat = await chatService.sendMessage(messageParams);
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
      logger.info('🔵 Avant mise à jour - acceptVisit', {
        activityId,
        currentStatus: activityDoc.visiteStatus,
        currentIsVisitAccepted: activityDoc.isVisitAccepted
      });

      const acceptVisit = await Activity.findByIdAndUpdate(
        activityId,
        {
          isVisitAccepted: true,
          visiteStatus: 'ACCEPTED'
        },
        { new: true, session }
      );

      logger.info('✅ Après mise à jour - acceptVisit', {
        activityId: acceptVisit._id.toString(),
        newStatus: acceptVisit.visiteStatus,
        newIsVisitAccepted: acceptVisit.isVisitAccepted,
        // updatedAt: acceptVisit.updatedAt
      });

      // Notifications automatiques pour acceptation de visite
      await this.activityNotificationService.sendVisitResponseNotifications(acceptVisit, true);

      // Émettre événement WebSocket pour mise à jour temps réel
      if (this.io) {
        this.io.to(`user_${activityDoc.clientId.toString()}`).emit('visit:updated', {
          visitId: acceptVisit._id.toString(),
          activityId: acceptVisit._id.toString(),
          visiteStatus: 'accepted',
          isVisitAccepted: true,
          propertyId: property._id.toString(),
          propertyTitle: property.title,
          timestamp: new Date().toISOString()
        });
        logger.info('✅ Événement WebSocket émis: visit:updated (accepted)', {
          clientId: activityDoc.clientId.toString(),
          visitId: acceptVisit._id.toString()
        });
      }

      // Utiliser le ChatService pour créer ou récupérer la conversation
      const chatService = await this.getChatService();
      const conversation = await chatService.createOrGetConversation({
        userId: activityDoc.clientId.toString(),
        participantId: property.ownerId.toString(),
        type: 'property_discussion',
        propertyId: property._id.toString()
      });

      const messageParams: SendMessageParams = {
        conversationId: conversation._id.toString(),
        content: `✅ **VISITE ACCEPTÉE**\n\n🏠 **Propriété:** ${property.title}\n📅 **Date de la visite:** ${acceptVisit.visitDate ? new Date(acceptVisit.visitDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'À confirmer'}\n\n🎉 **Félicitations !** Le propriétaire a accepté votre demande de visite.\n\n---\n💡 Vous pouvez maintenant faire une réservation après la visite.`,
        messageType: 'visit_response',
        userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
        metadata: {
          activityId: acceptVisit._id.toString(),
          actionType: 'visit_accepted',
          propertyId: property._id.toString(),
          accepted: true,
          visitDate: acceptVisit.visitDate?.toISOString()
        }
      };
      const chat = await chatService.sendMessage(messageParams);
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

  async refusVisit(activityId: string, rejectionReason?: string) {
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
          visiteStatus: 'REFUSED',
          ...(rejectionReason && { rejectionReason }) // Ajouter la raison si fournie
        },
        { new: true, session }
      );

      // Notifications automatiques pour refus de visite
      await this.activityNotificationService.sendVisitResponseNotifications(refusVisit, false);

      // Émettre événement WebSocket pour mise à jour temps réel
      if (this.io) {
        this.io.to(`user_${activityDoc.clientId.toString()}`).emit('visit:updated', {
          visitId: refusVisit._id.toString(),
          activityId: refusVisit._id.toString(),
          status: 'rejected',
          isVisitAccepted: false,
          rejectionReason: rejectionReason || undefined,
          propertyId: property._id.toString(),
          propertyTitle: property.title,
          timestamp: new Date().toISOString()
        });
        logger.info('❌ Événement WebSocket émis: visit:updated (rejected)', {
          clientId: activityDoc.clientId.toString(),
          visitId: refusVisit._id.toString(),
          reason: rejectionReason
        });
      }

      // Utiliser le ChatService pour créer ou récupérer la conversation
      const chatService = await this.getChatService();
      const conversation = await chatService.createOrGetConversation({
        userId: activityDoc.clientId.toString(),
        participantId: property.ownerId.toString(),
        type: 'property_discussion',
        propertyId: property._id.toString()
      });

      const messageParams: SendMessageParams = {
        conversationId: conversation._id.toString(),
        content: `❌ **VISITE REFUSÉE**\n\n🏠 **Propriété:** ${property.title}\n📝 **Raison:** ${rejectionReason || 'Non spécifiée'}\n\nNous sommes désolés, le propriétaire a refusé votre demande de visite.\n\n---\n💡 Vous pouvez rechercher d'autres propriétés similaires.`,
        messageType: 'visit_response',
        userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
        metadata: {
          activityId: refusVisit._id.toString(),
          actionType: 'visit_rejected',
          propertyId: property._id.toString(),
          accepted: false,
          rejectionReason: rejectionReason
        }
      };
      const chat = await chatService.sendMessage(messageParams);
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
      visiteStatus?: 'pending' | 'accepted' | 'rejected' | 'completed';
      reservationStatus?: 'pending' | 'accepted' | 'rejected' | 'completed';
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
        visiteStatus: options.visiteStatus ,
        reservationStatus:options.reservationStatus,
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

  async getUserVisitForProperty(userId: string, propertyId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new UserNotFoundError(userId);
      }
      if (!Types.ObjectId.isValid(propertyId)) {
        throw new PropertyNotFoundError(propertyId);
      }

      const activity = await Activity.findOne({
        clientId: new Types.ObjectId(userId),
        propertyId: new Types.ObjectId(propertyId)
        // Suppression du filtre isReservation: false pour trouver toutes les activités
      })
      .populate('propertyId')
      .populate('clientId', 'firstName lastName profilePicture email')
      .sort({ createdAt: -1 });
      
      if (!activity) {
        return null;
      }

      console.log('[getUserVisitForProperty] Visit details:', {
        id: activity._id,
        isReservation: activity.isReservation,
        isVisitAccepted: activity.isVisitAccepted,
        visiteStatus: activity.visiteStatus,
        reservationStatus: activity.reservationStatus
      });

      return activity;
    } catch (error) {
      logger.error("Error getting user visit for property", {
        error: error instanceof Error ? error.message : error,
        userId,
        propertyId
      });
      throw error;
    }
  }

  async  getPropertyActivity(propertyId:string){
    if(!propertyId || !Types.ObjectId.isValid(propertyId))
    {
      logger.warn("Invalid property ID provided to getPropertyActivity", {propertyId});
      return null
    }
    //search  the  activity
    const  activity = await Activity.findOne({propertyId:new Types.ObjectId(propertyId)})
    if(!activity){
      logger.info("No activity found for the given property ID", {propertyId});
      return null
    }
    return activity
  }


  async getVisitRequestStatus(visitId: string, propertyId: string) {
    try {
      if (!Types.ObjectId.isValid(visitId)) {
        throw new Error('Invalid visit ID format');
      }

      const activity = await Activity.findById(visitId);
      if (!activity) {
        return null;
      }

      // Déterminer le statut basé sur les champs de l'activité
      let status = 'pending';
      
      if (activity.visiteStatus) {
        const activityStatus = activity.visiteStatus.toLowerCase();
        if (activityStatus === 'accepted' || activityStatus === 'confirmed') {
          status = 'accepted';
        } else if (activityStatus === 'refused' || activityStatus === 'rejected') {
          status = 'rejected';
        }
      } else {
        // Fallback sur les champs booléens
        if (activity.isVisitAccepted === true) {
          status = 'accepted';
        } else if (activity.isVisitAccepted === false) {
          status = 'rejected';
        }
      }

      return {
        status,
        rejectionReason: activity.rejectionReason || null,
        visitDate: activity.visitDate,
        message: activity.message
      };
    } catch (error) {
      logger.error("Error getting visit request status", {
        error: error instanceof Error ? error.message : error,
        visitId,
        propertyId
      });
      throw error;
    }
  }


  async getOwnerVisitRequests(ownerId: string) {
    try {
      // Get all properties owned by this owner
      const properties = await Property.find({ ownerId }).select('_id title');
      const propertyIds = properties.map(p => p._id);

      // Get all visit requests for these properties
      const visits = await Activity.find({
        propertyId: { $in: propertyIds },
        isVisited: false // C'est une demande de visite
      })
        .populate('propertyId', 'title address images')
        .populate('clientId', 'firstName lastName email fullName')
        .sort({ createdAt: -1 });

      return visits;
    } catch (error) {
      logger.error("error getting owner visit requests", error);
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

  async processPayment( paymentData: ActivityPayment) {
    try {
      const result = await this.payReservation(paymentData );
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

  async refuseVisitRequest(activityId: string, rejectionReason?: string) {
    try {
      const result = await this.refusVisit(activityId, rejectionReason);
      return result;
    } catch (error) {
      logger.error("error refusing visit", error);
      throw error;
    }
  }
  async getUserProgressHistory(userId: string) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        throw new UserNotFoundError(userId);
      }

      // Récupérer toutes les activités de l'utilisateur
      const activities = await Activity.find({
        clientId: new Types.ObjectId(userId)
      })
      .sort({ updatedAt: -1 })
      .populate('propertyId');

      // Grouper par propriété pour consolider l'historique
      return activities.map(activityDoc => {
        // Cast to any to access properties that might be missing in the interface but present in Mongoose doc
        const activity = activityDoc as any;
        const property = activity.propertyId;
        
        // Déterminer les statuts
        let visitStatus = 'none';
        
        // Logique de statut de visite
        if (activity.status) {
           const status = activity.status.toLowerCase();
           if (status === 'accepted' || status === 'confirmed') visitStatus = 'accepted';
           else if (status === 'refused' || status === 'rejected' || status === 'cancelled') visitStatus = 'rejected';
           else if (status === 'pending') visitStatus = 'pending';
        }
        
        // Fallback sur les booléens si le statut texte n'est pas clair ou est PENDING
        // Note: isVisitAccepted est le champ correct selon le schéma (pas isVisiteAccepted)
        if (visitStatus === 'none' || visitStatus === 'pending') {
            if (activity.isVisitAccepted === true) visitStatus = 'accepted';
            else if (activity.isVisitAccepted === false) visitStatus = 'rejected';
            else if (activity.isVisited === false && activity.isVisitAccepted === null) visitStatus = 'pending';
        }

        let reservationStatus = 'none';
        if (activity.isReservation) {
          if (activity.isReservationAccepted === true) reservationStatus = 'accepted';
          else if (activity.isReservationAccepted === false) reservationStatus = 'rejected';
          else reservationStatus = 'pending';
        }

        let paymentStatus = 'none';
        // Utiliser isPayment (from schema) qui indique si le paiement a été effectué
        if (activity.isPayment === true) {
          paymentStatus = 'completed';
        }

        return {
          id: activity._id,
          propertyId: property?._id,
          propertyTitle: property?.title,
          propertyImage: property?.images?.[0], 
          visitStatus,
          visitId: activity._id,
          reservationStatus,
          reservationId: activity._id,
          paymentStatus,
          paymentId: activity._id,
          updatedAt: activity.updatedAt || activity.createdAt
        };
      });

    } catch (error) {
      logger.error(`Error fetching user activities: ${error}`);
      throw error;
    }
  }
}

export default ActivityServices;
