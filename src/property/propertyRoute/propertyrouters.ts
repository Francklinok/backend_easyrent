import express from "express";
import PropertyController from "../controllers/propertyControllers";

// import createProperty from "../../property/controllers/createProperty";
// import deleteProperty from "../../property/controllers/deleteProperty";
import checkOwnerAuthorization from "../middlewares/checkOwnerAuthorization";
import validateCreateProperty from "../middlewares/validateCreateProperty";
import rateLimiter from "../middlewares/rateLimiter";
import asyncHandler from "express-async-handler";

// import getProperties from "../../property/controllers/getProperties";
// import getPropertiesByOwner from "../../property/controllers/getPropertiesByOwner";
// import getPropertyById from "../../property/controllers/getPropertyById";
// import getPropertyStats from "../../property/controllers/getPropertyStats";
// import getSimilarProperties from "../../property/controllers/getSimilarProperties";
import validatePropertyId from "../middlewares/validatePropertyId";
// import permanentDeleteProperty from "../../property/controllers/permanentDeleteProperty";

// import restoreProperty from "../../property/controllers/restoreProperty";
// import searchProperties from "../../property/controllers/searchProperties";

// import updateProperty from "../../property/controllers/updateProperty";
import updatePropertyStatus from "../controllers/updatePropertyStatus";
import validationRules from "../middlewares/validateCreateProperty";
import { authenticate } from "../../auth/middlewares";

const property = new PropertyController()
const propertyRouter = express.Router();

// Apply rate limiter middleware
propertyRouter.use(rateLimiter(15 * 60 * 1000, 100));

// // Search route
propertyRouter.get('/search', property.searchProperty.bind(property)); // Search properties

// // POST route to create a property
propertyRouter.post('/', 
    authenticate,
    validationRules.validateProperty,
    // checkOwnerAuthorization,
    property.createProperty.bind(property));

propertyRouter.patch('/:id', property.updateProperty.bind(property)); // Update property details


// // GET routes for retrieving properties
propertyRouter.get('/', 
    // authenticate,
    // checkOwnerAuthorization,
    asyncHandler(property.getProperties.bind(property)));
 // Get all properties
propertyRouter.get('/owner/:ownerId', property.getPropertyByOwner.bind(property));

propertyRouter.get('/:id', validatePropertyId, property.getPropertyByID.bind(property)); // Get property by ID
propertyRouter.get('/:id/similar', property.getSimilarProperty.bind(property));
propertyRouter.get('/stats', property.getPropertyState.bind(property)); // Get property stats

// // DELETE routes for deleting properties
propertyRouter.delete('/:id', authenticate, checkOwnerAuthorization, property.deletedProperty.bind(property)); // Delete property
propertyRouter.delete('/permanent/:id',authenticate, checkOwnerAuthorization, validatePropertyId, property.permanentDeletion.bind(property)); // Permanent delete property

// // PATCH routes
propertyRouter.put('/restore/:id',authenticate, checkOwnerAuthorization, validatePropertyId, property.restoreProperty.bind(property)); // Restore deleted property
propertyRouter.patch('/status/:id', updatePropertyStatus); // Update property status


export default propertyRouter;  