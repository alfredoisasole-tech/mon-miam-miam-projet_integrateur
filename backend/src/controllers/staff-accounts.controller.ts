import type { Express, RequestHandler, Response } from 'express';
import type { AuthenticatedUser } from '../domain/orders.ts';
import { AppError } from '../http/errors.ts';
import { StaffAccountsService } from '../services/staff-accounts.service.ts';

type StaffAdministrator = AuthenticatedUser & { restaurantId: string; role: 'manager' | 'admin' };

function administrator(response: Response, next: (error?: unknown) => void, allowed: Set<string>): StaffAdministrator | null {
  const user = response.locals['authenticatedUser'] as AuthenticatedUser | undefined;
  if (user && allowed.has(user.role) && typeof user.restaurantId === 'string' && user.restaurantId) {
    return user as StaffAdministrator;
  }
  next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée au personnel autorisé du restaurant.'));
  return null;
}

export function registerStaffAccountRoutes(app: Express, service: StaffAccountsService, authenticate: RequestHandler): void {
  app.get('/api/staff/accounts', authenticate, (req, res, next) => {
    const user = administrator(res, next, new Set(['manager', 'admin']));
    if (!user) return;
    try { res.status(200).json(service.list(user)); }
    catch (error) { next(error); }
  });

  app.post('/api/staff/accounts', authenticate, (req, res, next) => {
    const user = administrator(res, next, new Set(['manager', 'admin']));
    if (!user) return;
    try { res.status(201).json(service.create(user, req.body as unknown)); }
    catch (error) { next(error); }
  });

  app.post('/api/staff/accounts/:id/reset-password', authenticate, (req, res, next) => {
    const user = administrator(res, next, new Set(['manager', 'admin']));
    if (!user) return;
    try {
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'STAFF_ACCOUNT_NOT_FOUND', 'Compte du personnel introuvable.');
      res.status(200).json(service.resetPassword(user, id));
    } catch (error) { next(error); }
  });

  app.patch('/api/staff/accounts/:id', authenticate, (req, res, next) => {
    const user = administrator(res, next, new Set(['admin']));
    if (!user) return;
    try {
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'STAFF_ACCOUNT_NOT_FOUND', 'Compte du personnel introuvable.');
      res.status(200).json(service.update(user, id, req.body as unknown));
    } catch (error) { next(error); }
  });
}
