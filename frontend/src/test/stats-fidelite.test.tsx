import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatsView } from '../views/pages/StatsPage.tsx';
import type { RestaurantStats, StatsState } from '../controllers/stats.ts';

afterEach(cleanup);
const base: RestaurantStats = {
  period: 'day', salesFc: 12000, averageOrderFc: 4000,
  orders: { total: 3, completed: 3, active: 0, cancelled: 0 }, topItems: [],
};
const state = (data: RestaurantStats): StatsState => ({ data, error: null, refreshing: false, updatedAt: null });
const show = (data: RestaurantStats) => render(<StatsView period="day" onPeriodChange={vi.fn()} onRefresh={vi.fn()} state={state(data)} />);

describe('Statistiques de la fidélité et du parrainage', () => {
  it('affiche l’usage du programme de fidélité', () => {
    show({ ...base, loyalty: { members: 48, pointsEarned: 12, pointsRedeemed: 15 }, referrals: { rewarded: 1, pointsGranted: 2, pending: 3 } });
    const loyalty = screen.getByRole('region', { name: 'Fidélité' });
    expect(loyalty).toHaveTextContent('48 clients inscrits');
    expect(loyalty).toHaveTextContent('12 points gagnés');
    expect(loyalty).toHaveTextContent('15 points utilisés');
  });
  it('affiche le parrainage de la période', () => {
    show({ ...base, loyalty: { members: 1, pointsEarned: 0, pointsRedeemed: 0 }, referrals: { rewarded: 1, pointsGranted: 2, pending: 3 } });
    const referrals = screen.getByRole('region', { name: 'Parrainage' });
    expect(referrals).toHaveTextContent('1 parrainage récompensé');
    expect(referrals).toHaveTextContent('2 points offerts');
    expect(referrals).toHaveTextContent('3 filleuls en attente');
  });
  it('reste affichable quand le serveur ne fournit pas encore ces chiffres', () => {
    show(base);
    expect(screen.queryByRole('region', { name: 'Fidélité' })).toBeNull();
    expect(screen.getByText('Ventes')).toBeInTheDocument();
  });
});
