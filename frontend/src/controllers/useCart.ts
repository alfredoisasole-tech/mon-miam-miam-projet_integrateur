import { useCallback, useMemo, useState } from 'react';
import {
  addCartItem,
  calculateIndicativeTotal,
  createEmptyCart,
  removeCartItem,
  setCartItemQuantity,
  type Cart,
  type CartProduct,
} from '../models/cart.ts';

interface PendingRestaurantChange {
  product: CartProduct;
  quantity: number;
}

export type AddProductResult = 'added' | 'confirmation_required' | 'error';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useCart() {
  const [cart, setCart] = useState<Cart>(createEmptyCart);
  const [pendingRestaurantChange, setPendingRestaurantChange] = useState<PendingRestaurantChange | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addProduct = useCallback((product: CartProduct, quantity = 1): AddProductResult => {
    setError(null);
    try {
      const result = addCartItem(cart, product, quantity);
      if (result.confirmationRequired) {
        setPendingRestaurantChange({ product, quantity });
        return 'confirmation_required';
      }
      setCart(result.cart);
      setPendingRestaurantChange(null);
      return 'added';
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Impossible d’ajouter ce plat au panier.'));
      return 'error';
    }
  }, [cart]);

  const confirmRestaurantChange = useCallback(() => {
    if (!pendingRestaurantChange) return;
    setError(null);
    try {
      const result = addCartItem(
        cart,
        pendingRestaurantChange.product,
        pendingRestaurantChange.quantity,
        true,
      );
      setCart(result.cart);
      setPendingRestaurantChange(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Impossible de changer de restaurant.'));
    }
  }, [cart, pendingRestaurantChange]);

  const cancelRestaurantChange = useCallback(() => {
    setPendingRestaurantChange(null);
  }, []);

  const updateProductQuantity = useCallback((productId: string, quantity: number) => {
    setError(null);
    try {
      setCart(setCartItemQuantity(cart, productId, quantity));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Impossible de modifier la quantité de ce plat.'));
    }
  }, [cart]);

  const removeProduct = useCallback((productId: string) => {
    setError(null);
    setCart(removeCartItem(cart, productId));
  }, [cart]);

  const clearCart = useCallback(() => {
    setCart(createEmptyCart());
    setPendingRestaurantChange(null);
    setError(null);
  }, []);

  const totalFc = useMemo(() => calculateIndicativeTotal(cart), [cart]);

  return {
    cart,
    totalFc,
    error,
    pendingRestaurantChange: pendingRestaurantChange?.product ?? null,
    addProduct,
    confirmRestaurantChange,
    cancelRestaurantChange,
    updateProductQuantity,
    removeProduct,
    clearCart,
  };
}
