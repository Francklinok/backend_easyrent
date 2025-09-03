import { Request, Response,  NextFunction } from "express";
import { PropertyCreateDTO, PropertyParams } from "../types/propertyType";
import { createLogger } from "../../utils/logger/logger";
import PropertyServices from "../proprityServices/proprityServices";
import { PropertyQueryFilters, PaginationOptions } from "../types/propertyType";
import { PropertyStatus } from "../types/propertyType";
import { PaginationWithStatus } from "../types/propertyType";
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
            logger.error('Erreur lors de la création de la propriété:', error),
            res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la propriété',
            error: error instanceof Error ? error.message : 'Erreur inconnue'
            });
            next()
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
    next()
    }
}

async getProperties(req:Request,  res:Response, next:NextFunction):Promise<void | null>{
    const filters = req.query as unknown as PropertyQueryFilters & PaginationOptions;
    try{
        const properies = await this.propertyServices.getProperty(filters)
        if(!properies){
            logger.error("property doesn t been found");
            res.status(404).json({
                success: false,
                message: 'property not found',
            });
            return null
        }
        res.status(200).json({
            success: true,
            message: 'property found',
            data:properies
        });  
    }catch(error){
        logger.error("error fetching properties",  error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des propriétés',
            error: error instanceof Error ? error.message : 'Erreur inconnue',  
            })
            next()
        }
     }
     async getPropertyByOwner(req:Request, res:Response, next:NextFucntion){
        const id = req.params 
        const { page = 1, limit = 10, sortBy, sortOrder, status } = req.query as {
            page?: string;
            limit?: string;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
            status?: PropertyStatus;
        };
        const filters:PropertyParams = {
                ownerId: { id }, // correspond à ton PropertyQueryFilters
                pagination: {
                page: Number(page),
                limit: Number(limit),
                sortBy,
                sortOrder,
                } as PaginationOptions,
                status,
                } as  PropertyParams
        try{
            const property = await this.propertyServices.getPropertyByOwner(filters)
            if(!property){
                res.status(404).json({
                    success: false,
                    message: 'property not found',
                })  
            }
            res.status(201).json({
                success:true,
                message:property
            })
            
        }catch(error){
            logger.error("error fetching properties",  error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des propriétés',
                error: error instanceof Error ? error.message : 'Erreur inconnue',  
                })
            next()
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
            })  
            }
            res.status(201).json({
                success:true,
                message:property
            })
        }catch(error){
             logger.error("error fetching properties",  error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des propriétés',
                error: error instanceof Error ? error.message : 'Erreur inconnue',  
                })
            next()

        }
     }
     
     async  getPropertyState(req:Request, res:Response, next:NextFunction){
        try{
            const stats = await this.propertyServices.getPropertyState()
            if(!stats){
                logger.warn('data has not  been  found')
                res.status(400).json({
                    success:false
                })
                
            }
            logger.info('Statistiques des propriétés récupérées');

            res.status(200).json({
            success: true,
            data: stats})
        }catch(error){
             logger.info('error  fetching property state ',error);
            res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Erreur inconnue'

        })
        }
     }
}

export  default PropertyController