import type { Express, Request, RequestHandler } from 'express';
import { AuthService } from '../services/auth.service.ts';

export function registerAuthRoutes(
  app: Express,
  service: AuthService,
  authenticate: RequestHandler,
  sendPasswordResetCode?: (identifier: string, code: string) => Promise<void>,
): void {
  app.post('/api/restaurants/:slug/auth/register', (req, res, next) => {
    try {
      const body = req.body && typeof req.body === 'object' ? { ...req.body, restaurant: req.params['slug'] } : req.body;
      res.status(201).json(service.register(body, req.ip ?? 'unknown'));
    } catch (error) { next(error); }
  });
  app.post('/api/auth/login', (req: Request, res, next) => {
    try { res.status(200).json(service.login(req.body?.identifier, req.body?.password, req.ip ?? 'unknown')); }
    catch (error) { next(error); }
  });
  app.get('/api/me', authenticate, (_req, res, next) => {
    try {
      const user = res.locals['authenticatedUser'] as { id: string };
      res.status(200).json(service.profile(user.id));
    } catch (error) { next(error); }
  });
  app.post('/api/auth/forgot-password', async (req, res, next) => {
    try { res.status(202).json(await service.forgotPassword(req.body?.identifier, sendPasswordResetCode)); }
    catch (error) { next(error); }
  });
  app.post('/api/auth/reset-password', (req, res, next) => {
    try {
      res.status(200).json(service.resetPassword(req.body?.identifier, req.body?.code, req.body?.newPassword));
    } catch (error) { next(error); }
  });
}
