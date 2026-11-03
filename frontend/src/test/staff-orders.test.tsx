import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffOrdersPage } from '../views/pages/StaffOrdersPage.tsx';
import { api } from '../models/http.ts';
import type { StaffOrder } from '../controllers/staffOrders.ts';

describe('StaffOrdersPage (G-9 · feat(commandes): page de gestion des commandes du restaurant)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockOrders: StaffOrder[] = [
    {
      id: 'order-1',
      orderNumber: '20261103-001',
      type: 'dine_in',
      status: 'pending',
      paymentMethod: 'cash',
      paymentStatus: 'unpaid',
      items: [{ menuItemId: 'd-1', name: 'Poulet DG', unitPriceFc: 3500, quantity: 1, lineTotalFc: 3500 }],
      subtotalFc: 3500,
      discountFc: 0,
      deliveryFeeFc: 0,
      totalFc: 3500,
      arrivalTime: '2026-11-03T11:45:00.000Z',
      delivery: null,
      createdAt: '2026-11-03T10:00:00.000Z',
      updatedAt: '2026-11-03T10:00:00.000Z',
    },
    {
      id: 'order-2',
      orderNumber: '20261103-002',
      type: 'delivery',
      status: 'completed',
      paymentMethod: 'mobile_money',
      paymentStatus: 'paid',
      items: [{ menuItemId: 'd-2', name: 'Riz sauté', unitPriceFc: 2800, quantity: 2, lineTotalFc: 5600 }],
      subtotalFc: 5600,
      discountFc: 0,
      deliveryFeeFc: 1000,
      totalFc: 6600,
      arrivalTime: null,
      delivery: { commune: 'Gombe', quartier: null, address: 'Av. Justice', landmark: null, phone: '0812345678' },
      createdAt: '2026-11-03T09:00:00.000Z',
      updatedAt: '2026-11-03T09:30:00.000Z',
    },
  ];

  it('charge et affiche les commandes en cours', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ items: mockOrders });

    render(<StaffOrdersPage />);

    expect(screen.getByText('Les commandes du service')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('20261103-001')).toBeInTheDocument();
      expect(screen.getByText('Poulet DG × 1')).toBeInTheDocument();
      expect(screen.getByTestId('btn-confirm-order-1')).toBeInTheDocument();
      expect(screen.getByTestId('btn-cancel-order-1')).toBeInTheDocument();
    });

    // L'onglet actif ne doit pas afficher la commande terminée
    expect(screen.queryByText('20261103-002')).not.toBeInTheDocument();
  });

  it('permet de changer d’onglet vers « Terminées »', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ items: mockOrders });

    render(<StaffOrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('20261103-001')).toBeInTheDocument();
    });

    // Clic sur l'onglet terminées
    fireEvent.click(screen.getByTestId('tab-completed'));

    expect(screen.getByText('20261103-002')).toBeInTheDocument();
    expect(screen.queryByText('20261103-001')).not.toBeInTheDocument();
  });

  it('confirmer une commande envoie le bon statut et met à jour l’affichage', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ items: mockOrders });
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValueOnce({
      ...mockOrders[0],
      status: 'confirmed',
    });

    render(<StaffOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-confirm-order-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-confirm-order-1'));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('/staff/orders/order-1/status', { status: 'confirmed' });
    });
  });

  it('affiche un message d’erreur si l’API refuse le changement de statut', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ items: mockOrders });
    vi.spyOn(api, 'patch').mockRejectedValueOnce(
      new Error('Le paiement en ligne doit être reçu avant de confirmer la commande.')
    );

    render(<StaffOrdersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-confirm-order-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-confirm-order-1'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Le paiement en ligne doit être reçu avant de confirmer la commande.'
      );
    });
  });
});

