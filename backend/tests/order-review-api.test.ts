import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-11-04T10:00:00.000Z');
const TOKENS = new Map<string, AuthenticatedUser>([
  ['student-a', { id: 'student-a', role: 'student', restaurantId: 'restaurant-a', status: 'active' }],
  ['student-b', { id: 'student-b', role: 'student', restaurantId: 'restaurant-b', status: 'active' }],
  ['employee-a', { id: 'employee-a', role: 'employee', restaurantId: 'restaurant-a', status: 'active' }],
]);

describe('[MM-AVIS] Commentaire après livraison', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    const at = NOW.toISOString();
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('restaurant-a', 'avis-a', 'Restaurant A', 'Arial', ?), ('restaurant-b', 'avis-b', 'Restaurant B', 'Arial', ?)`, [at, at]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
      ('restaurant-a', '{}', ?), ('restaurant-b', '{}', ?)`, [at, at]);
    for (const [id, restaurant, role, phone] of [['student-a', 'restaurant-a', 'student', '+243810000301'],
      ['student-b', 'restaurant-b', 'student', '+243810000302'], ['employee-a', 'restaurant-a', 'employee', '+243810000303']]) {
      db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'x', ?)`, [id, restaurant, role, id, `${id}@example.test`, phone, at]);
    }
    db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES ('student-a', 'restaurant-a', ?), ('student-b', 'restaurant-b', ?)`, [at, at]);
    const orders: Array<[string, string, string, string, string]> = [
      ['done-a', 'student-a', 'restaurant-a', 'completed', '261104-001'],
      ['done-b', 'student-b', 'restaurant-b', 'completed', '261104-001'],
      ['waiting-a', 'student-a', 'restaurant-a', 'preparing', '261104-002'],
      ['cancelled-a', 'student-a', 'restaurant-a', 'cancelled', '261104-003'],
      ['done-a-two', 'student-a', 'restaurant-a', 'completed', '261104-004'],
    ];
    for (const [id, user, restaurant, status, number] of orders) {
      db.run(`INSERT INTO orders (id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
        subtotal_fc, discount_fc, delivery_fee_fc, total_fc, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'dine_in', ?, 'cash', 'paid', 3000, 0, 0, 3000, ?, ?)`, [id, restaurant, user, number, status, at, at]);
    }
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db, now: () => new Date(NOW), resolveToken: (token) => TOKENS.get(token) ?? null,
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  const headers = (token?: string): HeadersInit => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' });
  const review = (orderId: string, token: string | undefined, body: unknown) =>
    fetch(`${server.base}/api/orders/${orderId}/review`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });

  it('enregistre la note et le commentaire d’une commande terminée, une seule fois', async () => {
    const response = await review('done-a', 'student-a', { rating: 5, comment: '  Très bon, merci !  ' });
    assert.equal(response.status, 201);
    const body = await response.json() as { orderId: string; rating: number; comment: string; commentedAt: string };
    assert.deepEqual({ orderId: body.orderId, rating: body.rating, comment: body.comment, commentedAt: body.commentedAt },
      { orderId: 'done-a', rating: 5, comment: 'Très bon, merci !', commentedAt: NOW.toISOString() });
    assert.deepEqual(db.get('SELECT rating, comment FROM orders WHERE id = ?', ['done-a']), { rating: 5, comment: 'Très bon, merci !' });

    const again = await review('done-a', 'student-a', { rating: 1, comment: 'Changement d’avis' });
    assert.equal(again.status, 409);
    assert.equal(((await again.json()) as { error: { code: string } }).error.code, 'ALREADY_REVIEWED');
    assert.equal(db.get<{ rating: number }>('SELECT rating FROM orders WHERE id = ?', ['done-a'])?.rating, 5);

    const detail = await fetch(`${server.base}/api/orders/done-a`, { headers: headers('student-a') });
    const order = await detail.json() as { rating: number | null; comment: string | null };
    assert.equal(order.rating, 5);
    assert.equal(order.comment, 'Très bon, merci !');
  });

  it('accepte une note sans commentaire', async () => {
    const response = await review('done-a-two', 'student-a', { rating: 3 });
    assert.equal(response.status, 201);
    assert.equal(((await response.json()) as { comment: string | null }).comment, null);
  });

  it('refuse les notes invalides, les commandes non terminées et les commandes des autres', async () => {
    for (const rating of [0, 6, 2.5, '5', null]) {
      assert.equal((await review('waiting-a', 'student-a', { rating })).status, 400, `note ${String(rating)}`);
    }
    assert.equal((await review('waiting-a', 'student-a', { rating: 4, comment: 'x'.repeat(501) })).status, 400);
    const notFinished = await review('waiting-a', 'student-a', { rating: 4 });
    assert.equal(notFinished.status, 409);
    assert.equal(((await notFinished.json()) as { error: { code: string } }).error.code, 'ORDER_NOT_COMPLETED');
    assert.equal((await review('cancelled-a', 'student-a', { rating: 4 })).status, 409);
    assert.equal((await review('done-b', 'student-a', { rating: 4 })).status, 404);
    assert.equal((await review('inconnue', 'student-a', { rating: 4 })).status, 404);
    assert.equal((await review('done-b', undefined, { rating: 4 })).status, 401);
    assert.equal((await review('done-b', 'employee-a', { rating: 4 })).status, 403);
    assert.equal(db.get<{ rating: number | null }>('SELECT rating FROM orders WHERE id = ?', ['done-b'])?.rating, null);
  });
});
