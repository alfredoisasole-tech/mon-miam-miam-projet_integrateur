export type OrderType = 'dine_in' | 'delivery';
export type PaymentMethod = 'cash' | 'mobile_money';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refund_due';

export interface OpeningInterval {
  open: string;
  close: string;
}

/** Horaires déjà décodés par le dépôt, indexés par jour (`mon` à `sun`). */
export type OpeningHours = Record<string, OpeningInterval[]>;

export interface RestaurantSettings {
  deliveryEnabled: boolean;
  deliveryFeeFc: number;
  deliveryCommunes: string[];
  mobileMoneyEnabled: boolean;
  spendPerPointFc: number;
  pointsPerMeal: number;
  freeMealCapFc: number;
  openingHours: OpeningHours;
}

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'inactive';
  settings: RestaurantSettings;
}

export interface StudentProfile {
  id: string;
  restaurantId: string;
  phone: string;
  loyaltyRemainderFc: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  category: string;
  priceFc: number;
  isAvailable: boolean;
  deletedAt: string | null;
}

export interface RequestedOrderItem {
  menuItemId: string;
  quantity: number;
}

export interface DeliveryInput {
  commune: string;
  quartier: string | null;
  address: string | null;
  landmark: string | null;
  phone: string | null;
}

export interface CreateOrderInput {
  idempotencyKey: string;
  restaurant?: string;
  type: OrderType;
  paymentMethod: PaymentMethod;
  arrivalTime: string | null;
  items: RequestedOrderItem[];
  delivery: DeliveryInput | null;
  note: string | null;
  redeemMeal: boolean;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  category: string;
  unitPriceFc: number;
  quantity: number;
  lineTotalFc: number;
}

export interface DeliveryDetails {
  commune: string;
  quartier: string | null;
  address: string | null;
  landmark: string | null;
  phone: string;
}

export interface OrderEvent {
  status: OrderStatus;
  at: string;
}

/** Représentation interne : les champs d’isolation et de rejeu ne sont pas renvoyés au client. */
export interface Order {
  id: string;
  userId: string;
  restaurantId: string;
  idempotencyKey: string;
  orderNumber: string;
  restaurant: { slug: string; name: string };
  type: OrderType;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  subtotalFc: number;
  discountFc: number;
  deliveryFeeFc: number;
  totalFc: number;
  pointsRedeemed: number;
  pointsEarned: number;
  arrivalTime: string | null;
  delivery: DeliveryDetails | null;
  note: string | null;
  comment: null;
  rating: null;
  events: OrderEvent[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface OrdersRepository {
  findStudent(userId: string): Promise<StudentProfile | null>;
  findRestaurantById(restaurantId: string): Promise<Restaurant | null>;
  findRestaurantBySlug(slug: string): Promise<Restaurant | null>;
  findMenuItemsByIds(ids: string[]): Promise<MenuItem[]>;
  getAvailablePoints(userId: string, restaurantId: string, at: string): Promise<number>;
  getLoyaltyRemainderFc(userId: string, restaurantId: string): Promise<number>;
  findOrderByIdempotencyKey(userId: string, key: string): Promise<Order | null>;
  listOrders(userId: string, query: { status?: OrderStatus; offset: number; limit: number }): Promise<{ orders: Order[]; total: number }>;
  findOrderForUser(orderId: string, userId: string): Promise<Order | null>;
  cancelOrder(userId: string, orderId: string, at: string): Promise<
    | { kind: 'not_found' }
    | { kind: 'cannot_cancel' }
    | { kind: 'cancelled'; order: Order }
  >;
  nextOrderSequence(restaurantId: string, dayKey: string): Promise<number>;
  createOrder(order: Order): Promise<{ created: boolean; order: Order }>;
}

export interface AuthenticatedUser {
  id: string;
  role: string;
  restaurantId?: string | null;
  status?: string;
}
