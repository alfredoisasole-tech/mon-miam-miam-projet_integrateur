import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffMenuPage } from '../views/pages/StaffMenuPage';
import { AdminMenuPage } from '../views/pages/AdminMenuPage';
import * as adminMenuApi from '../controllers/adminMenu';
import * as session from '../controllers/session';

// Mock du contrôleur adminMenu
vi.mock('../controllers/adminMenu', () => ({
  adminMenuApi: {
    getStaffMenu: vi.fn(),
    createDish: vi.fn(),
    staffUpdate: vi.fn(),
    deleteDish: vi.fn(),
  },
}));

// Mock de la session
vi.mock('../controllers/session', () => ({
  useAuth: vi.fn(),
}));

// Mock de RequireRole pour ne pas bloquer les tests
vi.mock('../views/components/RequireRole', () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockedUseAuth = session.useAuth as ReturnType<typeof vi.fn>;
const mockedApi = adminMenuApi.adminMenuApi as unknown as {
  getStaffMenu: ReturnType<typeof vi.fn>;
  createDish: ReturnType<typeof vi.fn>;
  staffUpdate: ReturnType<typeof vi.fn>;
  deleteDish: ReturnType<typeof vi.fn>;
};

const mockDishes = [
  {
    id: 'dish-1',
    name: 'Poulet braisé',
    description: 'Avec alloco',
    priceFc: 4500,
    category: 'plat',
    isDaily: false,
    isAvailable: true,
    imageUrl: null,
  },
  {
    id: 'dish-2',
    name: 'Coca-Cola',
    description: '33cl',
    priceFc: 1500,
    category: 'boisson',
    isDaily: false,
    isAvailable: true,
    imageUrl: null,
  },
];

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/staff/menu']}>
      <Routes>
        <Route path="/*" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('StaffMenuPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: '1', name: 'Employé Test', role: 'employee' },
      loading: false,
    });
  });

  it('charge et affiche la liste des plats', async () => {
    mockedApi.getStaffMenu.mockResolvedValue(mockDishes);

    renderWithRouter(<StaffMenuPage />);

    await waitFor(() => {
      expect(screen.getByText('Poulet braisé')).toBeInTheDocument();
      expect(screen.getByText('Coca-Cola')).toBeInTheDocument();
    });
  });

  it('affiche un message d erreur si le chargement echoue', async () => {
    mockedApi.getStaffMenu.mockRejectedValue(new Error('Erreur réseau'));

    renderWithRouter(<StaffMenuPage />);

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Impossible de charger le menu.');
    });
  });

  it('permet de basculer la disponibilite d un plat', async () => {
    const updatedDish = { ...mockDishes[0], isAvailable: false };
    mockedApi.getStaffMenu.mockResolvedValue(mockDishes);
    mockedApi.staffUpdate.mockResolvedValue(updatedDish);

    renderWithRouter(<StaffMenuPage />);

    await waitFor(() => {
      expect(screen.getByText('Poulet braisé')).toBeInTheDocument();
    });

    const checkbox = screen.getByTestId('available-dish-1');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockedApi.staffUpdate).toHaveBeenCalledWith('dish-1', { isAvailable: false });
    });
  });
});

describe('AdminMenuPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: '1', name: 'Admin Test', role: 'admin' },
      loading: false,
    });
  });

  it('affiche le formulaire d ajout quand on clique sur le bouton', async () => {
    mockedApi.getStaffMenu.mockResolvedValue([]);

    renderWithRouter(<AdminMenuPage />);

    // Attendre que le chargement initial soit terminé pour éviter le warning act(...)
    await waitFor(() => {
      expect(screen.queryByTestId('add-dish-form')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-form-btn'));

    expect(screen.getByTestId('add-dish-form')).toBeInTheDocument();
  });

  it('affiche une erreur de validation si le nom est trop court', async () => {
    mockedApi.getStaffMenu.mockResolvedValue([]);

    renderWithRouter(<AdminMenuPage />);

    await waitFor(() => {
      expect(screen.getByTestId('toggle-form-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-form-btn'));

    const nameInput = screen.getByTestId('input-name');
    fireEvent.change(nameInput, { target: { value: 'A' } });

    const submitBtn = screen.getByTestId('submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('error-name')).toHaveTextContent('Le nom doit contenir entre 2 et 80 caractères.');
    });
  });

  it('appelle createDish avec les bonnes donnees lors de la soumission', async () => {
    mockedApi.getStaffMenu.mockResolvedValue([]);
    mockedApi.createDish.mockResolvedValue({
      id: 'new-dish',
      name: 'Nouveau plat',
      description: 'Desc',
      priceFc: 3000,
      category: 'plat',
      isDaily: false,
      isAvailable: true,
      imageUrl: null,
    });

    renderWithRouter(<AdminMenuPage />);

    await waitFor(() => {
      expect(screen.getByTestId('toggle-form-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-form-btn'));

    fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Nouveau plat' } });
    fireEvent.change(screen.getByTestId('input-price'), { target: { value: '3000' } });

    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockedApi.createDish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nouveau plat',
          priceFc: 3000,
          category: 'plat',
        })
      );
    });
  });
});