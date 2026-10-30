import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { SqliteOrdersRepository } from '../src/repositories/sqlite-orders.repo.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-10-26T08:00:00.000Z');
const OPENING_HOURS = JSON.stringify(Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '00:00', close: '23:59' }]]),
));
const DINE_IN_ORDER = {
  restaurant: 'alpha',
  type: 'dine_in',
  paymentMethod: 'cash',
  items: [{ menuItemId: 'alpha-dish', quantity: 2 }],
  note: 'Sans piment.',
  redeemMeal: false,
};

let database: Database;
let server: Serveur;

function seedDatabase(db: Database): void {
  const now = NOW.toISOString();
  db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
    ('r-alpha', 'alpha', 'Restaurant Alpha', 'Arial', ?),
    ('r-beta', 'beta', 'Restaurant Beta', 'Arial', ?)` , [now, now]);
  db.run(`INSERT INTO restaurant_settings (restaurant_id, delivery_fee_fc, delivery_communes, opening_hours, updated_at) VALUES
    ('r-alpha', 2000, '["Limete"]', ?, ?),
    ('r-beta', 1500, '["Gombe"]', ?, ?)` , [OPENING_HOURS, now, OPENING_HOURS, now]);
  db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES
    ('student-1', 'r-alpha', 'student', 'Étudiant 1', 'student1@example.test', '+243820000001', 'hash-test', ?),
    ('student-2', 'r-alpha', 'student', 'Étudiant 2', 'student2@example.test', '+243820000002', 'hash-test', ?)` , [now, now]);
  db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES
    ('student-1', 'r-alpha', ?), ('student-1', 'r-beta', ?), ('student-2', 'r-alpha', ?)` , [now, now, now]);
  db.run(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at) VALUES
    ('alpha-dish', 'r-alpha', 'Poulet Alpha', 3000, 'plat', ?, ?),
    ('beta-dish', 'r-beta', 'Poulet Beta', 9000, 'plat', ?, ?)` , [now, now, now, now]);
  db.run(`INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, remaining, expires_at, created_at)
    VALUES ('alpha-points', 'r-alpha', 'student-1', 'earn', 15, 15, '2027-10-26T00:00:00.000Z', ?)` , [now]);
}

beforeEach(async () => {
  database = new Database(':memory:');
  migrate(database);
  seedDatabase(database);
  const users = new Map<string, AuthenticatedUser>([
    ['student-1-token', { id: 'student-1', role: 'student' }],
    ['student-2-token', { id: 'student-2', role: 'student' }],
    ['employee-token', { id: 'employee-1', role: 'employee' }],
  ]);
  server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
    database,
    now: () => new Date(NOW),
    resolveToken: (token) => users.get(token) ?? null,
  }));
});

afterEach(async () => {
  await server.fermer();
  database.close();
});

async function postOrder(body: unknown = DINE_IN_ORDER, token = 'student-1-token', key = 'sqlite-key-0001'): Promise<Response> {
  return fetch(`${server.base}/api/orders`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body),
  });
}

