import { randomUUID } from 'node:crypto';
import type { Express, RequestHandler, Response } from 'express';
import type { Database } from '../db/database.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';
import { AppError } from '../http/errors.ts';

const CATEGORIES = new Set(['plat', 'boisson', 'dessert', 'snack']);
const STAFF_ROLES = new Set(['employee', 'manager', 'admin']);
const ADMIN_ROLES = new Set(['admin']);

interface MenuDishRow {
  id: string;
  name: string;
  description: string | null;
  price_fc: number;
  category: string;
  is_daily: number;
  is_available: number;
  image_asset_id: string | null;
  restaurant_slug: string;
}

type StaffUser = AuthenticatedUser & { restaurantId: string };

function currentStaff(response: Response, next: (error?: unknown) => void, roles: Set<string>): StaffUser | null {
  const user = response.locals['authenticatedUser'] as AuthenticatedUser | undefined;
  if (user && roles.has(user.role) && user.restaurantId) return { ...user, restaurantId: user.restaurantId };
  next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée au personnel autorisé de ce restaurant.'));
  return null;
}

function requestObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, 'INVALID_BODY', 'Le corps de la requête doit être un objet JSON.');
  }
  return value as Record<string, unknown>;
}

function validateFields(body: Record<string, unknown>, fields: Set<string>, partial: boolean): void {
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !fields.has(key))) {
    throw new AppError(400, 'INVALID_BODY', 'Les champs de modification du plat sont invalides.');
  }
  if (!partial && [...fields].some((field) => field !== 'imageAssetId' && !(field in body))) {
    throw new AppError(400, 'INVALID_BODY', 'Tous les champs du plat sont obligatoires.');
  }
  if ('imageAssetId' in body && body['imageAssetId'] !== null && (typeof body['imageAssetId'] !== 'string' || !body['imageAssetId'].trim())) {
    throw new AppError(400, 'INVALID_BODY', 'imageAssetId doit être un identifiant d’image ou null.');
  }
  if ('name' in body && (typeof body['name'] !== 'string' || body['name'].trim().length < 2 || body['name'].trim().length > 80)) {
    throw new AppError(400, 'INVALID_BODY', 'Le nom du plat doit contenir de 2 à 80 caractères.');
  }
  if ('description' in body && (typeof body['description'] !== 'string' || body['description'].length > 1000)) {
    throw new AppError(400, 'INVALID_BODY', 'La description doit contenir au plus 1000 caractères.');
  }
  if ('priceFc' in body && (!Number.isSafeInteger(body['priceFc']) || (body['priceFc'] as number) < 0)) {
    throw new AppError(400, 'INVALID_BODY', 'Le prix doit être un entier positif ou nul en FC.');
  }
  if ('category' in body && (typeof body['category'] !== 'string' || !CATEGORIES.has(body['category']))) {
    throw new AppError(400, 'INVALID_BODY', 'La catégorie du plat est invalide.');
  }
  for (const field of ['isDaily', 'isAvailable']) {
    if (field in body && typeof body[field] !== 'boolean') {
      throw new AppError(400, 'INVALID_BODY', `Le champ ${field} doit être un booléen.`);
    }
  }
}

function menuDish(row: MenuDishRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceFc: row.price_fc,
    category: row.category,
    isDaily: row.is_daily === 1,
    isAvailable: row.is_available === 1,
    imageUrl: row.image_asset_id
      ? `/api/restaurants/${encodeURIComponent(row.restaurant_slug)}/assets/${encodeURIComponent(row.image_asset_id)}`
      : null,
  };
}

/** Une image de plat doit avoir été envoyée par le même restaurant (type « menu »). */
function requireMenuImage(db: Database, restaurantId: string, assetId: unknown): string | null {
  if (typeof assetId !== 'string') return null;
  const id = assetId.trim();
  if (!db.get("SELECT 1 AS found FROM assets WHERE id = ? AND restaurant_id = ? AND kind = 'menu'", [id, restaurantId])) {
    throw new AppError(422, 'ASSET_NOT_FOUND', 'Image introuvable pour ce restaurant : envoyez-la d’abord.');
  }
  return id;
}

function findDish(db: Database, restaurantId: string, id: string): MenuDishRow | undefined {
  return db.get<MenuDishRow>(`
    SELECT m.id, m.name, m.description, m.price_fc, m.category, m.is_daily, m.is_available,
      m.image_asset_id, r.slug AS restaurant_slug
    FROM menu_items m JOIN restaurants r ON r.id = m.restaurant_id
    WHERE m.id = ? AND m.restaurant_id = ? AND m.deleted_at IS NULL
  `, [id, restaurantId]);
}

