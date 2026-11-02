import type { Express, RequestHandler } from 'express';
import { AppError } from '../http/errors.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';
import type { LoyaltyService } from '../services/loyalty.service.ts';

export interface LoyaltyRouteOptions { service: LoyaltyService; authenticate: RequestHandler }

export function registerLoyaltyRoutes(app: Express, options: LoyaltyRouteOptions): void {
  app.get('/api/restaurants/:slug/loyalty', options.authenticate, async (req, res, next) => {
    const user = res.locals['authenticatedUser'] as AuthenticatedUser | undefined;
    if (!user || user.role !== 'student') {
      next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée aux étudiants.'));
      return;
    }
    try {
      const slug = req.params['slug'];
      if (typeof slug !== 'string') throw new AppError(404, 'NOT_FOUND', 'Restaurant introuvable.');
      res.status(200).json(await options.service.balance(user.id, slug));
    } catch (error) { next(error); }
  });
}
