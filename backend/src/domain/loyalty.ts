import type { Restaurant } from './orders.ts';

/** Règles de fidélité d'un restaurant (docs/regles-commande-paiement.md, §5). */
export interface LoyaltyRules {
  spendPerPointFc: number;
  pointsForReward: number;
  rewardValueFc: number;
  validityMonths: number;
}

/** Un mouvement du journal de points, sans données internes (le détail des lots débités n'est pas exposé). */
export interface PointMovement {
  kind: string;
  points: number;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface LoyaltyBalance {
  restaurant: { slug: string; name: string };
  availablePoints: number;
  remainderFc: number;
  canRedeem: boolean;
  rules: LoyaltyRules;
  movements: PointMovement[];
}

/** Nombre maximal de mouvements renvoyés : les plus récents. */
export const MAX_POINT_MOVEMENTS = 50;

export interface LoyaltyRepository {
  findRestaurantBySlug(slug: string): Promise<Restaurant | null>;
  getAvailablePoints(userId: string, restaurantId: string, at: string): Promise<number>;
  getLoyaltyRemainderFc(userId: string, restaurantId: string): Promise<number>;
  getLoyaltyRules(restaurantId: string): Promise<LoyaltyRules>;
  listPointMovements(userId: string, restaurantId: string, limit: number): Promise<PointMovement[]>;
}
