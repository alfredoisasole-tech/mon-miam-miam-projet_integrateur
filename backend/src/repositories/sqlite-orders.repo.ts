import { randomUUID } from 'node:crypto';
import type { Database } from '../db/database.ts';
import type {
  MenuItem, Order, OrderEvent, OrderStatus, OrdersRepository, Restaurant, StudentProfile,
} from '../domain/orders.ts';
import { AppError } from '../http/errors.ts';

interface OrderRow {
  id: string;
  user_id: string;
  restaurant_id: string;
  idempotency_key: string;
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

const ORDER_SELECT = `
  SELECT o.*, r.slug AS restaurant_slug, r.name AS restaurant_name
  FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
`;

function mapOrder(row: OrderRow, db: Database): Order {
  const items = db.all<{
    menu_item_id: string; name: string; category: string; unit_price_fc: number; quantity: number; line_total_fc: number;
  }>('SELECT menu_item_id, name, category, unit_price_fc, quantity, line_total_fc FROM order_items WHERE order_id = ?', [row.id])
    .map((item) => ({
      menuItemId: item.menu_item_id, name: item.name, category: item.category, unitPriceFc: item.unit_price_fc,
      quantity: item.quantity, lineTotalFc: item.line_total_fc,
    }));
  const events = db.all<{ status: OrderStatus; created_at: string }>(
    'SELECT status, created_at FROM order_events WHERE order_id = ? ORDER BY created_at, rowid', [row.id],
  ).map((event): OrderEvent => ({ status: event.status, at: event.created_at }));
  const delivery = row.delivery_commune ? {
    commune: row.delivery_commune,
    quartier: row.delivery_quartier,
    address: row.delivery_address,
    landmark: row.delivery_landmark,
    phone: row.delivery_phone ?? '',
  } : null;
  return {
    id: row.id, userId: row.user_id, restaurantId: row.restaurant_id, idempotencyKey: row.idempotency_key,
    orderNumber: row.order_number, restaurant: { slug: row.restaurant_slug, name: row.restaurant_name },
    type: row.type, status: row.status, paymentMethod: row.payment_method, paymentStatus: row.payment_status,
    items, subtotalFc: row.subtotal_fc, discountFc: row.discount_fc, deliveryFeeFc: row.delivery_fee_fc,
    totalFc: row.total_fc, pointsRedeemed: row.points_redeemed, pointsEarned: row.points_earned,
    arrivalTime: row.arrival_time, delivery, note: row.note, comment: row.comment,
    rating: row.rating, events, createdAt: row.created_at, updatedAt: row.updated_at,
    completedAt: row.completed_at, cancelledAt: row.cancelled_at,
  };
}

export class SqliteOrdersRepository implements OrdersRepository {
  constructor(private readonly db: Database) {}

  async findStudent(userId: string): Promise<StudentProfile | null> {
    const row = this.db.get<{ id: string; restaurant_id: string; phone: string; loyalty_remainder_fc: number }>(
      `SELECT u.id, u.restaurant_id, u.phone, m.loyalty_remainder_fc
       FROM users u JOIN memberships m ON m.user_id = u.id AND m.restaurant_id = u.restaurant_id
       WHERE u.id = ? AND u.role = 'student' AND u.status = 'active'`, [userId]);
    return row ? { id: row.id, restaurantId: row.restaurant_id, phone: row.phone, loyaltyRemainderFc: row.loyalty_remainder_fc } : null;
  }

  async findRestaurantById(restaurantId: string): Promise<Restaurant | null> {
    const row = this.db.get<{ id: string; slug: string; name: string; status: Restaurant['status']; delivery_enabled?: number; delivery_fee_fc?: number; delivery_communes?: string; spend_per_point_fc?: number; points_per_meal?: number; free_meal_cap_fc?: number; opening_hours?: string }>(
      `SELECT r.id, r.slug, r.name, r.status, s.delivery_enabled, s.delivery_fee_fc, s.delivery_communes,
        s.spend_per_point_fc, s.points_per_meal, s.free_meal_cap_fc, s.opening_hours
       FROM restaurants r
       LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id WHERE r.id = ?`, [restaurantId]);
    return row ? this.mapRestaurant(row) : null;
  }

  async findRestaurantBySlug(slug: string): Promise<Restaurant | null> {
    const row = this.db.get<{ id: string; slug: string; name: string; status: Restaurant['status']; delivery_enabled?: number; delivery_fee_fc?: number; delivery_communes?: string; spend_per_point_fc?: number; points_per_meal?: number; free_meal_cap_fc?: number; opening_hours?: string }>(
      `SELECT r.id, r.slug, r.name, r.status, s.delivery_enabled, s.delivery_fee_fc, s.delivery_communes,
        s.spend_per_point_fc, s.points_per_meal, s.free_meal_cap_fc, s.opening_hours
       FROM restaurants r LEFT JOIN restaurant_settings s ON s.restaurant_id = r.id WHERE r.slug = ?`, [slug]);
    return row ? this.mapRestaurant(row) : null;
  }

