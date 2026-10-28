import type { RequestHandler } from 'express';

/** En-têtes de sécurité pour une API JSON. */
export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.set({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
      'strict-transport-security': 'max-age=15552000; includeSubDomains',
    });
    next();
  };
}

/** Autorise uniquement les adresses de site listées à appeler l'API depuis un navigateur. */
export function cors(origines: string[]): RequestHandler {
  const autorisees = new Set(origines);
  return (req, res, next) => {
    const origine = req.headers.origin;
    const autorise = origine !== undefined && autorisees.has(origine);
    if (autorise) res.set({ 'access-control-allow-origin': origine, vary: 'Origin' });
    if (req.method === 'OPTIONS') {
      if (autorise) {
        res.set({
          'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'access-control-allow-headers': 'Authorization, Content-Type, Idempotency-Key',
          'access-control-max-age': '600',
        });
      }
      res.status(204).end();
      return;
    }
    next();
  };
}
