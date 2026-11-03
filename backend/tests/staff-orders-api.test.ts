import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-10-26T08:00:00.000Z');
const OPENING_HOURS = JSON.stringify(Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '00:00', close: '23:59' }]]),
));
const USERS = new Map<string, AuthenticatedUser>([
  ['student-token', { id: 'student', role: 'student' }],
  ['alpha-staff-token', { id: 'alpha-staff', role: 'employee', restaurantId: 'restaurant-alpha' }],
  ['beta-staff-token', { id: 'beta-staff', role: 'employee', restaurantId: 'restaurant-beta' }],
]);

describe('API du personnel pour les commandes', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('restaurant-alpha', 'alpha', 'Alpha', 'Arial', ?),
      ('restaurant-beta', 'beta', 'Beta', 'Arial', ?)`, [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
      ('restaurant-alpha', ?, ?), ('restaurant-beta', ?, ?)`,
    [OPENING_HOURS, NOW.toISOString(), OPENING_HOURS, NOW.toISOString()]);
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES
      ('student', 'restaurant-alpha', 'student', 'Étudiant', 'student@example.test', '+243820000001', 'hash', ?),
      ('alpha-staff', 'restaurant-alpha', 'employee', 'Employé Alpha', 'alpha@example.test', '+243820000002', 'hash', ?),
      ('beta-staff', 'restaurant-beta', 'employee', 'Employé Beta', 'beta@example.test', '+243820000003', 'hash', ?)`,
    [NOW.toISOString(), NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, referral_code, created_at) VALUES
      ('referrer', 'restaurant-beta', 'student', 'Parrain', 'referrer@example.test', '+243820000004', 'hash', 'REFERRAL-1', ?)`,
    [NOW.toISOString()]);
    db.run(`UPDATE users SET referred_by = 'referrer' WHERE id = 'student'`);
    db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES
      ('student', 'restaurant-alpha', ?), ('student', 'restaurant-beta', ?)`,
    [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at) VALUES
      ('alpha-dish', 'restaurant-alpha', 'Plat Alpha', 3000, 'plat', ?, ?),
      ('beta-dish', 'restaurant-beta', 'Plat Beta', 3000, 'plat', ?, ?)`,
    [NOW.toISOString(), NOW.toISOString(), NOW.toISOString(), NOW.toISOString()]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db,
      now: () => new Date(NOW),
      resolveToken: (token) => USERS.get(token) ?? null,
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  async function createOrder(paymentMethod = 'cash', key = 'staff-order-key-01'): Promise<{ id: string }> {
    const response = await fetch(`${server.base}/api/orders`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer student-token',
        'content-type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        restaurant: 'alpha',
        type: 'dine_in',
        paymentMethod,
        items: [{ menuItemId: 'alpha-dish', quantity: 2 }],
      }),
    });
    assert.equal(response.status, 201);
    return response.json() as Promise<{ id: string }>;
  }

  async function updateStatus(token: string, id: string, status: string): Promise<Response> {
    return fetch(`${server.base}/api/staff/orders/${id}/status`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  it('isole la liste et les transitions au restaurant du compte, sans exposer la clé idempotente', async () => {
    const order = await createOrder();
    const alphaList = await fetch(`${server.base}/api/staff/orders?restaurant=beta&restaurantId=restaurant-beta`, {
      headers: { authorization: 'Bearer alpha-staff-token' },
    });
    const betaList = await fetch(`${server.base}/api/staff/orders`, {
      headers: { authorization: 'Bearer beta-staff-token' },
    });
    const items = (await alphaList.json() as { items: Array<Record<string, unknown>> }).items;
    assert.equal(alphaList.status, 200);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.['idempotencyKey'], undefined);
    assert.equal(items[0]?.['restaurantId'], undefined);
    assert.deepEqual((await betaList.json() as { items: unknown[] }).items, []);

    const crossRestaurant = await updateStatus('beta-staff-token', order.id, 'confirmed');
    assert.equal(crossRestaurant.status, 404);
    const confirmed = await updateStatus('alpha-staff-token', order.id, 'confirmed');
    assert.equal(confirmed.status, 200);
  });

  it('crédite les points une seule fois après la fin et confirme le paiement en espèces', async () => {
    const order = await createOrder('cash', 'staff-order-loyalty-01');
    for (const status of ['confirmed', 'preparing', 'ready']) {
      assert.equal((await updateStatus('alpha-staff-token', order.id, status)).status, 200);
    }
    const completed = await updateStatus('alpha-staff-token', order.id, 'completed');
    assert.equal(completed.status, 200);
    const result = await completed.json() as { pointsEarned: number; paymentStatus: string };
    assert.equal(result.pointsEarned, 2);
    assert.equal(result.paymentStatus, 'paid');
    assert.equal(db.get<{ points: number }>(`
      SELECT points FROM points_ledger WHERE order_id = ? AND kind = 'earn'
    `, [order.id])?.points, 2);
    assert.equal(db.get<{ points: number }>(`
      SELECT points FROM points_ledger WHERE order_id = ? AND kind = 'referral'
    `, [order.id])?.points, 2);
    assert.equal(db.get<{ total: number }>(`
      SELECT COUNT(*) AS total FROM referrals WHERE referee_id = 'student' AND rewarded_order_id = ?
    `, [order.id])?.total, 1);
    assert.equal(db.get<{ total: number }>(`
      SELECT COUNT(*) AS total FROM memberships WHERE user_id = 'referrer' AND restaurant_id = 'restaurant-alpha'
    `)?.total, 1);
    assert.equal((await updateStatus('alpha-staff-token', order.id, 'completed')).status, 409);
  });

  it('bloque la remise mobile sans paiement confirmé et marque le remboursement dû en cas d’annulation payée', async () => {
    const completionOrder = await createOrder('mobile_money', 'staff-mobile-complete-1');
    for (const status of ['confirmed', 'preparing', 'ready']) {
      assert.equal((await updateStatus('alpha-staff-token', completionOrder.id, status)).status, 200);
    }
    const unpaidCompletion = await updateStatus('alpha-staff-token', completionOrder.id, 'completed');
    assert.equal(unpaidCompletion.status, 422);

    const cancelledOrder = await createOrder('mobile_money', 'staff-mobile-cancel-01');
    db.run('UPDATE orders SET payment_status = ? WHERE id = ?', ['paid', cancelledOrder.id]);
    const cancelled = await updateStatus('alpha-staff-token', cancelledOrder.id, 'cancelled');
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json() as { paymentStatus: string }).paymentStatus, 'refund_due');
  });
});
