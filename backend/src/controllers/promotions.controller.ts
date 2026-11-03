import { randomUUID } from 'node:crypto';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import type { Database } from '../db/database.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';
import type { PromotionKind } from '../domain/promotions.ts';
import { AppError } from '../http/errors.ts';
import { PromotionsService } from '../services/promotions.service.ts';

const PROMOTION_KINDS = new Set<PromotionKind>(['promotion', 'event', 'game']);

interface PromotionRow {
  id: string;
  restaurant_id: string;
  kind: PromotionKind;
  title: string;
  description: string | null;
  image_asset_id: string | null;
  starts_at: string;
  ends_at: string;
  is_active: number;
}

function promotionOutput(row: PromotionRow) {
  return {
    id: row.id,
    type: row.kind,
    title: row.title,
    description: row.description,
    imageAssetId: row.image_asset_id,
    startDate: row.starts_at,
    endDate: row.ends_at,
    isActive: row.is_active === 1,
  };
}

function promotionAdmin(response: Response, next: NextFunction): (AuthenticatedUser & { restaurantId: string }) | null {
  const user = response.locals['authenticatedUser'] as AuthenticatedUser | undefined;
  if (user?.role === 'admin' && typeof user.restaurantId === 'string' && user.restaurantId) {
    return { ...user, restaurantId: user.restaurantId };
  }
  next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée à l’administrateur du restaurant.'));
  return null;
}

function requestObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, 'INVALID_BODY', 'Le corps de la requête doit être un objet JSON.');
  }
  return value as Record<string, unknown>;
}

function isoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    throw new AppError(400, 'INVALID_BODY', `${field} doit être une date ISO 8601 avec fuseau horaire.`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new AppError(400, 'INVALID_BODY', `${field} est invalide.`);
  return date.toISOString();
}

interface ValidatedPromotion {
  kind?: PromotionKind; title?: string; description?: string | null; imageAssetId?: string | null;
  startsAt?: string; endsAt?: string; isActive?: boolean;
}

function validatePromotionBody(body: Record<string, unknown>, partial: boolean): ValidatedPromotion {
  const allowed = new Set(['type', 'title', 'description', 'imageAssetId', 'startDate', 'endDate', 'isActive']);
  if (Object.keys(body).length === 0 || Object.keys(body).some((key) => !allowed.has(key))) {
    throw new AppError(400, 'INVALID_BODY', 'Les champs de promotion sont invalides.');
  }
  if (!partial && (!('type' in body) || !('title' in body) || !('startDate' in body) || !('endDate' in body))) {
    throw new AppError(400, 'INVALID_BODY', 'Le type, le titre et les dates de validité sont obligatoires.');
  }
  const result: ValidatedPromotion = {};
  if ('type' in body) {
    if (typeof body['type'] !== 'string' || !PROMOTION_KINDS.has(body['type'] as PromotionKind)) {
      throw new AppError(400, 'INVALID_BODY', 'Le type doit être promotion, event ou game.');
    }
    result.kind = body['type'] as PromotionKind;
  }
  if ('title' in body) {
    if (typeof body['title'] !== 'string' || !body['title'].trim()) throw new AppError(400, 'INVALID_BODY', 'Le titre est obligatoire.');
    result.title = body['title'].trim();
  }
  if ('description' in body) {
    if (body['description'] !== null && typeof body['description'] !== 'string') {
      throw new AppError(400, 'INVALID_BODY', 'La description doit être du texte ou nulle.');
    }
    result.description = typeof body['description'] === 'string' ? body['description'].trim() || null : null;
  }
  if ('imageAssetId' in body) {
    if (body['imageAssetId'] !== null && (typeof body['imageAssetId'] !== 'string' || !body['imageAssetId'].trim())) {
      throw new AppError(400, 'INVALID_BODY', 'imageAssetId doit être un identifiant ou nul.');
    }
    result.imageAssetId = typeof body['imageAssetId'] === 'string' ? body['imageAssetId'].trim() : null;
  }
  if ('startDate' in body) result.startsAt = isoDate(body['startDate'], 'startDate');
  if ('endDate' in body) result.endsAt = isoDate(body['endDate'], 'endDate');
  if ('isActive' in body) {
    if (typeof body['isActive'] !== 'boolean') throw new AppError(400, 'INVALID_BODY', 'isActive doit être un booléen.');
    result.isActive = body['isActive'];
  }
  return result;
}

