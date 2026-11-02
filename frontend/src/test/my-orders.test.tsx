import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MyOrdersPage } from '../views/pages/MyOrdersPage';
import * as ordersModule from '../controllers/orders';
import * as session from '../controllers/session';

// Mock du hook useMyOrders
vi.mock('../controllers/orders', () => ({
  useMyOrders: vi.fn(),
}));

// Mock de la session pour RequireRole
vi.mock('../controllers/session', () => ({
  useAuth: vi.fn(),
}));

// Mock de RequireRole pour ne pas bloquer les tests
vi.mock('../views/components/RequireRole', () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockedUseMyOrders = ordersModule.useMyOrders as ReturnType<typeof vi.fn>;
const mockedUseAuth = session.useAuth as ReturnType<typeof vi.fn>;

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/mes-commandes']}>
      <Routes>
        <Route path="/*" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('MyOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: '1', name: 'Étudiant Test', role: 'student' },
      loading: false,
    });
  });

  it('affiche un message quand il n y a aucune commande', async () => {
    mockedUseMyOrders.mockReturnValue({ data: [], isLoading: false, error: null });

    renderWithRouter(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('no-orders')).toHaveTextContent('Vous n\'avez pas encore passé de commande.');
    });
  });

  it('affiche la liste des commandes avec les détails', async () => {
    const mockOrders = [
      {
        id: 'order-1',
        status: 'ready' as const,
        totalFc: 6000,
        createdAt: '2026-10-28T12:00:00Z',
        items: [{ id: 'item-1', name: 'Poulet braisé', quantity: 1, unitPriceFc: 4500 }],
        restaurantName: 'ZeDuc@Space',
      },
    ];
    mockedUseMyOrders.mockReturnValue({ data: mockOrders, isLoading: false, error: null });

    renderWithRouter(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('ZeDuc@Space')).toBeInTheDocument();
      expect(screen.getByTestId('status-order-1')).toHaveTextContent('Prête à récupérer');
      expect(screen.getByText('1x Poulet braisé')).toBeInTheDocument();
      expect(screen.getByText('Total : 6000 FC')).toBeInTheDocument();
    });
  });

  it('affiche un message d erreur en cas d echec du chargement', async () => {
    mockedUseMyOrders.mockReturnValue({ data: [], isLoading: false, error: 'Impossible de charger vos commandes.' });

    renderWithRouter(<MyOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Impossible de charger vos commandes.');
    });
  });
});