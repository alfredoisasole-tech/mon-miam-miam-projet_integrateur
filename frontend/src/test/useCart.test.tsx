import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCart } from '../controllers/useCart.ts';
import type { CartProduct } from '../models/cart.ts';

const burger: CartProduct = {
  id: 'burger',
  restaurantSlug: 'restaurant-a',
  name: 'Burger',
  unitPriceFc: 5000,
};

const salad: CartProduct = {
  id: 'salad',
  restaurantSlug: 'restaurant-b',
  name: 'Salade',
  unitPriceFc: 3500,
};

describe('Contrôleur du panier — APP-67', () => {
  it('ajoute des plats et expose le total indicatif', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addProduct(burger, 2);
    });

    expect(result.current.cart.lines).toHaveLength(1);
    expect(result.current.cart.lines[0]?.quantity).toBe(2);
    expect(result.current.totalFc).toBe(10000);
  });

  it('expose une erreur lisible quand la quantité dépasse la limite', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addProduct(burger, 2);
    });
    act(() => {
      result.current.updateProductQuantity(burger.id, 25);
    });

    expect(result.current.error).toBe('La quantité doit être comprise entre 1 et 20.');
    expect(result.current.cart.lines[0]?.quantity).toBe(2);
  });

  it('expose une erreur lisible quand le plat à modifier ne figure pas dans le panier', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.updateProductQuantity('plat-absent', 2);
    });

    expect(result.current.error).toBe('Ce plat ne figure pas dans le panier.');
    expect(result.current.cart.lines).toEqual([]);
  });

  it('garde le panier en attente du choix de l’étudiant avant de changer de restaurant', () => {
    const { result } = renderHook(() => useCart());

    act(() => {
      result.current.addProduct(burger);
    });
    act(() => {
      expect(result.current.addProduct(salad)).toBe('confirmation_required');
    });

    expect(result.current.cart.restaurantSlug).toBe('restaurant-a');
    expect(result.current.pendingRestaurantChange?.name).toBe('Salade');

    act(() => {
      result.current.cancelRestaurantChange();
    });
    expect(result.current.cart.restaurantSlug).toBe('restaurant-a');

    act(() => {
      result.current.addProduct(salad);
    });
    act(() => {
      result.current.confirmRestaurantChange();
    });
    expect(result.current.cart.restaurantSlug).toBe('restaurant-b');
    expect(result.current.cart.lines).toEqual([{ ...salad, quantity: 1 }]);
  });
});
