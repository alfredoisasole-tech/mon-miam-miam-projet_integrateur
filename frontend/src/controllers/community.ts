import { api } from '../models/http.ts';

export type TopPeriod = 'day' | 'week' | 'month';

export interface Referral {
  code: string;
  restaurant: { slug: string; name: string };
  referees: Array<{
    name: string;
    status: 'pending' | 'rewarded';
    rewardPoints: number | null;
    rewardedAt: string | null;
    rewardRestaurant: { slug: string; name: string } | null;
    joinedAt: string;
  }>;
  totals: { referees: number; rewarded: number; pointsEarned: number };
}

export interface TopClients {
  period: TopPeriod;
  from: string;
  restaurant: { slug: string; name: string };
  items: Array<{ rank: number; name: string; orders: number; spentFc: number; isMe: boolean }>;
}

export const communityApi = {
  referral: (slug: string) => api.get<Referral>(`/restaurants/${encodeURIComponent(slug)}/referral`),
  topClients: (slug: string, period: TopPeriod) =>
    api.get<TopClients>(`/restaurants/${encodeURIComponent(slug)}/top-clients?period=${period}`),
};
