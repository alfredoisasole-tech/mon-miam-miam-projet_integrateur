import type {
  MenuItem,
  Order,
  OrderStatus,
  OrdersRepository,
  Restaurant,
  StudentProfile,
} from '../domain/orders.ts';

export interface MemoryOrdersSeed {
  students: StudentProfile[];
  restaurants: Restaurant[];
  menuItems: MenuItem[];
  balances: Array<{ userId: string; restaurantId: string; availablePoints: number }>;
}

/** Dépôt en mémoire réservé aux tests unitaires des services. */
export class MemoryOrdersRepository implements OrdersRepository {
  readonly students: Map<string, StudentProfile>;
  readonly restaurants: Map<string, Restaurant>;
  readonly menuItems: Map<string, MenuItem>;
  readonly balances: Map<string, number>;
  readonly orders: Order[] = [];
  private readonly sequences = new Map<string, number>();

  constructor(seed: MemoryOrdersSeed) {
    this.students = new Map(seed.students.map((student) => [student.id, { ...student }]));
    this.restaurants = new Map(seed.restaurants.map((restaurant) => [restaurant.id, restaurant]));
    this.menuItems = new Map(seed.menuItems.map((item) => [item.id, { ...item }]));
    this.balances = new Map(seed.balances.map(({ userId, restaurantId, availablePoints }) => [
      `${userId}:${restaurantId}`,
      availablePoints,
    ]));
  }

  async findStudent(userId: string): Promise<StudentProfile | null> {
    return this.students.get(userId) ?? null;
  }

  async findRestaurantById(restaurantId: string): Promise<Restaurant | null> {
    return this.restaurants.get(restaurantId) ?? null;
  }

  async findRestaurantBySlug(slug: string): Promise<Restaurant | null> {
    return [...this.restaurants.values()].find((restaurant) => restaurant.slug === slug) ?? null;
  }

  async hasRestaurantMembership(userId: string, _restaurantId: string): Promise<boolean> {
    // Le dépôt mémoire ne modélise pas les adhésions ; il reste volontairement
    // permissif pour les tests unitaires du service.
    return this.students.has(userId);
  }

  async findMenuItemsByIds(ids: string[], _restaurantId: string): Promise<MenuItem[]> {
    return ids.flatMap((id) => {
      const item = this.menuItems.get(id);
      return item ? [item] : [];
    });
  }

  async getAvailablePoints(userId: string, restaurantId: string, _at: string): Promise<number> {
    return this.balances.get(`${userId}:${restaurantId}`) ?? 0;
  }

  async getLoyaltyRemainderFc(userId: string, restaurantId: string): Promise<number> {
    return this.students.get(userId)?.restaurantId === restaurantId
      ? (this.students.get(userId)?.loyaltyRemainderFc ?? 0)
      : 0;
  }

  async findOrderByIdempotencyKey(userId: string, key: string): Promise<Order | null> {
    return this.orders.find((order) => order.userId === userId && order.idempotencyKey === key) ?? null;
  }

  async listOrders(userId: string, query: { status?: OrderStatus; offset: number; limit: number }): Promise<{ orders: Order[]; total: number }> {
    const matching = this.orders
      .filter((order) => order.userId === userId && (!query.status || order.status === query.status))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    return { orders: matching.slice(query.offset, query.offset + query.limit), total: matching.length };
  }

  async findOrderForUser(orderId: string, userId: string): Promise<Order | null> {
    return this.orders.find((order) => order.id === orderId && order.userId === userId) ?? null;
  }

  async cancelOrder(userId: string, orderId: string, at: string): Promise<
    | { kind: 'not_found' }
    | { kind: 'cannot_cancel' }
    | { kind: 'cancelled'; order: Order }
  > {
    const order = await this.findOrderForUser(orderId, userId);
    if (!order) return { kind: 'not_found' };
    if (order.status !== 'pending' || !['unpaid', 'failed'].includes(order.paymentStatus)) return { kind: 'cannot_cancel' };

    order.status = 'cancelled';
    order.cancelledAt = at;
    order.updatedAt = at;
    order.events = [...order.events, { status: 'cancelled', at }];
    if (order.pointsRedeemed > 0) {
      const balanceKey = `${order.userId}:${order.restaurantId}`;
      this.balances.set(balanceKey, (this.balances.get(balanceKey) ?? 0) + order.pointsRedeemed);
    }
    return { kind: 'cancelled', order };
  }

  async nextOrderSequence(restaurantId: string, dayKey: string): Promise<number> {
    const key = `${restaurantId}:${dayKey}`;
    const sequence = this.sequences.get(key) ?? 1;
    this.sequences.set(key, sequence + 1);
    return sequence;
  }

  async createOrder(order: Order): Promise<{ created: boolean; order: Order }> {
    const existing = await this.findOrderByIdempotencyKey(order.userId, order.idempotencyKey);
    if (existing) return { created: false, order: existing };

    this.orders.push(order);
    if (order.pointsRedeemed > 0) {
      const balanceKey = `${order.userId}:${order.restaurantId}`;
      const available = this.balances.get(balanceKey) ?? 0;
      this.balances.set(balanceKey, Math.max(0, available - order.pointsRedeemed));
    }
    return { created: true, order };
  }
}
