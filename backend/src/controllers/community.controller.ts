import type { Express, Request, RequestHandler, Response } from 'express';
import type { AuthenticatedUser } from '../domain/orders.ts';
import { AppError } from '../http/errors.ts';
import { authGuards } from '../http/guards.ts';
import type { CommunityService } from '../services/community.service.ts';

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string' || !value) throw new AppError(404, 'NOT_FOUND', 'Ressource introuvable.');
  return value;
}

function userId(response: Response): string {
  return (response.locals['authenticatedUser'] as AuthenticatedUser).id;
}

export function registerCommunityRoutes(app: Express, service: CommunityService, authenticate: RequestHandler): void {
  const onlyStudent = authGuards.role('student');

  app.get('/api/restaurants/:slug/referral', authenticate, onlyStudent, (req, res, next) => {
    try { res.status(200).json(service.referral(userId(res), parameter(req, 'slug'))); }
    catch (error) { next(error); }
  });

  app.post('/api/orders/:id/review', authenticate, onlyStudent, (req, res, next) => {
    try { res.status(201).json(service.review(userId(res), parameter(req, 'id'), req.body as unknown)); }
    catch (error) { next(error); }
  });

  app.get('/api/restaurants/:slug/top-clients', authenticate, onlyStudent, (req, res, next) => {
    try { res.status(200).json(service.topClients(userId(res), parameter(req, 'slug'), req.query['period'])); }
    catch (error) { next(error); }
  });
}
