import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addCartItem,
  calculateIndicativeTotal,
  createEmptyCart,
  removeCartItem,
  setCartItemQuantity,
  type Cart,
  type CartProduct,
} from '../models/cart.ts';

const CART_STORAGE_KEY = 'mmm_cart';

export type AddProductResult = 'added' | 'confirmation_required' | 'error';

export interface CartContextValue {
  cart: Cart;
  totalFc: number;
  count: number;
  error: string | null;
  pendingRestaurantChange: CartProduct | null;
  addProduct: (product: CartProduct, quantity?: number) => AddProductResult;
  add: (product: CartProduct, quantity?: number) => AddProductResult;
  removeProduct: (productId: string) => void;
  remove: (productId: string) => void;
  updateProductQuantity: (productId: string, quantity: number) => void;
  setQty: (productId: string, quantity: number) => void;
  clearCart: () => void;
  clear: () => void;
  confirmRestaurantChange: () => void;
  cancelRestaurantChange: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadCartFromStorage(): Cart {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return createEmptyCart();
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.lines)) {
      return parsed as Cart;
    }
  } catch {
    // Ignore storage parse issues
  }
  return createEmptyCart();
}

function saveCartToStorage(cart: Cart): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Ignore storage issues
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(loadCartFromStorage);
  const [pendingChange, setPendingChange] = useState<{ product: CartProduct; quantity: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Synchronise dans le localStorage dès que le panier change
  useEffect(() => {
    saveCartToStorage(cart);
  }, [cart]);

  const addProduct = useCallback(
    (product: CartProduct, quantity = 1): AddProductResult => {
      setError(null);
      try {
        const result = addCartItem(cart, product, quantity);
        if (result.confirmationRequired) {
          setPendingChange({ product, quantity });
          return 'confirmation_required';
        }
        setCart(result.cart);
        setPendingChange(null);
        return 'added';
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Impossible d’ajouter ce plat au panier.';
        setError(msg);
        return 'error';
      }
    },
    [cart],
  );

  const confirmRestaurantChange = useCallback(() => {
    if (!pendingChange) return;
    setError(null);
    try {
      const result = addCartItem(cart, pendingChange.product, pendingChange.quantity, true);
      setCart(result.cart);
      setPendingChange(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de changer de restaurant.';
      setError(msg);
    }
  }, [cart, pendingChange]);

  const cancelRestaurantChange = useCallback(() => {
    setPendingChange(null);
  }, []);

  const updateProductQuantity = useCallback(
    (productId: string, quantity: number) => {
      setError(null);
      try {
        setCart(setCartItemQuantity(cart, productId, quantity));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Impossible de modifier la quantité.';
        setError(msg);
      }
    },
    [cart],
  );

  const removeProduct = useCallback(
    (productId: string) => {
      setError(null);
      setCart(removeCartItem(cart, productId));
    },
    [cart],
  );

  const clearCart = useCallback(() => {
    const empty = createEmptyCart();
    setCart(empty);
    setPendingChange(null);
    setError(null);
    saveCartToStorage(empty);
  }, []);

  const totalFc = useMemo(() => calculateIndicativeTotal(cart), [cart]);
  const count = useMemo(() => cart.lines.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  const value: CartContextValue = {
    cart,
    totalFc,
    count,
    error,
    pendingRestaurantChange: pendingChange?.product ?? null,
    addProduct,
    add: addProduct,
    removeProduct,
    remove: removeProduct,
    updateProductQuantity,
    setQty: updateProductQuantity,
    clearCart,
    clear: clearCart,
    confirmRestaurantChange,
    cancelRestaurantChange,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (ctx) return ctx;

  // Fallback si useCart est appelé hors d'un CartProvider (ex: tests unitaires isolés)
  return useLocalCartHook();
}

function useLocalCartHook(): CartContextValue {
  const [cart, setCart] = useState<Cart>(createEmptyCart);
  const [pendingChange, setPendingChange] = useState<{ product: CartProduct; quantity: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addProduct = useCallback((product: CartProduct, quantity = 1): AddProductResult => {
    setError(null);
    try {
      const result = addCartItem(cart, product, quantity);
      if (result.confirmationRequired) {
        setPendingChange({ product, quantity });
        return 'confirmation_required';
      }
      setCart(result.cart);
      setPendingChange(null);
      return 'added';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible d’ajouter ce plat au panier.';
      setError(msg);
      return 'error';
    }
  }, [cart]);

  const confirmRestaurantChange = useCallback(() => {
    if (!pendingChange) return;
    setError(null);
    try {
      const result = addCartItem(cart, pendingChange.product, pendingChange.quantity, true);
      setCart(result.cart);
      setPendingChange(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de changer de restaurant.';
      setError(msg);
    }
  }, [cart, pendingChange]);

  const cancelRestaurantChange = useCallback(() => {
    setPendingChange(null);
  }, []);

  const updateProductQuantity = useCallback((productId: string, quantity: number) => {
    setError(null);
    try {
      setCart(setCartItemQuantity(cart, productId, quantity));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de modifier la quantité.';
      setError(msg);
    }
  }, [cart]);

  const removeProduct = useCallback((productId: string) => {
    setError(null);
    setCart(removeCartItem(cart, productId));
  }, [cart]);

  const clearCart = useCallback(() => {
    setCart(createEmptyCart());
    setPendingChange(null);
    setError(null);
  }, []);

  const totalFc = useMemo(() => calculateIndicativeTotal(cart), [cart]);
  const count = useMemo(() => cart.lines.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  return {
    cart,
    totalFc,
    count,
    error,
    pendingRestaurantChange: pendingChange?.product ?? null,
    addProduct,
    add: addProduct,
    removeProduct,
    remove: removeProduct,
    updateProductQuantity,
    setQty: updateProductQuantity,
    clearCart,
    clear: clearCart,
    confirmRestaurantChange,
    cancelRestaurantChange,
  };
}

