import express, { type ErrorRequestHandler, type Express } from 'express';
import type { Config } from './config.ts';
import { AppError } from './http/errors.ts';
import { cors, securityHeaders } from './http/security.ts';
import type { Database } from './db/database.ts';
import { registerRestaurantsMenuRoutes } from './controllers/restaurants-menu.controller.ts';
import { registerAuthRoutes } from './controllers/auth.controller.ts';
import { AuthService } from './services/auth.service.ts';
import { createAuthMiddleware } from './http/auth.ts';
import { SqliteOrdersRepository } from './repositories/sqlite-orders.repo.ts';
import { OrdersService } from './services/orders.service.ts';
import { registerOrderRoutes, registerStaffOrderRoutes } from './controllers/orders.controller.ts';
import { registerPlatformRestaurantRoutes } from './controllers/platform-restaurants.controller.ts';
import { SqlitePromotionsRepository } from './repositories/sqlite-promotions.repo.ts';
import { PromotionsService } from './services/promotions.service.ts';
import { registerPromotionRoutes } from './controllers/promotions.controller.ts';

export interface AppOptions {
  /** Routes supplémentaires, ajoutées avant la gestion des routes inconnues et des erreurs (utile pour les tests). */
  routes?: (app: Express) => void;
  database?: Database;
  now?: () => Date;
  sendPasswordResetCode?: (identifier: string, code: string) => Promise<void>;
}

interface ErreurDeLecture {
  type?: string;
}

/** Toute erreur de l'API prend la même forme : { error: { code, message, details } }. */
const gestionnaireDErreurs: ErrorRequestHandler = (erreur: unknown, _req, res, _next) => {
  if (erreur instanceof AppError) {
    if (erreur.code === 'TOO_MANY_ATTEMPTS') res.setHeader('Retry-After', '900');
    res.status(erreur.status).json({ error: { code: erreur.code, message: erreur.message, details: erreur.details } });
    return;
  }
  const type = (erreur as ErreurDeLecture | null)?.type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "Le corps de la requête n'est pas un JSON valide.", details: [] } });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Le corps de la requête est trop volumineux.', details: [] } });
    return;
  }
  // Erreur inattendue : le détail reste dans les journaux du serveur, jamais dans la réponse.
  console.error('Erreur inattendue :', erreur);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.', details: [] } });
};

export function createApp(config: Config, options: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders());
  app.use(cors(config.corsOrigins));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  if (options.database) {
    registerRestaurantsMenuRoutes(app, options.database, { now: options.now });
    const auth = new AuthService(options.database, config.jwtSecret, options.now);
    const authenticate = createAuthMiddleware((token) => auth.authenticate(token));
    registerAuthRoutes(app, auth, authenticate, options.sendPasswordResetCode);
    registerPlatformRestaurantRoutes(app, options.database, authenticate);
    const orders = new SqliteOrdersRepository(options.database);
    registerOrderRoutes(app, { service: new OrdersService(orders, { now: options.now }), authenticate });
    registerStaffOrderRoutes(app, { repository: orders, authenticate, now: options.now });
    registerPromotionRoutes(app, new PromotionsService(new SqlitePromotionsRepository(options.database), options.now));
  }
  options.routes?.(app);

  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route introuvable.')));
  app.use(gestionnaireDErreurs);
  return app;
}
