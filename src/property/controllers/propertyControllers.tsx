import { Request, Response,  NextFunction } from "express";
import { PropertyCreateDTO } from "../types/propertyType";
import { createLogger } from "../../utils/logger/logger";
import PropertyServices from "../proprityServices/proprityServices";
import { PropertyQueryFilters, PaginationOptions } from "../types/propertyType";
const   logger  = createLogger("propertyservices")

class PropertyController {
    private propertyServices:PropertyServices

    constructor(){
        this.propertyServices = new PropertyServices()
    }

    async createProperty(req:Request, res:Response, nest:NextFunction):Promise<void>{
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
        }
     }
}

export  default PropertyController