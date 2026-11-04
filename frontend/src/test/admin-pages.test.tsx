import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../controllers/admin.ts';
import { StaffAccountsPage } from '../views/pages/StaffAccountsPage.tsx';
import { AdminPromotionsPage } from '../views/pages/AdminPromotionsPage.tsx';
import { PlatformPage } from '../views/pages/PlatformPage.tsx';
import * as session from '../controllers/session.tsx';

vi.mock('../controllers/admin.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../controllers/admin.ts')>()),
  adminApi: {
    listStaff: vi.fn(), createStaff: vi.fn(), deactivateStaff: vi.fn(),
    listPromotions: vi.fn(), createPromotion: vi.fn(), updatePromotion: vi.fn(), deletePromotion: vi.fn(),
    listRestaurants: vi.fn(), createRestaurant: vi.fn(), setRestaurantStatus: vi.fn(),
  },
}));
vi.mock('../controllers/session.tsx', () => ({ useAuth: vi.fn() }));
const api = vi.mocked(adminApi);
const asRole = (role: 'manager' | 'admin') =>
  vi.mocked(session.useAuth).mockReturnValue({ user: { id: 'me', name: 'Moi', role }, loading: false, login: vi.fn(), logout: vi.fn() });
const staff = (over = {}) => ({ id: 's1', name: 'Chef Paul', email: 'paul@example.test', phone: '+243810000001', role: 'employee' as const,
  status: 'active', mustChangePassword: false, createdAt: '2026-10-01T00:00:00Z', ...over });
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('Comptes du personnel', () => {
  it('liste les comptes et crée un employé en montrant le mot de passe temporaire une seule fois', async () => {
    asRole('manager');
    api.listStaff.mockResolvedValue([staff()]);
    api.createStaff.mockResolvedValue({ account: staff({ id: 's2', name: 'Awa', email: 'awa@example.test' }), temporaryPassword: 'MmTemp123' });
    render(<MemoryRouter><StaffAccountsPage /></MemoryRouter>);
    expect(await screen.findByText('Chef Paul')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nom'), 'Awa');
    await userEvent.type(screen.getByLabelText('E-mail'), 'awa@example.test');
    await userEvent.type(screen.getByLabelText('Téléphone'), '+243820000002');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));
    await waitFor(() => expect(api.createStaff).toHaveBeenCalledWith({ name: 'Awa', email: 'awa@example.test', phone: '+243820000002', role: 'employee' }));
    expect(await screen.findByText('MmTemp123')).toBeInTheDocument();
    expect(screen.getByText(/ne sera plus affiché/i)).toBeInTheDocument();
  });
  it('seul l’administrateur peut créer un gérant ou désactiver un compte', async () => {
    asRole('manager');
    api.listStaff.mockResolvedValue([staff()]);
    const { unmount } = render(<MemoryRouter><StaffAccountsPage /></MemoryRouter>);
    await screen.findByText('Chef Paul');
    expect(screen.queryByRole('option', { name: 'Gérant' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Désactiver/ })).toBeNull();
    unmount();
    asRole('admin');
    api.deactivateStaff.mockResolvedValue({ id: 's1', status: 'inactive' });
    render(<MemoryRouter><StaffAccountsPage /></MemoryRouter>);
    await screen.findByText('Chef Paul');
    expect(screen.getByRole('option', { name: 'Gérant' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Désactiver Chef Paul' }));
    await userEvent.click(screen.getByRole('button', { name: 'Oui, désactiver' }));
    await waitFor(() => expect(api.deactivateStaff).toHaveBeenCalledWith('s1'));
  });
  it('valide le format du téléphone avant l’envoi', async () => {
    asRole('admin');
    api.listStaff.mockResolvedValue([]);
    render(<MemoryRouter><StaffAccountsPage /></MemoryRouter>);
    await screen.findByLabelText('Nom');
    await userEvent.type(screen.getByLabelText('Nom'), 'Awa');
    await userEvent.type(screen.getByLabelText('E-mail'), 'awa@example.test');
    await userEvent.type(screen.getByLabelText('Téléphone'), '0820000002');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }));
    expect(screen.getByLabelText('Téléphone')).toHaveAttribute('aria-invalid', 'true');
    expect(api.createStaff).not.toHaveBeenCalled();
  });
});

