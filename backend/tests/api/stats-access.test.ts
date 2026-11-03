import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config.ts';
import { Database } from '../../src/db/database.ts';
import { migrate } from '../../src/db/migrations.ts';
import { seedDemoData } from '../../src/seed.ts';
import { hashPassword } from '../../src/services/auth.service.ts';
import type { StatsOverview, WeeklyStats } from '../../src/services/stats.service.ts';
import { demarrer, type Serveur } from '../helpers.ts';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const PASSWORD = 'StatsAccess1';

describe('APP-84 — statistiques isolées avec authentification réelle', () => {
  let db: Database;
  let server: Serveur;
  const tokens: Record<string, string> = {};

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    seedDemoData(db, {
      restaurantAdminPassword: PASSWORD, employeePassword: PASSWORD,
      studentPassword: PASSWORD, platformAdminPassword: PASSWORD,
    });
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
      VALUES ('stats-manager', 'demo-restaurant-zeduc', 'manager', 'Gérant test',
        'stats-manager@example.test', '+243810000005', ?, ?)`, [hashPassword(PASSWORD), NOW.toISOString()]);
    for (const [id, restaurant, quantity] of [
      ['stats-a1', 'demo-restaurant-zeduc', 2], ['stats-a2', 'demo-restaurant-zeduc', 3],
      ['stats-b1', 'demo-restaurant-lea', 18],
    ] as const) {
      const item = db.get<{ id: string; name: string; price_fc: number }>(
        'SELECT id, name, price_fc FROM menu_items WHERE restaurant_id = ? ORDER BY position LIMIT 1', [restaurant],
      )!;
      const total = quantity * item.price_fc;
      db.run(`INSERT INTO orders (id, restaurant_id, user_id, order_number, type, status, payment_method,
        payment_status, subtotal_fc, discount_fc, delivery_fee_fc, total_fc, created_at, updated_at, completed_at)
        VALUES (?, ?, 'demo-student', ?, 'dine_in', 'completed', 'cash', 'paid', ?, 0, 0, ?, ?, ?, ?)`,
      [id, restaurant, id, total, total, '2026-11-03T10:00:00.000Z', '2026-11-03T11:00:00.000Z', '2026-11-03T11:00:00.000Z']);
      db.run(`INSERT INTO order_items (id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc)
        VALUES (?, ?, ?, ?, 'plat', ?, ?, ?)`, ['item-' + id, id, item.id, item.name, item.price_fc, quantity, total]);
    }
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), { database: db, now: () => new Date(NOW) }));
    for (const [role, identifier] of Object.entries({
      admin: 'admin@zeduc-space.test', other: 'admin@chez-lea.test',
      manager: 'stats-manager@example.test', employee: 'employe@monmiam.test',
      student: 'etudiant@monmiam.test', platform: 'plateforme@monmiam.test',
    })) {
      const response = await fetch(`${server.base}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier, password: PASSWORD }),
      });
      assert.equal(response.status, 200);
      tokens[role] = (await response.json() as { token: string }).token;
    }
  });

  after(async () => { await server.fermer(); db.close(); });
  const get = (path: string, token?: string) => fetch(`${server.base}/api/staff/stats/${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

  for (const role of ['admin', 'manager'] as const) {
    it(`renvoie uniquement les chiffres du restaurant du ${role} sur les trois périodes`, async () => {
      for (const period of ['day', 'week', 'month']) {
        const response = await get('overview?period=' + period, tokens[role]);
        assert.equal(response.status, 200);
        const stats = await response.json() as StatsOverview;
        assert.equal(stats.period, period);
        assert.equal(stats.salesFc, 2500);
        assert.equal(stats.averageOrderFc, 1250);
        assert.equal(stats.orders.total, 2);
        assert.equal(stats.orders.completed, 2);
        assert.equal(stats.topItems[0]?.quantity, 5);
      }
      const response = await get('overview?period=day', tokens.other);
      assert.equal(response.status, 200);
      assert.equal((await response.json() as StatsOverview).salesFc, 9000);
    });
  }

  it('ignore les tentatives de choisir un autre restaurant dans les paramètres', async () => {
    const response = await get('overview?period=day&restaurant=chez-lea&restaurantId=demo-restaurant-lea&slug=chez-lea', tokens.manager);
    assert.equal(response.status, 200);
    assert.equal((await response.json() as StatsOverview).salesFc, 2500);
    const weekly = await get('weekly?restaurantId=demo-restaurant-lea', tokens.employee);
    assert.equal(weekly.status, 200);
    assert.equal((await weekly.json() as WeeklyStats).totalSalesFc, 2500);
  });

  for (const [role, status] of [['visiteur', 401], ['invalide', 401], ['student', 403], ['platform', 403]] as const) {
    it(`refuse les deux endpoints au rôle ${role} sans exposer les agrégats`, async () => {
      const token = role === 'visiteur' ? undefined : role === 'invalide' ? 'invalid-token' : tokens[role];
      for (const path of ['overview?period=day', 'weekly']) {
        const response = await get(path, token);
        assert.equal(response.status, status);
        const error = await response.json() as Record<string, unknown>;
        assert.ok(error.error);
        assert.ok(!('salesFc' in error) && !('orders' in error) && !('days' in error));
      }
    });
  }

  it('limite l’employé aux statistiques hebdomadaires de son restaurant', async () => {
    assert.equal((await get('overview?period=day', tokens.employee)).status, 403);
    const response = await get('weekly', tokens.employee);
    assert.equal(response.status, 200);
    const weekly = await response.json() as WeeklyStats;
    assert.equal(weekly.totalSalesFc, 2500);
    assert.equal(weekly.days.length, 7);
    assert.equal(weekly.ordersCompleted, 2);
  });

  it('rejette un jeton dont le rôle et le restaurant ont été falsifiés sans signature valide', async () => {
    const parts = tokens.employee!.split('.');
    const payload = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString()) as Record<string, unknown>;
    parts[0] = Buffer.from(JSON.stringify({ ...payload, role: 'admin', restaurantId: 'demo-restaurant-lea' })).toString('base64url');
    assert.equal((await get('overview?period=day', parts.join('.'))).status, 401);
  });

  it('refuse un compte désactivé même si son jeton était valide', async () => {
    db.run("UPDATE users SET status = 'inactive' WHERE id = 'stats-manager'");
    try {
      assert.equal((await get('overview?period=day', tokens.manager)).status, 403);
    } finally {
      db.run("UPDATE users SET status = 'active' WHERE id = 'stats-manager'");
    }
  });

  it('valide la période et recalcule les chiffres après modification de SQLite', async () => {
    for (const path of ['overview?period=year', 'overview?period=day&period=month']) {
      assert.equal((await get(path, tokens.admin)).status, 400);
    }
    db.run("UPDATE orders SET total_fc = total_fc + 1000, subtotal_fc = subtotal_fc + 1000 WHERE id = 'stats-a1'");
    try {
      const response = await get('overview?period=day', tokens.admin);
      assert.equal(response.status, 200);
      assert.equal((await response.json() as StatsOverview).salesFc, 3500);
      const other = await get('overview?period=day', tokens.other);
      assert.equal((await other.json() as StatsOverview).salesFc, 9000);
    } finally {
      db.run("UPDATE orders SET total_fc = total_fc - 1000, subtotal_fc = subtotal_fc - 1000 WHERE id = 'stats-a1'");
    }
  });
});
