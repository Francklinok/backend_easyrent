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
const logger = createLogger("ActivityLoger")

class ActivityServices{
    private Notification:NotificationService
    private chatService:ChatService
    constructor(io:IOServer){
        this.Notification = new NotificationService()
        this.chatService = new ChatService(io)
    }

    async createVisite(visitData:VisiteData){
        const session = await mongoose.startSession()
        session.startTransaction()
        try{
            const {propertyId, visitDate, clientId} = visitData
            const  property = await Property.findById(propertyId)
            if(!property || property.status !== PropertyStatus.AVAILABLE){
                session.abortTransaction()
                session.endSession()
                logger.warn("no property available")
                return 
            }
            const  createVisite = new Activity(visitData)
            if(!createVisite){
                session.abortTransaction()
                session.endSession()
                logger.warn("no visite created")
            }
            await  createVisite.save()
            const user = await User.findById(clientId)
            if(!user){
                logger.warn("no user found")
                return
            }
            const  visiteNotifcation = this.Notification.sendVisitNotification(visitData)
            if(!visiteNotifcation){
                logger.warn("no notification sent")
            }
            const conversation = await Conversation.findOne( 
                 { $all: [clientId, property.ownerId] })

            if(!conversation){
                const newConversation = new Conversation({
                    participants: [clientId, property.ownerId]
                })
                const ConversationId = await newConversation.save()
                return ConversationId
            }
            const messageParams: SendMessageParams = {
                conversationId:conversation._id.toString(),
                content: `Visite demandée par  ${user.firstName} ${user.lastName}   pour la propriété ${property.title} le ${visitDate.toLocaleDateString()}`,
                messageType: 'text',
                userId: (clientId as mongoose.Types.ObjectId).toString(),
                };
            const chat = await this.chatService.sendMessage(messageParams)
            if(!chat){
                logger.warn("no chat sent")
            }
            session.commitTransaction()
            session.endSession()
            logger.info("visite created")

            const activityResult = {
                data:createVisite,
                message:"visite created",
                conversationId:conversation._id.toString(),
            }
            return activityResult
        }catch(error){
            session.abortTransaction()
            session.endSession()
            logger.error("no activity  created", error)
        }

    }

    async createReservation(activity:AtivityData){
        const {clientId, activityId, visitDate,propertyId, conversationId, reservationDate} = activity

        const session = await mongoose.startSession()
        session.startTransaction()
        try{
            const property = await Property.findById(propertyId)
            if(!property || property.status !== PropertyStatus.AVAILABLE){
                session.abortTransaction()
                session.endSession()
                logger.warn("you  can't  make  the reservation")
                return 
            }
            logger.info("tentative de reservation")
            const activity = await Activity.findById(activityId)
            if(!activity){
                session.abortTransaction()
                session.endSession()
                logger.warn("no activity found")
                return 
            }
            const reservation = await Activity.findByIdAndUpdate(
                activityId, 
                {
                    isReservation:true,
                    visitDate:activity.visitDate,
                    clientId:activity.clientId,
                    propertyId:activity.propertyId,
                    isVisited:activity.isVisited,
                    isVisiteAcccepted:activity.isVisiteAcccepted

                }, 
                {new:true})

                const  visiteNotifcation = this.Notification.sendReservationNotification()
                if(!visiteNotifcation){
                    logger.warn("no notification sent")
                }
                
                if(!conversationId){
                    const newConversation = new Conversation({
                        participants: [clientId, property.ownerId]
                    })
                    const conversationId = await newConversation.save()
                    return conversationId
                }
                  const user = await User.findById(clientId)
                    if(!user){
                        logger.warn("no user found")
                        return
                    }
                const messageParams: SendMessageParams = {
                    conversationId:(conversationId as  mongoose.Types.ObjectId).toString(),
                    content: `reservation demandée par ${user.firstName} ${user.lastName}  pour  la propriété ${property.title} le ${reservationDate.toLocaleDateString()}`,
                    messageType: 'text',
                    userId: (clientId as mongoose.Types.ObjectId).toString(),
                    };
                const chat = await this.chatService.sendMessage(messageParams)
                if(!chat){
                    logger.warn("no chat sent")
                }
                session.commitTransaction()
                session.endSession()
                return reservation

        }catch(error){
            await session.abortTransaction()
            session.endSession()
            logger.error("error during the reservation",error)
            throw error
        }
    }

}
export  default ActivityServices