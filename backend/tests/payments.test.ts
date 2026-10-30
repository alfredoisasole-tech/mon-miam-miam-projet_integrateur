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
let currentNow = new Date(NOW);

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
  currentNow = new Date(NOW);
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
    now: () => new Date(currentNow),
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

async function simulatePayment(paymentId: string, outcome: 'paid' | 'failed', token = 'student-1-token'): Promise<Response> {
  return fetch(`${server.base}/api/payments/${paymentId}/simulate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ outcome }),
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

  it('permet un nouvel essai après un échec et conserve le paiement échoué', async () => {
    const order = await createOrder();
    const first = await startPayment(order.id);
    const firstId = (await first.json() as { paymentId: string }).paymentId;
    assert.equal((await sendWebhook(firstId, 'failed')).status, 200);

    const retry = await startPayment(order.id);
    const retryResult = await retry.json() as { paymentId: string; status: string };
    const payments = database.all<{ id: string; status: string }>(
      'SELECT id, status FROM payments WHERE order_id = ? AND restaurant_id = ? ORDER BY created_at, id', [order.id, 'r-alpha'],
    );

    assert.equal(retry.status, 201);
    assert.notEqual(retryResult.paymentId, firstId);
    assert.equal(retryResult.status, 'pending');
    assert.deepEqual(payments.map(({ id, status }) => ({ id, status })), [
      { id: firstId, status: 'failed' }, { id: retryResult.paymentId, status: 'pending' },
    ]);
    assert.equal(database.get<{ status: string }>(
      'SELECT payment_status AS status FROM orders WHERE id = ? AND restaurant_id = ?', [order.id, 'r-alpha'],
    )?.status, 'pending');
  });

  it('refuse un nouvel essai après paiement ou annulation', async () => {
    const paidOrder = await createOrder();
    const paidStart = await startPayment(paidOrder.id);
    const paidPaymentId = (await paidStart.json() as { paymentId: string }).paymentId;
    await sendWebhook(paidPaymentId, 'paid');
    const afterPaid = await startPayment(paidOrder.id);

    const cancelledOrder = await createOrder();
    const cancelledStart = await startPayment(cancelledOrder.id);
    const cancelledPaymentId = (await cancelledStart.json() as { paymentId: string }).paymentId;
    await sendWebhook(cancelledPaymentId, 'failed');
    await fetch(`${server.base}/api/orders/${cancelledOrder.id}/cancel`, {
      method: 'POST', headers: { authorization: 'Bearer student-1-token' },
    });
    const afterCancel = await startPayment(cancelledOrder.id);

    assert.equal(afterPaid.status, 409);
    assert.equal(afterCancel.status, 409);
    assert.equal(database.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM payments WHERE order_id = ? AND restaurant_id = ?', [paidOrder.id, 'r-alpha'],
    )?.count, 1);
    assert.equal(database.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM payments WHERE order_id = ? AND restaurant_id = ?', [cancelledOrder.id, 'r-alpha'],
    )?.count, 1);
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

  it('conserve un paiement pending après 14 minutes puis le fait échouer lors d’une tentative après 16 minutes', async () => {
    const order = await createOrder();
    const first = await startPayment(order.id);
    const firstPaymentId = (await first.json() as { paymentId: string }).paymentId;

    currentNow = new Date(NOW.getTime() + 14 * 60 * 1000);
    const atFourteenMinutes = await startPayment(order.id);
    assert.equal(atFourteenMinutes.status, 200);
    assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ?', [firstPaymentId])?.status, 'pending');

    currentNow = new Date(NOW.getTime() + 16 * 60 * 1000);
    const retry = await startPayment(order.id);
    const retryPaymentId = (await retry.json() as { paymentId: string }).paymentId;
    assert.equal(retry.status, 201);
    assert.notEqual(retryPaymentId, firstPaymentId);
    assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ?', [firstPaymentId])?.status, 'failed');
    assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ?', [retryPaymentId])?.status, 'pending');
  });

  it('expire un paiement de 16 minutes au début de l’annulation et autorise ensuite l’annulation', async () => {
    const order = await createOrder();
    const started = await startPayment(order.id);
    const paymentId = (await started.json() as { paymentId: string }).paymentId;
    currentNow = new Date(NOW.getTime() + 16 * 60 * 1000);

    const cancelled = await fetch(`${server.base}/api/orders/${order.id}/cancel`, {
      method: 'POST', headers: { authorization: 'Bearer student-1-token' },
    });

    assert.equal(cancelled.status, 200);
    assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ?', [paymentId])?.status, 'failed');
    const details = database.get<{ status: string; payment_status: string }>(
      'SELECT status, payment_status FROM orders WHERE id = ? AND restaurant_id = ?', [order.id, 'r-alpha'],
    );
    assert.equal(details?.status, 'cancelled');
    assert.equal(details?.payment_status, 'failed');
  });

  it('accepte un paiement tardif si la commande attend encore, puis indique refund_due si elle est annulée', async () => {
    const activeOrder = await createOrder();
    const activeStart = await startPayment(activeOrder.id);
    const activePaymentId = (await activeStart.json() as { paymentId: string }).paymentId;
    currentNow = new Date(NOW.getTime() + 16 * 60 * 1000);
    await startPayment(activeOrder.id);
    const lateActive = await sendWebhook(activePaymentId, 'paid');

    assert.equal(lateActive.status, 200);
    const activeDetails = database.get<{ status: string; payment_status: string }>(
      'SELECT status, payment_status FROM orders WHERE id = ? AND restaurant_id = ?', [activeOrder.id, 'r-alpha'],
    );
    assert.equal(activeDetails?.status, 'confirmed');
    assert.equal(activeDetails?.payment_status, 'paid');
    assert.equal(database.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM payments WHERE order_id = ? AND restaurant_id = ? AND status = 'pending'", [activeOrder.id, 'r-alpha'],
    )?.count, 0);

    currentNow = new Date(NOW);
    const cancelledOrder = await createOrder();
    const cancelledStart = await startPayment(cancelledOrder.id);
    const cancelledPaymentId = (await cancelledStart.json() as { paymentId: string }).paymentId;
    currentNow = new Date(NOW.getTime() + 16 * 60 * 1000);
    const cancelled = await fetch(`${server.base}/api/orders/${cancelledOrder.id}/cancel`, {
      method: 'POST', headers: { authorization: 'Bearer student-1-token' },
    });
    const lateCancelled = await sendWebhook(cancelledPaymentId, 'paid');

    assert.equal(cancelled.status, 200);
    assert.equal(lateCancelled.status, 200);
    const cancelledDetails = database.get<{ status: string; payment_status: string }>(
      'SELECT status, payment_status FROM orders WHERE id = ? AND restaurant_id = ?', [cancelledOrder.id, 'r-alpha'],
    );
    assert.equal(cancelledDetails?.status, 'cancelled');
    assert.equal(cancelledDetails?.payment_status, 'refund_due');
    assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ?', [cancelledPaymentId])?.status, 'paid');
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

  it('simule le paiement pour le propriétaire, de façon idempotente et sans signature', async () => {
    const order = await createOrder();
    const started = await startPayment(order.id);
    const { paymentId } = await started.json() as { paymentId: string };

    const first = await simulatePayment(paymentId, 'paid');
    const replay = await simulatePayment(paymentId, 'paid');

    assert.equal(first.status, 200);
    assert.equal(replay.status, 200);
    assert.equal((await first.json() as { status: string; orderStatus: string }).orderStatus, 'confirmed');
    assert.equal(database.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM order_events WHERE order_id = ? AND status = 'confirmed'", [order.id],
    )?.count, 1);
  });

  it('permet de simuler un échec puis de réessayer le paiement', async () => {
    const order = await createOrder();
    const started = await startPayment(order.id);
    const { paymentId } = await started.json() as { paymentId: string };

    const failed = await simulatePayment(paymentId, 'failed');
    const retry = await startPayment(order.id);

    assert.equal(failed.status, 200);
    assert.equal((await failed.json() as { status: string; orderStatus: string }).status, 'failed');
    assert.equal(retry.status, 201);
    assert.equal(database.get<{ status: string; payment_status: string }>(
      'SELECT status, payment_status FROM orders WHERE id = ? AND restaurant_id = ?', [order.id, 'r-alpha'],
    )?.payment_status, 'pending');
  });

  it('masque un paiement simulé au non-propriétaire', async () => {
    const order = await createOrder();
    const started = await startPayment(order.id);
    const { paymentId } = await started.json() as { paymentId: string };

    const response = await simulatePayment(paymentId, 'paid', 'student-2-token');

    assert.equal(response.status, 404);
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'PAYMENT_NOT_FOUND');
    assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ?', [paymentId])?.status, 'pending');
  });

  it('renvoie 404 en production pour la route de simulation', async () => {
    const order = await createOrder();
    const started = await startPayment(order.id);
    const { paymentId } = await started.json() as { paymentId: string };
    const users = new Map<string, AuthenticatedUser>([['student-1-token', { id: 'student-1', role: 'student' }]]);
    const production = await demarrer(createApp(loadConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'secret-de-production-de-test-avec-plus-de-32-caracteres',
      PAYMENT_WEBHOOK_SECRET: 'secret-webhook-de-test-avec-plus-de-32-caracteres',
    }), { database, resolveToken: (token) => users.get(token) ?? null }));
    try {
      const response = await fetch(`${production.base}/api/payments/${paymentId}/simulate`, {
        method: 'POST', headers: { authorization: 'Bearer student-1-token', 'content-type': 'application/json' },
        body: JSON.stringify({ outcome: 'paid' }),
      });
      assert.equal(response.status, 404);
      assert.equal((await response.json() as { error: { code: string } }).error.code, 'NOT_FOUND');
      assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ?', [paymentId])?.status, 'pending');
    } finally {
      await production.fermer();
    }
  });

  it('isole la simulation entre restaurants', async () => {
    const alpha = await createOrder('mobile_money', 'alpha');
    const beta = await createOrder('mobile_money', 'beta');
    const alphaStart = await startPayment(alpha.id);
    const betaStart = await startPayment(beta.id);
    const { paymentId: alphaPaymentId } = await alphaStart.json() as { paymentId: string };
    const { paymentId: betaPaymentId } = await betaStart.json() as { paymentId: string };

    const simulated = await simulatePayment(betaPaymentId, 'paid');

    assert.equal(simulated.status, 200);
    assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ? AND restaurant_id = ?', [alphaPaymentId, 'r-alpha'])?.status, 'pending');
    assert.equal(database.get<{ payment_status: string }>('SELECT payment_status FROM orders WHERE id = ? AND restaurant_id = ?', [alpha.id, 'r-alpha'])?.payment_status, 'pending');
    assert.equal(database.get<{ status: string }>('SELECT status FROM payments WHERE id = ? AND restaurant_id = ?', [betaPaymentId, 'r-beta'])?.status, 'paid');
    assert.equal(database.get<{ payment_status: string }>('SELECT payment_status FROM orders WHERE id = ? AND restaurant_id = ?', [beta.id, 'r-beta'])?.payment_status, 'paid');
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
