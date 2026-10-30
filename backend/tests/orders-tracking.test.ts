import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createAuthMiddleware } from '../src/http/auth.ts';
import { registerOrderRoutes } from '../src/controllers/orders.controller.ts';
import { OrdersService } from '../src/services/orders.service.ts';
import { MemoryOrdersRepository } from '../src/repositories/memory-orders.repo.ts';
import type { AuthenticatedUser, Order, OpeningHours } from '../src/domain/orders.ts';
import { demarrer as startServer, type Serveur as Server } from './helpers.ts';

const NOW = new Date('2026-10-26T08:00:00.000Z');

function createOrder(overrides: Partial<Order> & Pick<Order, 'id' | 'userId' | 'restaurantId' | 'createdAt'>): Order {
  const { id, userId, restaurantId, createdAt, ...changes } = overrides;
  const date = createdAt;
  return {
    id,
    userId,
    restaurantId,
    idempotencyKey: `key-${id}`,
    orderNumber: '261026-001',
    restaurant: { slug: overrides.restaurantId, name: overrides.restaurantId },
    type: 'dine_in',
    status: 'pending',
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    items: [{ menuItemId: 'dish-1', name: 'Plat 1', category: 'plat', unitPriceFc: 3000, quantity: 1, lineTotalFc: 3000 }],
    subtotalFc: 3000,
    discountFc: 0,
    deliveryFeeFc: 0,
    totalFc: 3000,
    pointsRedeemed: 0,
    pointsEarned: 0,
    arrivalTime: null,
    delivery: null,
    note: null,
    comment: null,
    rating: null,
    events: [{ status: 'pending', at: date }],
    createdAt: date,
    updatedAt: date,
    completedAt: null,
    cancelledAt: null,
    ...changes,
  };
}

function createRepository(): MemoryOrdersRepository {
  const openingHours: OpeningHours = Object.fromEntries(
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '00:00', close: '23:59' }]]),
  );
  const repository = new MemoryOrdersRepository({
    students: [
      { id: 'student-1', restaurantId: 'restaurant-1', phone: '+243820000001', loyaltyRemainderFc: 0 },
      { id: 'student-2', restaurantId: 'restaurant-1', phone: '+243820000002', loyaltyRemainderFc: 0 },
    ],
    restaurants: ['restaurant-1', 'restaurant-2'].map((id) => ({
      id,
      slug: id,
      name: id,
      status: 'active' as const,
      settings: {
        deliveryEnabled: true,
        deliveryFeeFc: 1000,
        deliveryCommunes: ['Limete'],
        mobileMoneyEnabled: true,
        spendPerPointFc: 3000,
        pointsPerMeal: 15,
        freeMealCapFc: 3000,
        openingHours,
      },
    })),
    menuItems: [],
    balances: [
      { userId: 'student-1', restaurantId: 'restaurant-1', availablePoints: 0 },
      { userId: 'student-1', restaurantId: 'restaurant-2', availablePoints: 0 },
      { userId: 'student-2', restaurantId: 'restaurant-1', availablePoints: 0 },
    ],
  });
  repository.orders.push(
    createOrder({ id: 'order-pending', userId: 'student-1', restaurantId: 'restaurant-1', createdAt: '2026-10-26T08:00:00.000Z', pointsRedeemed: 15 }),
    createOrder({
      id: 'order-preparing', userId: 'student-1', restaurantId: 'restaurant-2', createdAt: '2026-10-26T09:00:00.000Z',
      status: 'preparing', paymentMethod: 'mobile_money',
      events: [
        { status: 'preparing', at: '2026-10-26T09:05:00.000Z' },
        { status: 'pending', at: '2026-10-26T09:00:00.000Z' },
        { status: 'confirmed', at: '2026-10-26T09:02:00.000Z' },
      ],
    }),
    createOrder({ id: 'order-completed', userId: 'student-1', restaurantId: 'restaurant-1', createdAt: '2026-10-26T07:00:00.000Z', status: 'completed', paymentStatus: 'paid' }),
    createOrder({ id: 'order-mobile-pending', userId: 'student-1', restaurantId: 'restaurant-1', createdAt: '2026-10-26T10:00:00.000Z', paymentMethod: 'mobile_money', paymentStatus: 'pending' }),
    createOrder({ id: 'order-failed', userId: 'student-1', restaurantId: 'restaurant-2', createdAt: '2026-10-26T11:00:00.000Z', paymentStatus: 'failed' }),
    createOrder({ id: 'another-student-order', userId: 'student-2', restaurantId: 'restaurant-1', createdAt: '2026-10-26T12:00:00.000Z' }),
  );
  return repository;
}

function createTestAuthMiddleware(): ReturnType<typeof createAuthMiddleware> {
  const users = new Map<string, AuthenticatedUser>([
    ['student-token', { id: 'student-1', role: 'student' }],
    ['second-student-token', { id: 'student-2', role: 'student' }],
    ['employee-token', { id: 'employee-1', role: 'employee' }],
  ]);
  return createAuthMiddleware((token) => users.get(token) ?? null);
}

let server: Server;
let repository: MemoryOrdersRepository;

beforeEach(async () => {
  repository = createRepository();
  const service = new OrdersService(repository, { now: () => new Date(NOW) });
  const authenticate = createTestAuthMiddleware();
  const app = createApp(loadConfig({ NODE_ENV: 'test' }), {
    routes: (application) => registerOrderRoutes(application, { service, authenticate }),
  });
  server = await startServer(app);
});

