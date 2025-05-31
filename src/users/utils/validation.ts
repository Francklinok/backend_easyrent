
// Exemple avec validation de types au runtime (optionnel)
import Joi from 'joi';

const createRefreshTokenSchema = Joi.object<ICreateRefreshToken>({
  token: Joi.string().required(),
  device: Joi.string().max(200).optional(),
  userAgent: Joi.string().max(500).optional(),
  ip: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).optional(),
  user: Joi.string().hex().length(24).required(), // ObjectId as string
  expiresAt: Joi.date().required(),
  sessionId: Joi.string().optional(),
  location: Joi.object({
    country: Joi.string().optional(),
    city: Joi.string().optional(),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    }).optional()
  }).optional()
});
