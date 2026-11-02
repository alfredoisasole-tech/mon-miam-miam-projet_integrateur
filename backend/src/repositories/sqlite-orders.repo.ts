import { randomUUID } from 'node:crypto';
import type { Database } from '../db/database.ts';
import type {
  MenuItem,
  Order,
  OrderStatus,
  OrdersRepository,
  Restaurant,
  StudentProfile,
} from '../domain/orders.ts';
import type { LoyaltyRepository, LoyaltyRules, PointMovement } from '../domain/loyalty.ts';
import { AppError } from '../http/errors.ts';

interface RestaurantRow {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'inactive';
  timezone: string;
  spend_per_point_fc: number | null;
  points_per_meal: number | null;
  free_meal_cap_fc: number | null;
  delivery_enabled: number | null;
  delivery_fee_fc: number | null;
  delivery_communes: string | null;
  opening_hours: string | null;
}

interface MenuItemRow {
  id: string;
  restaurant_id: string;
  name: string;
  category: string;
  price_fc: number;
  is_available: number;
  deleted_at: string | null;
}

interface OrderRow {
  id: string;
  user_id: string;
  restaurant_id: string;
  idempotency_key: string | null;
  order_number: string;
  restaurant_slug: string;
  restaurant_name: string;
  type: Order['type'];
  status: OrderStatus;
  payment_method: Order['paymentMethod'];
  payment_status: Order['paymentStatus'];
  subtotal_fc: number;
  discount_fc: number;
  delivery_fee_fc: number;
  total_fc: number;
  points_redeemed: number;
  points_earned: number;
  arrival_time: string | null;
  delivery_commune: string | null;
  delivery_quartier: string | null;
  delivery_address: string | null;
  delivery_landmark: string | null;
  delivery_phone: string | null;
  note: string | null;
  comment: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
}

interface OrderItemRow {
  menu_item_id: string;
  name: string;
  category: string;
  unit_price_fc: number;
  quantity: number;
  line_total_fc: number;
}

interface OrderEventRow {
  status: OrderStatus;
  created_at: string;
}

interface PointBucket {
  id: string;
  available: number;
}

interface PointAllocation {
  ledgerId: string;
  points: number;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function mapRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    settings: {
      deliveryEnabled: row.delivery_enabled === 1,
      deliveryFeeFc: row.delivery_fee_fc ?? 0,
      deliveryCommunes: parseJson<string[]>(row.delivery_communes, []),
      // Aucune colonne de disponibilité mobile money n'existe encore dans restaurant_settings.
      // Ce choix provisoire à true sera remplacé par la migration 002 préparée avec Lusimafu.
      mobileMoneyEnabled: true,
      spendPerPointFc: row.spend_per_point_fc ?? 3000,
      pointsPerMeal: row.points_per_meal ?? 15,
      freeMealCapFc: row.free_meal_cap_fc ?? 3000,
      openingHours: parseJson(row.opening_hours, {}),
    },
  };
}

