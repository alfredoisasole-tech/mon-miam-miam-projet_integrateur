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
import { RestaurantContext } from './session.tsx';

/** Paniers de tous les restaurants, un par restaurant : aller chez un autre restaurant ne vide ni n'emporte rien. */
const CARTS_STORAGE_KEY = 'mmm_carts';
/** Ancien stockage : un seul panier pour toute la plateforme. Repris puis supprimé. */
const LEGACY_CART_STORAGE_KEY = 'mmm_cart';

export type Carts = Record<string, Cart>;
export type AddProductResult = 'added' | 'error';

export interface CartContextValue {
  cart: Cart;
  totalFc: number;
  count: number;
  error: string | null;
  addProduct: (product: CartProduct, quantity?: number) => AddProductResult;
  add: (product: CartProduct, quantity?: number) => AddProductResult;
  removeProduct: (productId: string) => void;
  remove: (productId: string) => void;
  updateProductQuantity: (productId: string, quantity: number) => void;
  setQty: (productId: string, quantity: number) => void;
  clearCart: () => void;
  clear: () => void;
}

interface CartStore {
  carts: Carts;
  error: string | null;
  setError: (message: string | null) => void;
  update: (slug: string, change: (cart: Cart) => Cart) => void;
  clear: (slug: string) => void;
}

const isCart = (value: unknown): value is Cart => Boolean(value) && typeof value === 'object'
  && Array.isArray((value as Cart).lines) && ((value as Cart).restaurantSlug === null || typeof (value as Cart).restaurantSlug === 'string');

/** Lit les paniers enregistrés et y range, au passage, l'ancien panier unique sous le restaurant qu'il désignait. */
export function loadCartsFromStorage(): Carts {
  const carts: Carts = {};
  try {
    const raw = localStorage.getItem(CARTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : null;
    if (parsed && typeof parsed === 'object') {
      for (const [slug, cart] of Object.entries(parsed as Record<string, unknown>)) {
        if (isCart(cart) && cart.lines.length > 0) carts[slug] = cart;
      }
    }
    const legacyRaw = localStorage.getItem(LEGACY_CART_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as unknown;
      if (isCart(legacy) && legacy.restaurantSlug && legacy.lines.length > 0 && !carts[legacy.restaurantSlug]) {
        carts[legacy.restaurantSlug] = legacy;
      }
      localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    }
  } catch {
    // Stockage illisible ou indisponible : on repart de paniers vides.
  }
  return carts;
}

function saveCartsToStorage(carts: Carts): void {
  try {
    localStorage.setItem(CARTS_STORAGE_KEY, JSON.stringify(carts));
  } catch {
    // Stockage indisponible : le panier reste en mémoire pour cette visite.
  }
}

function useCartStore(persist: boolean): CartStore {
  const [carts, setCarts] = useState<Carts>(() => (persist ? loadCartsFromStorage() : {}));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (persist) saveCartsToStorage(carts);
  }, [carts, persist]);

  const update = useCallback((slug: string, change: (cart: Cart) => Cart) => {
    setCarts((previous) => {
      const next = change(previous[slug] ?? createEmptyCart());
      const rest = { ...previous };
      if (next.lines.length === 0) delete rest[slug]; else rest[slug] = next;
      return rest;
    });
  }, []);
  const clear = useCallback((slug: string) => {
    setCarts((previous) => {
      const rest = { ...previous };
      delete rest[slug];
      return rest;
    });
    setError(null);
  }, []);

  return { carts, error, setError, update, clear };
}

const CartContext = createContext<CartStore | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const store = useCartStore(true);
  return <CartContext.Provider value={store}>{children}</CartContext.Provider>;
}

/** Quand aucun fournisseur n'est monté (tests isolés), les paniers restent en mémoire, sans stockage. */
function useStore(): CartStore {
  const shared = useContext(CartContext);
  const local = useCartStore(false);
  return shared ?? local;
}

/**
 * Panier du restaurant courant (celui de l'adresse `/r/:slug/…`), ou d'un restaurant donné.
 * Sans restaurant, le panier est vide et ne peut rien recevoir.
 */
export function useCart(restaurantSlug?: string | null): CartContextValue {
  const current = useContext(RestaurantContext)?.slug ?? null;
  const slug = restaurantSlug === undefined ? current : restaurantSlug;
  const store = useStore();
  const cart = (slug ? store.carts[slug] : undefined) ?? createEmptyCart();

  const addProduct = useCallback((product: CartProduct, quantity = 1): AddProductResult => {
    store.setError(null);
    if (!slug || product.restaurantSlug !== slug) {
      store.setError('Ce plat n’appartient pas au restaurant que vous consultez.');
      return 'error';
    }
    try {
      addCartItem(store.carts[slug] ?? createEmptyCart(), product, quantity);
      store.update(slug, (previous) => addCartItem(previous, product, quantity).cart);
      return 'added';
    } catch (err: unknown) {
      store.setError(err instanceof Error ? err.message : 'Impossible d’ajouter ce plat au panier.');
      return 'error';
    }
  }, [slug, store]);

  const updateProductQuantity = useCallback((productId: string, quantity: number) => {
    if (!slug) return;
    store.setError(null);
    try {
      setCartItemQuantity(store.carts[slug] ?? createEmptyCart(), productId, quantity);
      store.update(slug, (previous) => setCartItemQuantity(previous, productId, quantity));
    } catch (err: unknown) {
      store.setError(err instanceof Error ? err.message : 'Impossible de modifier la quantité.');
    }
  }, [slug, store]);

  const removeProduct = useCallback((productId: string) => {
    if (!slug) return;
    store.setError(null);
    store.update(slug, (previous) => removeCartItem(previous, productId));
  }, [slug, store]);

  const clearCart = useCallback(() => { if (slug) store.clear(slug); }, [slug, store]);

  const totalFc = useMemo(() => calculateIndicativeTotal(cart), [cart]);
  const count = useMemo(() => cart.lines.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  return {
    cart, totalFc, count, error: store.error,
    addProduct, add: addProduct,
    removeProduct, remove: removeProduct,
    updateProductQuantity, setQty: updateProductQuantity,
    clearCart, clear: clearCart,
  };
}
