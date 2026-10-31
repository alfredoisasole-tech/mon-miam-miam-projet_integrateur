import { randomBytes } from 'node:crypto';
import type { Express, RequestHandler, Response } from 'express';
import type { Database } from '../db/database.ts';
import { AppError } from '../http/errors.ts';
import { hashPassword } from '../services/auth.service.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';

const passwordPattern = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

function platformAdmin(res: Response, next: (error?: unknown) => void): AuthenticatedUser | null {
  const user = res.locals['authenticatedUser'] as AuthenticatedUser | undefined;
  if (user?.role === 'platform_admin') return user;
  next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée à l’administration de la plateforme.'));
  return null;
}

export function registerPlatformRestaurantRoutes(app: Express, db: Database, authenticate: RequestHandler): void {
  app.post('/api/platform/restaurants', authenticate, (req, res, next) => {
    if (!platformAdmin(res, next)) return;
    try {
      const body = req.body as Record<string, unknown> | null;
      const admin = body?.['admin'];
      if (!body || typeof body !== 'object' || typeof body['slug'] !== 'string' || typeof body['name'] !== 'string'
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body['slug'])
        || body['name'].trim().length < 2 || body['name'].trim().length > 100
        || !admin || typeof admin !== 'object' || Array.isArray(admin)) {
        throw new AppError(400, 'INVALID_BODY', 'Le restaurant et son premier administrateur sont obligatoires.');
      }
      const input = admin as Record<string, unknown>;
      if (typeof input['name'] !== 'string' || input['name'].trim().length < 2
        || typeof input['email'] !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input['email'])
        || typeof input['phone'] !== 'string' || !/^\+243\d{9}$/.test(input['phone'])
        || typeof input['password'] !== 'string' || !passwordPattern.test(input['password'])) {
        throw new AppError(400, 'INVALID_BODY', 'Les informations du premier administrateur sont invalides.');
      }
      const email = input['email'].toLowerCase();
      const phone = input['phone'];
      if (db.get('SELECT id FROM restaurants WHERE slug = ?', [body['slug']])) {
        throw new AppError(409, 'RESTAURANT_SLUG_TAKEN', 'Ce slug de restaurant est déjà utilisé.');
      }
      if (db.get('SELECT id FROM users WHERE lower(email) = lower(?) OR phone = ?', [email, phone])
        || db.get('SELECT id FROM platform_admins WHERE lower(email) = lower(?)', [email])) {
        throw new AppError(409, 'ACCOUNT_TAKEN', 'Un compte existe déjà avec cet e-mail ou ce téléphone.');
      }

      const restaurantId = `rst_${randomBytes(12).toString('hex')}`;
      const adminId = `usr_${randomBytes(12).toString('hex')}`;
      const createdAt = new Date().toISOString();
      const passwordHash = hashPassword(input['password']);
      const defaultHours = JSON.stringify(Object.fromEntries(
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '08:00', close: '22:00' }]]),
      ));
      db.transaction(() => {
        if (db.get('SELECT id FROM restaurants WHERE slug = ?', [body['slug']])) {
          throw new AppError(409, 'RESTAURANT_SLUG_TAKEN', 'Ce slug de restaurant est déjà utilisé.');
        }
        if (db.get('SELECT id FROM users WHERE lower(email) = lower(?) OR phone = ?', [email, phone])
          || db.get('SELECT id FROM platform_admins WHERE lower(email) = lower(?)', [email])) {
          throw new AppError(409, 'ACCOUNT_TAKEN', 'Un compte existe déjà avec cet e-mail ou ce téléphone.');
        }
        db.run(`INSERT INTO restaurants (id, slug, name, tagline, primary_color, secondary_color, font_family, timezone, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Africa/Kinshasa', ?)`,
        [restaurantId, body['slug'], body['name'].trim(), typeof body['slogan'] === 'string' ? body['slogan'].trim() : null,
          typeof body['primaryColor'] === 'string' ? body['primaryColor'] : '#cfbd97',
          typeof body['secondaryColor'] === 'string' ? body['secondaryColor'] : '#000000',
          typeof body['fontFamily'] === 'string' ? body['fontFamily'] : 'Arial', createdAt]);
        db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES (?, ?, ?)`, [restaurantId, defaultHours, createdAt]);
        db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, must_change_password, accepted_terms_at, created_at)
          VALUES (?, ?, 'admin', ?, ?, ?, ?, 0, ?, ?)`,
        [adminId, restaurantId, input['name'].trim(), email, phone, passwordHash, createdAt, createdAt]);
      });
      res.status(201).json({
        restaurant: { id: restaurantId, slug: body['slug'], name: body['name'].trim(), status: 'active' },
        administrator: { id: adminId, name: input['name'].trim(), email, role: 'admin' },
      });
    } catch (error) { next(error); }
  });

  app.patch('/api/platform/restaurants/:slug/status', authenticate, (req, res, next) => {
    if (!platformAdmin(res, next)) return;
    try {
      const slug = req.params['slug'];
      const status = req.body?.status;
      if (typeof slug !== 'string' || (status !== 'active' && status !== 'inactive')) {
        throw new AppError(400, 'INVALID_BODY', 'Le statut doit être active ou inactive.');
      }
      const result = db.run('UPDATE restaurants SET status = ? WHERE slug = ?', [status, slug]);
      if (!result.changes) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable.');
      res.status(200).json({ slug, status });
    } catch (error) { next(error); }
  });
}
