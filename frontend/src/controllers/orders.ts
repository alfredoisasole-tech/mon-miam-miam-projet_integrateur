import { api } from '../models/http.ts';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';

export interface OrderItem {
  menuItemId: string;
  name: string;
  unitPriceFc: number;
  quantity: number;
  lineTotalFc: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  restaurant: { slug: string; name: string };
  type: 'dine_in' | 'delivery';
  status: OrderStatus;
  paymentMethod: 'cash' | 'mobile_money';
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refund_due';
  items: OrderItem[];
  subtotalFc: number;
  discountFc: number;
  deliveryFeeFc: number;
  totalFc: number;
  pointsRedeemed: number;
  pointsEarned: number;
  arrivalTime: string | null;
  delivery: unknown;
  note: string | null;
  comment: string | null;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface OrderDetail extends Order {
  events: Array<{ status: OrderStatus; at: string }>;
}

export interface OrderPage { items: Order[]; total: number; page: number; pageSize: number }

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'En attente de confirmation',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête',
  out_for_delivery: 'En cours de livraison',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

export const isActive = (order: Pick<Order, 'status'>) => order.status !== 'completed' && order.status !== 'cancelled';

/** L'étudiant peut annuler tant que la commande est en attente et qu'aucun paiement n'est engagé. */
export function canCancel(order: Pick<Order, 'status' | 'paymentStatus' | 'totalFc'>) {
  return order.status === 'pending'
    && (order.paymentStatus === 'unpaid' || order.paymentStatus === 'failed' || order.totalFc === 0);
}

/** Une commande mobile money en attente, avec un montant à régler, peut être payée ou reprise. */
export function canPay(order: Pick<Order, 'status' | 'paymentMethod' | 'paymentStatus' | 'totalFc'>) {
  return order.status === 'pending' && order.paymentMethod === 'mobile_money' && order.totalFc > 0
    && (order.paymentStatus === 'unpaid' || order.paymentStatus === 'pending' || order.paymentStatus === 'failed');
}

export const ordersApi = {
  list: () => api.get<OrderPage>('/orders?pageSize=100'),
  get: (id: string) => api.get<OrderDetail>(`/orders/${encodeURIComponent(id)}`),
  cancel: (id: string) => api.post<OrderDetail>(`/orders/${encodeURIComponent(id)}/cancel`),
  review: (id: string, rating: number, comment: string) =>
    api.post<{ orderId: string; rating: number; comment: string | null; commentedAt: string }>(
      `/orders/${encodeURIComponent(id)}/review`, comment ? { rating, comment } : { rating }),
};