export function registerPromotionRoutes(
  app: Express,
  service: PromotionsService,
  db: Database,
  authenticate: RequestHandler,
  options: { now?: () => Date } = {},
): void {
  app.get('/api/restaurants/:slug/promotions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slug = req.params['slug'];
      if (typeof slug !== 'string') throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable ou désactivé.');
      res.status(200).json(await service.listByRestaurantSlug(slug));
    } catch (error) { next(error); }
  });

  app.get('/api/admin/promotions', authenticate, (req, res, next) => {
    const user = promotionAdmin(res, next);
    if (!user) return;
    try {
      const rows = db.all<PromotionRow>(
        `SELECT id, restaurant_id, kind, title, description, image_asset_id, starts_at, ends_at, is_active
         FROM promotions WHERE restaurant_id = ? ORDER BY starts_at, id`, [user.restaurantId],
      );
      res.status(200).json(rows.map(promotionOutput));
    } catch (error) { next(error); }
  });

  app.post('/api/admin/promotions', authenticate, (req, res, next) => {
    const user = promotionAdmin(res, next);
    if (!user) return;
    try {
      const body = requestObject(req.body);
      const input = validatePromotionBody(body, false);
      const startsAt = input.startsAt!;
      const endsAt = input.endsAt!;
      if (endsAt < startsAt) throw new AppError(400, 'INVALID_BODY', 'La date de fin doit être égale ou postérieure à la date de début.');
      if (input.imageAssetId && !db.get(
        "SELECT id FROM assets WHERE id = ? AND restaurant_id = ? AND kind = 'poster'",
        [input.imageAssetId, user.restaurantId],
      )) throw new AppError(400, 'INVALID_BODY', 'L’image doit être une affiche du même restaurant.');
      const id = `promo_${randomUUID()}`;
      const timestamp = (options.now?.() ?? new Date()).toISOString();
      db.run(`INSERT INTO promotions (id, restaurant_id, kind, title, description, image_asset_id, starts_at, ends_at, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.restaurantId, input.kind!, input.title!, input.description ?? null, input.imageAssetId ?? null,
        startsAt, endsAt, input.isActive === false ? 0 : 1, timestamp, timestamp]);
      const created = db.get<PromotionRow>(
        `SELECT id, restaurant_id, kind, title, description, image_asset_id, starts_at, ends_at, is_active
         FROM promotions WHERE id = ? AND restaurant_id = ?`, [id, user.restaurantId],
      );
      if (!created) throw new Error('La promotion créée ne peut pas être relue.');
      res.status(201).json(promotionOutput(created));
    } catch (error) { next(error); }
  });

  app.patch('/api/admin/promotions/:id', authenticate, (req, res, next) => {
    const user = promotionAdmin(res, next);
    if (!user) return;
    try {
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'PROMOTION_NOT_FOUND', 'Promotion introuvable.');
      const existing = db.get<PromotionRow>(
        `SELECT id, restaurant_id, kind, title, description, image_asset_id, starts_at, ends_at, is_active
         FROM promotions WHERE id = ? AND restaurant_id = ?`, [id, user.restaurantId],
      );
      if (!existing) throw new AppError(404, 'PROMOTION_NOT_FOUND', 'Promotion introuvable.');
      const input = validatePromotionBody(requestObject(req.body), true);
      const startsAt = input.startsAt ?? existing.starts_at;
      const endsAt = input.endsAt ?? existing.ends_at;
      if (endsAt < startsAt) throw new AppError(400, 'INVALID_BODY', 'La date de fin doit être égale ou postérieure à la date de début.');
      const imageAssetId = input.imageAssetId === undefined ? existing.image_asset_id : input.imageAssetId;
      if (imageAssetId && !db.get(
        "SELECT id FROM assets WHERE id = ? AND restaurant_id = ? AND kind = 'poster'",
        [imageAssetId, user.restaurantId],
      )) throw new AppError(400, 'INVALID_BODY', 'L’image doit être une affiche du même restaurant.');
      const timestamp = (options.now?.() ?? new Date()).toISOString();
      db.run(`UPDATE promotions SET kind = ?, title = ?, description = ?, image_asset_id = ?, starts_at = ?, ends_at = ?, is_active = ?, updated_at = ?
        WHERE id = ? AND restaurant_id = ?`,
      [input.kind ?? existing.kind, input.title ?? existing.title,
        input.description === undefined ? existing.description : input.description, imageAssetId,
        startsAt, endsAt, input.isActive === undefined ? existing.is_active : input.isActive ? 1 : 0,
        timestamp, id, user.restaurantId]);
      const updated = db.get<PromotionRow>(
        `SELECT id, restaurant_id, kind, title, description, image_asset_id, starts_at, ends_at, is_active
         FROM promotions WHERE id = ? AND restaurant_id = ?`, [id, user.restaurantId],
      );
      if (!updated) throw new Error('La promotion modifiée ne peut pas être relue.');
      res.status(200).json(promotionOutput(updated));
    } catch (error) { next(error); }
  });

  app.delete('/api/admin/promotions/:id', authenticate, (req, res, next) => {
    const user = promotionAdmin(res, next);
    if (!user) return;
    try {
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'PROMOTION_NOT_FOUND', 'Promotion introuvable.');
      const result = db.run('DELETE FROM promotions WHERE id = ? AND restaurant_id = ?', [id, user.restaurantId]);
      if (!Number(result.changes)) throw new AppError(404, 'PROMOTION_NOT_FOUND', 'Promotion introuvable.');
      res.status(204).end();
    } catch (error) { next(error); }
  });
}
