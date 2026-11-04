import { useEffect, useState } from 'react';
import { api } from '../models/http.ts';

export interface RestaurantBrand {
  slug: string;
  name: string;
  colors: { primary: string; secondary: string };
  logoUrl?: string | null;
  fontFamily?: string;
  defaultMode?: 'light' | 'dark' | 'system';
}

export function useRestaurantProfile(slug: string | null) {
  const [state, setState] = useState<{ slug: string | null; data: RestaurantBrand | null; error: string | null }>({ slug: null, data: null, error: null });
  useEffect(() => {
    if (!slug) return;
    let active = true;
    setState({ slug, data: null, error: null });
    api.get<RestaurantBrand>(`/restaurants/${encodeURIComponent(slug)}`)
      .then(data => { if (active) setState({ slug, data, error: null }); })
      .catch(() => { if (active) setState({ slug, data: null, error: 'Le profil du restaurant est indisponible.' }); });
    return () => { active = false; };
  }, [slug]);
  return { restaurant: slug && state.slug === slug ? state.data : null, error: slug && state.slug === slug ? state.error : null };
}
