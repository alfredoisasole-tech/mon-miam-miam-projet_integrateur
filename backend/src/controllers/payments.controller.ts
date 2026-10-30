import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../http/errors.ts';
import { PaymentsService } from '../services/payments.service.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

export interface PaymentRouteOptions {
  service: PaymentsService;
  authenticate: RequestHandler;
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

  app.post('/api/payments/webhook', async (req, res, next) => {
    try {
      const rawBody = (req as RequestWithRawBody).rawBody ?? Buffer.alloc(0);
      const result = await options.service.receiveWebhook(rawBody, req.header('X-Payment-Signature'), req.body as unknown);
      res.status(200).json(result);
    } catch (error) { next(error); }
  });
}
