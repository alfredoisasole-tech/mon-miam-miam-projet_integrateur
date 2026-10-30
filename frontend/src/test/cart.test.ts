import { describe, expect, it } from 'vitest';
import {
  addCartItem,
  calculateIndicativeTotal,
  createEmptyCart,
  removeCartItem,
  setCartItemQuantity,
  type CartProduct,
} from '../models/cart.ts';

const burger: CartProduct = {
  id: 'burger',
  restaurantSlug: 'restaurant-a',
  name: 'Burger',
  unitPriceFc: 5000,
};

const fries: CartProduct = {
  id: 'fries',
  restaurantSlug: 'restaurant-a',
  name: 'Frites',
  unitPriceFc: 2000,
};

const salad: CartProduct = {
  id: 'salad',
  restaurantSlug: 'restaurant-b',
  name: 'Salade',
  unitPriceFc: 3500,
};

describe('Panier — APP-67', () => {
  it('ajoute un plat et calcule son total indicatif', () => {
    const result = addCartItem(createEmptyCart(), burger, 2);

    expect(result.confirmationRequired).toBe(false);
    expect(result.cart.restaurantSlug).toBe('restaurant-a');
    expect(result.cart.lines).toEqual([{ ...burger, quantity: 2 }]);
    expect(calculateIndicativeTotal(result.cart)).toBe(10000);
  });

  it('regroupe les ajouts du même plat', () => {
    const first = addCartItem(createEmptyCart(), burger, 2).cart;
    const second = addCartItem(first, burger, 3).cart;

    expect(second.lines).toEqual([{ ...burger, quantity: 5 }]);
  });

  it('limite chaque plat à 20 exemplaires', () => {
    const full = addCartItem(createEmptyCart(), burger, 20).cart;

    expect(() => addCartItem(full, burger)).toThrowError('La quantité maximale est de 20 par plat.');
    expect(() => addCartItem(createEmptyCart(), burger, 21)).toThrowError('La quantité doit être comprise entre 1 et 20.');
    expect(() => addCartItem(createEmptyCart(), burger, 0)).toThrowError('La quantité doit être comprise entre 1 et 20.');
  });

  it('limite le panier à 30 plats distincts', () => {
    let cart = createEmptyCart();
    for (let index = 1; index <= 30; index += 1) {
      cart = addCartItem(cart, {
        id: `dish-${index}`,
        restaurantSlug: 'restaurant-a',
        name: `Plat ${index}`,
        unitPriceFc: 1000,
      }).cart;
    }

    expect(cart.lines).toHaveLength(30);
    expect(() => addCartItem(cart, { ...burger, id: 'dish-31' })).toThrowError('Le panier est limité à 30 plats différents.');
  });

  it('demande confirmation avant de vider le panier pour changer de restaurant', () => {
    const cart = addCartItem(createEmptyCart(), burger).cart;

    const pending = addCartItem(cart, salad);
    expect(pending.confirmationRequired).toBe(true);
    expect(pending.cart).toEqual(cart);

    const confirmed = addCartItem(cart, salad, 1, true);
    expect(confirmed.confirmationRequired).toBe(false);
    expect(confirmed.cart.restaurantSlug).toBe('restaurant-b');
    expect(confirmed.cart.lines).toEqual([{ ...salad, quantity: 1 }]);
  });

  it('permet de modifier et de retirer un plat', () => {
    const cart = addCartItem(createEmptyCart(), burger, 2).cart;
    const updated = setCartItemQuantity(cart, burger.id, 4);

    expect(calculateIndicativeTotal(updated)).toBe(20000);
    expect(removeCartItem(updated, burger.id)).toEqual(createEmptyCart());
  });
});
