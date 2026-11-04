import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoyaltyPage } from '../views/pages/LoyaltyPage.tsx';
import { AuthProvider, RestaurantProvider } from '../controllers/session.tsx';
import { api } from '../models/http.ts';
import type { LoyaltyBalance } from '../controllers/loyalty.ts';

describe('LoyaltyPage (G-12 · feat(fidelite): ecran des points de l\'etudiant)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const studentUser = {
    id: 'student-1',
    name: 'Alex',
    email: 'alex@example.com',
    role: 'student',
  };

  const mockLoyaltyBalance: LoyaltyBalance = {
    restaurant: { slug: 'zeduc-space', name: 'ZeDuc@Space' },
    availablePoints: 30,
    remainderFc: 1200,
    canRedeem: true,
    rules: {
      spendPerPointFc: 3000,
      pointsForReward: 15,
      rewardValueFc: 3000,
      validityMonths: 12,
    },
    movements: [
      { kind: 'earn', points: 2, orderId: 'ord-1', orderNumber: '20261027-001', createdAt: '2026-10-27T12:00:00.000Z', expiresAt: '2027-10-27T12:00:00.000Z' },
      { kind: 'redeem', points: -15, orderId: null, orderNumber: null, createdAt: '2026-10-25T14:00:00.000Z', expiresAt: null },
    ],
  };

  it('affiche un message d’invitation si aucun restaurant n’est sélectionné', async () => {
    // Simuler connexion étudiant
    vi.spyOn(api, 'get').mockResolvedValueOnce(studentUser);
    localStorage.setItem('mmm_token', 'token-student');

    render(
      <AuthProvider>
        <RestaurantProvider>
          <MemoryRouter>
            <LoyaltyPage />
          </MemoryRouter>
        </RestaurantProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loyalty-no-restaurant')).toBeInTheDocument();
      expect(screen.getByText('Choisissez un restaurant pour consulter vos points de fidélité.')).toBeInTheDocument();
    });
  });

  it('affiche le solde de points et les réductions disponibles si solde >= 15', async () => {
    localStorage.setItem('mmm_token', 'token-student');
    localStorage.setItem('mmm_restaurant', 'zeduc-space');

    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/me') return studentUser;
      if (path === '/restaurants/zeduc-space/loyalty') return mockLoyaltyBalance;
      throw new Error(`Route inattendue : ${path}`);
    });

    render(
      <AuthProvider>
        <RestaurantProvider>
          <MemoryRouter>
            <LoyaltyPage />
          </MemoryRouter>
        </RestaurantProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Vos points Miam Club')).toBeInTheDocument();
      expect(screen.getByTestId('available-points')).toHaveTextContent('30');
      expect(screen.getByTestId('reward-available')).toHaveTextContent('2 réduction(s) disponible(s)');
      expect(screen.getByText('Points gagnés · commande 20261027-001')).toBeInTheDocument();
      expect(screen.getByText('Réduction utilisée')).toBeInTheDocument();
      expect(screen.getByText(/3 000 FC payés = 1 point/)).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
      expect(screen.getByText('-15')).toBeInTheDocument();
    });
  });

  it('affiche les points manquants quand le solde est inférieur au palier', async () => {
    localStorage.setItem('mmm_token', 'token-student');
    localStorage.setItem('mmm_restaurant', 'zeduc-space');

    const lowBalance: LoyaltyBalance = {
      ...mockLoyaltyBalance,
      availablePoints: 9,
      movements: [],
    };

    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/me') return studentUser;
      if (path === '/restaurants/zeduc-space/loyalty') return lowBalance;
      throw new Error(`Route inattendue : ${path}`);
    });

    render(
      <AuthProvider>
        <RestaurantProvider>
          <MemoryRouter>
            <LoyaltyPage />
          </MemoryRouter>
        </RestaurantProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('available-points')).toHaveTextContent('9');
      expect(screen.getByTestId('points-missing')).toHaveTextContent('Il vous manque 6 points pour une réduction de 3 000 FC');
      expect(screen.getByTestId('empty-movements')).toHaveTextContent('Vous n\'avez pas encore cumulé de points chez ZeDuc@Space.');
    });
  });

  it('affiche une alerte en cas d’erreur de l’API', async () => {
    localStorage.setItem('mmm_token', 'token-student');
    localStorage.setItem('mmm_restaurant', 'zeduc-space');

    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/me') return studentUser;
      if (path === '/restaurants/zeduc-space/loyalty') throw new Error('Erreur réseau');
      throw new Error(`Route inattendue : ${path}`);
    });

    render(
      <AuthProvider>
        <RestaurantProvider>
          <MemoryRouter>
            <LoyaltyPage />
          </MemoryRouter>
        </RestaurantProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Erreur réseau');
    });
  });
});

