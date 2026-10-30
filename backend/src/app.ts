import express, { type ErrorRequestHandler, type Express, type Request } from 'express';
import type { Config } from './config.ts';
import { AppError } from './http/errors.ts';
import { cors, securityHeaders } from './http/security.ts';
import type { Database } from './db/database.ts';
import { createAuthMiddleware, type TokenResolver } from './http/auth.ts';
import { registerRestaurantsMenuRoutes } from './controllers/restaurants-menu.controller.ts';
import { registerOrderRoutes } from './controllers/orders.controller.ts';
import { OrdersService } from './services/orders.service.ts';
import { SqliteOrdersRepository } from './repositories/sqlite-orders.repo.ts';
import { registerPaymentRoutes } from './controllers/payments.controller.ts';
import { PaymentsService } from './services/payments.service.ts';
import { SqlitePaymentsRepository } from './repositories/sqlite-payments.repo.ts';
import { SimulatedPaymentProvider, type PaymentProvider } from './domain/payments.ts';

export interface AppOptions {
  /** Routes supplémentaires, ajoutées avant la gestion des routes inconnues et des erreurs (utile pour les tests). */
  routes?: (app: Express) => void;
  database?: Database;
  now?: () => Date;
  /** Résout l’identité du jeton ; l’authentification réelle peut être remplacée sans toucher aux routes. */
  resolveToken?: TokenResolver;
  /** Fournisseur remplaçable dans les tests et lors de l’intégration future d’un agrégateur. */
  paymentProvider?: PaymentProvider;
}

interface ErreurDeLecture {
  type?: string;
}

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/** Toute erreur de l'API prend la même forme : { error: { code, message, details } }. */
const gestionnaireDErreurs: ErrorRequestHandler = (erreur: unknown, _req, res, _next) => {
  if (erreur instanceof AppError) {
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
  app.use(express.json({
    limit: '1mb',
    verify: (request, _response, body) => {
      if ((request as Request).originalUrl.split('?')[0] === '/api/payments/webhook') {
        (request as RequestWithRawBody).rawBody = Buffer.from(body);
      }
    },
  }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  if (options.database) {
    registerRestaurantsMenuRoutes(app, options.database, { now: options.now });
    const authenticate = createAuthMiddleware(options.resolveToken ?? (() => null));
    registerOrderRoutes(app, {
      service: new OrdersService(new SqliteOrdersRepository(options.database), { now: options.now }),
      authenticate,
    });
    registerPaymentRoutes(app, {
      env: config.env,
      service: new PaymentsService(
        new SqlitePaymentsRepository(options.database),
        options.paymentProvider ?? new SimulatedPaymentProvider(config.paymentWebhookSecret),
        { now: options.now },
      ),
      authenticate,
    });
  }
  options.routes?.(app);

  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route introuvable.')));
  app.use(gestionnaireDErreurs);
  return app;
}
