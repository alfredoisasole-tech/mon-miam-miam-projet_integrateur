import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HomePage, RestaurantRedirectPage } from '../views/pages/HomePage.tsx';
import { AuthProvider, RestaurantProvider } from '../controllers/session.tsx';
import { api } from '../models/http.ts';

describe('HomePage (G-6 · feat(restaurants): liste des restaurants et selection)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockRestaurants = [
    {
      slug: 'zeduc-space',
      name: 'ZeDuc@Space',
      slogan: 'Le goût de la terrasse',
      logoUrl: null,
      colors: { primary: '#cfbd97', secondary: '#000000' },
      isOpenNow: true,
    },
    {
      slug: 'chez-lea',
      name: 'Chez Léa',
      slogan: 'Cuisine familiale',
      logoUrl: null,
      colors: { primary: '#cfbd97', secondary: '#000000' },
      isOpenNow: false,
    },
  ];

  it('affiche les restaurants renvoyés par l’API', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      items: mockRestaurants,
      total: 2,
      page: 1,
      pageSize: 20,
    });

    render(
      <AuthProvider>
        <RestaurantProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<HomePage />} />
            </Routes>
          </MemoryRouter>
        </RestaurantProvider>
      </AuthProvider>
    );

    expect(screen.getByText('Vos repas du campus, commandés en quelques clics')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('ZeDuc@Space')).toBeInTheDocument();
      expect(screen.getByText('Chez Léa')).toBeInTheDocument();
    });

    expect(screen.getByText('Ouvert')).toBeInTheDocument();
    expect(screen.getByText('Fermé')).toBeInTheDocument();
  });

  it('cliquer sur un restaurant choisit le restaurant et navigue vers le menu', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      items: mockRestaurants,
      total: 2,
      page: 1,
      pageSize: 20,
    });

    render(
      <AuthProvider>
        <RestaurantProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/r/:slug/menu" element={<div>Page Menu Cible</div>} />
            </Routes>
          </MemoryRouter>
        </RestaurantProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('select-restaurant-zeduc-space')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('select-restaurant-zeduc-space'));

    await waitFor(() => {
      expect(screen.getByText('Page Menu Cible')).toBeInTheDocument();
    });
    expect(localStorage.getItem('mmm_restaurant')).toBe('zeduc-space');
  });

  it('affiche un message d’erreur si l’API échoue', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Erreur de chargement'));

    render(
      <AuthProvider>
        <RestaurantProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<HomePage />} />
            </Routes>
          </MemoryRouter>
        </RestaurantProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Erreur de chargement');
    });
  });

  it('RestaurantRedirectPage sélectionne le restaurant depuis l’URL puis redirige vers son menu', async () => {
    render(
      <RestaurantProvider>
        <MemoryRouter initialEntries={['/r/chez-lea']}>
          <Routes>
            <Route path="/r/:slug" element={<RestaurantRedirectPage />} />
            <Route path="/r/:slug/menu" element={<div>Menu de chez-lea</div>} />
          </Routes>
        </MemoryRouter>
      </RestaurantProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Menu de chez-lea')).toBeInTheDocument();
    });
    expect(localStorage.getItem('mmm_restaurant')).toBe('chez-lea');
  });
});
