import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CartPage } from '../views/pages/CartPage.tsx';
import { AtRestaurant } from './AtRestaurant.tsx';
import { api } from '../models/http.ts';
import type { Cart } from '../models/cart.ts';

describe('CartPage (G-8 · feat(panier): panier d\'un seul restaurant et changement de restaurant)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('affiche un message quand le panier est vide', () => {
    render(
      <AtRestaurant slug="zeduc-space"><CartPage /></AtRestaurant>
    );

    expect(screen.getByTestId('empty-cart')).toBeInTheDocument();
    expect(screen.getByText('Votre panier est vide pour le moment.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Découvrir le menu' })).toHaveAttribute('href', '/r/zeduc-space/menu');
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
      <AtRestaurant slug="zeduc-space"><CartPage /></AtRestaurant>
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

  const loyalty = (availablePoints: number) => ({
    restaurant: { slug: 'zeduc-space', name: 'ZeDuc@Space' }, availablePoints, remainderFc: 0, canRedeem: availablePoints >= 15,
    rules: { spendPerPointFc: 3000, pointsForReward: 15, rewardValueFc: 3000, validityMonths: 12 }, movements: [],
  });
  const mountWithLoyalty = (points: number) => {
    localStorage.setItem('mmm_cart', JSON.stringify({ restaurantSlug: 'zeduc-space', lines: [
      { id: 'dish-1', name: 'Poulet DG', restaurantSlug: 'zeduc-space', unitPriceFc: 7000, quantity: 1 },
    ] }));
    localStorage.setItem('mmm_token', 'fake-token');
    vi.spyOn(api, 'get').mockImplementation(async (path: string) => (path === '/me'
      ? { id: 'student-1', name: 'Alex', email: 'alex@example.com', role: 'student' } : loyalty(points)) as never);
    render(<AtRestaurant slug="zeduc-space"><CartPage /></AtRestaurant>);
  };

  it('préremplit la livraison avec l’adresse habituelle du profil, modifiable à chaque commande', async () => {
    localStorage.setItem('mmm_cart', JSON.stringify({ restaurantSlug: 'zeduc-space', lines: [
      { id: 'dish-1', name: 'Poulet DG', restaurantSlug: 'zeduc-space', unitPriceFc: 7000, quantity: 1 },
    ] }));
    localStorage.setItem('mmm_token', 'fake-token');
    vi.spyOn(api, 'get').mockImplementation(async (path: string) => (path === '/me'
      ? { id: 'student-1', name: 'Alex', email: 'alex@example.com', role: 'student', commune: 'Limete', address: '12 avenue du Marché' }
      : loyalty(0)) as never);
    render(<AtRestaurant slug="zeduc-space"><CartPage /></AtRestaurant>);
    fireEvent.click(await screen.findByLabelText(/Livraison/));
    expect(await screen.findByTestId('select-commune')).toHaveValue('Limete');
    const address = screen.getByLabelText('Adresse');
    expect(address).toHaveValue('12 avenue du Marché');
    fireEvent.change(address, { target: { value: 'Chez un ami, rue 5' } });
    expect(address).toHaveValue('Chez un ami, rue 5');
  });

  it('propose la réduction fidélité avec les règles du restaurant quand les points suffisent', async () => {
    mountWithLoyalty(20);
    expect(await screen.findByTestId('checkbox-loyalty-discount')).toBeInTheDocument();
    expect(screen.getByText(/Utiliser 15 points pour une réduction de 3 000 FC \(vous en avez 20\)/)).toBeInTheDocument();
  });

  it('n’offre pas la case quand les points ne suffisent pas et indique le solde', async () => {
    mountWithLoyalty(4);
    expect(await screen.findByTestId('loyalty-info')).toHaveTextContent('Vous avez 4 points chez ZeDuc@Space');
    expect(screen.queryByTestId('checkbox-loyalty-discount')).toBeNull();
    expect(screen.getByTestId('net-total')).toHaveTextContent('7 000 FC');
  });

  it('applique la réduction fidélité lorsque la case est cochée', async () => {
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
    mountWithLoyalty(20);

    expect(screen.getByTestId('net-total')).toHaveTextContent('7 000 FC');

    const checkbox = await screen.findByTestId('checkbox-loyalty-discount');
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
      <AtRestaurant slug="zeduc-space"><CartPage /></AtRestaurant>
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
