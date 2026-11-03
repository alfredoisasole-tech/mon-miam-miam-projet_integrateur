import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api } from '../models/http.ts';
import { ApiError } from '../models/types.ts';
import { useStats } from '../controllers/stats.ts';
import { StatsPage } from '../views/pages/StatsPage.tsx';
import { RequireRole } from '../views/components/RequireRole.tsx';

vi.mock('../models/http.ts', () => ({ api: { get: vi.fn() } }));
vi.mock('../controllers/session.tsx', () => ({ useAuth: vi.fn(), useRestaurant: () => ({ slug: 'campus' }) }));
import { useAuth } from '../controllers/session.tsx';
const sample = { period: 'day', salesFc: 120000, averageOrderFc: 4000, orders: { total: 35, completed: 30, active: 3, cancelled: 2 }, topItems: [{ name: 'Pondu', quantity: 8 }, { name: 'Poulet mayonnaise', quantity: 20 }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue(sample);
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', name: 'Gérante', role: 'manager' }, loading: false, logout: vi.fn(), login: vi.fn() });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Écran E-7', () => {
  it('affiche les chiffres du serveur et classe les plats sans modifier la réponse', async () => {
    render(<StatsPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement');
    await screen.findByText('120 000 FC', { exact: false });
    expect(screen.getByText('4 000 FC', { exact: false })).toBeVisible();
    expect(screen.getByText('35')).toBeVisible();
    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['Poulet mayonnaise20 portions', 'Pondu8 portions']);
    expect(sample.topItems[0].name).toBe('Pondu');
    expect(api.get).toHaveBeenCalledWith('/staff/stats/overview?period=day');
  });
  it('change la période et retire immédiatement les anciennes valeurs', async () => {
    render(<StatsPage />);
    await screen.findByText('Poulet mayonnaise');
    vi.mocked(api.get).mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(screen.getByRole('tab', { name: 'Mois' }));
    expect(screen.queryByText('Poulet mayonnaise')).not.toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith('/staff/stats/overview?period=month');
  });
  it('affiche zéro et un état vide sans inventer de ventes', async () => {
    vi.mocked(api.get).mockResolvedValue({ ...sample, salesFc: 0, averageOrderFc: 0, orders: { total: 0, completed: 0, active: 0, cancelled: 0 }, topItems: [] });
    render(<StatsPage />);
    expect(await screen.findByText('Aucune vente sur cette période.')).toBeVisible();
    expect(screen.getAllByText('0 FC')).toHaveLength(2);
  });
  it('annonce une erreur et permet une reprise manuelle', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));
    render(<StatsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger');
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(await screen.findByText('Poulet mayonnaise')).toBeVisible();
  });
  it.each(['student', 'employee', 'platform_admin'] as const)('refuse le bilan global au rôle %s avant tout appel API', role => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', name: 'Test', role }, loading: false, logout: vi.fn(), login: vi.fn() });
    render(<MemoryRouter initialEntries={['/staff/overview']}><Routes><Route path="/staff/overview" element={<RequireRole allowedRoles={['manager', 'admin']}><StatsPage /></RequireRole>} /><Route path="/" element={<p>Accueil</p>} /></Routes></MemoryRouter>);
    expect(screen.getByText('Accueil')).toBeVisible();
    expect(api.get).not.toHaveBeenCalled();
  });
  it.each(['manager', 'admin'] as const)('autorise le rôle %s à charger le bilan', async role => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1', name: 'Test', role }, loading: false, logout: vi.fn(), login: vi.fn() });
    render(<MemoryRouter><RequireRole allowedRoles={['manager', 'admin']}><StatsPage /></RequireRole></MemoryRouter>);
    expect(await screen.findByText('Poulet mayonnaise')).toBeVisible();
  });
  it('redirige un visiteur vers la connexion sans requête de statistiques', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, logout: vi.fn(), login: vi.fn() });
    render(<MemoryRouter initialEntries={['/staff/overview']}><Routes><Route path="/staff/overview" element={<RequireRole allowedRoles={['manager', 'admin']}><StatsPage /></RequireRole>} /><Route path="/login" element={<p>Connexion requise</p>} /></Routes></MemoryRouter>);
    expect(screen.getByText('Connexion requise')).toBeVisible();
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('Contrôleur statistiques', () => {
  it('actualise à 30 secondes et supprime le minuteur au démontage', async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useStats('day', 'u1:campus'));
    await act(async () => {});
    await act(async () => vi.advanceTimersByTime(29999));
    expect(api.get).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(1));
    expect(api.get).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => vi.advanceTimersByTime(60000));
    expect(api.get).toHaveBeenCalledTimes(2);
  });
  it('ignore une ancienne réponse après changement de période', async () => {
    let resolveFirst!: (data: unknown) => void;
    vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValueOnce({ ...sample, period: 'week' });
    const { result, rerender } = renderHook(({ period }: { period: 'day' | 'week' }) => useStats(period, 'u1'), { initialProps: { period: 'day' as 'day' | 'week' } });
    rerender({ period: 'week' });
    await waitFor(() => expect(result.current.data?.period).toBe('week'));
    await act(async () => resolveFirst(sample));
    expect(result.current.data?.period).toBe('week');
  });
  it('ne conserve pas les données d’une autre session ou d’un autre restaurant', async () => {
    const { result, rerender } = renderHook(({ scope }) => useStats('day', scope), { initialProps: { scope: 'u1:a' } });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    vi.mocked(api.get).mockReturnValueOnce(new Promise(() => {}));
    rerender({ scope: 'u2:b' });
    expect(result.current.data).toBeNull();
  });
  it('conserve les valeurs lors d’une panne de rafraîchissement, mais les efface après un refus d’accès', async () => {
    const { result } = renderHook(() => useStats('day', 'u1'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data?.salesFc).toBe(120000);
    vi.mocked(api.get).mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Accès refusé'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.data).toBeNull());
  });
  it('refuse une réponse invalide au lieu de transformer des champs absents en zéro', async () => {
    vi.mocked(api.get).mockResolvedValue({ salesFc: -1 });
    const { result } = renderHook(() => useStats('day', 'u1'));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeNull();
  });
  it('ne superpose pas les appels quand une requête est encore en cours', async () => {
    vi.useFakeTimers();
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    renderHook(() => useStats('day', 'u1'));
    await act(async () => vi.advanceTimersByTime(90000));
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