describe('Promotions', () => {
  const promo = (over = {}) => ({ id: 'p1', type: 'promotion' as const, title: 'Menu étudiant', description: '-10 %', imageAssetId: null,
    startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-30T23:59:59.000Z', isActive: true, ...over });
  it('liste, crée, désactive et supprime une promotion', async () => {
    api.listPromotions.mockResolvedValue([promo()]);
    api.createPromotion.mockResolvedValue(promo({ id: 'p2', title: 'Tournoi' }));
    api.updatePromotion.mockResolvedValue(promo({ isActive: false }));
    api.deletePromotion.mockResolvedValue(undefined);
    render(<MemoryRouter><AdminPromotionsPage /></MemoryRouter>);
    expect(await screen.findByText('Menu étudiant')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Titre'), 'Tournoi');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'event');
    await userEvent.type(screen.getByLabelText('Début'), '2026-12-01');
    await userEvent.type(screen.getByLabelText('Fin'), '2026-12-05');
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() => expect(api.createPromotion).toHaveBeenCalledWith(expect.objectContaining({
      type: 'event', title: 'Tournoi', startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-05T23:59:59.000Z',
    })));

    await userEvent.click(screen.getByRole('button', { name: 'Désactiver Menu étudiant' }));
    await waitFor(() => expect(api.updatePromotion).toHaveBeenCalledWith('p1', { isActive: false }));

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer Menu étudiant' }));
    await userEvent.click(screen.getByRole('button', { name: 'Oui, supprimer' }));
    await waitFor(() => expect(api.deletePromotion).toHaveBeenCalledWith('p1'));
  });
  it('refuse une fin avant le début', async () => {
    api.listPromotions.mockResolvedValue([]);
    render(<MemoryRouter><AdminPromotionsPage /></MemoryRouter>);
    await screen.findByLabelText('Titre');
    await userEvent.type(screen.getByLabelText('Titre'), 'Tournoi');
    await userEvent.type(screen.getByLabelText('Début'), '2026-12-05');
    await userEvent.type(screen.getByLabelText('Fin'), '2026-12-01');
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));
    expect(screen.getByLabelText('Fin')).toHaveAttribute('aria-invalid', 'true');
    expect(api.createPromotion).not.toHaveBeenCalled();
  });
});

describe('Plateforme', () => {
  const restaurant = (over = {}) => ({ slug: 'alpha', name: 'Alpha', status: 'active', createdAt: '2026-10-01T00:00:00Z', students: 12,
    administrators: [{ name: 'Admin Alpha', email: 'admin@alpha.test' }], ...over });
  it('liste les restaurants et change leur statut', async () => {
    api.listRestaurants.mockResolvedValue([restaurant(), restaurant({ slug: 'bravo', name: 'Bravo', status: 'inactive', students: 0, administrators: [] })]);
    api.setRestaurantStatus.mockResolvedValue({ slug: 'bravo', status: 'active' });
    render(<MemoryRouter><PlatformPage /></MemoryRouter>);
    const bravo = await screen.findByRole('article', { name: /Bravo/ });
    expect(within(bravo).getByText('Désactivé')).toBeInTheDocument();
    await userEvent.click(within(bravo).getByRole('button', { name: 'Réactiver' }));
    await waitFor(() => expect(api.setRestaurantStatus).toHaveBeenCalledWith('bravo', 'active'));
  });
  it('crée un restaurant avec son premier administrateur', async () => {
    api.listRestaurants.mockResolvedValue([]);
    api.createRestaurant.mockResolvedValue({ restaurant: { slug: 'nouveau', name: 'Nouveau', status: 'active' } });
    render(<MemoryRouter><PlatformPage /></MemoryRouter>);
    await screen.findByLabelText('Nom du restaurant');
    await userEvent.type(screen.getByLabelText('Nom du restaurant'), 'Nouveau');
    await userEvent.type(screen.getByLabelText('Identifiant (slug)'), 'nouveau');
    await userEvent.type(screen.getByLabelText('Nom de l’administrateur'), 'Admin N');
    await userEvent.type(screen.getByLabelText('E-mail de l’administrateur'), 'admin@nouveau.test');
    await userEvent.type(screen.getByLabelText('Téléphone de l’administrateur'), '+243830000003');
    await userEvent.type(screen.getByLabelText('Mot de passe initial'), 'Initial123');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le restaurant' }));
    await waitFor(() => expect(api.createRestaurant).toHaveBeenCalledWith({
      slug: 'nouveau', name: 'Nouveau', admin: { name: 'Admin N', email: 'admin@nouveau.test', phone: '+243830000003', password: 'Initial123' },
    }));
  });
  it('refuse un identifiant mal formé', async () => {
    api.listRestaurants.mockResolvedValue([]);
    render(<MemoryRouter><PlatformPage /></MemoryRouter>);
    await screen.findByLabelText('Nom du restaurant');
    await userEvent.type(screen.getByLabelText('Nom du restaurant'), 'Nouveau');
    await userEvent.type(screen.getByLabelText('Identifiant (slug)'), 'Mauvais Slug');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le restaurant' }));
    expect(screen.getByLabelText('Identifiant (slug)')).toHaveAttribute('aria-invalid', 'true');
    expect(api.createRestaurant).not.toHaveBeenCalled();
  });
});
