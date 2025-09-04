import { IProperty, PropertyStatus } from "../types/propertyType";
import { NotificationService } from "../../services/notificationServices";
import { createLogger } from "../../utils/logger/logger";
import { PropertyCreateDTO } from "../types/propertyType";
import Property from "../model/propertyModel";
import mongoose from "mongoose";
import User from "../../users/models/userModel";
import { PropertyQueryFilters } from "../types/propertyType";
import { PaginationOptions } from "../types/propertyType";
import { PropertyParams } from "../types/propertyType";
import { SimilarPropertyType } from "../types/propertyType";
import permanentDeleteProperty from "../controllers/permanentDeleteProperty";
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

    async deleteProperty(propertyId:string){
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

    async getProperty(propertyQuery:PropertyQueryFilters & PaginationOptions){
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
                sortOrder = 'desc'} = propertyQuery;
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
    async getPropertyByOwner(propertyQuery:PropertyParams){
        const  session = await mongoose.startSession();
        session.startTransaction()
        try{
            const {pagination,status, ownerId} = propertyQuery as PropertyParams
            const  filter: Record<string,  any> = {ownerId, active:true}
            if(status) filter.status = status;
            const  skip = (Number(pagination.page)-1) * Number(pagination.limit)
            
            const  total = await Property.countDocuments(filter)
            if(total ===0){
                logger.warn("nothing  has  not  bee,n   found")
                return 
            }
            const  property = await  Property.find(filter)
            .sort({createdAt:-1})
            .skip(skip)
            .limit(Number(pagination.limit))
            .lean()
            if(!property){
                await session.abortTransaction()
                session.endSession()
                logger.info("the property   is  not  available")
            }
            session.commitTransaction()
            session.endSession()

            return property

        }catch(error){
            session.abortTransaction()
            session.endSession()
            logger.warn("Error  fetching  property", error)
        }
    }
    async finPropertyById(id:string){
        const session = await mongoose.startSession();
        session.startTransaction()
        try{
            const property = await  Property.findById(id)
            .populate('ownerId', 'name email phone')
            .lean();
            if(!property){
                session.abortTransaction()
                session.endSession()
                logger.warn('property has  not been  found')
                return null
            }
            session.commitTransaction()
            session.endSession()
            return property
        }catch(error){
             session.abortTransaction()
            session.endSession()
            logger.warn("error  fetching  the  propety", error)

        }
    }
    async getPropertyState(){
        const session = await mongoose.startSession()
        session.startTransaction()
        try{
        const [
        totalProperties,
        availableProperties,
        rentedProperties,
        averageRent,
        averageSize,
        propertiesByArea,
        propertiesByStatus
        ] = await Promise.all([
        // Nombre total de propriétés actives
        Property.countDocuments({ isActive: true }),
        
        // Nombre de propriétés disponibles
        Property.countDocuments({ isActive: true, status: PropertyStatus.AVAILABLE }),
        
        // Nombre de propriétés louées
        Property.countDocuments({ isActive: true, status: PropertyStatus.RENTED }),
        
        // Loyer moyen
        Property.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: null, average: { $avg: '$monthlyRent' } } }
        ]),
        
        // Taille moyenne
        Property.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: null, average: { $avg: '$surface' } } }
        ]),
        
        // Propriétés par zone/quartier
        Property.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$area', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        
        // Propriétés par statut
        Property.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ])
        ]);
        
        logger.info('Statistiques des propriétés récupérées');
        session.commitTransaction()
        session.endSession()
        return {
        totalProperties,
        availableProperties,
        rentedProperties,
        averageRent: averageRent[0]?.average || 0,
        averageSize: averageSize[0]?.average || 0,
        propertiesByArea,
        propertiesByStatus
        }
        }catch(error){
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }

    async  getSImilarProperty(data:SimilarPropertyType){
        const  session = await  mongoose.startSession()
        session.startTransaction()
        try{     
            const {propertyId, pagination} = data
            const property = await  Property.findById(propertyId)
            if(!property){
                logger.warn("no property  found")
                return null
            }
            const similarProperty =  await Property.find({
                _id:{$ne: propertyId},
                isActive:true,
                status:PropertyStatus.AVAILABLE,
                area:property.area,
                $or: [
                { bedrooms: property.bedrooms }, // Même nombre de chambres
                { monthlyRent: { $gte: property.monthlyRent * 0.8, $lte: property.monthlyRent * 1.2 } } // Prix similaire (±20%)
            ]
        })
        .limit(Number(pagination.limit))
        .lean()
        if(!similarProperty){
            session.abortTransaction()
            session.endSession()
            logger.warn("No similar  property  founded")
        }
        logger.info("similar  property  founded")
        session.commitTransaction()
        session.endSession()
        return similarProperty

        }catch(error){
            session.abortTransaction()
            session.endSession()
            logger.warn("error  while getting  the  similar  property", error)
        }

       
        }
         async  permanentDeleteProperty(id:string){
            const  session = await mongoose.startSession()
            session.startTransaction()
            try{
                const property = await Property.findById(id)
                if(!property){
                    logger.warn("no property  found")
                    return null
                }
                const deletProperty = await Property.findByIdAndDelete(id,{session})
                if(!deletProperty){
                    logger.warn("no property has  not  been  deleted")
                    return null
                }
                await mongoose.model("User").findByIdAndUpdate(
                    property.ownerId,
                    {$inc: { propertyCount: -1 } },
                    {session}
                );
                await  mongoose.model("Property").deleteMany(property.id, {session})
                await session.commitTransaction();
                session.endSession();
                
                logger.info(`Property  has  been  removed  permanently: ${id}`);
                return null
                


            }catch(error){
                session.abortTransaction()
                session.endSession()
                logger.warn("error  while deleting  the  property", error)
            }


    }

}
export  default  PropertyServices