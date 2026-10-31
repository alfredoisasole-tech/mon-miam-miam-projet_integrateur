import type { Database } from '../db/database.ts';
import type { Promotion, PromotionRestaurant, PromotionsRepository } from '../domain/promotions.ts';

export class SqlitePromotionsRepository implements PromotionsRepository {
  constructor(private readonly db: Database) {}

  async findRestaurantBySlug(slug: string): Promise<PromotionRestaurant | null> {
    return this.db.get<PromotionRestaurant>('SELECT id, slug, status FROM restaurants WHERE slug = ?', [slug]) ?? null;
  }

  async listPromotionsByRestaurantId(restaurantId: string): Promise<Promotion[]> {
    return this.db.all<{
      id: string; restaurant_id: string; kind: Promotion['kind']; title: string; description: string | null;
      image_asset_id: string | null; starts_at: string; ends_at: string; is_active: number;
    }>(
      `SELECT id, restaurant_id, kind, title, description, image_asset_id, starts_at, ends_at, is_active
       FROM promotions WHERE restaurant_id = ? ORDER BY starts_at, id`, [restaurantId],
    ).map((row) => ({
      id: row.id, restaurantId: row.restaurant_id, kind: row.kind, title: row.title, description: row.description,
      imageAssetId: row.image_asset_id, startsAt: row.starts_at, endsAt: row.ends_at, isActive: row.is_active === 1,
    }));
  }
}
