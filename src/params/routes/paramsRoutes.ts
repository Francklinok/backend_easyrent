import { Router, Request, Response, NextFunction } from 'express';
import paramsService from '../services/ParamsService';
import { createLogger } from '../../utils/logger/logger';
import authenticate from '../../auth/middlewares/authenticate';

const logger = createLogger('ParamsRoutes');
const router = Router();


router.use(authenticate);

router.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-API-Mode', 'REST-Fallback');
  res.setHeader('X-Preferred-API', 'GraphQL');
  next();
});

const getUserId = (req: Request): string => {
  const user = (req as any).user;
  if (!user || !user.userId) {
    throw new Error('Utilisateur non authentifié');
  }
  return user.userId.toString();
};

// Wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ================================
// GET ALL PARAMS
// ================================

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const params = await paramsService.getAllParams(userId);

  res.json({
    success: true,
    data: params
  });
}));

// ================================
// SECURITY ROUTES
// ================================

router.get('/security', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const security = await paramsService.getSecuritySettings(userId);

  res.json({
    success: true,
    data: security
  });
}));

router.patch('/security', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const security = await paramsService.updateSecuritySettings(userId, req.body);

  res.json({
    success: true,
    message: 'Paramètres de sécurité mis à jour',
    data: security
  });
}));

router.post('/security/two-factor/enable', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { method } = req.body;

  const security = await paramsService.enableTwoFactor(userId, method || 'email');

  res.json({
    success: true,
    message: 'Authentification à deux facteurs activée',
    data: security
  });
}));

router.post('/security/two-factor/disable', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const security = await paramsService.disableTwoFactor(userId);

  res.json({
    success: true,
    message: 'Authentification à deux facteurs désactivée',
    data: security
  });
}));

router.post('/security/questions', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({
      success: false,
      message: 'Question et réponse requises'
    });
  }

  const security = await paramsService.addSecurityQuestion(userId, { question, answer });

  res.json({
    success: true,
    message: 'Question de sécurité ajoutée',
    data: security
  });
}));

router.post('/security/questions/verify', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { questionId, answer } = req.body;

  const isValid = await paramsService.verifySecurityQuestion(userId, questionId, answer);

  res.json({
    success: true,
    data: { valid: isValid }
  });
}));

router.delete('/security/questions/:questionId', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { questionId } = req.params;

  const security = await paramsService.removeSecurityQuestion(userId, questionId);

  res.json({
    success: true,
    message: 'Question de sécurité supprimée',
    data: security
  });
}));

// ================================
// PRIVACY ROUTES
// ================================

router.get('/privacy', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const privacy = await paramsService.getPrivacySettings(userId);

  res.json({
    success: true,
    data: privacy
  });
}));

router.patch('/privacy', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const privacy = await paramsService.updatePrivacySettings(userId, req.body);

  res.json({
    success: true,
    message: 'Paramètres de confidentialité mis à jour',
    data: privacy
  });
}));

router.post('/privacy/block', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { userId: blockedUserId, reason } = req.body;

  if (!blockedUserId) {
    return res.status(400).json({
      success: false,
      message: 'ID utilisateur requis'
    });
  }

  const privacy = await paramsService.blockUser(userId, { userId: blockedUserId, reason });

  res.json({
    success: true,
    message: 'Utilisateur bloqué',
    data: privacy
  });
}));

router.delete('/privacy/block/:blockedUserId', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { blockedUserId } = req.params;

  const privacy = await paramsService.unblockUser(userId, blockedUserId);

  res.json({
    success: true,
    message: 'Utilisateur débloqué',
    data: privacy
  });
}));

router.get('/privacy/block-list', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const blockList = await paramsService.getBlockList(userId);

  res.json({
    success: true,
    data: blockList
  });
}));

// ================================
// PREMIUM ROUTES
// ================================

router.get('/premium', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const premium = await paramsService.getPremiumSettings(userId);

  res.json({
    success: true,
    data: premium
  });
}));

router.patch('/premium', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const premium = await paramsService.updatePremiumSettings(userId, req.body);

  res.json({
    success: true,
    message: 'Paramètres premium mis à jour',
    data: premium
  });
}));

router.post('/premium/upgrade', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { tier, paymentMethodId, promoCode } = req.body;

  if (!tier || !paymentMethodId) {
    return res.status(400).json({
      success: false,
      message: 'Tier et méthode de paiement requis'
    });
  }

  const premium = await paramsService.upgradePremium(userId, {
    tier,
    paymentMethodId,
    promoCode
  });

  res.json({
    success: true,
    message: `Abonnement ${tier} activé`,
    data: premium
  });
}));

