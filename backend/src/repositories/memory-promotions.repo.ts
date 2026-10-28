import type { Promotion, PromotionRestaurant, PromotionsRepository } from '../domain/promotions.ts';

export interface MemoryPromotionsSeed {
  restaurants: PromotionRestaurant[];
  promotions: Promotion[];
}

/** Dépôt temporaire utilisé par les tests en attendant le raccordement à la base. */
export class MemoryPromotionsRepository implements PromotionsRepository {
  private readonly restaurants: Map<string, PromotionRestaurant>;
  private readonly promotions: Promotion[];

  constructor(seed: MemoryPromotionsSeed) {
    this.restaurants = new Map(seed.restaurants.map((restaurant) => [restaurant.slug, { ...restaurant }]));
    this.promotions = seed.promotions.map((promotion) => ({ ...promotion }));
  }

  async findRestaurantBySlug(slug: string): Promise<PromotionRestaurant | null> {
    return this.restaurants.get(slug) ?? null;
  }

  async listPromotionsByRestaurantId(restaurantId: string): Promise<Promotion[]> {
    return this.promotions
      .filter((promotion) => promotion.restaurantId === restaurantId)
      .map((promotion) => ({ ...promotion }));
  }
}
