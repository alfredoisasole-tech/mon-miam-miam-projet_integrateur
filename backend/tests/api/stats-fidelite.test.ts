import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config.ts';
import { Database } from '../../src/db/database.ts';
import { migrate } from '../../src/db/migrations.ts';
import type { AuthenticatedUser } from '../../src/domain/orders.ts';
import { demarrer, type Serveur } from '../helpers.ts';

const NOW = new Date('2026-11-04T10:00:00.000Z');
const TOKENS = new Map<string, AuthenticatedUser>([
  ['manager-a', { id: 'manager-a', role: 'manager', restaurantId: 'rest-a' }],
  ['admin-b', { id: 'admin-b', role: 'admin', restaurantId: 'rest-b' }],
  ['employee-a', { id: 'employee-a', role: 'employee', restaurantId: 'rest-a' }],
]);

describe('[MM-STATS] Statistiques de la fidélité et du parrainage', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    const at = '2026-10-01T00:00:00.000Z';
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('rest-a', 'a', 'A', 'Arial', ?), ('rest-b', 'b', 'B', 'Arial', ?)`, [at, at]);
    for (const [id, restaurant, code, referredBy] of [
      ['u1', 'rest-a', 'CODE1', null], ['u2', 'rest-a', 'CODE2', 'u1'], ['u3', 'rest-a', 'CODE3', 'u1'], ['u4', 'rest-b', 'CODE4', null],
    ] as const) {
      db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, referral_code, referred_by, created_at)
        VALUES (?, ?, 'student', ?, ?, ?, 'x', ?, ?, ?)`, [id, restaurant, `Étudiant ${id}`, `${id}@example.test`, `+2438100000${id.slice(1)}`, code, referredBy, at]);
      db.run('INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES (?, ?, ?)', [id, restaurant, at]);
    }
    db.run(`INSERT INTO orders (id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
      subtotal_fc, discount_fc, delivery_fee_fc, total_fc, created_at, updated_at)
      VALUES ('o1', 'rest-a', 'u2', '261104-001', 'dine_in', 'completed', 'cash', 'paid', 6000, 0, 0, 6000, ?, ?)`, ['2026-11-04T09:00:00.000Z', '2026-11-04T09:00:00.000Z']);
    db.run(`INSERT INTO referrals (id, restaurant_id, referrer_id, referee_id, status, reward_points, rewarded_order_id, created_at, rewarded_at)
      VALUES ('ref1', 'rest-a', 'u1', 'u2', 'rewarded', 2, 'o1', ?, ?)`, ['2026-11-04T09:00:00.000Z', '2026-11-04T09:00:00.000Z']);
    const ledger = (id: string, restaurant: string, user: string, kind: string, points: number, createdAt: string) =>
      db.run(`INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, remaining, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, restaurant, user, kind, points, points > 0 ? points : null, createdAt]);
    ledger('l1', 'rest-a', 'u1', 'earn', 4, '2026-11-04T08:00:00.000Z');
    ledger('l2', 'rest-a', 'u1', 'referral', 2, '2026-11-04T09:00:00.000Z');
    ledger('l3', 'rest-a', 'u1', 'redeem', -15, '2026-11-04T09:30:00.000Z');
    ledger('l4', 'rest-a', 'u2', 'earn', 3, '2026-11-02T08:00:00.000Z'); // hors du jour, dans le mois
    ledger('l5', 'rest-b', 'u4', 'earn', 99, '2026-11-04T08:00:00.000Z'); // autre restaurant
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db, now: () => new Date(NOW), resolveToken: (token) => TOKENS.get(token) ?? null,
    }));
  });
  after(async () => { await server.fermer(); db.close(); });

  async function overview(token: string, period = 'day') {
    return fetch(`${server.base}/api/staff/stats/overview?period=${period}`, { headers: { authorization: `Bearer ${token}` } });
  }

  it('compte les points gagnés, utilisés et donnés par parrainage sur la période, pour ce restaurant seulement', async () => {
    const response = await overview('manager-a');
    assert.equal(response.status, 200);
    const body = await response.json() as { loyalty: Record<string, number>; referrals: Record<string, number> };
    assert.deepEqual(body.loyalty, { members: 3, pointsEarned: 4, pointsRedeemed: 15 });
    assert.deepEqual(body.referrals, { rewarded: 1, pointsGranted: 2, pending: 1 });
  });

  it('élargit la période au mois', async () => {
    const body = await (await overview('manager-a', 'month')).json() as { loyalty: Record<string, number> };
    assert.equal(body.loyalty['pointsEarned'], 7);
  });

  it('isole chaque restaurant', async () => {
    const body = await (await overview('admin-b')).json() as { loyalty: Record<string, number>; referrals: Record<string, number> };
    assert.deepEqual(body.loyalty, { members: 1, pointsEarned: 99, pointsRedeemed: 0 });
    assert.deepEqual(body.referrals, { rewarded: 0, pointsGranted: 0, pending: 0 });
  });

  it('reste interdit à l’employé', async () => {
    assert.equal((await overview('employee-a')).status, 403);
  });
});
