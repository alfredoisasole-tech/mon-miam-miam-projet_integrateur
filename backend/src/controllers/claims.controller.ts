import type { Express, NextFunction, RequestHandler, Response } from 'express';
import type { AuthenticatedUser } from '../domain/orders.ts';
import { AppError } from '../http/errors.ts';
import { ClaimsService } from '../services/claims.service.ts';

const STAFF_ROLES = new Set(['employee', 'manager', 'admin']);
const SUPERVISOR_ROLES = new Set(['manager', 'admin']);
const CLAIM_STATUSES = new Set(['open', 'pending_validation', 'resolved']);

function student(response: Response, next: NextFunction): AuthenticatedUser | null {
  const user = response.locals['authenticatedUser'] as AuthenticatedUser | undefined;
  if (user?.role === 'student') return user;
  next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée aux étudiants.'));
  return null;
}

function staff(response: Response, next: NextFunction, roles: Set<string> = STAFF_ROLES): (AuthenticatedUser & { restaurantId: string }) | null {
  const user = response.locals['authenticatedUser'] as AuthenticatedUser | undefined;
  if (user && roles.has(user.role) && typeof user.restaurantId === 'string' && user.restaurantId) {
    return { ...user, restaurantId: user.restaurantId };
  }
  next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée au personnel autorisé du restaurant.'));
  return null;
}

export function registerClaimsRoutes(app: Express, service: ClaimsService, authenticate: RequestHandler): void {
  app.post('/api/claims', authenticate, (req, res, next) => {
    const user = student(res, next);
    if (!user) return;
    try { res.status(201).json(service.create(user.id, req.body as unknown)); }
    catch (error) { next(error); }
  });

  app.get('/api/claims', authenticate, (req, res, next) => {
    const user = student(res, next);
    if (!user) return;
    try { res.status(200).json(service.listForStudent(user.id)); }
    catch (error) { next(error); }
  });

  app.get('/api/claims/:id', authenticate, (req, res, next) => {
    const user = student(res, next);
    if (!user) return;
    try {
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
      res.status(200).json(service.getForStudent(user.id, id));
    } catch (error) { next(error); }
  });

  app.get('/api/staff/claims', authenticate, (req, res, next) => {
    const user = staff(res, next);
    if (!user) return;
    try {
      const status = req.query['status'];
      if (status !== undefined && (typeof status !== 'string' || !CLAIM_STATUSES.has(status))) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Le statut de réclamation est invalide.');
      }
      res.status(200).json(service.listForStaff(user.restaurantId, status as 'open' | 'pending_validation' | 'resolved' | undefined));
    } catch (error) { next(error); }
  });

  app.get('/api/staff/claims/:id', authenticate, (req, res, next) => {
    const user = staff(res, next);
    if (!user) return;
    try {
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
      res.status(200).json(service.getForStaff(user.restaurantId, id));
    } catch (error) { next(error); }
  });

  app.post('/api/staff/claims/:id/propose', authenticate, (req, res, next) => {
    const user = staff(res, next);
    if (!user) return;
    try {
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
      res.status(200).json(service.propose(user.restaurantId, user.id, id, req.body as unknown));
    } catch (error) { next(error); }
  });

  app.post('/api/staff/claims/:id/validate', authenticate, (req, res, next) => {
    const user = staff(res, next, SUPERVISOR_ROLES);
    if (!user) return;
    try {
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
      res.status(200).json(service.validate(user.restaurantId, user.id, user.role, id, req.body as unknown));
    } catch (error) { next(error); }
  });

  app.post('/api/staff/claims/:id/reject', authenticate, (req, res, next) => {
    const user = staff(res, next, SUPERVISOR_ROLES);
    if (!user) return;
    try {
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
      res.status(200).json(service.reject(user.restaurantId, id, req.body as unknown));
    } catch (error) { next(error); }
  });
}
