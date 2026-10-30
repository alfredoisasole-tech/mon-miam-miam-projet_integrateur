import type { Database } from '../db/database.ts';

export interface RestaurantRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_asset_id: string | null;
  primary_color: string;
  secondary_color: string;
  timezone: string;
  settings_id: string | null;
  spend_per_point_fc: number | null;
  points_per_meal: number | null;
  free_meal_cap_fc: number | null;
  points_validity_months: number | null;
  delivery_enabled: number | null;
  delivery_fee_fc: number | null;
  delivery_communes: string | null;
  opening_hours: string | null;
}

export interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  price_fc: number;
  category: 'plat' | 'boisson' | 'dessert' | 'snack';
  is_available: number;
  is_daily: number;
  image_asset_id: string | null;
}

export function restaurantsMenuRepository(db: Database) {
  return {
    listActive(limit: number, offset: number): RestaurantRow[] {
      return db.all<RestaurantRow>(`
        SELECT r.id, r.slug, r.name, r.tagline, r.logo_asset_id,
          r.primary_color, r.secondary_color, r.timezone,
          s.restaurant_id AS settings_id, s.spend_per_point_fc, s.points_per_meal,
          s.free_meal_cap_fc, s.points_validity_months, s.delivery_enabled,
          s.delivery_fee_fc, s.delivery_communes, s.opening_hours
        FROM restaurants r
        LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
        WHERE r.status = 'active'
        ORDER BY r.name COLLATE NOCASE, r.slug COLLATE NOCASE
        LIMIT ? OFFSET ?
      `, [limit, offset]);
    },

    countActive(): number {
      return db.get<{ total: number }>(`SELECT COUNT(*) AS total FROM restaurants WHERE status = 'active'`)?.total ?? 0;
    },

    findActiveBySlug(slug: string): RestaurantRow | undefined {
      return db.get<RestaurantRow>(`
        SELECT r.id, r.slug, r.name, r.tagline, r.logo_asset_id,
          r.primary_color, r.secondary_color, r.timezone,
          s.restaurant_id AS settings_id, s.spend_per_point_fc, s.points_per_meal,
          s.free_meal_cap_fc, s.points_validity_months, s.delivery_enabled,
          s.delivery_fee_fc, s.delivery_communes, s.opening_hours
        FROM restaurants r
        LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
        WHERE r.slug = ? AND r.status = 'active'
      `, [slug]);
    },

    listAvailableMenu(restaurantId: string): MenuItemRow[] {
      return db.all<MenuItemRow>(`
        SELECT id, name, description, price_fc, category, is_available, is_daily, image_asset_id
        FROM menu_items
        WHERE restaurant_id = ? AND is_available = 1 AND deleted_at IS NULL
        ORDER BY is_daily DESC, position, name COLLATE NOCASE
      `, [restaurantId]);
    },

    getAsset(restaurantId: string, assetId: string): { mime: string; data: Uint8Array } | undefined {
      return db.get<{ mime: string; data: Uint8Array }>(`SELECT mime, data FROM assets WHERE restaurant_id = ? AND id = ?`, [restaurantId, assetId]);
    },
  };
}