afterEach(async () => server.fermer());

async function request(path: string, token: string | null = 'student-token', method = 'GET'): Promise<Response> {
  const headers = new Headers();
  if (token !== null) headers.set('authorization', `Bearer ${token}`);
  return fetch(`${server.base}${path}`, { method, headers });
}

async function expectError(response: Response, status: number, code: string): Promise<void> {
  assert.equal(response.status, status);
  const body = (await response.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, code);
  assert.ok(body.error.message.length > 0);
}

describe('Suivi des commandes — APP-69', () => {
  it('liste les commandes de tous les restaurants du propriétaire sans événements', async () => {
    const response = await request('/api/orders');
    assert.equal(response.status, 200);
    const body = (await response.json()) as { items: Array<Record<string, unknown>>; total: number; page: number; pageSize: number };
    assert.equal(body.total, 5);
    assert.equal(body.page, 1);
    assert.equal(body.pageSize, 20);
    assert.deepEqual(body.items.map((order) => order['id']), ['order-failed', 'order-mobile-pending', 'order-preparing', 'order-pending', 'order-completed']);
    assert.deepEqual(new Set(body.items.map((order) => (order['restaurant'] as { slug: string }).slug)), new Set(['restaurant-1', 'restaurant-2']));
    assert.ok(body.items.every((order) => !('events' in order)));
    assert.ok(body.items.every((order) => order['id'] !== 'another-student-order'));
  });

  it('filtre par statut et applique page et pageSize', async () => {
    const filtered = await request('/api/orders?status=completed');
    const filteredBody = (await filtered.json()) as { items: Array<{ id: string }>; total: number };
    assert.equal(filtered.status, 200);
    assert.equal(filteredBody.total, 1);
    assert.deepEqual(filteredBody.items.map((order) => order.id), ['order-completed']);

    const paged = await request('/api/orders?page=2&pageSize=2');
    const pagedBody = (await paged.json()) as { items: Array<{ id: string }>; total: number; page: number; pageSize: number };
    assert.equal(pagedBody.total, 5);
    assert.equal(pagedBody.page, 2);
    assert.equal(pagedBody.pageSize, 2);
    assert.deepEqual(pagedBody.items.map((order) => order.id), ['order-preparing', 'order-pending']);
  });

  it('refuse les paramètres de pagination et de statut invalides', async () => {
    await expectError(await request('/api/orders?page=0'), 400, 'VALIDATION_ERROR');
    await expectError(await request('/api/orders?pageSize=101'), 400, 'VALIDATION_ERROR');
    await expectError(await request('/api/orders?status=unknown'), 400, 'VALIDATION_ERROR');
  });

  it('renvoie le détail du propriétaire avec les événements en ordre chronologique', async () => {
    const response = await request('/api/orders/order-preparing');
    assert.equal(response.status, 200);
    const order = (await response.json()) as { events: Array<{ status: string; at: string }> };
    assert.deepEqual(order.events.map((event) => event.status), ['pending', 'confirmed', 'preparing']);
    assert.ok(order.events.every((event) => !Number.isNaN(Date.parse(event.at)) && event.at.endsWith('Z')));
  });

  it('répond 404 pour une commande inconnue ou appartenant à un autre étudiant', async () => {
    await expectError(await request('/api/orders/missing'), 404, 'NOT_FOUND');
    await expectError(await request('/api/orders/another-student-order'), 404, 'NOT_FOUND');
  });

  it('annule une commande pending non payée et restitue les points', async () => {
    const response = await request('/api/orders/order-pending/cancel', 'student-token', 'POST');
    assert.equal(response.status, 200);
    const order = (await response.json()) as { status: string; pointsEarned: number; events: Array<{ status: string; at: string }>; cancelledAt: string };
    assert.equal(order.status, 'cancelled');
    assert.equal(order.pointsEarned, 0);
    assert.equal(order.cancelledAt, NOW.toISOString());
    assert.equal(order.events.at(-1)?.status, 'cancelled');
    assert.equal(await repository.getAvailablePoints('student-1', 'restaurant-1', NOW.toISOString()), 15);
    await expectError(await request('/api/orders/order-pending/cancel', 'student-token', 'POST'), 409, 'CANNOT_CANCEL');
    assert.equal(await repository.getAvailablePoints('student-1', 'restaurant-1', NOW.toISOString()), 15);
  });

  it('autorise l’annulation lorsque le paiement est failed', async () => {
    const response = await request('/api/orders/order-failed/cancel', 'student-token', 'POST');
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { status: string }).status, 'cancelled');
  });

  it('refuse une commande déjà préparée ou dont le paiement est en attente', async () => {
    await expectError(await request('/api/orders/order-preparing/cancel', 'student-token', 'POST'), 409, 'CANNOT_CANCEL');
    await expectError(await request('/api/orders/order-mobile-pending/cancel', 'student-token', 'POST'), 409, 'CANNOT_CANCEL');
  });

  it('masque les commandes des autres étudiants et refuse les rôles non étudiants', async () => {
    await expectError(await request('/api/orders/another-student-order/cancel', 'student-token', 'POST'), 404, 'NOT_FOUND');
    await expectError(await request('/api/orders', null), 401, 'UNAUTHORIZED');
    await expectError(await request('/api/orders', 'employee-token'), 403, 'FORBIDDEN');
  });
});
