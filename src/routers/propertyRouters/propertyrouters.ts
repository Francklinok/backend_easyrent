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
