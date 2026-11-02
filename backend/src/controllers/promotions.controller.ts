import type { Express, NextFunction, Request, Response } from 'express';
import { AppError } from '../http/errors.ts';
import { PromotionsService } from '../services/promotions.service.ts';

export function registerPromotionRoutes(app: Express, service: PromotionsService): void {
  app.get('/api/restaurants/:slug/promotions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params['slug'];
      if (typeof slug !== 'string') throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable ou désactivé.');
      res.status(200).json(await service.listByRestaurantSlug(slug));
    } catch (error) { next(error); }
  });
}
