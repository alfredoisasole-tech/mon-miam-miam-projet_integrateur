export interface CartProduct {
  id: string;
  restaurantSlug: string;
  name: string;
  unitPriceFc: number;
}

export interface CartLine extends CartProduct {
  quantity: number;
}

export interface Cart {
  restaurantSlug: string | null;
  lines: CartLine[];
}

export type CartErrorCode =
  | 'INVALID_PRODUCT'
  | 'INVALID_QUANTITY'
  | 'QUANTITY_LIMIT_EXCEEDED'
  | 'MAX_LINES_EXCEEDED'
  | 'ITEM_NOT_IN_CART'
  | 'TOTAL_OVERFLOW';

export class CartError extends Error {
  constructor(readonly code: CartErrorCode, message: string) {
    super(message);
    this.name = 'CartError';
  }
}

export interface AddCartItemResult {
  cart: Cart;
  confirmationRequired: boolean;
}

const MAX_PRODUCT_QUANTITY = 20;
const MAX_CART_LINES = 30;

function validateProduct(product: CartProduct): void {
  if (
    product.id.trim().length === 0
    || product.restaurantSlug.trim().length === 0
    || product.name.trim().length === 0
    || !Number.isSafeInteger(product.unitPriceFc)
    || product.unitPriceFc < 0
  ) {
    throw new CartError('INVALID_PRODUCT', 'Les informations du plat ne sont pas valides.');
  }
}

function validateQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_PRODUCT_QUANTITY) {
    throw new CartError('INVALID_QUANTITY', 'La quantité doit être comprise entre 1 et 20.');
  }
}

export function createEmptyCart(): Cart {
  return { restaurantSlug: null, lines: [] };
}

export function addCartItem(
  cart: Cart,
  product: CartProduct,
  quantity = 1,
  confirmRestaurantChange = false,
): AddCartItemResult {
  validateProduct(product);
  validateQuantity(quantity);

  const changingRestaurant = cart.restaurantSlug !== null && cart.restaurantSlug !== product.restaurantSlug;
  if (changingRestaurant && cart.lines.length > 0 && !confirmRestaurantChange) {
    return { cart, confirmationRequired: true };
  }

  const baseCart = changingRestaurant ? createEmptyCart() : cart;
  const existingLine = baseCart.lines.find((line) => line.id === product.id);
  if (existingLine) {
    if (existingLine.quantity + quantity > MAX_PRODUCT_QUANTITY) {
      throw new CartError('QUANTITY_LIMIT_EXCEEDED', 'La quantité maximale est de 20 par plat.');
    }
    return {
      cart: {
        restaurantSlug: product.restaurantSlug,
        lines: baseCart.lines.map((line) => (
          line.id === product.id
            ? { ...product, quantity: line.quantity + quantity }
            : line
        )),
      },
      confirmationRequired: false,
    };
  }

  if (baseCart.lines.length >= MAX_CART_LINES) {
    throw new CartError('MAX_LINES_EXCEEDED', 'Le panier est limité à 30 plats différents.');
  }

  return {
    cart: {
      restaurantSlug: product.restaurantSlug,
      lines: [...baseCart.lines, { ...product, quantity }],
    },
    confirmationRequired: false,
  };
}

export function setCartItemQuantity(cart: Cart, productId: string, quantity: number): Cart {
  validateQuantity(quantity);
  if (!cart.lines.some((line) => line.id === productId)) {
    throw new CartError('ITEM_NOT_IN_CART', 'Ce plat ne figure pas dans le panier.');
  }

  return {
    ...cart,
    lines: cart.lines.map((line) => (line.id === productId ? { ...line, quantity } : line)),
  };
}

export function removeCartItem(cart: Cart, productId: string): Cart {
  const lines = cart.lines.filter((line) => line.id !== productId);
  return lines.length === 0 ? createEmptyCart() : { ...cart, lines };
}

export function calculateIndicativeTotal(cart: Cart): number {
  const total = cart.lines.reduce((sum, line) => sum + line.unitPriceFc * line.quantity, 0);
  if (!Number.isSafeInteger(total)) {
    throw new CartError('TOTAL_OVERFLOW', 'Le total indicatif dépasse la valeur autorisée.');
  }
  return total;
}
