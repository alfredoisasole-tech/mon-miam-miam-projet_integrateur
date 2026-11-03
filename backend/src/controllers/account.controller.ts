import type { Express, RequestHandler, Response } from 'express';
import type { AuthenticatedUser } from '../domain/orders.ts';
import { authGuards } from '../http/guards.ts';
import type { AccountService } from '../services/account.service.ts';

function userId(response: Response): string {
  return (response.locals['authenticatedUser'] as AuthenticatedUser).id;
}

export function registerAccountRoutes(app: Express, service: AccountService, authenticate: RequestHandler): void {
  const onlyStudent = authGuards.role('student');

  app.get('/api/me/export', authenticate, onlyStudent, (_req, res, next) => {
    try {
      res.setHeader('Content-Disposition', 'attachment; filename="mes-donnees.json"');
      res.status(200).json(service.exportData(userId(res)));
    } catch (error) { next(error); }
  });

  app.delete('/api/me', authenticate, onlyStudent, (req, res, next) => {
    try {
      const body = req.body as { password?: unknown } | undefined;
      res.status(200).json(service.deleteAccount(userId(res), body?.password));
    } catch (error) { next(error); }
  });
}
