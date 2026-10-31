import { AppError } from '../http/errors.ts';
import type { Promotion, PromotionsRepository } from '../domain/promotions.ts';

export class PromotionsService {
  constructor(private readonly repository: PromotionsRepository, private readonly now: () => Date = () => new Date()) {}

  async listByRestaurantSlug(slug: string): Promise<{ restaurant: string; items: Array<{
    id: string; type: Promotion['kind']; title: string; description: string | null; imageUrl: string | null;
    startDate: string; endDate: string;
  }> }> {
    const restaurant = await this.repository.findRestaurantBySlug(slug);
    if (!restaurant || restaurant.status !== 'active') throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable ou désactivé.');
    const timestamp = this.now().getTime();
    if (!Number.isFinite(timestamp)) throw new Error('Horloge invalide pour la consultation des promotions.');
    const promotions = await this.repository.listPromotionsByRestaurantId(restaurant.id);
    const items = promotions.flatMap((promotion) => {
      if (promotion.restaurantId !== restaurant.id || !promotion.isActive) return [];
      const start = Date.parse(promotion.startsAt);
      const end = Date.parse(promotion.endsAt);
      if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error(`Période invalide pour la promotion ${promotion.id}.`);
      if (start > timestamp || end < timestamp) return [];
      return [{
        id: promotion.id,
        type: promotion.kind,
        title: promotion.title,
        description: promotion.description,
        imageUrl: promotion.imageAssetId ? `/api/restaurants/${encodeURIComponent(slug)}/assets/${encodeURIComponent(promotion.imageAssetId)}` : null,
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
      }];
    });
    return { restaurant: slug, items };
  }
}
