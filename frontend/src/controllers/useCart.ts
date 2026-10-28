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

export type AddProductResult = 'added' | 'confirmation_required';

export function useCart() {
  const [cart, setCart] = useState<Cart>(createEmptyCart);
  const [pendingRestaurantChange, setPendingRestaurantChange] = useState<PendingRestaurantChange | null>(null);

  const addProduct = useCallback((product: CartProduct, quantity = 1): AddProductResult => {
    const result = addCartItem(cart, product, quantity);
    if (result.confirmationRequired) {
      setPendingRestaurantChange({ product, quantity });
      return 'confirmation_required';
    }
    setCart(result.cart);
    setPendingRestaurantChange(null);
    return 'added';
  }, [cart]);

  const confirmRestaurantChange = useCallback(() => {
    if (!pendingRestaurantChange) return;
    const result = addCartItem(
      cart,
      pendingRestaurantChange.product,
      pendingRestaurantChange.quantity,
      true,
    );
    setCart(result.cart);
    setPendingRestaurantChange(null);
  }, [cart, pendingRestaurantChange]);

  const cancelRestaurantChange = useCallback(() => {
    setPendingRestaurantChange(null);
  }, []);

  const updateProductQuantity = useCallback((productId: string, quantity: number) => {
    setCart((currentCart) => setCartItemQuantity(currentCart, productId, quantity));
  }, []);

  const removeProduct = useCallback((productId: string) => {
    setCart((currentCart) => removeCartItem(currentCart, productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart(createEmptyCart());
    setPendingRestaurantChange(null);
  }, []);

  const totalFc = useMemo(() => calculateIndicativeTotal(cart), [cart]);

  return {
    cart,
    totalFc,
    pendingRestaurantChange: pendingRestaurantChange?.product ?? null,
    addProduct,
    confirmRestaurantChange,
    cancelRestaurantChange,
    updateProductQuantity,
    removeProduct,
    clearCart,
  };
}
