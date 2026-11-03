import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CartPage } from '../views/pages/CartPage.tsx';
import { CartProvider } from '../controllers/cart.tsx';
import { AuthProvider } from '../controllers/session.tsx';
import { api } from '../models/http.ts';
import type { Cart } from '../models/cart.ts';

describe('CartPage (G-8 · feat(panier): panier d\'un seul restaurant et changement de restaurant)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('affiche un message quand le panier est vide', () => {
    render(
      <AuthProvider>
        <CartProvider>
          <MemoryRouter>
            <CartPage />
          </MemoryRouter>
        </CartProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('empty-cart')).toBeInTheDocument();
    expect(screen.getByText('Votre panier est vide pour le moment.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Découvrir le menu' })).toHaveAttribute('href', '/menu');
  });

  it('affiche les articles du panier et permet de modifier les quantités', () => {
    const initialCart: Cart = {
      restaurantSlug: 'zeduc-space',
      lines: [
        {
          id: 'dish-1',
          name: 'Poulet DG',
          restaurantSlug: 'zeduc-space',
          unitPriceFc: 3500,
          quantity: 2,
        },
      ],
    };
    localStorage.setItem('mmm_cart', JSON.stringify(initialCart));

    render(
      <AuthProvider>
        <CartProvider>
          <MemoryRouter>
            <CartPage />
          </MemoryRouter>
        </CartProvider>
      </AuthProvider>
    );

    expect(screen.getByText('Poulet DG')).toBeInTheDocument();
    expect(screen.getByTestId('quantity-dish-1')).toHaveTextContent('2');

    // Incrémenter la quantité
    fireEvent.click(screen.getByTestId('increment-dish-1'));
    expect(screen.getByTestId('quantity-dish-1')).toHaveTextContent('3');

    // Décrémenter la quantité
    fireEvent.click(screen.getByTestId('decrement-dish-1'));
    expect(screen.getByTestId('quantity-dish-1')).toHaveTextContent('2');
  });

  it('applique la réduction fidélité lorsque la case est cochée', () => {
    const initialCart: Cart = {
      restaurantSlug: 'zeduc-space',
      lines: [
        {
          id: 'dish-1',
          name: 'Poulet DG',
          restaurantSlug: 'zeduc-space',
          unitPriceFc: 7000,
          quantity: 1,
        },
      ],
    };
    localStorage.setItem('mmm_cart', JSON.stringify(initialCart));

    render(
      <AuthProvider>
        <CartProvider>
          <MemoryRouter>
            <CartPage />
          </MemoryRouter>
        </CartProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('net-total')).toHaveTextContent('7 000 FC');

    const checkbox = screen.getByTestId('checkbox-loyalty-discount');
    fireEvent.click(checkbox);

    expect(screen.getByText('Réduction fidélité :')).toBeInTheDocument();
    expect(screen.getByTestId('net-total')).toHaveTextContent('4 000 FC');
  });

  it('envoie la commande avec Idempotency-Key et affiche la confirmation', async () => {
    const initialCart: Cart = {
      restaurantSlug: 'zeduc-space',
      lines: [
        {
          id: 'dish-1',
          name: 'Poulet DG',
          restaurantSlug: 'zeduc-space',
          unitPriceFc: 3500,
          quantity: 1,
        },
      ],
    };
    localStorage.setItem('mmm_cart', JSON.stringify(initialCart));

    // Simuler un utilisateur connecté
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      id: 'student-1',
      name: 'Alex',
      email: 'alex@example.com',
      role: 'student',
    });
    localStorage.setItem('mmm_token', 'fake-token');

    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      id: 'ord_123',
      orderNumber: '20261103-001',
    });

    render(
      <AuthProvider>
        <CartProvider>
          <MemoryRouter>
            <CartPage />
          </MemoryRouter>
        </CartProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('confirm-order-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-order-button'));

    await waitFor(() => {
      expect(screen.getByTestId('order-confirmed')).toBeInTheDocument();
    });

    expect(screen.getByText('20261103-001')).toBeInTheDocument();
    expect(postSpy).toHaveBeenCalled();
    const callArgs = postSpy.mock.calls[0];
    expect(callArgs[0]).toBe('/orders');
    expect(callArgs[2]).toHaveProperty('idempotencyKey');
  });
});
