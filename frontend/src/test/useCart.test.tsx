import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartProvider, loadCartsFromStorage, useCart } from '../controllers/cart.tsx';
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

const wrapper = ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>;
/** Les deux paniers côte à côte, comme un client qui passe d'un restaurant à l'autre. */
const bothCarts = () => renderHook(() => ({ a: useCart('restaurant-a'), b: useCart('restaurant-b') }), { wrapper });

beforeEach(() => localStorage.clear());

describe('Contrôleur du panier — un panier par restaurant', () => {
  it('ajoute des plats et expose le total indicatif', () => {
    const { result } = renderHook(() => useCart('restaurant-a'));

    act(() => {
      result.current.addProduct(burger, 2);
    });

    expect(result.current.cart.lines).toHaveLength(1);
    expect(result.current.cart.lines[0]?.quantity).toBe(2);
    expect(result.current.totalFc).toBe(10000);
    expect(result.current.count).toBe(2);
  });

  it('expose une erreur lisible quand la quantité dépasse la limite', () => {
    const { result } = renderHook(() => useCart('restaurant-a'));

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
    const { result } = renderHook(() => useCart('restaurant-a'));

    act(() => {
      result.current.updateProductQuantity('plat-absent', 2);
    });

    expect(result.current.error).toBe('Ce plat ne figure pas dans le panier.');
    expect(result.current.cart.lines).toEqual([]);
  });

  it('garde un panier distinct par restaurant, sans rien demander ni vider en changeant de restaurant', () => {
    const { result } = bothCarts();

    act(() => { result.current.a.addProduct(burger); });
    act(() => { result.current.b.addProduct(salad, 3); });

    expect(result.current.a.cart.lines).toEqual([{ ...burger, quantity: 1 }]);
    expect(result.current.b.cart.lines).toEqual([{ ...salad, quantity: 3 }]);
    expect(result.current.a.totalFc).toBe(5000);
    expect(result.current.b.totalFc).toBe(10500);

    act(() => { result.current.a.clearCart(); });
    expect(result.current.a.cart.lines).toEqual([]);
    expect(result.current.b.count).toBe(3);
  });

  it('refuse un plat d’un autre restaurant que celui dont on ouvre le panier', () => {
    const { result } = renderHook(() => useCart('restaurant-a'));

    act(() => {
      expect(result.current.addProduct(salad)).toBe('error');
    });

    expect(result.current.error).toBe('Ce plat n’appartient pas au restaurant que vous consultez.');
    expect(result.current.cart.lines).toEqual([]);
  });

  it('n’a pas de panier hors d’un restaurant', () => {
    const { result } = renderHook(() => useCart(null));
    act(() => { expect(result.current.addProduct(burger)).toBe('error'); });
    expect(result.current.count).toBe(0);
  });

  it('retrouve les paniers au rechargement', () => {
    const first = bothCarts();
    act(() => { first.result.current.a.addProduct(burger); });
    act(() => { first.result.current.b.addProduct(salad); });
    first.unmount();

    const second = bothCarts();
    expect(second.result.current.a.count).toBe(1);
    expect(second.result.current.b.count).toBe(1);
  });

  it('reprend l’ancien panier unique sous son restaurant', () => {
    localStorage.setItem('mmm_cart', JSON.stringify({ restaurantSlug: 'restaurant-b', lines: [{ ...salad, quantity: 2 }] }));

    expect(loadCartsFromStorage()).toEqual({ 'restaurant-b': { restaurantSlug: 'restaurant-b', lines: [{ ...salad, quantity: 2 }] } });
    expect(localStorage.getItem('mmm_cart')).toBeNull();
  });
});
