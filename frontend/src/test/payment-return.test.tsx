import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PaymentReturnPage } from '../views/pages/PaymentReturnPage';
import * as paymentApi from '../controllers/payment';
import * as session from '../controllers/session';

vi.mock('../controllers/payment', () => ({
  paymentApi: {
    simulatePayment: vi.fn(),
  },
}));

vi.mock('../controllers/session', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../views/components/RequireRole', () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockedSimulatePayment = paymentApi.paymentApi.simulatePayment as ReturnType<typeof vi.fn>;
const mockedUseAuth = session.useAuth as ReturnType<typeof vi.fn>;

const renderWithRouter = (ui: React.ReactElement, initialEntries = ['/paiement/simulation/pay_123']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/paiement/simulation/:paymentId" element={ui} />
        <Route path="/mes-commandes" element={<p data-testid="my-orders-page">Mes Commandes</p>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('PaymentReturnPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: '1', name: 'Étudiant Test', role: 'student' },
      loading: false,
    });
  });

  it('affiche les boutons de simulation au chargement', () => {
    renderWithRouter(<PaymentReturnPage />);
    expect(screen.getByTestId('btn-simulate-paid')).toBeInTheDocument();
    expect(screen.getByTestId('btn-simulate-failed')).toBeInTheDocument();
  });

  it('simule un paiement réussi et affiche le message de succès', async () => {
    mockedSimulatePayment.mockResolvedValue({
      paymentId: 'pay_123',
      status: 'paid',
      orderStatus: 'confirmed',
    });

    renderWithRouter(<PaymentReturnPage />);
    fireEvent.click(screen.getByTestId('btn-simulate-paid'));

    await waitFor(() => {
      expect(screen.getByTestId('payment-success')).toBeInTheDocument();
      expect(screen.getByText('✅ Paiement reçu !')).toBeInTheDocument();
    });
  });

  it('simule un échec de paiement et affiche le message d échec', async () => {
    mockedSimulatePayment.mockResolvedValue({
      paymentId: 'pay_123',
      status: 'failed',
      orderStatus: 'pending',
    });

    renderWithRouter(<PaymentReturnPage />);
    fireEvent.click(screen.getByTestId('btn-simulate-failed'));

    await waitFor(() => {
      expect(screen.getByTestId('payment-failed')).toBeInTheDocument();
      expect(screen.getByText('❌ Paiement échoué')).toBeInTheDocument();
    });
  });

  it('redirige vers mes commandes après un succès', async () => {
    mockedSimulatePayment.mockResolvedValue({
      paymentId: 'pay_123',
      status: 'paid',
      orderStatus: 'confirmed',
    });

    renderWithRouter(<PaymentReturnPage />);
    fireEvent.click(screen.getByTestId('btn-simulate-paid'));

    await waitFor(() => {
      expect(screen.getByText('Voir mes commandes')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Voir mes commandes'));
    expect(screen.getByTestId('my-orders-page')).toBeInTheDocument();
  });
});