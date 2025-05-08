import express from "express";
import createProperty from "../../controllers/propertyController/createProperty";
import deleteProperty from "../../controllers/propertyController/deleteProperty";
import checkOwnerAuthorization from "../../middlewares/propertyMiddleware/checkOwnerAuthorization";
import validateCreateProperty from "../../middlewares/propertyMiddleware/validateCreateProperty";
import rateLimiter from "../../middlewares/propertyMiddleware/rateLimiter";

import getProperties from "../../controllers/propertyController/getProperties";
import getPropertiesByOwner from "../../controllers/propertyController/getPropertiesByOwner";
import getPropertyById from "../../controllers/propertyController/getPropertyById";
import getPropertyStats from "../../controllers/propertyController/getPropertyStats";
import getSimilarProperties from "../../controllers/propertyController/getSimilarProperties";
import validatePropertyId from "../../middlewares/propertyMiddleware/validatePropertyId";
import permanentDeleteProperty from "../../controllers/propertyController/permanentDeleteProperty";

import restoreProperty from "../../controllers/propertyController/restoreProperty";
import searchProperties from "../../controllers/propertyController/searchProperties";

import updateProperty from "../../controllers/propertyController/updateProperty";
import updatePropertyStatus from "../../controllers/propertyController/updatePropertyStatus";

const router = express.Router();

// Apply rate limiter middleware
router.use(rateLimiter(15 * 60 * 1000, 100));

// POST route to create a property
router.post('/', validateCreateProperty, checkOwnerAuthorization, createProperty);

// GET routes for retrieving properties
router.get('/', getProperties); // Get all properties
router.get('/owner', getPropertiesByOwner); // Get properties by owner
router.get('/:id', validatePropertyId, getPropertyById); // Get property by ID
router.get('/similar', getSimilarProperties); // Get similar properties
router.get('/stats', getPropertyStats); // Get property stats

// DELETE routes for deleting properties
router.delete('/:id', checkOwnerAuthorization, deleteProperty); // Delete property
router.delete('/permanent/:id', checkOwnerAuthorization, permanentDeleteProperty); // Permanent delete property

// PATCH routes
router.patch('/restore/:id', restoreProperty); // Restore deleted property
router.patch('/:id', updateProperty); // Update property details
router.patch('/status/:id', updatePropertyStatus); // Update property status

// Search route
router.get('/search', searchProperties); // Search properties
