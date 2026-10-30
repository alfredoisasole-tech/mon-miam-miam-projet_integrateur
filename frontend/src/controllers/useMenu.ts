import { useEffect, useState } from 'react';
import { api } from '../models/http.ts';

export interface MenuDish {
  id: string;
  name: string;
  description: string | null;
  priceFc: number;
  isDaily: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
}

export interface RestaurantMenu {
  restaurant: string;
  categories: Array<{ name: string; items: MenuDish[] }>;
  dailyItems: MenuDish[];
}

interface MenuState {
  slug: string | null;
  data: RestaurantMenu | null;
  isLoading: boolean;
  error: string | null;
}

export function useMenu(slug: string | null) {
  const [state, setState] = useState<MenuState>({ slug: null, data: null, isLoading: false, error: null });

  useEffect(() => {
    if (!slug) {
      setState({ slug: null, data: null, isLoading: false, error: null });
      return;
    }

    let active = true;
    setState({ slug, data: null, isLoading: true, error: null });
    api.get<RestaurantMenu>(`/restaurants/${encodeURIComponent(slug)}/menu`)
      .then((data) => {
        if (active) setState({ slug, data, isLoading: false, error: null });
      })
      .catch(() => {
        if (active) setState({ slug, data: null, isLoading: false, error: 'Impossible de charger le menu. Réessayez.' });
      });

    return () => { active = false; };
  }, [slug]);

  const current = state.slug === slug;
  return {
    data: current ? state.data : null,
    isLoading: slug !== null && (!current || state.isLoading),
    error: current ? state.error : null,
  };
}
