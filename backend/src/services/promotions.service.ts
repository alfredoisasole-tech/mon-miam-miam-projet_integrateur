import { AppError } from '../http/errors.ts';
import type { Promotion, PromotionsRepository } from '../domain/promotions.ts';

export interface PromotionsServiceOptions {
  now?: () => Date;
}

export interface PublicPromotion {
  id: string;
  kind: Promotion['kind'];
  title: string;
  description: string | null;
  imageAssetId: string | null;
  startsAt: string;
  endsAt: string;
  active: true;
}

export class PromotionsService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: PromotionsRepository,
    options: PromotionsServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async listByRestaurantSlug(slug: string): Promise<{ items: PublicPromotion[] }> {
    const restaurant = await this.repository.findRestaurantBySlug(slug);
    if (!restaurant || restaurant.status !== 'active') {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable.');
    }

    const now = this.now().getTime();
    if (!Number.isFinite(now)) throw new Error('Horloge invalide pour la consultation des promotions.');

    const promotions = await this.repository.listPromotionsByRestaurantId(restaurant.id);
    const visible = promotions.flatMap((promotion) => {
      if (promotion.restaurantId !== restaurant.id || !promotion.isActive) return [];

      const start = Date.parse(promotion.startsAt);
      const end = Date.parse(promotion.endsAt);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error(`Période invalide pour la promotion ${promotion.id}.`);
      }
      if (start > now || end <= now) return [];

      return [{
        promotion,
        start,
        item: {
          id: promotion.id,
          kind: promotion.kind,
          title: promotion.title,
          description: promotion.description,
          imageAssetId: promotion.imageAssetId,
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          active: true as const,
        },
      }];
    });

    visible.sort((first, second) => {
      if (first.start !== second.start) return first.start - second.start;
      return first.promotion.id < second.promotion.id ? -1 : first.promotion.id > second.promotion.id ? 1 : 0;
    });

    return { items: visible.map(({ item }) => item) };
  }
}
