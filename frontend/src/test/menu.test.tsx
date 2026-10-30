import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, RestaurantProvider } from '../controllers/session.tsx';
import { MenuPage } from '../views/pages/MenuPage.tsx';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../models/http.ts', () => ({ api: { get } }));

function renderMenu(): void {
  render(
    <AuthProvider>
      <RestaurantProvider>
        <MenuPage />
      </RestaurantProvider>
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('mmm_restaurant', 'alpha');
  get.mockReset();
});

describe('MenuPage', () => {
  it('charge le menu du restaurant sélectionné depuis l’API', async () => {
    get.mockResolvedValue({
      restaurant: 'alpha',
      dailyItems: [{ id: 'daily-1', name: 'Pondu', description: null, priceFc: 3500, isDaily: true, isAvailable: true, imageUrl: null }],
      categories: [{ name: 'Plats', items: [{ id: 'dish-1', name: 'Poulet braisé', description: 'Avec alloco', priceFc: 4500, isDaily: false, isAvailable: true, imageUrl: '/image.png' }] }],
    });

    renderMenu();

    expect(await screen.findByText('Poulet braisé')).toBeTruthy();
    expect(screen.getByText('Pondu')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/restaurants/alpha/menu');
  });

  it('affiche le chargement pendant la requête', () => {
    get.mockReturnValue(new Promise(() => {}));
    renderMenu();
    expect(screen.getByText('Chargement du menu...')).toBeTruthy();
  });

  it('affiche un message en français quand le menu ne peut pas être chargé', async () => {
    get.mockRejectedValue(new Error('Réseau indisponible'));
    renderMenu();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Impossible de charger le menu. Réessayez.')).toBeTruthy();
  });

  it('demande de choisir un restaurant si aucun slug n’est enregistré', () => {
    localStorage.removeItem('mmm_restaurant');
    renderMenu();
    expect(screen.getByText('Choisissez un restaurant pour afficher son menu.')).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });
});
