import { IProperty, PropertyStatus } from "../types/propertyType";
import { NotificationService } from "../../services/notificationServices";
import { createLogger } from "../../utils/logger/logger";
import { PropertyCreateDTO } from "../types/propertyType";
import Property from "../model/propertyModel";
import mongoose from "mongoose";
import User from "../../users/models/userModel";
import { PropertyQueryFilters } from "../types/propertyType";
import { PaginationOptions } from "../types/propertyType";
const   logger = createLogger("proprietyCreation")

class PropertyServices{
    private Notification:NotificationService
    constructor(){
        this.Notification = new NotificationService();
    }

    async createProperty(propertyData:PropertyCreateDTO,userId?:string):Promise<IProperty>{
         const  session = await mongoose.startSession()
        session.startTransaction()
        logger.info("tantative de  creation de  neew  proprity")
        try{   
            if(!propertyData.ownerId && userId){
                propertyData.ownerId = userId
            }
            const property = new Property(propertyData);
            await property.save({session})    
            await mongoose.model("User").findByIdAndUpdate(
                propertyData.ownerId,
                { $inc: { propertyCount: 1 }},
                {session});

            await session.commitTransaction();
            session.endSession()
            logger.info(`Propriété créée avec succès: ${property._id}`);
            return property
            }catch(error){
                await  session.abortTransaction();
                session.endSession()
                logger.error('Erreur lors de la création de la propriété:', error);
                throw error;
            }

    }

    async  deleteProperty(propertyId:string){
        const session = await  mongoose.startSession();
        session.startTransaction();

        //verifi  if  property  exsit 
        try {
        const property = await Property.findById(propertyId)
        if(!property)
        {
            await session.abortTransaction();
            session.endSession()
            logger.warn("no property  found ");
            return null
        }
        await Property.findByIdAndUpdate(
            propertyId,
            {
                isActive:false,
                status:PropertyStatus.REMOVED
            },
            {session}
        );
        // Mise à jour des stats liées à l'utilisateur
      await mongoose.model('User').findByIdAndUpdate(
        property.ownerId,
        { $inc: { activePropertyCount: -1 } },
        { session }
      );
        await  session.commitTransaction()
        session.endSession()
        logger.info(`Propriété supprimée (logique): ${propertyId}`);
        }catch(error){
            logger.warn("error  while deleting  the  property", error)
        }
    }

    async getProperty(propertyData:PropertyQueryFilters & PaginationOptions){
        const session = await  mongoose.startSession()
        session.startTransaction()
        try{
        const {
                area,
                minRent,
                maxRent,
                minBedrooms,
                ownerId,
                status,
                isActive = true,
                availableFrom,
                page = 1,
                limit = 10,
                sortBy = 'createdAt',
                sortOrder = 'desc'} = propertyData;
        //filter 
        const filters:Record<string,  any> = {isActive};
         if (area) filters.area = { $regex: new RegExp(area, 'i') };

        if (minRent) filters.monthlyRent = { $gte: minRent };
        if (maxRent) filters.monthlyRent = { ...filters.monthlyRent, $lte: maxRent };
        if (minBedrooms) filters.bedrooms = { $gte: minBedrooms };
        if (ownerId) filters.ownerId = ownerId;
        if (status) filters.status = status;
        if (availableFrom) filters.availableFrom = { $lte: availableFrom };

        const sort:Record<string, 1|-1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        const total= await Property.countDocuments(filters);
        //pagination
        const skip = (Number(page)-1)* Number(limit);
        const properties = await Property.find(filters)
            .sort(sort)
            .skip(skip)
            .limit(Number(limit))
            .populate('ownerId', 'name email phone')
            .session(session)
        if(!properties){
            await session.abortTransaction()
            session.endSession()
            logger.warn("no property  found")
            return null
        }
        logger.info(`Récupération de ${properties.length} propriétés`);
        await session.commitTransaction()
        session.endSession()
        return {
            properties,
            total,
            page:Number(page),
            limit:Number(limit),
            totalPages:Math.ceil(total/Number(limit))

        }
     

        }catch(error){
            logger.warn("error  while getting  the  property", error)
        }

        
    }
}
export  default  PropertyServices