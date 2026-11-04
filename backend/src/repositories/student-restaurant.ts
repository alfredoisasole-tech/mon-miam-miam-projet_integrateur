import type { Database } from '../db/database.ts';
import { AppError } from '../http/errors.ts';

export interface StudentRestaurant { id: string; slug: string; name: string }

/** Restaurant actif désigné par son adresse, à condition que l'étudiant en soit client. */
export function requireStudentRestaurant(db: Database, userId: string, slug: string): StudentRestaurant {
  const restaurant = db.get<{ id: string; slug: string; name: string; status: string }>(
    'SELECT id, slug, name, status FROM restaurants WHERE slug = ?', [slug],
  );
  if (!restaurant || restaurant.status !== 'active') throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable ou désactivé.');
  if (!db.get('SELECT 1 AS found FROM memberships WHERE user_id = ? AND restaurant_id = ?', [userId, restaurant.id])) {
    throw new AppError(403, 'NOT_A_MEMBER', 'Vous n’êtes pas client de ce restaurant.');
  }
  return { id: restaurant.id, slug: restaurant.slug, name: restaurant.name };
}
