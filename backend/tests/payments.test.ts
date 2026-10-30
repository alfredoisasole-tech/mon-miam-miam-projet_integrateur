import { createHmac, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { SimulatedPaymentProvider } from '../src/domain/payments.ts';
import { SqliteOrdersRepository } from '../src/repositories/sqlite-orders.repo.ts';
import { demarrer, type Serveur } from './helpers.ts';

const WEBHOOK_SECRET = randomBytes(32).toString('hex');
const NOW = new Date('2026-10-26T08:00:00.000Z');
const OPENING_HOURS = JSON.stringify(Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '00:00', close: '23:59' }]]),
));
const PHONE = '+243812345678';
const PAYMENT_REQUEST = { operator: 'mpesa', phone: PHONE };
const DINE_IN_ORDER = {
  restaurant: 'alpha',
  type: 'dine_in',
  paymentMethod: 'mobile_money',
  items: [{ menuItemId: 'alpha-dish', quantity: 2 }],
  redeemMeal: false,
};

let database: Database;
let server: Serveur;
let orderCounter = 0;

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
}

beforeEach(async () => {
  orderCounter = 0;
  database = new Database(':memory:');
  migrate(database);
  seedDatabase(database);
  const users = new Map<string, AuthenticatedUser>([
    ['student-1-token', { id: 'student-1', role: 'student' }],
    ['student-2-token', { id: 'student-2', role: 'student' }],
    ['employee-token', { id: 'employee-1', role: 'employee' }],
  ]);
  server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET }), {
    database,
    now: () => new Date(NOW),
    resolveToken: (token) => users.get(token) ?? null,
  }));
});

afterEach(async () => {
  await server.fermer();
  database.close();
});

async function createOrder(
  paymentMethod: 'cash' | 'mobile_money' = 'mobile_money',
  restaurant: 'alpha' | 'beta' = 'alpha',
  token = 'student-1-token',
): Promise<{ id: string; response: Response }> {
  orderCounter += 1;
  const body = {
    ...DINE_IN_ORDER,
    restaurant,
    paymentMethod,
    items: [{ menuItemId: restaurant === 'alpha' ? 'alpha-dish' : 'beta-dish', quantity: 1 }],
  };
  const response = await fetch(`${server.base}/api/orders`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'Idempotency-Key': `payment-order-${orderCounter}` },
    body: JSON.stringify(body),
  });
  const order = await response.json() as { id: string };
  return { id: order.id, response };
}