function mapOrderRow(row: OrderRow, items: OrderItemRow[], events: OrderEventRow[]): Order {
  const delivery = row.delivery_commune === null ? null : {
    commune: row.delivery_commune,
    quartier: row.delivery_quartier,
    address: row.delivery_address,
    landmark: row.delivery_landmark,
    phone: row.delivery_phone ?? '',
  };
  const order: Order = {
    id: row.id,
    userId: row.user_id,
    restaurantId: row.restaurant_id,
    idempotencyKey: row.idempotency_key ?? '',
    orderNumber: row.order_number,
    restaurant: { slug: row.restaurant_slug, name: row.restaurant_name },
    type: row.type,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    items: items.map((item) => ({
      menuItemId: item.menu_item_id,
      name: item.name,
      category: item.category,
      unitPriceFc: item.unit_price_fc,
      quantity: item.quantity,
      lineTotalFc: item.line_total_fc,
    })),
    subtotalFc: row.subtotal_fc,
    discountFc: row.discount_fc,
    deliveryFeeFc: row.delivery_fee_fc,
    totalFc: row.total_fc,
    pointsRedeemed: row.points_redeemed,
    pointsEarned: row.points_earned,
    arrivalTime: row.arrival_time,
    delivery,
    note: row.note,
    comment: row.comment,
    rating: row.rating,
    events: events.map((event) => ({ status: event.status, at: event.created_at })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
  };
  return order;
}

const orderColumns = `o.id, o.user_id, o.restaurant_id, o.idempotency_key, o.order_number,
  r.slug AS restaurant_slug, r.name AS restaurant_name, o.type, o.status, o.payment_method,
  o.payment_status, o.subtotal_fc, o.discount_fc, o.delivery_fee_fc, o.total_fc,
  o.points_redeemed, o.points_earned, o.arrival_time, o.delivery_commune,
  o.delivery_quartier, o.delivery_address, o.delivery_landmark, o.delivery_phone,
  o.note, o.comment, o.rating, o.created_at, o.updated_at, o.completed_at, o.cancelled_at`;

export class SqliteOrdersRepository implements OrdersRepository, LoyaltyRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findStudent(userId: string): Promise<StudentProfile | null> {
    const row = this.db.get<{ id: string; restaurant_id: string; phone: string; loyalty_remainder_fc: number }>(`
      SELECT u.id, u.restaurant_id, u.phone, m.loyalty_remainder_fc
      FROM users u JOIN memberships m ON m.user_id = u.id AND m.restaurant_id = u.restaurant_id
      WHERE u.id = ? AND u.role = 'student' AND u.status = 'active' AND m.restaurant_id = u.restaurant_id
    `, [userId]);
    return row ? { id: row.id, restaurantId: row.restaurant_id, phone: row.phone, loyaltyRemainderFc: row.loyalty_remainder_fc } : null;
  }

  async findRestaurantById(restaurantId: string): Promise<Restaurant | null> {
    const row = this.db.get<RestaurantRow>(`
      SELECT r.id, r.slug, r.name, r.status, r.timezone, s.spend_per_point_fc, s.points_per_meal,
        s.free_meal_cap_fc, s.delivery_enabled, s.delivery_fee_fc, s.delivery_communes, s.opening_hours
      FROM restaurants r LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
      WHERE r.id = ?
    `, [restaurantId]);
    return row ? mapRestaurant(row) : null;
  }

  async findRestaurantBySlug(slug: string): Promise<Restaurant | null> {
    const row = this.db.get<RestaurantRow>(`
      SELECT r.id, r.slug, r.name, r.status, r.timezone, s.spend_per_point_fc, s.points_per_meal,
        s.free_meal_cap_fc, s.delivery_enabled, s.delivery_fee_fc, s.delivery_communes, s.opening_hours
      FROM restaurants r LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id
      WHERE r.slug = ?
    `, [slug]);
    return row ? mapRestaurant(row) : null;
  }

  async hasRestaurantMembership(userId: string, restaurantId: string): Promise<boolean> {
    return Boolean(this.db.get<{ found: number }>(`
      SELECT 1 AS found FROM memberships WHERE user_id = ? AND restaurant_id = ?
    `, [userId, restaurantId]));
  }

  async findMenuItemsByIds(ids: string[], restaurantId: string): Promise<MenuItem[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    return this.db.all<MenuItemRow>(`
      SELECT id, restaurant_id, name, category, price_fc, is_available, deleted_at
      FROM menu_items
      WHERE restaurant_id = ? AND id IN (${placeholders})
    `, [restaurantId, ...ids]).map((row) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      category: row.category,
      priceFc: row.price_fc,
      isAvailable: row.is_available === 1,
      deletedAt: row.deleted_at,
    }));
  }

  async getAvailablePoints(userId: string, restaurantId: string, at: string): Promise<number> {
    return this.availablePoints(userId, restaurantId, at);
  }

  async getLoyaltyRemainderFc(userId: string, restaurantId: string): Promise<number> {
    return this.db.get<{ loyalty_remainder_fc: number }>(`
      SELECT loyalty_remainder_fc FROM memberships WHERE user_id = ? AND restaurant_id = ?
    `, [userId, restaurantId])?.loyalty_remainder_fc ?? 0;
  }

  async getLoyaltyRules(restaurantId: string): Promise<LoyaltyRules> {
    const row = this.db.get<{ spend_per_point_fc: number; points_per_meal: number; free_meal_cap_fc: number; points_validity_months: number }>(`
      SELECT spend_per_point_fc, points_per_meal, free_meal_cap_fc, points_validity_months
      FROM restaurant_settings WHERE restaurant_id = ?
    `, [restaurantId]);
    return {
      spendPerPointFc: row?.spend_per_point_fc ?? 3000,
      pointsForReward: row?.points_per_meal ?? 15,
      rewardValueFc: row?.free_meal_cap_fc ?? 3000,
      validityMonths: row?.points_validity_months ?? 12,
    };
  }

  async listPointMovements(userId: string, restaurantId: string, limit: number): Promise<PointMovement[]> {
    return this.db.all<{
      kind: string; points: number; order_id: string | null; order_number: string | null; created_at: string; expires_at: string | null;
    }>(`
      SELECT kind, points, order_id, order_number, created_at, expires_at FROM (
        SELECT l.kind, l.points, l.order_id, o.order_number, l.created_at, l.expires_at, l.rowid AS position
        FROM points_ledger l LEFT JOIN orders o ON o.id = l.order_id AND o.restaurant_id = l.restaurant_id
        WHERE l.user_id = ? AND l.restaurant_id = ?
        UNION ALL
        -- Restitution d'une commande annulée : le journal rend les points à leurs lots d'origine sans nouvelle ligne.
        -- Cette ligne est déduite de la commande pour que l'historique montre le retour des points ; elle n'entre
        -- jamais dans le calcul du solde. Les restitutions déjà écrites au journal (kind = refund) sont déduites.
        SELECT 'refund', o.points_redeemed - COALESCE((
            SELECT SUM(r.points) FROM points_ledger r
            WHERE r.order_id = o.id AND r.user_id = o.user_id AND r.restaurant_id = o.restaurant_id AND r.kind = 'refund'
          ), 0), o.id, o.order_number, o.cancelled_at, NULL, 0
        FROM orders o
        WHERE o.user_id = ? AND o.restaurant_id = ? AND o.status = 'cancelled' AND o.cancelled_at IS NOT NULL
          AND o.points_redeemed > COALESCE((
            SELECT SUM(r.points) FROM points_ledger r
            WHERE r.order_id = o.id AND r.user_id = o.user_id AND r.restaurant_id = o.restaurant_id AND r.kind = 'refund'
          ), 0)
      )
      ORDER BY created_at DESC, position DESC LIMIT ?
    `, [userId, restaurantId, userId, restaurantId, limit]).map((row) => ({
      kind: row.kind,
      points: row.points,
      orderId: row.order_id,
      orderNumber: row.order_number,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
  }

  async findOrderByIdempotencyKey(userId: string, key: string): Promise<Order | null> {
    const row = this.db.get<OrderRow>(`
      SELECT ${orderColumns}
      FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.user_id = ? AND o.idempotency_key = ?
        AND o.restaurant_id IN (SELECT m.restaurant_id FROM memberships m WHERE m.user_id = ?)
    `, [userId, key, userId]);
    return row ? this.loadOrder(row) : null;
  }

  async listOrders(userId: string, query: { status?: OrderStatus; offset: number; limit: number }): Promise<{ orders: Order[]; total: number }> {
    const statusClause = query.status ? 'AND o.status = ?' : '';
    const total = this.db.get<{ total: number }>(`
      SELECT COUNT(*) AS total FROM orders o
      WHERE o.user_id = ? AND o.restaurant_id IN (SELECT m.restaurant_id FROM memberships m WHERE m.user_id = ?)
        ${statusClause}
    `, query.status ? [userId, userId, query.status] : [userId, userId])?.total ?? 0;
    const rows = this.db.all<OrderRow>(`
      SELECT ${orderColumns}
      FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.user_id = ? AND o.restaurant_id IN (SELECT m.restaurant_id FROM memberships m WHERE m.user_id = ?)
        ${statusClause}
      ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?
    `, query.status ? [userId, userId, query.status, query.limit, query.offset] : [userId, userId, query.limit, query.offset]);
    return { orders: rows.map((row) => this.loadOrder(row)), total };
  }

  async findOrderForUser(orderId: string, userId: string): Promise<Order | null> {
    const row = this.db.get<OrderRow>(`
      SELECT ${orderColumns}
      FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.id = ? AND o.user_id = ?
        AND o.restaurant_id IN (SELECT m.restaurant_id FROM memberships m WHERE m.user_id = ?)
    `, [orderId, userId, userId]);
    return row ? this.loadOrder(row) : null;
  }

  async cancelOrder(userId: string, orderId: string, at: string): Promise<
    | { kind: 'not_found' }
    | { kind: 'cannot_cancel' }
    | { kind: 'cancelled'; order: Order }
  > {
    return this.db.transaction(() => {
      const identity = this.db.get<{ restaurant_id: string }>(`
        SELECT o.restaurant_id FROM orders o
        WHERE o.id = ? AND o.user_id = ?
          AND o.restaurant_id IN (SELECT m.restaurant_id FROM memberships m WHERE m.user_id = ?)
      `, [orderId, userId, userId]);
      if (!identity) return { kind: 'not_found' } as const;

      const cutoff = new Date(Date.parse(at) - 15 * 60 * 1000).toISOString();
      const expired = this.db.run(`UPDATE payments SET status = 'failed', updated_at = ?
        WHERE order_id = ? AND restaurant_id = ? AND status = 'pending' AND created_at < ?`,
      [at, orderId, identity.restaurant_id, cutoff]);
      if (Number(expired.changes) > 0) {
        const stillPending = this.db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM payments
          WHERE order_id = ? AND restaurant_id = ? AND status = 'pending'`, [orderId, identity.restaurant_id]);
        if (stillPending?.count === 0) {
          this.db.run(`UPDATE orders SET payment_status = 'failed', updated_at = ?
            WHERE id = ? AND restaurant_id = ? AND status = 'pending' AND payment_status = 'pending'`,
          [at, orderId, identity.restaurant_id]);
        }
      }

      const row = this.db.get<OrderRow>(`
        SELECT ${orderColumns}
        FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
        WHERE o.id = ? AND o.user_id = ?
          AND o.restaurant_id IN (SELECT m.restaurant_id FROM memberships m WHERE m.user_id = ?)
      `, [orderId, userId, userId]);
      if (!row) return { kind: 'not_found' } as const;
      // Une commande réglée entièrement avec des points (total de 0 FC) est marquée « payée » sans qu'aucun
      // paiement n'ait eu lieu : elle reste annulable tant qu'elle est en attente (docs/regles-commande-paiement.md, §4).
      const nothingPaid = row.total_fc === 0;
      if (row.status !== 'pending' || (!nothingPaid && !['unpaid', 'failed'].includes(row.payment_status))) return { kind: 'cannot_cancel' } as const;

      this.db.run(`UPDATE orders SET status = 'cancelled', cancelled_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ? AND restaurant_id = ? AND status = 'pending'
          AND (payment_status IN ('unpaid', 'failed') OR total_fc = 0)`,
      [at, at, orderId, userId, row.restaurant_id]);
      this.db.run(`INSERT INTO order_events (id, order_id, status, created_at)
        VALUES (?, ?, 'cancelled', ?)`, [randomUUID(), orderId, at]);

      if (row.points_redeemed > 0) this.restoreRedeemedPoints(orderId, row, at);
      const updated = this.db.get<OrderRow>(`
        SELECT ${orderColumns} FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
        WHERE o.id = ? AND o.user_id = ? AND o.restaurant_id = ?
      `, [orderId, userId, row.restaurant_id]);
      if (!updated) return { kind: 'not_found' } as const;
      return { kind: 'cancelled', order: this.loadOrder(updated) } as const;
    });
  }

  async nextOrderSequence(restaurantId: string, dayKey: string): Promise<number> {
    const row = this.db.get<{ next_value: number }>(`
      SELECT next_value FROM order_sequences WHERE restaurant_id = ? AND day_key = ?
    `, [restaurantId, dayKey]);
    return row?.next_value ?? this.maximumOrderSequence(restaurantId, dayKey);
  }

  async createOrder(order: Order): Promise<{ created: boolean; order: Order }> {
    return this.db.transaction(() => {
      const existing = this.db.get<OrderRow>(`
        SELECT ${orderColumns} FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
        WHERE o.user_id = ? AND o.idempotency_key = ?
          AND o.restaurant_id IN (SELECT m.restaurant_id FROM memberships m WHERE m.user_id = ?)
      `, [order.userId, order.idempotencyKey, order.userId]);
      if (existing) return { created: false, order: this.loadOrder(existing) };

      if (order.pointsRedeemed > 0 && this.availablePoints(order.userId, order.restaurantId, order.createdAt) < order.pointsRedeemed) {
        return { created: false, order, insufficientPoints: true };
      }

      const dayKey = order.orderNumber.split('-')[0] ?? '';
      const allocatedOrder = { ...order, orderNumber: `${dayKey}-${String(this.reserveOrderSequence(order.restaurantId, dayKey)).padStart(3, '0')}` };
      const delivery = allocatedOrder.delivery;
      this.db.run(`INSERT INTO orders (
        id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
        subtotal_fc, discount_fc, delivery_fee_fc, total_fc, points_redeemed, points_earned,
        arrival_time, delivery_commune, delivery_quartier, delivery_address, delivery_landmark,
        delivery_phone, note, idempotency_key, comment, rating, created_at, updated_at, completed_at, cancelled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        allocatedOrder.id, allocatedOrder.restaurantId, allocatedOrder.userId, allocatedOrder.orderNumber,
        allocatedOrder.type, allocatedOrder.status, allocatedOrder.paymentMethod, allocatedOrder.paymentStatus,
        allocatedOrder.subtotalFc, allocatedOrder.discountFc, allocatedOrder.deliveryFeeFc, allocatedOrder.totalFc,
        allocatedOrder.pointsRedeemed, allocatedOrder.pointsEarned, allocatedOrder.arrivalTime,
        delivery?.commune ?? null, delivery?.quartier ?? null, delivery?.address ?? null,
        delivery?.landmark ?? null, delivery?.phone ?? null, allocatedOrder.note, allocatedOrder.idempotencyKey,
        allocatedOrder.comment, allocatedOrder.rating, allocatedOrder.createdAt, allocatedOrder.updatedAt,
        allocatedOrder.completedAt, allocatedOrder.cancelledAt,
      ]);

      for (const item of allocatedOrder.items) {
        this.db.run(`INSERT INTO order_items (id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), allocatedOrder.id, item.menuItemId, item.name,
          item.category, item.unitPriceFc, item.quantity, item.lineTotalFc]);
      }
      for (const event of allocatedOrder.events) {
        this.db.run('INSERT INTO order_events (id, order_id, status, created_at) VALUES (?, ?, ?, ?)',
          [randomUUID(), allocatedOrder.id, event.status, event.at]);
      }
      if (allocatedOrder.pointsRedeemed > 0) this.debitPoints(allocatedOrder, allocatedOrder.createdAt);
      return { created: true, order: allocatedOrder };
    });
  }

  async listRestaurantOrders(restaurantId: string, status?: OrderStatus): Promise<Order[]> {
    const statusClause = status ? 'AND o.status = ?' : '';
    const parameters = status ? [restaurantId, status] : [restaurantId];
    const rows = this.db.all<OrderRow>(`
      SELECT ${orderColumns}
      FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.restaurant_id = ? ${statusClause}
      ORDER BY o.created_at, o.id
    `, parameters);
    return rows.map((row) => this.loadOrder(row));
  }

  async updateRestaurantOrderStatus(
    restaurantId: string,
    orderId: string,
    expectedStatus: OrderStatus,
    actorId: string,
    status: OrderStatus,
    at: string,
  ): Promise<Order | null> {
    return this.db.transaction(() => {
      const row = this.db.get<OrderRow>(`
        SELECT ${orderColumns}
        FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
        WHERE o.id = ? AND o.restaurant_id = ?
      `, [orderId, restaurantId]);
      if (!row || row.status !== expectedStatus) return null;
      if (status === 'completed' && row.payment_method === 'mobile_money' && row.payment_status !== 'paid') {
        throw new AppError(422, 'PAYMENT_NOT_CONFIRMED', 'Le paiement mobile doit être confirmé avant la remise de la commande.');
      }

      const result = this.db.run(`
        UPDATE orders SET status = ?, updated_at = ?,
          completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END,
          cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_at END,
          payment_status = CASE
            WHEN ? = 'cancelled' AND payment_method = 'mobile_money' AND payment_status = 'paid' AND total_fc > 0 THEN 'refund_due'
            WHEN ? = 'completed' AND payment_method = 'cash' THEN 'paid'
            ELSE payment_status
          END
        WHERE id = ? AND restaurant_id = ? AND status = ?
      `, [status, at, status, at, status, at, status, status, orderId, restaurantId, expectedStatus]);
      if (!Number(result.changes)) return null;

      this.db.run(
        'INSERT INTO order_events (id, order_id, status, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), orderId, status, actorId, at],
      );
      if (status === 'completed') {
        this.awardLoyaltyPoints(row, at);
        this.awardReferralPoints(row, Math.max(0, row.subtotal_fc - row.discount_fc), at);
      }
      if (status === 'cancelled' && row.points_redeemed > 0) this.restoreRedeemedPoints(orderId, row, at);

      const updated = this.db.get<OrderRow>(`
        SELECT ${orderColumns}
        FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
        WHERE o.id = ? AND o.restaurant_id = ?
      `, [orderId, restaurantId]);
      return updated ? this.loadOrder(updated) : null;
    });
  }

  private loadOrder(row: OrderRow): Order {
    const items = this.db.all<OrderItemRow>(`
      SELECT oi.menu_item_id, oi.name, oi.category, oi.unit_price_fc, oi.quantity, oi.line_total_fc
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.order_id = ? AND o.restaurant_id = ? ORDER BY oi.rowid
    `, [row.id, row.restaurant_id]);
    const events = this.db.all<OrderEventRow>(`
      SELECT oe.status, oe.created_at
      FROM order_events oe JOIN orders o ON o.id = oe.order_id
      WHERE oe.order_id = ? AND o.restaurant_id = ? ORDER BY oe.created_at, oe.rowid
    `, [row.id, row.restaurant_id]);
    return mapOrderRow(row, items, events);
  }

  private maximumOrderSequence(restaurantId: string, dayKey: string): number {
    const row = this.db.get<{ maximum: number | null }>(`
      SELECT MAX(CAST(substr(order_number, ?) AS INTEGER)) AS maximum
      FROM orders WHERE restaurant_id = ? AND order_number LIKE ?
    `, [dayKey.length + 2, restaurantId, `${dayKey}-%`]);
    return (row?.maximum ?? 0) + 1;
  }

  private reserveOrderSequence(restaurantId: string, dayKey: string): number {
    this.db.run(`
      INSERT INTO order_sequences (restaurant_id, day_key, next_value)
      VALUES (?, ?, ?)
      ON CONFLICT (restaurant_id, day_key) DO NOTHING
    `, [restaurantId, dayKey, this.maximumOrderSequence(restaurantId, dayKey)]);
    const row = this.db.get<{ next_value: number }>(`
      SELECT next_value FROM order_sequences WHERE restaurant_id = ? AND day_key = ?
    `, [restaurantId, dayKey]);
    if (!row) throw new Error('La séquence de commande n’a pas pu être initialisée.');
    this.db.run(`
      UPDATE order_sequences SET next_value = ? WHERE restaurant_id = ? AND day_key = ?
    `, [row.next_value + 1, restaurantId, dayKey]);
    return row.next_value;
  }

  private availablePoints(userId: string, restaurantId: string, at: string): number {
    const row = this.db.get<{ total: number | null }>(`
      SELECT COALESCE(SUM(CASE WHEN points > 0 AND remaining IS NOT NULL THEN remaining ELSE points END), 0) AS total
      FROM points_ledger WHERE user_id = ? AND restaurant_id = ? AND kind IN ('earn', 'referral', 'refund', 'adjust')
        AND (expires_at IS NULL OR expires_at > ?)
    `, [userId, restaurantId, at]);
    return Math.max(0, row?.total ?? 0);
  }

  private debitPoints(order: Order, at: string): void {
    let needed = order.pointsRedeemed;
    const buckets = this.db.all<PointBucket>(`
      SELECT id, CASE WHEN remaining IS NULL THEN points ELSE remaining END AS available
      FROM points_ledger
      WHERE user_id = ? AND restaurant_id = ? AND points > 0
        AND (expires_at IS NULL OR expires_at > ?) AND (remaining IS NULL OR remaining > 0)
      ORDER BY expires_at IS NULL, expires_at, created_at, id
    `, [order.userId, order.restaurantId, at]);
    const allocations: PointAllocation[] = [];
    for (const bucket of buckets) {
      if (needed === 0) break;
      const used = Math.min(needed, bucket.available);
      this.db.run('UPDATE points_ledger SET remaining = ? WHERE id = ? AND restaurant_id = ?',
        [bucket.available - used, bucket.id, order.restaurantId]);
      allocations.push({ ledgerId: bucket.id, points: used });
      needed -= used;
    }
    if (needed > 0) throw new Error('Le solde de points a changé pendant la commande.');
    this.db.run(`INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, order_id, note, created_at)
      VALUES (?, ?, ?, 'redeem', ?, ?, ?, ?)`, [randomUUID(), order.restaurantId, order.userId,
      -order.pointsRedeemed, order.id, JSON.stringify({ allocations }), at]);
  }

  private restoreRedeemedPoints(orderId: string, order: OrderRow, at: string): void {
    const redemption = this.db.get<{ note: string | null }>(`
      SELECT note FROM points_ledger
      WHERE order_id = ? AND user_id = ? AND restaurant_id = ? AND kind = 'redeem'
      ORDER BY created_at LIMIT 1
    `, [orderId, order.user_id, order.restaurant_id]);
    const allocationData = parseJson<{ allocations?: PointAllocation[] }>(redemption?.note ?? null, {});
    const allocations = Array.isArray(allocationData.allocations) ? allocationData.allocations : [];
    for (const allocation of allocations) {
      this.db.run(`UPDATE points_ledger SET remaining = COALESCE(remaining, points) + ?
        WHERE id = ? AND user_id = ? AND restaurant_id = ?`,
      [allocation.points, allocation.ledgerId, order.user_id, order.restaurant_id]);
    }
    const restored = allocations.reduce((sum, allocation) => sum + allocation.points, 0);
    if (restored < order.points_redeemed) {
      this.db.run(`INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, remaining, order_id, note, created_at)
        VALUES (?, ?, ?, 'refund', ?, ?, ?, ?, ?)`, [randomUUID(), order.restaurant_id, order.user_id,
        order.points_redeemed - restored, order.points_redeemed - restored, orderId,
        'Restitution des points d’une commande annulée.', at]);
    }
  }

  private awardLoyaltyPoints(order: OrderRow, at: string): void {
    const settings = this.db.get<{ spend_per_point_fc: number; points_validity_months: number }>(`
        SELECT spend_per_point_fc, points_validity_months
        FROM restaurant_settings WHERE restaurant_id = ?
    `, [order.restaurant_id]);
    const membership = this.db.get<{ loyalty_remainder_fc: number }>(`
        SELECT loyalty_remainder_fc FROM memberships WHERE user_id = ? AND restaurant_id = ?
    `, [order.user_id, order.restaurant_id]);
    if (!membership) throw new Error('L’adhésion de fidélité de la commande est introuvable.');

    const spendPerPoint = settings?.spend_per_point_fc ?? 3000;
    const eligibleSpend = Math.max(0, order.subtotal_fc - order.discount_fc);
    const accumulated = eligibleSpend + membership.loyalty_remainder_fc;
    const points = Math.floor(accumulated / spendPerPoint);
    this.db.run(`
        UPDATE memberships SET loyalty_remainder_fc = ? WHERE user_id = ? AND restaurant_id = ?
    `, [accumulated % spendPerPoint, order.user_id, order.restaurant_id]);
    this.db.run('UPDATE orders SET points_earned = ? WHERE id = ? AND restaurant_id = ?', [
        points, order.id, order.restaurant_id,
    ]);

    if (points > 0) {
        const expiresAt = new Date(at);
        expiresAt.setUTCMonth(expiresAt.getUTCMonth() + (settings?.points_validity_months ?? 12));
        this.db.run(`
          INSERT INTO points_ledger (
            id, restaurant_id, user_id, kind, points, remaining, expires_at, order_id, created_at
          ) VALUES (?, ?, ?, 'earn', ?, ?, ?, ?, ?)
        `, [randomUUID(), order.restaurant_id, order.user_id, points, points, expiresAt.toISOString(), order.id, at]);
    }
  }

  private awardReferralPoints(order: OrderRow, eligibleSpend: number, at: string): void {
    if (eligibleSpend < 3000) return;
    const referred = this.db.get<{ referrer_id: string | null; referral_id: string | null }>(`
        SELECT u.referred_by AS referrer_id, r.id AS referral_id
        FROM users u LEFT JOIN referrals r ON r.referee_id = u.id
        WHERE u.id = ? AND u.role = 'student' AND u.status = 'active'
    `, [order.user_id]);
    if (!referred?.referrer_id || referred.referral_id) return;
    const referrer = this.db.get<{ id: string }>(`
        SELECT id FROM users WHERE id = ? AND role = 'student' AND status = 'active'
    `, [referred.referrer_id]);
    if (!referrer) return;

    const rewardPoints = Math.floor(eligibleSpend / 3000);
    if (rewardPoints <= 0) return;
    const settings = this.db.get<{ points_validity_months: number }>(`
        SELECT points_validity_months FROM restaurant_settings WHERE restaurant_id = ?
    `, [order.restaurant_id]);
    const referralId = randomUUID();
    const expiresAt = new Date(at);
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + (settings?.points_validity_months ?? 12));
    this.db.run(`
        INSERT INTO memberships (user_id, restaurant_id, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT (user_id, restaurant_id) DO NOTHING
    `, [referrer.id, order.restaurant_id, at]);
    this.db.run(`
        INSERT INTO referrals (
          id, restaurant_id, referrer_id, referee_id, status, reward_points,
          rewarded_order_id, created_at, rewarded_at
        ) VALUES (?, ?, ?, ?, 'rewarded', ?, ?, ?, ?)
    `, [referralId, order.restaurant_id, referrer.id, order.user_id, rewardPoints, order.id, at, at]);
    this.db.run(`
        INSERT INTO points_ledger (
          id, restaurant_id, user_id, kind, points, remaining, expires_at, order_id, referral_id, created_at
        ) VALUES (?, ?, ?, 'referral', ?, ?, ?, ?, ?, ?)
    `, [randomUUID(), order.restaurant_id, referrer.id, rewardPoints, rewardPoints, expiresAt.toISOString(), order.id, referralId, at]);
  }
}
