
// Middleware de limitation pour les requêtes d'authentification
export const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Trop de tentatives, veuillez réessayer plus tard'
  },
  keyGenerator: (req) => {
    return `auth:${req.ip}`;
  },
});