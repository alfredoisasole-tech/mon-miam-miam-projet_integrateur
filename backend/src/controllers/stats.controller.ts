import type { Express, RequestHandler, Response, NextFunction } from 'express';
import type { AuthenticatedUser } from '../domain/orders.ts';
import { AppError } from '../http/errors.ts';
import type { StatsPeriod, StatsService } from '../services/stats.service.ts';

const PERIODS = new Set<StatsPeriod>(['day', 'week', 'month']);
const OVERVIEW_ROLES = new Set(['manager', 'admin']);
const WEEKLY_ROLES = new Set(['employee', 'manager', 'admin']);

function staffForRoute(
  response: Response,
  next: NextFunction,
  allowedRoles: Set<string>,
): AuthenticatedUser | null {
  const user = response.locals['authenticatedUser'] as AuthenticatedUser | undefined;
  if (!user || !allowedRoles.has(user.role) || !user.restaurantId) {
    next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée au personnel autorisé du restaurant.'));
    return null;
  }
  return user;
}

export function registerStatsRoutes(app: Express, service: StatsService, authenticate: RequestHandler): void {
  app.get('/api/staff/stats/overview', authenticate, (req, res, next) => {
    const user = staffForRoute(res, next, OVERVIEW_ROLES);
    if (!user) return;
    const periodInput = req.query['period'];
    const period = periodInput === undefined ? 'day' : periodInput;
    if (typeof period !== 'string' || !PERIODS.has(period as StatsPeriod)) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Le paramètre period doit valoir day, week ou month.'));
      return;
    }
    try {
      res.status(200).json(service.overview(user.restaurantId!, period as StatsPeriod));
    } catch (error) { next(error); }
  });

  app.get('/api/staff/stats/weekly', authenticate, (req, res, next) => {
    const user = staffForRoute(res, next, WEEKLY_ROLES);
    if (!user) return;
    try {
      res.status(200).json(service.weekly(user.restaurantId!));
    } catch (error) { next(error); }
  });
}
