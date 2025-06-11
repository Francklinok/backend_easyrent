import express from "express";
import createProperty from "../../property/controllers/createProperty";
import deleteProperty from "../../property/controllers/deleteProperty";
import checkOwnerAuthorization from "../../property/middlewares/checkOwnerAuthorization";
import validateCreateProperty from "../../property/middlewares/validateCreateProperty";
import rateLimiter from "../../property/middlewares/rateLimiter";

import getProperties from "../../property/controllers/getProperties";
import getPropertiesByOwner from "../../property/controllers/getPropertiesByOwner";
import getPropertyById from "../../property/controllers/getPropertyById";
import getPropertyStats from "../../property/controllers/getPropertyStats";
import getSimilarProperties from "../../property/controllers/getSimilarProperties";
import validatePropertyId from "../../property/middlewares/validatePropertyId";
import permanentDeleteProperty from "../../property/controllers/permanentDeleteProperty";

import restoreProperty from "../../property/controllers/restoreProperty";
import searchProperties from "../../property/controllers/searchProperties";

import updateProperty from "../../property/controllers/updateProperty";
import updatePropertyStatus from "../../property/controllers/updatePropertyStatus";
import validationRules from "../../property/middlewares/validateCreateProperty";
import { authenticate } from "../../auth/middlewares";
const propertyRouter = express.Router();

// Apply rate limiter middleware
propertyRouter.use(rateLimiter(15 * 60 * 1000, 100));

// // Search route
propertyRouter.get('/search', searchProperties); // Search properties

// // POST route to create a property
propertyRouter.post('/', 
    authenticate,
    validationRules.validateProperty,
    // checkOwnerAuthorization,
    createProperty);

propertyRouter.patch('/:id', updateProperty); // Update property details


// // GET routes for retrieving properties
propertyRouter.get('/', 
    // authenticate,
    // checkOwnerAuthorization,
    getProperties
); // Get all properties
propertyRouter.get('/owner/:ownerId', getPropertiesByOwner);

propertyRouter.get('/:id', validatePropertyId, getPropertyById); // Get property by ID
propertyRouter.get('/:id/similar', getSimilarProperties);
propertyRouter.get('/stats', getPropertyStats); // Get property stats

// // DELETE routes for deleting properties
propertyRouter.delete('/:id', authenticate, checkOwnerAuthorization, deleteProperty); // Delete property
propertyRouter.delete('/permanent/:id',authenticate, checkOwnerAuthorization, validatePropertyId, permanentDeleteProperty); // Permanent delete property

// // PATCH routes
propertyRouter.put('/restore/:id',authenticate, checkOwnerAuthorization, validatePropertyId, restoreProperty); // Restore deleted property
propertyRouter.patch('/status/:id', updatePropertyStatus); // Update property status


export default propertyRouter;  