  async findMenuItemsByIds(ids: string[]): Promise<MenuItem[]> {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    return this.db.all<{ id: string; restaurant_id: string; name: string; category: string; price_fc: number; is_available: number; deleted_at: string | null }>(
      `SELECT id, restaurant_id, name, category, price_fc, is_available, deleted_at
       FROM menu_items WHERE id IN (${placeholders})`, ids,
    ).map((row) => ({
      id: row.id, restaurantId: row.restaurant_id, name: row.name, category: row.category, priceFc: row.price_fc,
      isAvailable: row.is_available === 1, deletedAt: row.deleted_at,
    }));
  }

  async getAvailablePoints(userId: string, restaurantId: string, at: string): Promise<number> {
    return this.db.get<{ points: number }>(
      `SELECT COALESCE(SUM(CASE WHEN kind IN ('earn', 'referral') THEN COALESCE(remaining, points) ELSE points END), 0) AS points
       FROM points_ledger WHERE user_id = ? AND restaurant_id = ? AND (expires_at IS NULL OR expires_at > ?)`,
      [userId, restaurantId, at],
    )?.points ?? 0;
  }

  async getLoyaltyRemainderFc(userId: string, restaurantId: string): Promise<number> {
    return this.db.get<{ remainder: number }>('SELECT loyalty_remainder_fc AS remainder FROM memberships WHERE user_id = ? AND restaurant_id = ?', [userId, restaurantId])?.remainder ?? 0;
  }

  async findOrderByIdempotencyKey(userId: string, key: string): Promise<Order | null> {
    const row = this.db.get<OrderRow>(`${ORDER_SELECT} WHERE o.user_id = ? AND o.idempotency_key = ?`, [userId, key]);
    return row ? mapOrder(row, this.db) : null;
  }

