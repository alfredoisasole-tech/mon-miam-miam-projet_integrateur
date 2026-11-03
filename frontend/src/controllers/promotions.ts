import { useEffect, useState } from 'react';
import { api } from '../models/http';

export interface Promotion {
  id: string;
  type: 'promotion' | 'event' | 'game';
  title: string;
  description: string;
  imageUrl: string | null;
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
}

export function usePromotions(slug: string | null) {
  const [data, setData] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setData([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    // ✅ CORRECTION : On retire le "/api" car http.ts l'ajoute déjà via baseUrl
    api.get<Promotion[]>(`/restaurants/${encodeURIComponent(slug)}/promotions`)
      .then((res) => {
        if (active) {
          // Filtrer uniquement les promotions actives et dans les dates
          const now = new Date().toISOString();
          const activePromos = res.filter(
            (promo) => promo.startDate <= now && promo.endDate >= now
          );
          setData(activePromos);
        }
      })
      .catch(() => {
        if (active) {
          setError('Impossible de charger les promotions.');
          setData([]);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [slug]);

  return { data, isLoading, error };
}