async function startPayment(orderId: string, body: unknown = PAYMENT_REQUEST, token = 'student-1-token'): Promise<Response> {
  return fetch(`${server.base}/api/orders/${orderId}/pay`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeWebhookBody(paymentId: string, status: 'paid' | 'failed'): string {
  return JSON.stringify({ paymentId, status, providerRef: `simulation-${paymentId}` });
}

function signBody(rawBody: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

async function sendWebhook(paymentId: string, status: 'paid' | 'failed', rawBody = makeWebhookBody(paymentId, status), signature = signBody(rawBody)): Promise<Response> {
  return fetch(`${server.base}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Payment-Signature': signature },
    body: rawBody,
  });
}

describe('Paiements mobiles simulés — APP-75', () => {
  it('démarre un paiement de la commande du propriétaire et enregistre les montants en FC', async () => {
    const created = await createOrder();
    assert.equal(created.response.status, 201);
    const payment = await startPayment(created.id);
    const result = await payment.json() as { paymentId: string; status: string; amountFc: number; redirectUrl: string };

    assert.equal(payment.status, 201);
    assert.equal(result.status, 'pending');
    assert.equal(result.amountFc, 3000);
    assert.match(result.paymentId, /^pay_/);
    assert.equal(result.redirectUrl, `/paiement/simulation/${encodeURIComponent(result.paymentId)}`);
    assert.equal(database.get<{ status: string }>('SELECT payment_status AS status FROM orders WHERE id = ? AND restaurant_id = ?', [created.id, 'r-alpha'])?.status, 'pending');
    assert.deepEqual({ ...database.get<{ restaurant_id: string; order_id: string; operator: string; phone: string; amount_fc: number; status: string }>(
      'SELECT restaurant_id, order_id, operator, phone, amount_fc, status FROM payments WHERE id = ?', [result.paymentId],
    ) }, { restaurant_id: 'r-alpha', order_id: created.id, operator: 'mpesa', phone: PHONE, amount_fc: 3000, status: 'pending' });
  });

  it('réutilise le paiement pending identique sans créer une seconde ligne', async () => {
    const order = await createOrder();
    const first = await startPayment(order.id);
    const firstPayment = await first.json() as { paymentId: string; redirectUrl: string };
    const replay = await startPayment(order.id);
    const replayPayment = await replay.json() as { paymentId: string; redirectUrl: string };

    assert.equal(first.status, 201);
    assert.equal(replay.status, 200);
    assert.deepEqual(replayPayment, firstPayment);
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM payments WHERE order_id = ? AND restaurant_id = ?', [order.id, 'r-alpha'])?.count, 1);
  });

  it('refuse des coordonnées invalides, une commande en espèces ou un rôle interdit', async () => {
    const mobileOrder = await createOrder();
    const cashOrder = await createOrder('cash');

    const invalid = await startPayment(mobileOrder.id, { operator: 'bank', phone: 'telephone' });
    const cash = await startPayment(cashOrder.id);
    const forbidden = await startPayment(mobileOrder.id, PAYMENT_REQUEST, 'employee-token');

    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json() as { error: { code: string } }).error.code, 'VALIDATION_ERROR');
    assert.equal(cash.status, 409);
    assert.equal((await cash.json() as { error: { code: string } }).error.code, 'ORDER_NOT_PAYABLE');
    assert.equal(forbidden.status, 403);
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM payments')?.count, 0);
  });

  it('masque une commande appartenant à un autre étudiant', async () => {
    const order = await createOrder();
    const response = await startPayment(order.id, PAYMENT_REQUEST, 'student-2-token');
    assert.equal(response.status, 404);
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'NOT_FOUND');
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM payments')?.count, 0);
  });

  it('exige un jeton étudiant valide pour démarrer un paiement', async () => {
    const order = await createOrder();
    const missing = await fetch(`${server.base}/api/orders/${order.id}/pay`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(PAYMENT_REQUEST),
    });
    const invalid = await startPayment(order.id, PAYMENT_REQUEST, 'unknown-token');

    assert.equal(missing.status, 401);
    assert.equal(invalid.status, 401);
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM payments')?.count, 0);
  });

  it('refuse le démarrage si la commande n’est plus en attente et non payée', async () => {
    const order = await createOrder();
    database.run("UPDATE orders SET status = 'confirmed' WHERE id = ? AND restaurant_id = ?", [order.id, 'r-alpha']);
    const response = await startPayment(order.id);
    assert.equal(response.status, 409);
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'ORDER_NOT_PAYABLE');
    assert.equal(database.get<{ count: number }>('SELECT COUNT(*) AS count FROM payments')?.count, 0);
  });

  it('refuse une signature absente ou invalide', async () => {
    const missing = await fetch(`${server.base}/api/payments/webhook`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: makeWebhookBody('unknown-payment', 'paid'),
    });
    const invalid = await sendWebhook('unknown-payment', 'paid', undefined, '0'.repeat(64));

    assert.equal(missing.status, 401);
    assert.equal((await missing.json() as { error: { code: string } }).error.code, 'INVALID_SIGNATURE');
    assert.equal(invalid.status, 401);
    assert.equal((await invalid.json() as { error: { code: string } }).error.code, 'INVALID_SIGNATURE');
  });

  it('vérifie la signature sur les octets bruts du corps', async () => {
    const order = await createOrder();
    const started = await startPayment(order.id);
    const { paymentId } = await started.json() as { paymentId: string };
    const signedBody = makeWebhookBody(paymentId, 'paid');
    const changedBody = ` ${signedBody}`;
    const response = await sendWebhook(paymentId, 'paid', changedBody, signBody(signedBody));

    assert.equal(response.status, 401);
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'INVALID_SIGNATURE');
    assert.equal(database.get<{ status: string }>('SELECT payment_status AS status FROM orders WHERE id = ? AND restaurant_id = ?', [order.id, 'r-alpha'])?.status, 'pending');
  });

  it('confirme la commande après notification valide et rend le rejeu idempotent', async () => {
    const order = await createOrder();
    const started = await startPayment(order.id);
    const { paymentId } = await started.json() as { paymentId: string };

    const first = await sendWebhook(paymentId, 'paid');
    const replay = await sendWebhook(paymentId, 'paid');
    const details = await new SqliteOrdersRepository(database).findOrderForUser(order.id, 'student-1');

    assert.equal(first.status, 200);
    assert.equal(replay.status, 200);
    assert.equal(database.get<{ status: string; provider_ref: string }>('SELECT status, provider_ref FROM payments WHERE id = ? AND restaurant_id = ?', [paymentId, 'r-alpha'])?.status, 'paid');
    assert.equal(database.get<{ status: string; payment_status: string }>('SELECT status, payment_status FROM orders WHERE id = ? AND restaurant_id = ?', [order.id, 'r-alpha'])?.status, 'confirmed');
    assert.equal(database.get<{ count: number }>("SELECT COUNT(*) AS count FROM order_events WHERE order_id = ? AND status = 'confirmed'", [order.id])?.count, 1);
    assert.equal(details?.status, 'confirmed');
    assert.equal(details?.paymentStatus, 'paid');
    assert.deepEqual(details?.events.map((event) => event.status), ['pending', 'confirmed']);
  });

  it('laisse annuler une commande après un paiement échoué', async () => {
    const order = await createOrder();
    const started = await startPayment(order.id);
    const { paymentId } = await started.json() as { paymentId: string };
    const webhook = await sendWebhook(paymentId, 'failed');

    const failed = await database.get<{ status: string; order_status: string }>(`SELECT payment_status AS status, status AS order_status
      FROM orders WHERE id = ? AND restaurant_id = ?`, [order.id, 'r-alpha']);
    const cancelled = await fetch(`${server.base}/api/orders/${order.id}/cancel`, {
      method: 'POST', headers: { authorization: 'Bearer student-1-token' },
    });

    assert.equal(webhook.status, 200);
    assert.equal(failed?.status, 'failed');
    assert.equal(failed?.order_status, 'pending');
    assert.equal(database.get<{ status: string }>('SELECT status FROM orders WHERE id = ? AND restaurant_id = ?', [order.id, 'r-alpha'])?.status, 'cancelled');
    assert.equal(cancelled.status, 200);
  });

  it('ne permet pas à l’étudiant d’annuler une commande payée', async () => {
    const order = await createOrder();
    const started = await startPayment(order.id);
    const { paymentId } = await started.json() as { paymentId: string };
    await sendWebhook(paymentId, 'paid');

    const cancelled = await fetch(`${server.base}/api/orders/${order.id}/cancel`, {
      method: 'POST', headers: { authorization: 'Bearer student-1-token' },
    });
    assert.equal(cancelled.status, 409);
    assert.equal((await cancelled.json() as { error: { code: string } }).error.code, 'CANNOT_CANCEL');
    assert.equal(database.get<{ status: string }>('SELECT status FROM orders WHERE id = ? AND restaurant_id = ?', [order.id, 'r-alpha'])?.status, 'confirmed');
  });

  it('isole les paiements de commandes de restaurants différents', async () => {
    const alpha = await createOrder('mobile_money', 'alpha');
    const beta = await createOrder('mobile_money', 'beta');
    const alphaStart = await startPayment(alpha.id);
    const betaStart = await startPayment(beta.id);
    const { paymentId: alphaPaymentId } = await alphaStart.json() as { paymentId: string };
    const { paymentId: betaPaymentId } = await betaStart.json() as { paymentId: string };

    await sendWebhook(betaPaymentId, 'paid');

    assert.equal(database.get<{ payment_status: string }>('SELECT payment_status FROM orders WHERE id = ? AND restaurant_id = ?', [alpha.id, 'r-alpha'])?.payment_status, 'pending');
    assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ? AND restaurant_id = ?', [alphaPaymentId, 'r-alpha'])?.status, 'pending');
    assert.equal(database.get<{ payment_status: string }>('SELECT payment_status FROM orders WHERE id = ? AND restaurant_id = ?', [beta.id, 'r-beta'])?.payment_status, 'paid');
    assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ? AND restaurant_id = ?', [betaPaymentId, 'r-beta'])?.status, 'paid');
  });

  it('refuse une confirmation contradictoire après la finalisation', async () => {
    const order = await createOrder();
    const started = await startPayment(order.id);
    const { paymentId } = await started.json() as { paymentId: string };
    await sendWebhook(paymentId, 'paid');
    const conflicting = await sendWebhook(paymentId, 'failed');

    assert.equal(conflicting.status, 409);
    assert.equal((await conflicting.json() as { error: { code: string } }).error.code, 'PAYMENT_ALREADY_FINALIZED');
    assert.equal(database.get<{ count: number }>("SELECT COUNT(*) AS count FROM order_events WHERE order_id = ? AND status = 'confirmed'", [order.id])?.count, 1);
  });

  it('génère un chemin de simulation sans exposer de signature', async () => {
    const provider = new SimulatedPaymentProvider(WEBHOOK_SECRET);
    const result = await provider.startPayment({
      paymentId: 'pay_test-id', orderId: 'ord_test-id', amountFc: 3000, operator: 'mpesa', phone: PHONE,
    });
    assert.equal(result.redirectUrl, '/paiement/simulation/pay_test-id');
    assert.equal(JSON.stringify(result).includes(WEBHOOK_SECRET), false);
  });
});