  async listOrders(userId: string, query: { status?: OrderStatus; offset: number; limit: number }): Promise<{ orders: Order[]; total: number }> {
    const conditions = ['o.user_id = ?'];
    const values: Array<string | number> = [userId];
    if (query.status) { conditions.push('o.status = ?'); values.push(query.status); }
    const where = conditions.join(' AND ');
    const total = this.db.get<{ total: number }>(`SELECT COUNT(*) AS total FROM orders o WHERE ${where}`, values)?.total ?? 0;
    const rows = this.db.all<OrderRow>(`${ORDER_SELECT} WHERE ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, [...values, query.limit, query.offset]);
    return { orders: rows.map((row) => mapOrder(row, this.db)), total };
  }

  async findOrderForUser(orderId: string, userId: string): Promise<Order | null> {
    const row = this.db.get<OrderRow>(`${ORDER_SELECT} WHERE o.id = ? AND o.user_id = ?`, [orderId, userId]);
    return row ? mapOrder(row, this.db) : null;
  }

  async cancelOrder(userId: string, orderId: string, at: string): Promise<
    | { kind: 'not_found' }
    | { kind: 'cannot_cancel' }
    | { kind: 'cancelled'; order: Order }
  > {
    return this.db.transaction(() => {
      const row = this.db.get<OrderRow>(`${ORDER_SELECT} WHERE o.id = ? AND o.user_id = ?`, [orderId, userId]);
      if (!row) return { kind: 'not_found' };
      if (row.status !== 'pending' || !['unpaid', 'failed'].includes(row.payment_status)) return { kind: 'cannot_cancel' };
      this.db.run("UPDATE orders SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?", [at, at, orderId]);
      this.db.run("INSERT INTO order_events (id, order_id, status, user_id, created_at) VALUES (?, ?, 'cancelled', ?, ?)", [`evt_${randomUUID()}`, orderId, userId, at]);
      if (row.points_redeemed > 0) this.db.run(
        `INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, order_id, note, created_at)
         VALUES (?, ?, ?, 'refund', ?, ?, 'Remboursement des points après annulation', ?)`,
        [`pts_${randomUUID()}`, row.restaurant_id, userId, row.points_redeemed, orderId, at],
      );
      const updated = this.db.get<OrderRow>(`${ORDER_SELECT} WHERE o.id = ?`, [orderId])!;
      return { kind: 'cancelled', order: mapOrder(updated, this.db) };
    });
  }

  async nextOrderSequence(restaurantId: string, dayKey: string): Promise<number> {
    return this.db.transaction(() => {
      this.db.run(`INSERT INTO order_sequences (restaurant_id, day_key, next_value) VALUES (?, ?, 1)
        ON CONFLICT (restaurant_id, day_key) DO NOTHING`, [restaurantId, dayKey]);
      const row = this.db.get<{ next_value: number }>('SELECT next_value FROM order_sequences WHERE restaurant_id = ? AND day_key = ?', [restaurantId, dayKey]);
      const value = row?.next_value ?? 1;
      this.db.run('UPDATE order_sequences SET next_value = ? WHERE restaurant_id = ? AND day_key = ?', [value + 1, restaurantId, dayKey]);
      return value;
    });
  }

  async createOrder(order: Order): Promise<{ created: boolean; order: Order }> {
    return this.db.transaction(() => {
      const existing = this.db.get<OrderRow>(`${ORDER_SELECT} WHERE o.user_id = ? AND o.idempotency_key = ?`, [order.userId, order.idempotencyKey]);
      if (existing) return { created: false, order: mapOrder(existing, this.db) };
      this.db.run('INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES (?, ?, ?) ON CONFLICT (user_id, restaurant_id) DO NOTHING',
        [order.userId, order.restaurantId, order.createdAt]);
      if (order.pointsRedeemed > 0) {
        const available = this.db.get<{ points: number }>(
          `SELECT COALESCE(SUM(CASE WHEN kind IN ('earn', 'referral') THEN COALESCE(remaining, points) ELSE points END), 0) AS points
           FROM points_ledger WHERE user_id = ? AND restaurant_id = ? AND (expires_at IS NULL OR expires_at > ?)`,
          [order.userId, order.restaurantId, order.createdAt],
        )?.points ?? 0;
        if (available < order.pointsRedeemed) throw new AppError(422, 'INSUFFICIENT_POINTS', 'Le solde de points est insuffisant dans ce restaurant.');
      }
      this.db.run(`INSERT INTO orders (
        id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
        subtotal_fc, discount_fc, delivery_fee_fc, total_fc, points_redeemed, points_earned,
        arrival_time, delivery_commune, delivery_quartier, delivery_address, delivery_landmark,
        delivery_phone, note, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        order.id, order.restaurantId, order.userId, order.orderNumber, order.type, order.status,
        order.paymentMethod, order.paymentStatus, order.subtotalFc, order.discountFc, order.deliveryFeeFc,
        order.totalFc, order.pointsRedeemed, order.pointsEarned, order.arrivalTime, order.delivery?.commune ?? null,
        order.delivery?.quartier ?? null, order.delivery?.address ?? null, order.delivery?.landmark ?? null,
        order.delivery?.phone ?? null, order.note, order.idempotencyKey, order.createdAt, order.updatedAt,
      ]);
      for (const item of order.items) this.db.run(
        `INSERT INTO order_items (id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`oli_${randomUUID()}`, order.id, item.menuItemId, item.name, item.category, item.unitPriceFc, item.quantity, item.lineTotalFc],
      );
      this.db.run('INSERT INTO order_events (id, order_id, status, created_at) VALUES (?, ?, ?, ?)', [`evt_${randomUUID()}`, order.id, order.status, order.createdAt]);
      if (order.pointsRedeemed > 0) this.db.run(
        `INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, order_id, note, created_at)
         VALUES (?, ?, ?, 'redeem', ?, ?, 'Points utilisés pour une commande', ?)`,
        [`pts_${randomUUID()}`, order.restaurantId, order.userId, -order.pointsRedeemed, order.id, order.createdAt],
      );
      const inserted = this.db.get<OrderRow>(`${ORDER_SELECT} WHERE o.id = ?`, [order.id])!;
      return { created: true, order: mapOrder(inserted, this.db) };
    });
  }

  async listRestaurantOrders(restaurantId: string, status?: OrderStatus): Promise<Order[]> {
    const rows = status
      ? this.db.all<OrderRow>(`${ORDER_SELECT} WHERE o.restaurant_id = ? AND o.status = ? ORDER BY o.created_at`, [restaurantId, status])
      : this.db.all<OrderRow>(`${ORDER_SELECT} WHERE o.restaurant_id = ? ORDER BY o.created_at`, [restaurantId]);
    return rows.map((row) => mapOrder(row, this.db));
  }

  async updateRestaurantOrderStatus(restaurantId: string, orderId: string, expectedStatus: OrderStatus, actorId: string, status: OrderStatus, at: string): Promise<Order | null> {
    return this.db.transaction(() => {
      const row = this.db.get<OrderRow>(`${ORDER_SELECT} WHERE o.id = ? AND o.restaurant_id = ?`, [orderId, restaurantId]);
      if (!row || row.status !== expectedStatus) return null;
      if (status === 'completed' && row.payment_method === 'mobile_money' && row.payment_status !== 'paid') {
        throw new AppError(422, 'PAYMENT_NOT_CONFIRMED', 'Le paiement mobile doit être confirmé avant la remise de la commande.');
      }
      let pointsEarned = row.points_earned;
      if (status === 'completed') {
        const settings = this.db.get<{ spend_per_point_fc: number; points_validity_months: number }>(
          'SELECT spend_per_point_fc, points_validity_months FROM restaurant_settings WHERE restaurant_id = ?',
          [restaurantId],
        );
        const remainder = this.db.get<{ value: number }>(
          'SELECT loyalty_remainder_fc AS value FROM memberships WHERE user_id = ? AND restaurant_id = ?',
          [row.user_id, restaurantId],
        )?.value ?? 0;
        const spendPerPoint = settings?.spend_per_point_fc ?? 3000;
        const qualifiedAmount = row.total_fc + remainder;
        pointsEarned = Math.floor(qualifiedAmount / spendPerPoint);
        this.db.run('UPDATE orders SET points_earned = ? WHERE id = ?', [pointsEarned, orderId]);
        this.db.run('UPDATE memberships SET loyalty_remainder_fc = ? WHERE user_id = ? AND restaurant_id = ?',
          [qualifiedAmount % spendPerPoint, row.user_id, restaurantId]);
        if (pointsEarned > 0) {
          const expiresAt = new Date(at);
          expiresAt.setUTCMonth(expiresAt.getUTCMonth() + (settings?.points_validity_months ?? 12));
          this.db.run(`INSERT INTO points_ledger (
            id, restaurant_id, user_id, kind, points, remaining, expires_at, order_id, created_at
          ) VALUES (?, ?, ?, 'earn', ?, ?, ?, ?, ?)`,
          [`pts_${randomUUID()}`, restaurantId, row.user_id, pointsEarned, pointsEarned, expiresAt.toISOString(), orderId, at]);
        }
      }
      this.db.run(`UPDATE orders SET status = ?, updated_at = ?,
        completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END,
        cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_at END,
        payment_status = CASE WHEN ? = 'completed' AND payment_method = 'cash' THEN 'paid' ELSE payment_status END
        WHERE id = ? AND status = ?`, [status, at, status, at, status, at, status, orderId, expectedStatus]);
      this.db.run('INSERT INTO order_events (id, order_id, status, user_id, created_at) VALUES (?, ?, ?, ?, ?)', [`evt_${randomUUID()}`, orderId, status, actorId, at]);
      if (status === 'cancelled' && row.points_redeemed > 0) this.db.run(
        `INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, order_id, note, created_at)
         VALUES (?, ?, ?, 'refund', ?, ?, 'Remboursement des points après annulation', ?)`,
        [`pts_${randomUUID()}`, restaurantId, row.user_id, row.points_redeemed, orderId, at],
      );
      const updated = this.db.get<OrderRow>(`${ORDER_SELECT} WHERE o.id = ?`, [orderId])!;
      return mapOrder(updated, this.db);
    });
  }

  private mapRestaurant(row: {
    id: string; slug: string; name: string; status: Restaurant['status']; delivery_enabled?: number; delivery_fee_fc?: number;
    delivery_communes?: string; spend_per_point_fc?: number; points_per_meal?: number; free_meal_cap_fc?: number; opening_hours?: string;
  }): Restaurant {
    let deliveryCommunes: string[] = [];
    let openingHours: Restaurant['settings']['openingHours'] = {};
    try { if (row.delivery_communes) deliveryCommunes = JSON.parse(row.delivery_communes) as string[]; }
    catch (error) { throw new Error(`Paramètres de livraison invalides pour ${row.slug}: ${String(error)}`); }
    try { if (row.opening_hours) openingHours = JSON.parse(row.opening_hours) as Restaurant['settings']['openingHours']; }
    catch (error) { throw new Error(`Horaires invalides pour ${row.slug}: ${String(error)}`); }
    return {
      id: row.id, slug: row.slug, name: row.name, status: row.status,
      settings: {
        deliveryEnabled: row.delivery_enabled === 1, deliveryFeeFc: row.delivery_fee_fc ?? 0, deliveryCommunes,
        mobileMoneyEnabled: true, spendPerPointFc: row.spend_per_point_fc ?? 3000,
        pointsPerMeal: row.points_per_meal ?? 15, freeMealCapFc: row.free_meal_cap_fc ?? 3000, openingHours,
      },
    };
  }
}
