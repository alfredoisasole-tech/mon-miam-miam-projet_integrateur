import type { Express, RequestHandler } from 'express';
import { AppError } from '../http/errors.ts';
import { OrdersService } from '../services/orders.service.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';

export interface OrderRouteOptions { service: OrdersService; authenticate: RequestHandler }

export function registerOrderRoutes(app: Express, options: OrderRouteOptions): void {
  app.post('/api/orders', options.authenticate, async (req, res, next) => {
    const user = res.locals['authenticatedUser'] as AuthenticatedUser | undefined;
    if (!user || user.role !== 'student') {
      next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée aux étudiants.'));
      return;
    }
    try {
      const result = await options.service.create(user.id, req.body as unknown, req.header('Idempotency-Key'));
      if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
      res.status(result.replayed ? 200 : 201).json(result.order);
    } catch (error) { next(error); }
  });
}
