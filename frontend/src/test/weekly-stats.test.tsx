import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../models/http.ts';
import { WeeklyStatsPage } from '../views/pages/WeeklyStatsPage.tsx';

vi.mock('../models/http.ts', () => ({ api: { get: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const week = {
  from: '2026-11-01T23:00:00.000Z', to: '2026-11-08T23:00:00.000Z', totalSalesFc: 6000, ordersCompleted: 2,
  days: [
    { date: '2026-11-02', label: 'lundi', salesFc: 2000, orders: 1 },
    { date: '2026-11-03', label: 'mardi', salesFc: 4000, orders: 1 },
    { date: '2026-11-04', label: 'mercredi', salesFc: 0, orders: 0 },
  ],
};

describe('Ventes de la semaine (employé)', () => {
  it('affiche le total et le détail par jour', async () => {
    vi.mocked(api.get).mockResolvedValue(week);
    render(<WeeklyStatsPage />);
    expect(await screen.findByText(/6\s?000 FC/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/staff/stats/weekly');
    expect(screen.getByRole('row', { name: /mardi/i })).toHaveTextContent(/4\s?000 FC/);
    expect(screen.getByText(/2 commandes terminées/)).toBeInTheDocument();
  });
  it('signale une erreur de chargement', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('hors ligne'));
    render(<WeeklyStatsPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/impossible/i));
  });
});