router.post('/premium/cancel', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const premium = await paramsService.cancelPremium(userId);

  res.json({
    success: true,
    message: 'Abonnement annulé',
    data: premium
  });
}));

router.get('/premium/status', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const [isPremium, tier] = await Promise.all([
    paramsService.isPremium(userId),
    paramsService.getPremiumTier(userId)
  ]);

  res.json({
    success: true,
    data: {
      isPremium,
      tier
    }
  });
}));

router.get('/premium/usage/:limitType', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { limitType } = req.params;
  const { currentUsage } = req.query;

  const usage = await paramsService.checkUsageLimit(
    userId,
    limitType as any,
    parseInt(currentUsage as string) || 0
  );

  res.json({
    success: true,
    data: usage
  });
}));

// ================================
// FAVORITES ROUTES
// ================================

router.get('/favorites', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const favorites = await paramsService.getFavoriteSettings(userId);

  res.json({
    success: true,
    data: favorites
  });
}));

router.patch('/favorites', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const favorites = await paramsService.updateFavoriteSettings(userId, req.body);

  res.json({
    success: true,
    message: 'Paramètres de favoris mis à jour',
    data: favorites
  });
}));

// Properties favorites
router.get('/favorites/properties', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const properties = await paramsService.getFavoriteProperties(userId);

  res.json({
    success: true,
    data: properties
  });
}));

router.post('/favorites/properties', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { propertyId, notes, tags, notifyPriceDrop } = req.body;

  if (!propertyId) {
    return res.status(400).json({
      success: false,
      message: 'ID de propriété requis'
    });
  }

  const favorites = await paramsService.addFavoriteProperty(userId, {
    propertyId,
    notes,
    tags,
    notifyPriceDrop
  });

  res.json({
    success: true,
    message: 'Propriété ajoutée aux favoris',
    data: favorites
  });
}));

router.delete('/favorites/properties/:propertyId', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { propertyId } = req.params;

  const favorites = await paramsService.removeFavoriteProperty(userId, propertyId);

  res.json({
    success: true,
    message: 'Propriété retirée des favoris',
    data: favorites
  });
}));

router.get('/favorites/properties/:propertyId/check', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { propertyId } = req.params;

  const isFavorite = await paramsService.isFavoriteProperty(userId, propertyId);

  res.json({
    success: true,
    data: { isFavorite }
  });
}));

// Saved searches
router.get('/favorites/searches', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const searches = await paramsService.getSavedSearches(userId);

  res.json({
    success: true,
    data: searches
  });
}));

router.post('/favorites/searches', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { name, criteria, notificationsEnabled, frequency } = req.body;

  if (!name || !criteria) {
    return res.status(400).json({
      success: false,
      message: 'Nom et critères requis'
    });
  }

  const search = await paramsService.createSavedSearch(userId, {
    name,
    criteria,
    notificationsEnabled,
    frequency
  });

  res.json({
    success: true,
    message: 'Recherche sauvegardée',
    data: search
  });
}));

router.delete('/favorites/searches/:searchId', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { searchId } = req.params;

  const favorites = await paramsService.deleteSavedSearch(userId, searchId);

  res.json({
    success: true,
    message: 'Recherche supprimée',
    data: favorites
  });
}));

// Collections
router.post('/favorites/collections', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { name, description, isPrivate, propertyIds } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Nom de collection requis'
    });
  }

  const collection = await paramsService.createFavoriteCollection(userId, {
    name,
    description,
    isPrivate,
    propertyIds
  });

  res.json({
    success: true,
    message: 'Collection créée',
    data: collection
  });
}));

router.delete('/favorites/collections/:collectionId', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { collectionId } = req.params;

  const favorites = await paramsService.deleteFavoriteCollection(userId, collectionId);

  res.json({
    success: true,
    message: 'Collection supprimée',
    data: favorites
  });
}));

router.post('/favorites/collections/:collectionId/properties', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { collectionId } = req.params;
  const { propertyId } = req.body;

  const collection = await paramsService.addToCollection(userId, collectionId, propertyId);

  if (!collection) {
    return res.status(404).json({
      success: false,
      message: 'Collection non trouvée'
    });
  }

  res.json({
    success: true,
    message: 'Propriété ajoutée à la collection',
    data: collection
  });
}));

router.delete('/favorites/collections/:collectionId/properties/:propertyId', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { collectionId, propertyId } = req.params;

  const collection = await paramsService.removeFromCollection(userId, collectionId, propertyId);

  if (!collection) {
    return res.status(404).json({
      success: false,
      message: 'Collection non trouvée'
    });
  }

  res.json({
    success: true,
    message: 'Propriété retirée de la collection',
    data: collection
  });
}));

