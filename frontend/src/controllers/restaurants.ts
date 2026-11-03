import { useCallback, useEffect, useState } from 'react';
import { api } from '../models/http.ts';

export interface RestaurantItem {
  slug: string;
  name: string;
  slogan: string | null;
  logoUrl: string | null;
  colors: {
    primary: string;
    secondary: string;
  };
  isOpenNow: boolean;
}

export interface RestaurantListResponse {
  items: RestaurantItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function useRestaurants({ enabled = true }: { enabled?: boolean } = {}) {
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<RestaurantListResponse | RestaurantItem[]>('/restaurants');
      const items = Array.isArray(data) ? data : data.items ?? [];
      setRestaurants(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de charger la liste des restaurants.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void load();
    } else {
      setIsLoading(false);
    }
  }, [enabled, load]);

  return {
    restaurants,
    isLoading,
    error,
    reload: load,
  };
}
