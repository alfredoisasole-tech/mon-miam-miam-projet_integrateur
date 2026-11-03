import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config.ts';
import { Database } from '../../src/db/database.ts';
import { migrate } from '../../src/db/migrations.ts';
import type { AuthenticatedUser } from '../../src/domain/orders.ts';
import { demarrer, type Serveur } from '../helpers.ts';

const NOW = new Date('2026-11-03T08:30:00.000Z');
const TOKENS = new Map<string, AuthenticatedUser>([
  ['manager-alpha', { id: 'manager-alpha', role: 'manager', restaurantId: 'restaurant-alpha' }],
  ['admin-beta', { id: 'admin-beta', role: 'admin', restaurantId: 'restaurant-beta' }],
  ['employee-alpha', { id: 'employee-alpha', role: 'employee', restaurantId: 'restaurant-alpha' }],
  ['student-alpha', { id: 'student-alpha', role: 'student', restaurantId: 'restaurant-alpha' }],
  ['platform-admin', { id: 'platform-admin', role: 'platform_admin' }],
]);

describe('API des statistiques du personnel — L-11', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('restaurant-alpha', 'alpha', 'Alpha', 'Arial', ?),
      ('restaurant-beta', 'beta', 'Beta', 'Arial', ?)`, [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES
      ('student-alpha', 'restaurant-alpha', 'student', 'Étudiant Alpha', 'alpha@example.test', '+243810000001', 'hash', ?),
      ('student-beta', 'restaurant-beta', 'student', 'Étudiant Beta', 'beta@example.test', '+243810000002', 'hash', ?)` , [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES
      ('student-alpha', 'restaurant-alpha', ?), ('student-beta', 'restaurant-beta', ?)` , [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at) VALUES
      ('alpha-dish', 'restaurant-alpha', 'Poulet Alpha', 2500, 'plat', ?, ?),
      ('beta-dish', 'restaurant-beta', 'Plat Beta', 3000, 'plat', ?, ?)` ,
    [NOW.toISOString(), NOW.toISOString(), NOW.toISOString(), NOW.toISOString()]);

    const insertOrder = (input: {
      id: string; restaurantId: string; userId: string; status: string; total: number;
      createdAt: string; completedAt?: string; cancelledAt?: string; itemId?: string;
      quantity?: number; unitPrice?: number; discount?: number;
    }) => {
      const discount = input.discount ?? 0;
      db.run(`INSERT INTO orders (
        id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
        subtotal_fc, discount_fc, delivery_fee_fc, total_fc, created_at, updated_at, completed_at, cancelled_at
      ) VALUES (?, ?, ?, ?, 'dine_in', ?, 'cash', 'paid', ?, ?, 0, ?, ?, ?, ?, ?)`, [
        input.id, input.restaurantId, input.userId, `num-${input.id}`, input.status,
        input.total + discount, discount, input.total, input.createdAt, input.createdAt,
        input.completedAt ?? null, input.cancelledAt ?? null,
      ]);
      if (input.itemId && input.quantity && input.unitPrice) db.run(`INSERT INTO order_items (
        id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc
      ) VALUES (?, ?, ?, ?, 'plat', ?, ?, ?)`, [
        `item-${input.id}`, input.id, input.itemId,
        input.itemId === 'alpha-dish' ? 'Poulet Alpha' : 'Plat Beta',
        input.unitPrice, input.quantity, input.unitPrice * input.quantity,
      ]);
    };

    insertOrder({ id: 'alpha-today-done', restaurantId: 'restaurant-alpha', userId: 'student-alpha', status: 'completed', total: 4000, discount: 1000, createdAt: '2026-11-03T05:00:00.000Z', completedAt: '2026-11-03T06:00:00.000Z', itemId: 'alpha-dish', quantity: 2, unitPrice: 2500 });
    insertOrder({ id: 'alpha-today-active', restaurantId: 'restaurant-alpha', userId: 'student-alpha', status: 'pending', total: 3000, createdAt: '2026-11-03T06:15:00.000Z' });
    insertOrder({ id: 'alpha-today-cancelled', restaurantId: 'restaurant-alpha', userId: 'student-alpha', status: 'cancelled', total: 2000, createdAt: '2026-11-03T06:30:00.000Z', cancelledAt: '2026-11-03T06:45:00.000Z' });
    insertOrder({ id: 'alpha-monday-done', restaurantId: 'restaurant-alpha', userId: 'student-alpha', status: 'completed', total: 2000, createdAt: '2026-11-02T21:00:00.000Z', completedAt: '2026-11-02T21:30:00.000Z', itemId: 'alpha-dish', quantity: 1, unitPrice: 2000 });
    insertOrder({ id: 'alpha-sunday-done', restaurantId: 'restaurant-alpha', userId: 'student-alpha', status: 'completed', total: 1000, createdAt: '2026-11-01T21:00:00.000Z', completedAt: '2026-11-01T21:30:00.000Z', itemId: 'alpha-dish', quantity: 1, unitPrice: 1000 });
    insertOrder({ id: 'alpha-october-done', restaurantId: 'restaurant-alpha', userId: 'student-alpha', status: 'completed', total: 1000, createdAt: '2026-10-31T21:00:00.000Z', completedAt: '2026-10-31T21:30:00.000Z', itemId: 'alpha-dish', quantity: 1, unitPrice: 1000 });
    insertOrder({ id: 'beta-today-done', restaurantId: 'restaurant-beta', userId: 'student-beta', status: 'completed', total: 9000, createdAt: '2026-11-03T05:00:00.000Z', completedAt: '2026-11-03T06:00:00.000Z', itemId: 'beta-dish', quantity: 3, unitPrice: 3000 });

    server = await demarrer(createApp(loadConfig({
      NODE_ENV: 'test', JWT_SECRET: 'stats-test-secret-long-enough-for-tokens',
    }), { database: db, now: () => new Date(NOW), resolveToken: (token) => TOKENS.get(token) ?? null }));
  });

  after(async () => {
    await server.fermer();
    db.close();
  });

  const get = (path: string, token?: string) => fetch(`${server.base}/api/staff/stats/${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

  it('calcule le bilan du jour sur le restaurant du jeton et les commandes terminées', async () => {
    const response = await get('overview?period=day', 'manager-alpha');
    assert.equal(response.status, 200);
    const stats = await response.json() as {
      period: string; salesFc: number; averageOrderFc: number;
      orders: { total: number; completed: number; active: number; cancelled: number; byStatus: Record<string, number> };
      topItems: Array<{ name: string; quantity: number }>;
    };
    assert.equal(stats.period, 'day');
    assert.equal(stats.salesFc, 4000);
    assert.equal(stats.averageOrderFc, 4000);
    assert.deepEqual(stats.orders, {
      total: 3, completed: 1, active: 1, cancelled: 1,
      byStatus: { pending: 1, confirmed: 0, preparing: 0, ready: 0, out_for_delivery: 0, completed: 1, cancelled: 1 },
    });
    assert.deepEqual(stats.topItems, [{ name: 'Poulet Alpha', quantity: 2, revenueFc: 5000 }]);
  });

  it('respecte les limites de période locales et isole les restaurants', async () => {
    const [weekly, monthly, beta] = await Promise.all([
      get('overview?period=week', 'manager-alpha'),
      get('overview?period=month', 'manager-alpha'),
      get('overview?period=day', 'admin-beta'),
    ]);
    assert.equal(weekly.status, 200);
    assert.equal(monthly.status, 200);
    assert.equal(beta.status, 200);
    assert.equal((await weekly.json() as { salesFc: number }).salesFc, 6000);
    const monthStats = await monthly.json() as { salesFc: number; averageOrderFc: number };
    assert.equal(monthStats.salesFc, 7000);
    assert.equal(monthStats.averageOrderFc, 2333);
    assert.equal((await beta.json() as { salesFc: number }).salesFc, 9000);
  });

  it('fournit à l’employé les ventes de la semaine, du lundi au dimanche en heure de Kinshasa', async () => {
    const response = await get('weekly', 'employee-alpha');
    assert.equal(response.status, 200);
    const stats = await response.json() as {
      totalSalesFc: number; ordersCompleted: number; days: Array<{ date: string; label: string; salesFc: number; orders: number }>;
    };
    assert.equal(stats.totalSalesFc, 6000);
    assert.equal(stats.ordersCompleted, 2);
    assert.deepEqual(stats.days.slice(0, 2), [
      { date: '2026-11-02', label: 'lundi', salesFc: 2000, orders: 1 },
      { date: '2026-11-03', label: 'mardi', salesFc: 4000, orders: 1 },
    ]);
    assert.equal(stats.days.length, 7);
  });

  it('réserve chaque route aux rôles prévus et valide la période', async () => {
    assert.equal((await get('overview', 'employee-alpha')).status, 403);
    assert.equal((await get('weekly', 'student-alpha')).status, 403);
    assert.equal((await get('overview', 'platform-admin')).status, 403);
    assert.equal((await get('overview?period=year', 'manager-alpha')).status, 400);
    const unauthorized = await get('overview');
    assert.equal(unauthorized.status, 401);
    assert.equal((await unauthorized.json() as { error: { code: string } }).error.code, 'UNAUTHORIZED');
  });
});