export function registerMenuAdminRoutes(
  app: Express,
  db: Database,
  authenticate: RequestHandler,
  options: { now?: () => Date } = {},
): void {
  const now = () => (options.now?.() ?? new Date()).toISOString();
  app.get('/api/staff/menu', authenticate, (req, res, next) => {
    const user = currentStaff(res, next, STAFF_ROLES);
    if (!user) return;
    try {
      const rows = db.all<MenuDishRow>(`
        SELECT m.id, m.name, m.description, m.price_fc, m.category, m.is_daily, m.is_available,
          m.image_asset_id, r.slug AS restaurant_slug
        FROM menu_items m JOIN restaurants r ON r.id = m.restaurant_id
        WHERE m.restaurant_id = ? AND m.deleted_at IS NULL
        ORDER BY m.position, m.name COLLATE NOCASE, m.id
      `, [user.restaurantId]);
      res.status(200).json(rows.map(menuDish));
    } catch (error) { next(error); }
  });

  app.patch('/api/staff/menu/:id', authenticate, (req, res, next) => {
    const user = currentStaff(res, next, STAFF_ROLES);
    if (!user) return;
    try {
      const body = requestObject(req.body);
      validateFields(body, new Set(['isAvailable', 'isDaily']), true);
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Plat introuvable.');
      const sets: string[] = [];
      const values: Array<string | number> = [];
      if ('isAvailable' in body) { sets.push('is_available = ?'); values.push(body['isAvailable'] ? 1 : 0); }
      if ('isDaily' in body) { sets.push('is_daily = ?'); values.push(body['isDaily'] ? 1 : 0); }
      sets.push('updated_at = ?');
      values.push(now(), id, user.restaurantId);
      const result = db.run(
        `UPDATE menu_items SET ${sets.join(', ')} WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
        values,
      );
      if (!Number(result.changes)) throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Plat introuvable.');
      const row = findDish(db, user.restaurantId, id);
      if (!row) throw new Error('Le plat modifié ne peut pas être relu.');
      res.status(200).json(menuDish(row));
    } catch (error) { next(error); }
  });

  app.post('/api/admin/menu', authenticate, (req, res, next) => {
    const user = currentStaff(res, next, ADMIN_ROLES);
    if (!user) return;
    try {
      const body = requestObject(req.body);
      validateFields(body, new Set(['name', 'description', 'priceFc', 'category', 'isDaily', 'isAvailable', 'imageAssetId']), false);
      const imageAssetId = requireMenuImage(db, user.restaurantId, body['imageAssetId']);
      const id = `itm_${randomUUID()}`;
      const timestamp = now();
      db.transaction(() => {
        const position = db.get<{ next_position: number }>(`
          SELECT COALESCE(MAX(position), -1) + 1 AS next_position
          FROM menu_items WHERE restaurant_id = ? AND deleted_at IS NULL
        `, [user.restaurantId])?.next_position ?? 0;
        db.run(`
          INSERT INTO menu_items (
            id, restaurant_id, name, description, price_fc, category, is_daily, is_available, position, image_asset_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, user.restaurantId, (body['name'] as string).trim(),
          (body['description'] as string).trim() || null, body['priceFc'] as number, body['category'] as string,
          body['isDaily'] ? 1 : 0, body['isAvailable'] ? 1 : 0, position, imageAssetId, timestamp, timestamp]);
      });
      const row = findDish(db, user.restaurantId, id);
      if (!row) throw new Error('Le plat créé ne peut pas être relu.');
      res.status(201).json(menuDish(row));
    } catch (error) { next(error); }
  });

  app.patch('/api/admin/menu/:id', authenticate, (req, res, next) => {
    const user = currentStaff(res, next, ADMIN_ROLES);
    if (!user) return;
    try {
      const body = requestObject(req.body);
      validateFields(body, new Set(['name', 'description', 'priceFc', 'category', 'isDaily', 'isAvailable', 'imageAssetId']), true);
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Plat introuvable.');
      if ('imageAssetId' in body) body['imageAssetId'] = requireMenuImage(db, user.restaurantId, body['imageAssetId']);
      const columns: Record<string, string> = {
        name: 'name', description: 'description', priceFc: 'price_fc', category: 'category',
        isDaily: 'is_daily', isAvailable: 'is_available', imageAssetId: 'image_asset_id',
      };
      const sets: string[] = [];
      const values: Array<string | number | null> = [];
      for (const [field, column] of Object.entries(columns)) {
        if (!(field in body)) continue;
        sets.push(`${column} = ?`);
        const value = body[field];
        values.push(field === 'isDaily' || field === 'isAvailable'
          ? (value ? 1 : 0)
          : field === 'description' ? (value as string).trim() || null
            : field === 'name' ? (value as string).trim() : value as string | number);
      }
      sets.push('updated_at = ?');
      values.push(now(), id, user.restaurantId);
      const result = db.run(
        `UPDATE menu_items SET ${sets.join(', ')} WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
        values,
      );
      if (!Number(result.changes)) throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Plat introuvable.');
      const row = findDish(db, user.restaurantId, id);
      if (!row) throw new Error('Le plat modifié ne peut pas être relu.');
      res.status(200).json(menuDish(row));
    } catch (error) { next(error); }
  });

  app.delete('/api/admin/menu/:id', authenticate, (req, res, next) => {
    const user = currentStaff(res, next, ADMIN_ROLES);
    if (!user) return;
    try {
      const id = req.params['id'];
      if (typeof id !== 'string') throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Plat introuvable.');
      const timestamp = now();
      const result = db.run(`
        UPDATE menu_items SET deleted_at = ?, updated_at = ?
        WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL
      `, [timestamp, timestamp, id, user.restaurantId]);
      if (!Number(result.changes)) throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Plat introuvable.');
      res.status(204).end();
    } catch (error) { next(error); }
  });
}
