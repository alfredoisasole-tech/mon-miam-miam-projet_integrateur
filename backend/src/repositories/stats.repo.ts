import type { Database } from '../db/database.ts';

export interface DateRange {
  from: string;
  to: string;
}

export const ORDER_STATUSES = [
  'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled',
] as const;

export interface CompletedOrderRow {
  completedAt: string;
  totalFc: number;
}

export interface TopItemRow {
  name: string;
  quantity: number;
  revenueFc: number;
}

export interface StatsRepository {
  ordersByStatus(restaurantId: string, range: DateRange): Record<(typeof ORDER_STATUSES)[number], number>;
  completedTotals(restaurantId: string, range: DateRange): { salesFc: number; orders: number };
  topItems(restaurantId: string, range: DateRange, limit: number): TopItemRow[];
  completedOrders(restaurantId: string, range: DateRange): CompletedOrderRow[];
}

/** Requêtes de lecture de statistiques : chaque agrégat est limité au restaurant demandé. */
export function statsRepository(db: Database): StatsRepository {
  return {
    ordersByStatus(restaurantId, range) {
      const rows = db.all<{ status: string; total: number }>(`
        SELECT status, COUNT(*) AS total
        FROM orders
        WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?
        GROUP BY status
      `, [restaurantId, range.from, range.to]);
      const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<(typeof ORDER_STATUSES)[number], number>;
      for (const row of rows) {
        if (ORDER_STATUSES.includes(row.status as (typeof ORDER_STATUSES)[number])) {
          counts[row.status as (typeof ORDER_STATUSES)[number]] = Number(row.total);
        }
      }
      return counts;
    },

    completedTotals(restaurantId, range) {
      const row = db.get<{ sales: number | null; orders: number }>(`
        SELECT COALESCE(SUM(total_fc), 0) AS sales, COUNT(*) AS orders
        FROM orders
        WHERE restaurant_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?
      `, [restaurantId, range.from, range.to]);
      return { salesFc: Number(row?.sales ?? 0), orders: Number(row?.orders ?? 0) };
    },

    topItems(restaurantId, range, limit) {
      return db.all<{ name: string; quantity: number; revenue: number }>(`
        SELECT oi.name AS name, SUM(oi.quantity) AS quantity, SUM(oi.line_total_fc) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.restaurant_id = ? AND o.status = 'completed'
          AND o.completed_at >= ? AND o.completed_at < ?
        GROUP BY oi.menu_item_id
        ORDER BY quantity DESC, revenue DESC, name COLLATE NOCASE
        LIMIT ?
      `, [restaurantId, range.from, range.to, limit]).map((row) => ({
        name: row.name,
        quantity: Number(row.quantity),
        revenueFc: Number(row.revenue),
      }));
    },

    completedOrders(restaurantId, range) {
      return db.all<{ completed_at: string; total_fc: number }>(`
        SELECT completed_at, total_fc
        FROM orders
        WHERE restaurant_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?
        ORDER BY completed_at
      `, [restaurantId, range.from, range.to]).map((row) => ({
        completedAt: row.completed_at,
        totalFc: Number(row.total_fc),
      }));
    },
  };
}
