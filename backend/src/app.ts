import express, { type ErrorRequestHandler, type Express } from 'express';
import type { Config } from './config.ts';
import { AppError } from './http/errors.ts';
import { cors, securityHeaders } from './http/security.ts';

export interface AppOptions {
  /** Routes supplémentaires, ajoutées avant la gestion des routes inconnues et des erreurs (utile pour les tests). */
  routes?: (app: Express) => void;
}

interface ErreurDeLecture {
  type?: string;
}

/** Toute erreur de l'API prend la même forme : { error: { code, message, details } }. */
const gestionnaireDErreurs: ErrorRequestHandler = (erreur: unknown, _req, res, _next) => {
  if (erreur instanceof AppError) {
    res.status(erreur.status).json({ error: { code: erreur.code, message: erreur.message, details: erreur.details } });
    return;
  }
  const type = (erreur as ErreurDeLecture | null)?.type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: "Le corps de la requête n'est pas un JSON valide.", details: [] } });
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

  options.routes?.(app);

  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route introuvable.')));
  app.use(gestionnaireDErreurs);
  return app;
}
