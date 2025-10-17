import { Request, Response,  NextFunction } from "express";
import { PropertyCreateDTO, PropertyParams } from "../types/propertyType";
import { createLogger } from "../../utils/logger/logger";
import PropertyServices from "../proprityServices/proprityServices";
import { PropertyQueryFilters, PaginationOptions } from "../types/propertyType";
import { PropertyStatus } from "../types/propertyType";
// import { PaginationWithStatus } from "../types/propertyType";
import { SimilarPropertyType } from "../types/propertyType";
import { SearchPropertyParams } from "../types/propertyType";
import { UpdatePropertyParams } from "../types/propertyType";
const   logger  = createLogger("propertyservices")


class PropertyController {
    private propertyServices:PropertyServices

    constructor(){
        this.propertyServices = new PropertyServices()
    }

    async createProperty(req:Request, res:Response, next:NextFunction):Promise<void>{
        try{
            const propertyData:PropertyCreateDTO = req.body;
            const userId = req.user?.userId;

            const   property = await this.propertyServices.createProperty(propertyData, userId);
            res.status(201).json({
                success:true,
                message:"property  created",
                data:property
            });
        }catch(error){
            logger.error('Erreur lors de la création de la propriété:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la création de la propriété',
                error: error instanceof Error ? error.message : 'Erreur inconnue'
            });
            next(error);
        }

    }
async  deletedProperty(req:Request,  res:Response, next:NextFunction):Promise<void>{
    try{
        const {id} = req.params;
        const property = await this.propertyServices.deleteProperty(id)
        if(!property){
           res.status(404).json({
                success: false,
                message: 'Propriété non trouvée',
            });
            return 
        }
        res.status(200).json({
      success: true,
      message: 'Propriété supprimée avec succès',
    });
    }catch(error){
         logger.error(`Erreur lors de la suppression de la propriété ${req.params.id}:`, error);

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de la propriété',
            error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
        next(error);
    }
}

async getProperties(req:Request,  res:Response, next:NextFunction):Promise<void>{
    const filters = req.query as unknown as PropertyQueryFilters & PaginationOptions;
    try{
        const properies = await this.propertyServices.getProperty(filters)
        if(!properies || properies.properties.length === 0){
            logger.error("properties not found");
            res.status(404).json({
                success: false,
                message: 'properties not found',
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'property found',
            data:properies
        });  
    }catch(error){
        logger.error("error fetching properties", error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des propriétés',
            error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
        next(error);
        }
     }
     async getPropertyByOwner(req:Request, res:Response, next:NextFunction){
        const {id} = req.params; 
        const { page = 1, limit = 10, sortBy, sortOrder, status } = req.query as {
            page?: string;
            limit?: string;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
            status?: PropertyStatus;
        };
        const filters: PropertyParams = {
            ownerId: id,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                sortBy,
                sortOrder,
            } as PaginationOptions,
            status,
        } as PropertyParams;
        try{
            const property = await this.propertyServices.getPropertyByOwner(filters)
            if(!property){
                res.status(404).json({
                    success: false,
                    message: 'property not found',
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: 'Properties found',
                data: property
            });
            
        }catch(error){
            logger.error("error fetching properties", error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des propriétés',
                error: error instanceof Error ? error.message : 'Erreur inconnue',
            });
            next(error);
        }
       
     }
     async getPropertyByID(req:Request,  res:Response, next:NextFunction){
        const  {id} = req.params
        try{
            const property = await this.propertyServices.finPropertyById(id)
            if(!property){
                res.status(404).json({
                    success: false,
                    message: 'property not found',
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: 'Property found',
                data: property
            });
        }catch(error){
            logger.error("error fetching property", error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération de la propriété',
                error: error instanceof Error ? error.message : 'Erreur inconnue',
            });
            next(error);

        }
     }
     
     async  getPropertyState(req:Request, res:Response, next:NextFunction){
        try{
            const stats = await this.propertyServices.getPropertyState()
            if(!stats){
                logger.warn('Statistics not found');
                res.status(404).json({
                    success: false,
                    message: 'Statistics not found'
                });
                return;
            }
            logger.info('Statistiques des propriétés récupérées');

            res.status(200).json({
                success: true,
                data: stats
            });
        }catch(error){
            logger.error('error fetching property state', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des statistiques',
                error: error instanceof Error ? error.message : 'Erreur inconnue'
            });
            next(error);
        }
     }
     async getSimilarProperty(req:Request, res:Response, next:NextFunction){

        const {id} = req.params
        const {  limit = 10 } = req.query as {
            limit?: string;
        } 

        const filter:SimilarPropertyType = {
            propertyId : id,
             pagination: {
                limit: Number(limit),       
                } as PaginationOptions     
        } 
        
        try{
            const  similarProperty = await  this.propertyServices.getSImilarProperty(filter)
            if(!similarProperty){
                res.status(404).json({
                    success: false,
                    message: 'similar properties not found',
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: 'Similar properties found',
                data: similarProperty
            });
        }catch(error){
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des propriétés similaires',
                error: error instanceof Error ? error.message : 'Erreur inconnue',
            });
            next(error);
        }
     }
     async  permanentDeletion(req:Request,  res:Response, next:NextFunction){
        const {id} = req.params
        try{
            const deletProperty = await this.propertyServices.permanentDeleteProperty(id)
            if(!deletProperty){
                res.status(404).json({
                    success: false,
                    message: 'property not found or not deleted',
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: "property permanently deleted"
            });
        }catch(error){
            res.status(500).json({
                success: false,
                message: 'error deleting property',
                error: error instanceof Error ? error.message : 'unknown error',
            });
            next(error);
        }
     }
     async restoreProperty(req:Request, res:Response, next:NextFunction){
        const  {id} = req.params 
        try{
            const  propertyRestore = await this.propertyServices.restoreProperty(id)
            if(!propertyRestore){
                res.status(404).json({
                    success: false,
                    message: "property not found"
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: "property restored",
                data: propertyRestore
            });

        }catch(error){
            res.status(500).json({
                success: false,
                message: "error restoring property",
                error: error instanceof Error ? error.message : 'unknown error',
            });
            next(error);
        }
     }
     async  searchProperty(req:Request, res:Response, next:NextFunction){
        try{
              const q = (req.query.q as string) || "";
                const page = parseInt((req.query.page as string) || "1", 10);
                const limit = parseInt((req.query.limit as string) || "10", 10);

                const queryData: SearchPropertyParams = {
                q,
                pagination: { page, limit }
                };
            const searchProperty = await this.propertyServices.searchProperty(queryData)
            if(!searchProperty || (searchProperty.property && searchProperty.property.length === 0)){
                res.status(404).json({
                    success: false,
                    message: "properties not found"
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: "properties found",
                data: searchProperty
            });
        }catch(error){
            res.status(500).json({
                success: false,
                message: "error searching property",
                error: error instanceof Error ? error.message : 'unknown error',
            });
            next(error);
        }
     }
     async updateProperty(req:Request, res:Response, next:NextFunction){
        const {id} = req.params
        const data:PropertyCreateDTO = req.body

        const propertyData:UpdatePropertyParams = {propertyId:id, data:data}
        try{
            const updateProperty = await this.propertyServices.updateProperty(propertyData)
            if(!updateProperty){
                res.status(404).json({
                    success: false,
                    message: "property not found or not updated"
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: "property updated",
                data: updateProperty
            });
        }catch(error){
            res.status(500).json({
                success: false,
                message: "error updating property",
                error: error instanceof Error ? error.message : 'unknown error',
            });
            next(error);
        }
     }
}

export  default PropertyController