describe('Commandes SQLite — APP-21', () => {
  it('monte les routes quand la base est fournie et persiste la commande, ses lignes et son événement', async () => {
    const response = await postOrder();
    assert.equal(response.status, 201);
    const order = await response.json() as { id: string; orderNumber: string; paymentStatus: string; totalFc: number; createdAt: string };
    assert.equal(order.orderNumber, '261026-001');
    assert.equal(order.paymentStatus, 'unpaid');
    assert.equal(order.totalFc, 6000);
    assert.equal(order.createdAt, NOW.toISOString());
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM orders WHERE restaurant_id = ?', ['r-alpha'])?.count, 1);
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?', [order.id])?.count, 1);
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM order_events WHERE order_id = ?', [order.id])?.count, 1);
  });

  it('isole le menu et refuse une commande dont un plat appartient à un autre restaurant', async () => {
    const response = await postOrder({ ...DINE_IN_ORDER, items: [{ menuItemId: 'beta-dish', quantity: 1 }] });
    assert.equal(response.status, 422);
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'ITEM_NOT_FOUND');
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM orders')?.count, 0);
  });

  it('permet de commander dans un restaurant membre et ne révèle jamais la commande à un autre étudiant', async () => {
    const betaOrder = { ...DINE_IN_ORDER, restaurant: 'beta', items: [{ menuItemId: 'beta-dish', quantity: 1 }] };
    const created = await postOrder(betaOrder, 'student-1-token', 'beta-order-0001');
    assert.equal(created.status, 201);
    const id = (await created.json() as { id: string }).id;

    const hidden = await fetch(`${server.base}/api/orders/${id}`, { headers: { authorization: 'Bearer student-2-token' } });
    assert.equal(hidden.status, 404);
    const list = await fetch(`${server.base}/api/orders`, { headers: { authorization: 'Bearer student-2-token' } });
    assert.deepEqual((await list.json() as { items: unknown[] }).items, []);
  });

  it('liste les restaurants du propriétaire, filtre les statuts et renvoie le détail chronologique', async () => {
    const alpha = await postOrder(DINE_IN_ORDER, 'student-1-token', 'alpha-order-001');
    const beta = await postOrder({ ...DINE_IN_ORDER, restaurant: 'beta', items: [{ menuItemId: 'beta-dish', quantity: 1 }] }, 'student-1-token', 'beta-order-001');
    const alphaId = (await alpha.json() as { id: string }).id;
    assert.equal(beta.status, 201);
    database.run('UPDATE orders SET comment = ?, rating = ? WHERE id = ? AND restaurant_id = ?',
      ['Très bon repas.', 5, alphaId, 'r-alpha']);

    const list = await fetch(`${server.base}/api/orders?page=1&pageSize=1&status=pending`, { headers: { authorization: 'Bearer student-1-token' } });
    const page = await list.json() as { total: number; items: Array<{ id: string; restaurant: { slug: string }; events?: unknown }> };
    assert.equal(list.status, 200);
    assert.equal(page.total, 2);
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.events, undefined);

    const detailResponse = await fetch(`${server.base}/api/orders/${alphaId}`, { headers: { authorization: 'Bearer student-1-token' } });
    const detail = await detailResponse.json() as { events: Array<{ status: string; at: string }>; comment: string | null; rating: number | null };
    assert.equal(detailResponse.status, 200);
    assert.deepEqual(detail.events.map((event) => event.status), ['pending']);
    assert.ok(detail.events.every((event) => event.at.endsWith('Z')));
    assert.equal(detail.comment, 'Très bon repas.');
    assert.equal(detail.rating, 5);
  });

  it('rejoue la clé idempotente sans doubler la commande et garde le paiement simulé unpaid', async () => {
    const first = await postOrder();
    const firstOrder = await first.json();
    const replay = await postOrder();
    assert.equal(first.status, 201);
    assert.equal(replay.status, 200);
    assert.equal(replay.headers.get('Idempotent-Replayed'), 'true');
    assert.deepEqual(await replay.json(), firstOrder);
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM orders WHERE restaurant_id = ?', ['r-alpha'])?.count, 1);
    assert.equal(database.get<{ status: string }>('SELECT payment_status AS status FROM orders WHERE restaurant_id = ?', ['r-alpha'])?.status, 'unpaid');
  });

  it('alloue des numéros distincts si deux commandes arrivent en même temps', async () => {
    const responses = await Promise.all([
      postOrder(DINE_IN_ORDER, 'student-1-token', 'concurrent-order-01'),
      postOrder(DINE_IN_ORDER, 'student-2-token', 'concurrent-order-02'),
    ]);
    assert.deepEqual(responses.map((response) => response.status), [201, 201]);
    const numbers = await Promise.all(responses.map(async (response) => (await response.json() as { orderNumber: string }).orderNumber));
    assert.deepEqual(new Set(numbers), new Set(['261026-001', '261026-002']));
  });

  it('refuse la même clé avec un autre contenu sans créer une seconde commande', async () => {
    assert.equal((await postOrder()).status, 201);
    const replay = await postOrder({ ...DINE_IN_ORDER, note: 'Avec piment.' });
    assert.equal(replay.status, 409);
    assert.equal((await replay.json() as { error: { code: string } }).error.code, 'IDEMPOTENCY_KEY_REUSED');
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM orders WHERE restaurant_id = ?', ['r-alpha'])?.count, 1);
  });

  it('isole les clés idempotentes entre étudiants et les commandes entre restaurants', async () => {
    assert.equal((await postOrder(DINE_IN_ORDER, 'student-1-token', 'shared-key-01')).status, 201);
    assert.equal((await postOrder(DINE_IN_ORDER, 'student-2-token', 'shared-key-01')).status, 201);
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM orders WHERE restaurant_id = ?', ['r-alpha'])?.count, 2);
  });

  it('débite les points du restaurant choisi et les restitue en cas d’annulation', async () => {
    const body = { ...DINE_IN_ORDER, redeemMeal: true };
    const created = await postOrder(body, 'student-1-token', 'redeem-order-001');
    assert.equal(created.status, 201);
    const order = await created.json() as { id: string; discountFc: number; pointsRedeemed: number };
    assert.equal(order.discountFc, 3000);
    assert.equal(order.pointsRedeemed, 15);
    const afterDebit = database.get<{ points: number }>(`SELECT COALESCE(SUM(remaining), 0) AS points FROM points_ledger
      WHERE user_id = ? AND restaurant_id = ? AND points > 0 AND (expires_at IS NULL OR expires_at > ?)`, ['student-1', 'r-alpha', NOW.toISOString()]);
    assert.equal(afterDebit?.points, 0);

    const cancelled = await fetch(`${server.base}/api/orders/${order.id}/cancel`, {
      method: 'POST', headers: { authorization: 'Bearer student-1-token' },
    });
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json() as { status: string }).status, 'cancelled');
    assert.equal(await new SqliteOrdersRepository(database).getAvailablePoints('student-1', 'r-alpha', NOW.toISOString()), 15);
  });

  it('calcule le même solde malgré des points expirés et un ajustement négatif', async () => {
    database.run("DELETE FROM points_ledger WHERE id = 'alpha-points'");
    database.run(`INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, remaining, expires_at, created_at) VALUES
      ('valid-points', 'r-alpha', 'student-1', 'earn', 20, 20, '2027-10-26T00:00:00.000Z', ?),
      ('expired-points', 'r-alpha', 'student-1', 'earn', 100, 100, '2026-10-26T07:59:59.999Z', ?),
      ('negative-adjustment', 'r-alpha', 'student-1', 'adjust', -5, 0, NULL, ?)`,
    [NOW.toISOString(), NOW.toISOString(), NOW.toISOString()]);

    const repository = new SqliteOrdersRepository(database);
    assert.equal(await repository.getAvailablePoints('student-1', 'r-alpha', NOW.toISOString()), 15);

    const response = await postOrder({ ...DINE_IN_ORDER, redeemMeal: true }, 'student-1-token', 'points-balance-01');
    assert.equal(response.status, 201);
    assert.equal((await response.json() as { pointsRedeemed: number }).pointsRedeemed, 15);
  });

  it('refuse un restaurant sans adhésion et permet mobile money sans simuler un paiement réussi', async () => {
    const betaOrder = { ...DINE_IN_ORDER, restaurant: 'beta', paymentMethod: 'mobile_money', items: [{ menuItemId: 'beta-dish', quantity: 1 }] };
    const rejected = await postOrder(betaOrder, 'student-2-token', 'no-membership-001');
    assert.equal(rejected.status, 403);
    assert.equal((await rejected.json() as { error: { code: string } }).error.code, 'FORBIDDEN');

    const accepted = await postOrder(betaOrder, 'student-1-token', 'mobile-money-01');
    assert.equal(accepted.status, 201);
    assert.equal((await accepted.json() as { paymentStatus: string }).paymentStatus, 'unpaid');
  });
});
