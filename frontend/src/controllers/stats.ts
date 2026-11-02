import { useEffect, useState } from 'react';
import { api } from '../models/http.ts';
import { ApiError } from '../models/types.ts';

export type StatsPeriod = 'day' | 'week' | 'month';
/** Champs Overview utilisés par E-7, vérifiés avec l’API L-11 (APP-82, PR #43). */
export interface RestaurantStats {
  period: StatsPeriod;
  salesFc: number;
  averageOrderFc: number;
  orders: { total: number; completed: number; active: number; cancelled: number };
  topItems: { name: string; quantity: number }[];
}
export interface StatsState {
  data: RestaurantStats | null;
  error: string | null;
  refreshing: boolean;
  updatedAt: Date | null;
}

function parseStats(value: unknown, period: StatsPeriod): RestaurantStats {
  const data = value as Partial<RestaurantStats> | null;
  const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const count = (v: unknown) => amount(v) && Number.isInteger(v);
  if (!data || data.period !== period || !amount(data.salesFc) || !amount(data.averageOrderFc)
    || !data.orders || !['total', 'completed', 'active', 'cancelled'].every(key => count(data.orders![key as keyof RestaurantStats['orders']]))
    || !Array.isArray(data.topItems) || !data.topItems.every(item => item && typeof item.name === 'string' && count(item.quantity))) {
    throw new Error('Réponse de statistiques invalide.');
  }
  return data as RestaurantStats;
}

const initial: StatsState = { data: null, error: null, refreshing: true, updatedAt: null };
export function useStats(period: StatsPeriod, scope: string) {
  const key = `${scope}:${period}`;
  const [state, setState] = useState<StatsState & { key: string }>({ ...initial, key });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      setState(previous => ({ ...(previous.key === key ? previous : initial), key, refreshing: true }));
      try {
        // Le restaurant est déterminé côté serveur par la session du personnel.
        const data = parseStats(await api.get<unknown>(`/staff/stats/overview?period=${period}`), period);
        if (active) setState({ key, data, error: null, refreshing: false, updatedAt: new Date() });
      } catch (error) {
        const denied = error instanceof ApiError && (error.status === 401 || error.status === 403);
        if (active) setState(previous => ({ ...previous, key, refreshing: false,
          data: denied ? null : previous.data,
          error: denied ? 'Accès aux statistiques refusé. Vérifiez votre session et votre rôle.' : 'Impossible de charger les statistiques. Réessayez.',
        }));
      } finally { inFlight = false; }
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [key, period, revision]);
  return { ...(state.key === key ? state : initial), refresh: () => setRevision(value => value + 1) };
}
