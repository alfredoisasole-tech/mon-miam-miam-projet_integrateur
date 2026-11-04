import { useCallback, useEffect, useState } from 'react';
import { api } from '../models/http.ts';

/** Règles de fidélité du restaurant, telles que l'API les renvoie (docs/api/fidelite.md). */
export interface LoyaltyRules {
  spendPerPointFc: number;
  pointsForReward: number;
  rewardValueFc: number;
  validityMonths: number;
}

export interface LoyaltyMovement {
  kind: string;
  points: number;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: string;
  expiresAt: string | null;
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

const KIND_LABEL: Record<string, string> = {
  earn: 'Points gagnés',
  referral: 'Parrainage',
  redeem: 'Réduction utilisée',
  expire: 'Points expirés',
  adjust: 'Ajustement',
  refund: 'Points rendus (commande annulée)',
};

/** Libellé lisible d'un mouvement, avec le numéro de la commande concernée quand il y en a une. */
export function movementLabel(movement: Pick<LoyaltyMovement, 'kind' | 'orderNumber'>): string {
  const label = KIND_LABEL[movement.kind] ?? 'Mouvement de points';
  return movement.orderNumber ? `${label} · commande ${movement.orderNumber}` : label;
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
