export type PromotionKind = 'promotion' | 'event' | 'game';

export interface Promotion {
  id: string;
  restaurantId: string;
  kind: PromotionKind;
  title: string;
  description: string | null;
  imageAssetId: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export interface PromotionRestaurant {
  id: string;
  slug: string;
  status: 'active' | 'inactive';
}

export interface PromotionsRepository {
  findRestaurantBySlug(slug: string): Promise<PromotionRestaurant | null>;
  listPromotionsByRestaurantId(restaurantId: string): Promise<Promotion[]>;
}
