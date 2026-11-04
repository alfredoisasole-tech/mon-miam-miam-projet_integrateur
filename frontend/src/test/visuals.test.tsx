import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, RestaurantProvider } from '../controllers/session.tsx';
import { MenuPage } from '../views/pages/MenuPage.tsx';
import { DishCard } from '../views/components/DishCard.tsx';
import { AdminPromotionsPage } from '../views/pages/AdminPromotionsPage.tsx';
import { AdminMenuPage } from '../views/pages/AdminMenuPage.tsx';
import { adminApi } from '../controllers/admin.ts';
import { adminMenuApi } from '../controllers/adminMenu.ts';
import { settingsApi } from '../controllers/settings.ts';
import * as session from '../controllers/session.tsx';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../models/http.ts', () => ({ api: { get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }, assetUrl: (path: string) => path }));
vi.mock('../controllers/admin.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../controllers/admin.ts')>()),
  adminApi: { listPromotions: vi.fn(), createPromotion: vi.fn(), updatePromotion: vi.fn(), deletePromotion: vi.fn() },
}));
vi.mock('../controllers/adminMenu.ts', () => ({ adminMenuApi: { getStaffMenu: vi.fn(), createDish: vi.fn() } }));
vi.mock('../controllers/settings.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../controllers/settings.ts')>()),
  settingsApi: { uploadAsset: vi.fn() },
}));
vi.mock('../views/components/RequireRole', () => ({ RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'affiche.png', { type: 'image/png' });
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); localStorage.setItem('mmm_restaurant', 'alpha'); });
afterEach(cleanup);

describe('Photos des plats', () => {
  it('affiche la photo d’un plat quand il en a une', () => {
    render(<DishCard dish={{ id: 'd1', name: 'Pondu', description: null, priceFc: 3500, isDaily: false, isAvailable: true, imageUrl: '/api/restaurants/alpha/assets/ast_1' }} isStudent onAdd={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Pondu' })).toHaveAttribute('src', '/api/restaurants/alpha/assets/ast_1');
  });
  it('n’affiche pas d’image sans photo', () => {
    render(<DishCard dish={{ id: 'd1', name: 'Pondu', description: null, priceFc: 3500, isDaily: false, isAvailable: true, imageUrl: null }} isStudent onAdd={vi.fn()} />);
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('Promotions et événements sur la page du menu', () => {
  function renderMenu() {
    render(<MemoryRouter><AuthProvider><RestaurantProvider><MenuPage /></RestaurantProvider></AuthProvider></MemoryRouter>);
  }
  it('affiche les promotions, événements et jeux en cours du restaurant', async () => {
    const now = Date.now();
    get.mockImplementation(async (path: string) => {
      if (path.endsWith('/promotions')) {
        return [
          { id: 'p1', type: 'promotion', title: 'Happy Hour', description: '-20 % sur les boissons', imageUrl: null,
            startDate: new Date(now - 86400000).toISOString(), endDate: new Date(now + 86400000).toISOString() },
          { id: 'p2', type: 'event', title: 'Match de la semaine', description: 'Sur grand écran', imageUrl: '/api/restaurants/alpha/assets/ast_2',
            startDate: new Date(now - 86400000).toISOString(), endDate: new Date(now + 86400000).toISOString() },
        ];
      }
      return { restaurant: 'alpha', dailyItems: [], categories: [{ name: 'Plats', items: [{ id: 'd1', name: 'Poulet', description: null, priceFc: 4500, isDaily: false, isAvailable: true, imageUrl: null }] }] };
    });
    renderMenu();
    expect(await screen.findByText('Happy Hour')).toBeInTheDocument();
    expect(screen.getByText('Match de la semaine')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Promotions et événements' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/restaurants/alpha/promotions');
  });
  it('n’affiche pas la section sans promotion', async () => {
    get.mockImplementation(async (path: string) => (path.endsWith('/promotions') ? []
      : { restaurant: 'alpha', dailyItems: [], categories: [{ name: 'Plats', items: [{ id: 'd1', name: 'Poulet', description: null, priceFc: 4500, isDaily: false, isAvailable: true, imageUrl: null }] }] }));
    renderMenu();
    await screen.findByText('Poulet');
    expect(screen.queryByRole('heading', { name: 'Promotions et événements' })).toBeNull();
  });
});

describe('Envoi d’images par l’administrateur', () => {
  beforeEach(() => {
    vi.spyOn(session, 'useAuth').mockReturnValue({ user: { id: 'a', name: 'Admin', role: 'admin' }, loading: false, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn() });
  });
  it('joint une affiche à une promotion', async () => {
    vi.mocked(adminApi.listPromotions).mockResolvedValue([]);
    vi.mocked(adminApi.createPromotion).mockResolvedValue({} as never);
    vi.mocked(settingsApi.uploadAsset).mockResolvedValue({ id: 'ast_9', url: '/x' });
    render(<MemoryRouter><AdminPromotionsPage /></MemoryRouter>);
    await screen.findByLabelText('Titre');
    await userEvent.type(screen.getByLabelText('Titre'), 'Tournoi');
    await userEvent.type(screen.getByLabelText('Début'), '2026-12-01');
    await userEvent.type(screen.getByLabelText('Fin'), '2026-12-05');
    const file = png();
    await userEvent.upload(screen.getByLabelText('Affiche'), file);
    await waitFor(() => expect(settingsApi.uploadAsset).toHaveBeenCalledWith('poster', file));
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() => expect(adminApi.createPromotion).toHaveBeenCalledWith(expect.objectContaining({ imageAssetId: 'ast_9' })));
  });
  it('refuse une affiche trop lourde', async () => {
    vi.mocked(adminApi.listPromotions).mockResolvedValue([]);
    render(<MemoryRouter><AdminPromotionsPage /></MemoryRouter>);
    await screen.findByLabelText('Titre');
    await userEvent.upload(screen.getByLabelText('Affiche'), new File([new Uint8Array(600 * 1024)], 'gros.png', { type: 'image/png' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('512 Ko');
    expect(settingsApi.uploadAsset).not.toHaveBeenCalled();
  });
  it('joint une photo à un nouveau plat', async () => {
    vi.mocked(adminMenuApi.getStaffMenu).mockResolvedValue([]);
    vi.mocked(adminMenuApi.createDish).mockResolvedValue({} as never);
    vi.mocked(settingsApi.uploadAsset).mockResolvedValue({ id: 'ast_7', url: '/x' });
    render(<MemoryRouter><AdminMenuPage /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: /Ajouter un plat/ }));
    await userEvent.type(screen.getByLabelText('Nom'), 'Riz et haricots');
    await userEvent.type(screen.getByLabelText('Prix (FC)'), '2500');
    const file = png();
    await userEvent.upload(screen.getByLabelText('Photo'), file);
    await waitFor(() => expect(settingsApi.uploadAsset).toHaveBeenCalledWith('menu', file));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(adminMenuApi.createDish).toHaveBeenCalledWith(expect.objectContaining({ name: 'Riz et haricots', imageAssetId: 'ast_7' })));
  });
});
