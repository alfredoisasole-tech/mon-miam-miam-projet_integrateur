import type { Express, NextFunction, RequestHandler, Response } from 'express';
import { AppError } from '../http/errors.ts';
import { OrdersService } from '../services/orders.service.ts';
import type { AuthenticatedUser, OrderStatus } from '../domain/orders.ts';
import type { SqliteOrdersRepository } from '../repositories/sqlite-orders.repo.ts';

export interface OrderRouteOptions { service: OrdersService; authenticate: RequestHandler }

const ORDER_STATUSES = new Set<OrderStatus>([
  'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled',
]);

function currentStudent(response: Response, next: NextFunction): AuthenticatedUser | null {
  const user = response.locals['authenticatedUser'] as AuthenticatedUser | undefined;
  if (user && user.role === 'student') return user;
  next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée aux étudiants.'));
  return null;
}

function parsePositiveInteger(value: unknown, field: string, defaultValue: number, maximum?: number): number {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Le paramètre ${field} doit être un entier positif.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (maximum !== undefined && parsed > maximum)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Le paramètre ${field} dépasse la limite autorisée.`);
  }
  return parsed;
}

export function registerOrderRoutes(app: Express, options: OrderRouteOptions): void {
  app.post('/api/orders', options.authenticate, async (req, res, next) => {
    const user = currentStudent(res, next);
    if (!user) return;
    try {
      const result = await options.service.create(user.id, req.body as unknown, req.header('Idempotency-Key'));
      if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
      res.status(result.replayed ? 200 : 201).json(result.order);
    } catch (error) { next(error); }
  });

  app.get('/api/orders', options.authenticate, async (req, res, next) => {
    const user = currentStudent(res, next);
    if (!user) return;
    try {
      const page = parsePositiveInteger(req.query['page'], 'page', 1);
      const pageSize = parsePositiveInteger(req.query['pageSize'], 'pageSize', 20, 100);
      let status: OrderStatus | undefined;
      const statusInput = req.query['status'];
      if (statusInput !== undefined) {
        if (typeof statusInput !== 'string' || !ORDER_STATUSES.has(statusInput as OrderStatus)) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Le paramètre status ne correspond pas à un statut de commande connu.');
        }
        status = statusInput as OrderStatus;
      }
      res.status(200).json(await options.service.list(user.id, { page, pageSize, status }));
    } catch (error) { next(error); }
  });

  app.get('/api/orders/:id', options.authenticate, async (req, res, next) => {
    const user = currentStudent(res, next);
    if (!user) return;
    try {
      const orderId = req.params['id'];
      if (typeof orderId !== 'string') throw new AppError(404, 'NOT_FOUND', 'Commande introuvable.');
      const order = await options.service.getById(user.id, orderId);
      if (!order) throw new AppError(404, 'NOT_FOUND', 'Commande introuvable.');
      res.status(200).json(order);
    } catch (error) { next(error); }
  });

  app.post('/api/orders/:id/cancel', options.authenticate, async (req, res, next) => {
    const user = currentStudent(res, next);
    if (!user) return;
    try {
      const orderId = req.params['id'];
      if (typeof orderId !== 'string') throw new AppError(404, 'NOT_FOUND', 'Commande introuvable.');
      res.status(200).json(await options.service.cancel(user.id, orderId));
    } catch (error) { next(error); }
  });
}

const STAFF_ROLES = new Set(['employee', 'manager', 'admin']);
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['completed', 'out_for_delivery'],
  out_for_delivery: ['completed'],
  completed: [],
  cancelled: [],
};

export function registerStaffOrderRoutes(
  app: Express,
  options: { repository: SqliteOrdersRepository; authenticate: RequestHandler; now?: () => Date },
): void {
  app.get('/api/staff/orders', options.authenticate, async (req, res, next) => {
    const user = res.locals['authenticatedUser'] as AuthenticatedUser | undefined;
    if (!user || !STAFF_ROLES.has(user.role) || !user.restaurantId) {
      next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée au personnel d’un restaurant.'));
      return;
    }
    try {
      const status = req.query['status'];
      if (status !== undefined && (typeof status !== 'string' || !ORDER_STATUSES.has(status as OrderStatus))) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Le statut de commande est invalide.');
      }
      const orders = await options.repository.listRestaurantOrders(user.restaurantId, status as OrderStatus | undefined);
      res.status(200).json({ items: orders });
    } catch (error) { next(error); }
  });

  app.patch('/api/staff/orders/:id/status', options.authenticate, async (req, res, next) => {
    const user = res.locals['authenticatedUser'] as AuthenticatedUser | undefined;
    if (!user || !STAFF_ROLES.has(user.role) || !user.restaurantId) {
      next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée au personnel d’un restaurant.'));
      return;
    }
    try {
      const orderId = req.params['id'];
      const status = req.body?.status;
      if (typeof orderId !== 'string' || typeof status !== 'string' || !ORDER_STATUSES.has(status as OrderStatus)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Le statut demandé est invalide.');
      }
      const existing = (await options.repository.listRestaurantOrders(user.restaurantId)).find((order) => order.id === orderId);
      if (!existing) throw new AppError(404, 'NOT_FOUND', 'Commande introuvable.');
      const nextStatus = status as OrderStatus;
      if (!STATUS_TRANSITIONS[existing.status].includes(nextStatus)
        || (nextStatus === 'out_for_delivery' && existing.type !== 'delivery')
        || (nextStatus === 'completed' && existing.type === 'delivery' && existing.status !== 'out_for_delivery')
        || (nextStatus === 'cancelled' && ['pending', 'paid'].includes(existing.paymentStatus))) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Cette transition de statut n’est pas autorisée.');
      }
      const order = await options.repository.updateRestaurantOrderStatus(
        user.restaurantId, orderId, existing.status, user.id, nextStatus, (options.now?.() ?? new Date()).toISOString(),
      );
      if (!order) throw new AppError(409, 'ORDER_CHANGED', 'La commande a été modifiée par une autre requête. Actualisez-la avant de réessayer.');
      res.status(200).json(order);
    } catch (error) { next(error); }
  });
}
