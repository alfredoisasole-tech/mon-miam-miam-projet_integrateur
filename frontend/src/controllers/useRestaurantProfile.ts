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

const UPDATED_EVENT = 'mm:restaurant-updated';

/** À appeler quand la charte du restaurant vient de changer : l'écran se met à jour sans rechargement. */
export function announceRestaurantUpdated(): void {
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

export function useRestaurantProfile(slug: string | null) {
  const [state, setState] = useState<{ slug: string | null; data: RestaurantBrand | null; error: string | null }>({ slug: null, data: null, error: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion(current => current + 1);
    window.addEventListener(UPDATED_EVENT, refresh);
    return () => window.removeEventListener(UPDATED_EVENT, refresh);
  }, []);
  useEffect(() => {
    if (!slug) return;
    let active = true;
    // On garde l'ancien profil affiché pendant un rechargement : pas de clignotement du thème.
    setState(previous => (previous.slug === slug ? previous : { slug, data: null, error: null }));
    api.get<RestaurantBrand>(`/restaurants/${encodeURIComponent(slug)}`)
      .then(data => { if (active) setState({ slug, data, error: null }); })
      .catch(() => { if (active) setState({ slug, data: null, error: 'Le profil du restaurant est indisponible.' }); });
    return () => { active = false; };
  }, [slug, version]);
  return { restaurant: slug && state.slug === slug ? state.data : null, error: slug && state.slug === slug ? state.error : null };
}