// Agents favoris
router.post('/favorites/agents', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { agentId } = req.body;

  if (!agentId) {
    return res.status(400).json({
      success: false,
      message: 'ID agent requis'
    });
  }

  const favorites = await paramsService.addFavoriteAgent(userId, agentId);

  res.json({
    success: true,
    message: 'Agent ajouté aux favoris',
    data: favorites
  });
}));

router.delete('/favorites/agents/:agentId', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { agentId } = req.params;

  const favorites = await paramsService.removeFavoriteAgent(userId, agentId);

  res.json({
    success: true,
    message: 'Agent retiré des favoris',
    data: favorites
  });
}));

// ================================
// LANGUAGE ROUTES
// ================================

router.get('/language', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const language = await paramsService.getLanguageSettings(userId);

  res.json({
    success: true,
    data: language
  });
}));

router.patch('/language', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const language = await paramsService.updateLanguageSettings(userId, req.body);

  res.json({
    success: true,
    message: 'Paramètres de langue mis à jour',
    data: language
  });
}));

router.put('/language/preferred', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { language: lang } = req.body;

  if (!lang) {
    return res.status(400).json({
      success: false,
      message: 'Langue requise'
    });
  }

  const language = await paramsService.setPreferredLanguage(userId, lang);

  res.json({
    success: true,
    message: 'Langue préférée mise à jour',
    data: language
  });
}));

router.put('/language/timezone', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { timezone } = req.body;

  if (!timezone) {
    return res.status(400).json({
      success: false,
      message: 'Fuseau horaire requis'
    });
  }

  const language = await paramsService.setTimezone(userId, timezone);

  res.json({
    success: true,
    message: 'Fuseau horaire mis à jour',
    data: language
  });
}));

router.put('/language/currency', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { code, symbol, position } = req.body;

  if (!code || !symbol) {
    return res.status(400).json({
      success: false,
      message: 'Code et symbole de devise requis'
    });
  }

  const language = await paramsService.setCurrency(userId, code, symbol, position || 'after');

  res.json({
    success: true,
    message: 'Devise mise à jour',
    data: language
  });
}));

// ================================
// REGION ROUTES
// ================================

router.get('/region', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const region = await paramsService.getRegionSettings(userId);

  res.json({
    success: true,
    data: region
  });
}));

router.patch('/region', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const region = await paramsService.updateRegionSettings(userId, req.body);

  res.json({
    success: true,
    message: 'Paramètres de région mis à jour',
    data: region
  });
}));

router.put('/region/current', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { region: reg } = req.body;

  if (!reg) {
    return res.status(400).json({
      success: false,
      message: 'Région requise'
    });
  }

  const region = await paramsService.setCurrentRegion(userId, reg);

  res.json({
    success: true,
    message: 'Région actuelle mise à jour',
    data: region
  });
}));

router.post('/region/preferred', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { region: reg } = req.body;

  if (!reg) {
    return res.status(400).json({
      success: false,
      message: 'Région requise'
    });
  }

  const region = await paramsService.addPreferredRegion(userId, reg);

  res.json({
    success: true,
    message: 'Région préférée ajoutée',
    data: region
  });
}));

router.delete('/region/preferred/:region', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { region: reg } = req.params;

  const region = await paramsService.removePreferredRegion(userId, reg);

  res.json({
    success: true,
    message: 'Région préférée supprimée',
    data: region
  });
}));

router.put('/region/measurement-unit', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { unit } = req.body;

  if (!unit || !['metric', 'imperial'].includes(unit)) {
    return res.status(400).json({
      success: false,
      message: 'Unité de mesure invalide (metric ou imperial)'
    });
  }

  const region = await paramsService.setMeasurementUnit(userId, unit);

  res.json({
    success: true,
    message: 'Unité de mesure mise à jour',
    data: region
  });
}));

// ================================
// UTILITY ROUTES
// ================================

router.post('/reset', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { sections } = req.body;

  const params = await paramsService.resetToDefaults(userId, sections);

  res.json({
    success: true,
    message: 'Paramètres réinitialisés',
    data: params
  });
}));

router.get('/export', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const exportData = await paramsService.exportUserParams(userId);

  res.json({
    success: true,
    data: exportData
  });
}));

router.delete('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const deleted = await paramsService.deleteUserParams(userId);

  res.json({
    success: true,
    message: deleted ? 'Paramètres supprimés' : 'Aucun paramètre à supprimer'
  });
}));

// Error handler
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error in params routes', { error: error.message, path: req.path });

  res.status(500).json({
    success: false,
    message: error.message || 'Erreur interne du serveur'
  });
});

export default router;
