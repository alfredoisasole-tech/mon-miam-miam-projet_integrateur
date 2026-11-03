import type { Express, RequestHandler, Response } from 'express';
import type { AuthenticatedUser } from '../domain/orders.ts';
import { authGuards } from '../http/guards.ts';
import type { SettingsService } from '../services/settings.service.ts';

function restaurantId(response: Response): string {
  return (response.locals['authenticatedUser'] as AuthenticatedUser & { restaurantId: string }).restaurantId;
}

export function registerSettingsRoutes(app: Express, service: SettingsService, authenticate: RequestHandler): void {
  const onlyAdmin = [authGuards.role('admin'), authGuards.staffOnly];

  app.get('/api/admin/settings', authenticate, ...onlyAdmin, (_req, res, next) => {
    try { res.status(200).json(service.get(restaurantId(res))); }
    catch (error) { next(error); }
  });

  app.patch('/api/admin/settings', authenticate, ...onlyAdmin, (req, res, next) => {
    try { res.status(200).json(service.update(restaurantId(res), req.body as unknown)); }
    catch (error) { next(error); }
  });

  app.post('/api/admin/assets', authenticate, ...onlyAdmin, (req, res, next) => {
    try { res.status(201).json(service.uploadAsset(restaurantId(res), req.body as unknown)); }
    catch (error) { next(error); }
  });
}
