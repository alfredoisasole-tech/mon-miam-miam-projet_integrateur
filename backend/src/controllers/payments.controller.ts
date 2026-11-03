import { createHash, timingSafeEqual } from 'node:crypto';
import express, { type Express, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { AppError } from '../http/errors.ts';
import type { Environnement } from '../config.ts';
import { PaymentsService } from '../services/payments.service.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

export interface PaymentRouteOptions {
  service: PaymentsService;
  authenticate: RequestHandler;
  env: Environnement;
  /** Clé secrète de l'adresse de notification Easypay (`?key=`), requise pour exposer cette route. */
  ipnKey?: string;
}

function sameKey(received: string, expected: string): boolean {
  const empreinte = (valeur: string) => createHash('sha256').update(valeur).digest();
  return timingSafeEqual(empreinte(received), empreinte(expected));
}

function currentStudent(response: Response, next: NextFunction): AuthenticatedUser | null {
  const user = response.locals['authenticatedUser'] as AuthenticatedUser | undefined;
  if (user && user.role === 'student') return user;
  next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée aux étudiants.'));
  return null;
}

export function registerPaymentRoutes(app: Express, options: PaymentRouteOptions): void {
  app.post('/api/orders/:id/pay', options.authenticate, async (req, res, next) => {
    const user = currentStudent(res, next);
    if (!user) return;
    try {
      const orderId = req.params['id'];
      if (typeof orderId !== 'string' || orderId.length === 0) throw new AppError(404, 'NOT_FOUND', 'Commande introuvable.');
      const result = await options.service.start(user.id, orderId, req.body as unknown);
      res.status(result.replayed ? 200 : 201).json(result.payment);
    } catch (error) { next(error); }
  });

  app.post('/api/payments/:id/simulate', (req, _res, next) => {
    // La simulation ne doit jamais pouvoir confirmer un paiement quand un fournisseur réel est configuré.
    if (options.env === 'production' || options.service.supportsIpn) {
      next(new AppError(404, 'NOT_FOUND', 'Route introuvable.'));
      return;
    }
    next();
  }, options.authenticate, async (req, res, next) => {
    const user = currentStudent(res, next);
    if (!user) return;
    try {
      const paymentId = req.params['id'];
      if (typeof paymentId !== 'string' || paymentId.length === 0) {
        throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
      }
      const result = await options.service.simulate(user.id, paymentId, req.body as unknown);
      res.status(200).json(result);
    } catch (error) { next(error); }
  });

  app.post('/api/payments/webhook', async (req, res, next) => {
    try {
      const rawBody = (req as RequestWithRawBody).rawBody ?? Buffer.alloc(0);
      const result = await options.service.receiveWebhook(rawBody, req.header('X-Payment-Signature'), req.body as unknown);
      res.status(200).json(result);
    } catch (error) { next(error); }
  });

  // Notification d'un fournisseur qui ne signe pas ses messages (Easypay). Le corps est lu même sans type JSON.
  if (options.service.supportsIpn && options.ipnKey) {
    const ipnKey = options.ipnKey;
    app.post('/api/payments/easypay/ipn', express.json({ type: () => true, limit: '100kb' }), async (req, res, next) => {
      try {
        const key = typeof req.query['key'] === 'string' ? req.query['key'] : '';
        if (!sameKey(key, ipnKey)) throw new AppError(401, 'INVALID_IPN_KEY', 'La clé de la notification est absente ou invalide.');
        const result = await options.service.receiveIpn(req.body as unknown);
        res.status(result.status === 'pending' ? 202 : 200).json(result);
      } catch (error) { next(error); }
    });
  }
}
