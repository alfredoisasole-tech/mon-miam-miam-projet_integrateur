import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { demarrer, type Serveur } from './helpers.ts';

// Mercredi 4 novembre 2026, 11 h à Kinshasa (UTC+1, sans changement d'heure).
const NOW = new Date('2026-11-04T10:00:00.000Z');
const TOKENS = new Map<string, AuthenticatedUser>([
  ['ann', { id: 'ann', role: 'student', restaurantId: 'restaurant-a', status: 'active' }],
  ['bob', { id: 'bob', role: 'student', restaurantId: 'restaurant-a', status: 'active' }],
  ['zed', { id: 'zed', role: 'student', restaurantId: 'restaurant-b', status: 'active' }],
  ['employee', { id: 'employee', role: 'employee', restaurantId: 'restaurant-a', status: 'active' }],
]);

interface Ranking {
  period: string;
  from: string;
  items: Array<{ rank: number; name: string; orders: number; spentFc: number; isMe: boolean }>;
}

describe('[MM-TOP10] Classement des meilleurs clients', () => {
  let db: Database;
  let server: Serveur;
  let sequence = 0;

  function order(user: string, restaurant: string, status: string, completedAt: string, totalFc: number) {
    sequence += 1;
    db.run(`INSERT INTO orders (id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
      subtotal_fc, discount_fc, delivery_fee_fc, total_fc, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, 'dine_in', ?, 'cash', 'paid', ?, 0, 0, ?, ?, ?, ?)`,
    [`order-${sequence}`, restaurant, user, `N-${sequence}`, status, totalFc, totalFc, completedAt, completedAt,
      status === 'completed' ? completedAt : null]);
  }

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    const at = NOW.toISOString();
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('restaurant-a', 'top-a', 'Restaurant A', 'Arial', ?), ('restaurant-b', 'top-b', 'Restaurant B', 'Arial', ?)`, [at, at]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
      ('restaurant-a', '{}', ?), ('restaurant-b', '{}', ?)`, [at, at]);
    const users: Array<[string, string, string, string, string, string]> = [
      ['ann', 'restaurant-a', 'Ann Kabeya Mwamba', '+243810000401', 'student', 'active'],
      ['bob', 'restaurant-a', 'Bob Ilunga', '+243810000402', 'student', 'active'],
      ['cid', 'restaurant-a', 'Cid Tshala', '+243810000403', 'student', 'active'],
      ['dan', 'restaurant-a', 'Dan Supprimé', '+243810000404', 'student', 'deleted'],
      ['eve', 'restaurant-a', 'Eve Inactive', '+243810000405', 'student', 'inactive'],
      ['zed', 'restaurant-b', 'Zed Autre', '+243810000406', 'student', 'active'],
      ['employee', 'restaurant-a', 'Employé A', '+243810000407', 'employee', 'active'],
    ];
    for (const [id, restaurant, name, phone, role, status] of users) {
      db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'x', ?, ?)`, [id, restaurant, role, name, `${id}@example.test`, phone, status, at]);
      if (role === 'student') db.run('INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES (?, ?, ?)', [id, restaurant, at]);
    }
    // Ann : 3 commandes ce mois-ci (1 aujourd'hui, 1 cette semaine, 1 dimanche 1er), 1 le mois dernier.
    order('ann', 'restaurant-a', 'completed', '2026-11-04T08:00:00.000Z', 3000);
    order('ann', 'restaurant-a', 'completed', '2026-11-03T12:00:00.000Z', 3000);
    order('ann', 'restaurant-a', 'completed', '2026-11-01T12:00:00.000Z', 3000);
    order('ann', 'restaurant-a', 'completed', '2026-10-20T10:00:00.000Z', 3000);
    // Bob : 2 commandes (aujourd'hui, lundi 2), plus chères que celles d'Ann.
    order('bob', 'restaurant-a', 'completed', '2026-11-04T09:00:00.000Z', 6000);
    order('bob', 'restaurant-a', 'completed', '2026-11-02T10:00:00.000Z', 6000);
    // Cid : une commande annulée (ignorée) et une terminée à 23 h 30 à Kinshasa le 3 (veille).
    order('cid', 'restaurant-a', 'cancelled', '2026-11-04T07:00:00.000Z', 9000);
    order('cid', 'restaurant-a', 'completed', '2026-11-03T22:30:00.000Z', 1500);
    // Comptes supprimé et désactivé, et autre restaurant : jamais dans le classement.
    order('dan', 'restaurant-a', 'completed', '2026-11-04T08:00:00.000Z', 3000);
    order('eve', 'restaurant-a', 'completed', '2026-11-04T08:00:00.000Z', 3000);
    order('zed', 'restaurant-b', 'completed', '2026-11-04T08:00:00.000Z', 3000);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db, now: () => new Date(NOW), resolveToken: (token) => TOKENS.get(token) ?? null,
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  const headers = (token?: string): HeadersInit => ({ ...(token ? { authorization: `Bearer ${token}` } : {}) });
  const ranking = (slug: string, query: string, token?: string) =>
    fetch(`${server.base}/api/restaurants/${slug}/top-clients${query}`, { headers: headers(token) });

  it('classe sur le jour de Kinshasa : à égalité de commandes, la dépense départage', async () => {
    const response = await ranking('top-a', '?period=day', 'ann');
    assert.equal(response.status, 200);
    const body = await response.json() as Ranking;
    assert.equal(body.period, 'day');
    assert.equal(body.from, '2026-11-03T23:00:00.000Z');
    assert.deepEqual(body.items.map((item) => [item.rank, item.name, item.orders, item.spentFc, item.isMe]), [
      [1, 'Bob I.', 1, 6000, false],
      [2, 'Ann K.', 1, 3000, true],
    ]);
  });

  it('classe sur la semaine commençant le lundi', async () => {
    const body = await (await ranking('top-a', '?period=week', 'bob')).json() as Ranking;
    assert.equal(body.from, '2026-11-01T23:00:00.000Z');
    assert.deepEqual(body.items.map((item) => [item.rank, item.name, item.orders, item.isMe]), [
      [1, 'Bob I.', 2, true], [2, 'Ann K.', 2, false], [3, 'Cid T.', 1, false],
    ]);
  });

  it('classe sur le mois, par défaut, sans les comptes supprimés ni les autres restaurants', async () => {
    const body = await (await ranking('top-a', '', 'ann')).json() as Ranking;
    assert.equal(body.period, 'month');
    assert.equal(body.from, '2026-10-31T23:00:00.000Z');
    assert.deepEqual(body.items.map((item) => [item.name, item.orders]), [['Ann K.', 3], ['Bob I.', 2], ['Cid T.', 1]]);
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes('Mwamba') && !serialized.includes('Supprimé') && !serialized.includes('Zed') && !serialized.includes('@example.test'));
    const other = await (await ranking('top-b', '', 'zed')).json() as Ranking;
    assert.deepEqual(other.items.map((item) => item.name), ['Zed A.']);
  });

  it('refuse les accès non autorisés et les périodes inconnues', async () => {
    assert.equal((await ranking('top-a', '?period=day')).status, 401);
    assert.equal((await ranking('top-a', '?period=an', 'ann')).status, 400);
    assert.equal((await ranking('top-a', '', 'zed')).status, 403);
    assert.equal((await ranking('inconnu', '', 'ann')).status, 404);
    assert.equal((await ranking('top-a', '', 'employee')).status, 403);
  });
});
