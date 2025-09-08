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
            const {propertyId, visitDate,message, clientId} = visitData
            const  property = await Property.findById(propertyId)
            if(!property || property.status !== PropertyStatus.AVAILABLE){
                session.abortTransaction()
                session.endSession()
                logger.warn("no property available")
                return 
            }
            const createVisite = new Activity({
                propertyId,
                visitDate:new Date,
                clientId,                
                message,
            })
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
            const  visiteNotifcation = this.Notification.sendVisitNotification(property.ownerId, createVisite)
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
                message:"visite demander",
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
        const {activityId,reservationDate, uploadedFiles} = activity

        const session = await mongoose.startSession()
        session.startTransaction()
        try{
             const activityDoc = await Activity.findById(activityId)
            if(!activityDoc){
                session.abortTransaction()
                session.endSession()
                logger.warn("no activity found")
                return 
            }

            const property = await Property.findById(activityDoc?.propertyId)
            if(!property || property.status !== PropertyStatus.AVAILABLE){
                session.abortTransaction()
                session.endSession()
                logger.warn("you  can't  make  the reservation")
                return 
            }
            logger.info("tentative de reservation")
            let files;
            let isdocumentUpload;

            if(property.ownerCriteria.isDocumentRequired){
                files == uploadedFiles ;
                if(files){
                    isdocumentUpload = true
                }
            }

            const reservation = await Activity.findByIdAndUpdate(
                activityId, 
                {
                    isReservation:true,
                    clientId:activityDoc.clientId,
                    propertyId:activityDoc.propertyId,
                    isVisiteAcccepted:activityDoc.isVisiteAcccepted,
                    documentsUploaded:isdocumentUpload,
                    uploadedFiles:files,
                    reservationDate:new Date()
                }, 
                {new:true})

                const  visiteNotifcation = this.Notification.sendReservationNotification(reservation)
                if(!visiteNotifcation){
                    logger.warn("no notification sent")
                }
                
                if(!activityDoc.conversationId){
                    const newConversation = new Conversation({
                        participants: [activityDoc.clientId, property.ownerId]
                    })
                    const conversationId = await newConversation.save()
                    return conversationId
                }
                  const user = await User.findById(activityDoc.clientId)
                    if(!user){
                        logger.warn("no user found")
                        return
                    }
                const messageParams: SendMessageParams = {
                    conversationId:(activityDoc.conversationId as  mongoose.Types.ObjectId).toString(),
                    content: `reservation demandée par ${user.firstName} ${user.lastName}  pour  la propriété ${property.title} le ${reservationDate.toLocaleDateString()}`,
                    messageType: 'text',
                    userId: (activityDoc.clientId as mongoose.Types.ObjectId).toString(),
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
    
    async acceptReservation(activity:AccepteReservation){
        const session = await mongoose.startSession()
        session.startTransaction()
        const { activityId,} = activity

        try{
            
            const activityDoc = await Activity.findById(activityId)
            if(!activityDoc){
                session.abortTransaction()
                session.endSession()
                logger.warn("no activity found")
                return
            }
            const reservation = await Activity.findByIdAndUpdate(
                activityId,
                {
                    isReservationAccepted:true,
                    acceptDate:new Date()
                },
                {new:true})
                await mongoose.model("Property").findByIdAndUpdate(
                    activityDoc.propertyId,
                    {status:PropertyStatus.RESERVED},
                    {new:true}
                )
                const  visiteNotifcation = this.Notification.sendReservationAcceptedNotification(activityDoc.clientId)
                if(!visiteNotifcation){
                    logger.warn("no notification sent")
                }
                const property = await Property.findById(activityDoc.propertyId)
                if(!property){
                    session.abortTransaction()
                    session.endSession()
                    logger.warn("no property found")
                    return
                }
                 if(!activityDoc.conversationId){
                    const newConversation = new Conversation({
                        participants: [activityDoc.clientId, property.ownerId]
                    })
                    const conversationId = await newConversation.save()
                    return conversationId
                }
                const messageParams: SendMessageParams = {
                    conversationId:(activityDoc.conversationId as  mongoose.Types.ObjectId).toString(),
                    content: `Reservation Accepter  pour  la propriété ${property.title} le ${acceptedDate.toLocaleDateString()} vous  pouver  continuer  pour  le  payement `,
                    messageType: 'text',
                    userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
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
            logger.error("error during the reservation", error)
            throw error
        }
    }
    async refuseReservation(activity:RefusReservation){
        const session = await mongoose.startSession()
        session.startTransaction()
        const { activityId,reason} = activity

        try{
            const activityDoc = await Activity.findById(activityId)
            if(!activityDoc){
                session.abortTransaction()
                session.endSession()
                logger.warn("no activity found")
                return
            }
            const reservation = await Activity.findByIdAndUpdate(
                activityId,
                {
                    isReservationAccepted:false,
                    refusDate:new Date(),
                    reason:reason
                },
                {new:true})

                await mongoose.model("Property").findByIdAndUpdate(
                    activityDoc.propertyId,
                    {status:PropertyStatus.AVAILABLE},
                    {new:true}
                )
                const  visiteNotifcation = this.Notification.sendReservationRefusedNotification(activityDoc.clientId)
                if(!visiteNotifcation){
                    logger.warn("no notification sent")
                }
                const property = await Property.findById(activityDoc.propertyId)
                if(!property){
                    session.abortTransaction()
                    session.endSession()
                    logger.warn("no property found")
                    return
                }
                 if(!activityDoc.conversationId){
                    const newConversation = new Conversation({
                        participants: [activityDoc.clientId, property.ownerId]
                    })
                    const conversationId = await newConversation.save()
                    return conversationId
                }
                const messageParams: SendMessageParams = {
                    conversationId:(activityDoc.conversationId as  mongoose.Types.ObjectId).toString(),
                    content: `Reservation Refusé  pour  la propriété ${property.title}.La raison est:${reason}`,
                    messageType: 'text',
                    userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
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
            logger.error("error during the reservation", error)
            throw error
        }
    }

    async payReservation(activity:ActiviytyPayement){
        const session = await mongoose.startSession()
        session.startTransaction()
        const {activityId,amount, isPayment, payementDate} = activity

        try{
            const activityDoc = await Activity.findById(activityId)
            if(!activityDoc){
                session.abortTransaction()
                session.endSession()
                logger.warn("no activity found")
                return
            }
             const property = await Property.findById(activityDoc.propertyId)
                if(!property || property.status !== PropertyStatus.AVAILABLE){
                    session.abortTransaction()
                    session.endSession()
                    logger.warn("no property found")
                    return
                }

            if(amount!== property?.ownerCriteria.depositAmount){
                session.abortTransaction
                session.endSession()
                logger.warn("the amount is not correct")
                return 

            }
            const payement = await Activity.findByIdAndUpdate(
                activityId,
                {
                    isPayment:true,
                    amount,
                    payementDate:new Date(),
                    
                },
                {new:true, session})

            const newStatus =
                property.actionType === "rent" ? PropertyStatus.RENTED : PropertyStatus.SOLD;  
                await Property.findByIdAndUpdate(
                    activityDoc.propertyId,
                    { status: newStatus, acquiredBy: activityDoc.clientId },
                    { new: true, session }
                );

                const sendPayementNotification = await this.Notification.sendPayementNotification(property.ownerId)
              
                const propertyAcquireNotification = this.Notification.sendAcquireNotification(activity.clientId)
                if(!sendPayementNotification && !propertyAcquireNotification){
                    logger.warn("no notification sent")
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
                    conversationId:(activityDoc.conversationId as  mongoose.Types.ObjectId).toString(),
                    content: `Payement effectué  pour  la propriété ${property.title} le ${payementDate.toLocaleDateString()}`,
                    messageType: 'text',
                    userId: (activityDoc.clientId as mongoose.Types.ObjectId).toString(),
                    };
                const chat = await this.chatService.sendMessage(messageParams)
                if(!chat){
                    logger.warn("no chat sent")
                }
                session.commitTransaction()
                session.endSession()
                return payement
        }catch(error){
            await session.abortTransaction()
            session.endSession()
            logger.error("error during the reservation", error)
            throw error
        }
    }
    async acceptVisit(activityId:string){
        const session  = await mongoose.startSession()
        session.startTransaction()
        try{
            const activityDoc = await Activity.findById(activityId)
            if(!activityDoc){
                session.abortTransaction()
                session.endSession()
                logger.warn("no activity found")
                return
            }
            const property = await Property.findById(activityDoc.propertyId)
                if(!property){
                    session.abortTransaction()
                    session.endSession()
                    logger.warn("no property found")
                    return
                }
            const acceptVisit = await Activity.findByIdAndUpdate(
                activityId,
                {
                    isVisitAccepted:true,
                },
                {new:true})

                await this.Notification.sendVisiteAccpeted(activityDoc.clientId)
                 if(!activityDoc.conversationId){
                    const newConversation = new Conversation({
                        participants: [activityDoc.clientId, property.ownerId]
                    })
                    const conversationId = await newConversation.save()
                    return conversationId
                }
                const messageParams: SendMessageParams = {
                    conversationId:(activityDoc.conversationId as  mongoose.Types.ObjectId).toString(),
                    content: `visite Accepter  pour  la propriété ${property.title}  `,
                    messageType: 'text',
                    userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
                    };
                const chat = await this.chatService.sendMessage(messageParams)
                if(!chat){
                    logger.warn("no chat sent")
                }
                session.commitTransaction()
                session.endSession()
        }catch(error){
            await session.abortTransaction()
            session.endSession()
            logger.error("error during the reservation", error)
            throw error
        }

    }
    async refusVisit(activityId:string){
        const session  = await mongoose.startSession()
        session.startTransaction()
        try{
            const activityDoc = await Activity.findById(activityId)
            if(!activityDoc){
                session.abortTransaction()
                session.endSession()
                logger.warn("no activity found")
                return
            }
            const property = await Property.findById(activityDoc.propertyId)
                if(!property){
                    session.abortTransaction()
                    session.endSession()
                    logger.warn("no property found")
                    return
                }
            const acceptVisit = await Activity.findByIdAndUpdate(
                activityId,
                {
                    isVisitAccepted:false,
                },
                {new:true})

                await this.Notification.sendVisiteRejection(activityDoc.clientId)
                 if(!activityDoc.conversationId){
                    const newConversation = new Conversation({
                        participants: [activityDoc.clientId, property.ownerId]
                    })
                    const conversationId = await newConversation.save()
                    return conversationId
                }
                const messageParams: SendMessageParams = {
                    conversationId:(activityDoc.conversationId as  mongoose.Types.ObjectId).toString(),
                    content: `visite refuser  pour  la propriété ${property.title}  `,
                    messageType: 'text',
                    userId: (property.ownerId as mongoose.Types.ObjectId).toString(),
                    };
                const chat = await this.chatService.sendMessage(messageParams)
                if(!chat){
                    logger.warn("no chat sent")
                }
                session.commitTransaction()
                session.endSession()
        }catch(error){
            await session.abortTransaction()
            session.endSession()
            logger.error("error during the reservation", error)
            throw error
        }

    }

}
export  default ActivityServices