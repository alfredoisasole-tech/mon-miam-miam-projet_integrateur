import type { Express, Request, RequestHandler, Response } from 'express';
import { CLAIM_STATUSES, type ClaimStatus } from '../domain/claims.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';
import { AppError } from '../http/errors.ts';
import { authGuards } from '../http/guards.ts';
import type { ClaimsService } from '../services/claims.service.ts';

type Staff = AuthenticatedUser & { restaurantId: string };

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== 'string' || !value) throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
  return value;
}

function positiveInteger(value: unknown, field: string, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > maximum) {
    throw new AppError(400, 'VALIDATION_ERROR', `Le paramètre ${field} doit être un entier entre 1 et ${maximum}.`);
  }
  return Number(value);
}

function pageOf(request: Request): { page: number; pageSize: number } {
  return {
    page: positiveInteger(request.query['page'], 'page', 1, 10_000),
    pageSize: positiveInteger(request.query['pageSize'], 'pageSize', 20, 100),
  };
}

function student(response: Response): AuthenticatedUser {
  return response.locals['authenticatedUser'] as AuthenticatedUser;
}

function staff(response: Response): Staff {
  return response.locals['authenticatedUser'] as Staff;
}

export function registerClaimRoutes(app: Express, service: ClaimsService, authenticate: RequestHandler): void {
  const onlyStudent = authGuards.role('student');
  const onlyStaff = [authGuards.role('employee', 'manager', 'admin'), authGuards.staffOnly];
  const onlyValidators = [authGuards.role('manager', 'admin'), authGuards.staffOnly];

  // --- Étudiant ---------------------------------------------------------------
  app.post('/api/restaurants/:slug/claims', authenticate, onlyStudent, (req, res, next) => {
    try { res.status(201).json(service.create(student(res).id, parameter(req, 'slug'), req.body as unknown)); }
    catch (error) { next(error); }
  });

  app.get('/api/restaurants/:slug/claims', authenticate, onlyStudent, (req, res, next) => {
    try { res.status(200).json(service.listMine(student(res).id, parameter(req, 'slug'), pageOf(req))); }
    catch (error) { next(error); }
  });

  app.get('/api/claims/:id', authenticate, onlyStudent, (req, res, next) => {
    try { res.status(200).json(service.getMine(student(res).id, parameter(req, 'id'))); }
    catch (error) { next(error); }
  });

  // --- Personnel ----------------------------------------------------------------
  app.get('/api/staff/claims', authenticate, ...onlyStaff, (req, res, next) => {
    try {
      const status = req.query['status'];
      if (status !== undefined && (typeof status !== 'string' || ![...CLAIM_STATUSES, 'active'].includes(status))) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Le statut demandé est invalide.');
      }
      res.status(200).json(service.listForStaff(staff(res).restaurantId, (status as ClaimStatus | 'active' | undefined) ?? 'active', pageOf(req)));
    } catch (error) { next(error); }
  });

  app.get('/api/staff/claims/:id', authenticate, ...onlyStaff, (req, res, next) => {
    try { res.status(200).json(service.getForStaff(staff(res).restaurantId, parameter(req, 'id'))); }
    catch (error) { next(error); }
  });

  app.post('/api/staff/claims/:id/propose', authenticate, ...onlyStaff, (req, res, next) => {
    try { res.status(200).json(service.propose(staff(res), parameter(req, 'id'), req.body as unknown)); }
    catch (error) { next(error); }
  });

  app.post('/api/staff/claims/:id/validate', authenticate, ...onlyValidators, (req, res, next) => {
    try { res.status(200).json(service.validate(staff(res), parameter(req, 'id'), req.body as unknown)); }
    catch (error) { next(error); }
  });

  app.post('/api/staff/claims/:id/reject', authenticate, ...onlyValidators, (req, res, next) => {
    try { res.status(200).json(service.reject(staff(res), parameter(req, 'id'), req.body as unknown)); }
    catch (error) { next(error); }
  });
}
