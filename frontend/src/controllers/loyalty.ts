import { useCallback, useEffect, useState } from 'react';
import { api } from '../models/http.ts';

export interface LoyaltyRules {
  spendPerPointFc: number;
  pointsForReward: number;
  rewardDiscountFc: number;
  pointsValidityMonths: number;
}

export interface LoyaltyMovement {
  id: string;
  points: number;
  reason: string;
  createdAt: string;
  orderId?: string | null;
}

export interface LoyaltyBalance {
  restaurant: {
    slug: string;
    name: string;
  };
  availablePoints: number;
  remainderFc: number;
  canRedeem: boolean;
  rules: LoyaltyRules;
  movements: LoyaltyMovement[];
}

export function useLoyalty(restaurantSlug: string | null) {
  const [balance, setBalance] = useState<LoyaltyBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantSlug) {
      setBalance(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<LoyaltyBalance>(`/restaurants/${encodeURIComponent(restaurantSlug)}/loyalty`);
      setBalance(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de charger vos points de fidélité.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    balance,
    isLoading,
    error,
    reload: load,
  };
}

