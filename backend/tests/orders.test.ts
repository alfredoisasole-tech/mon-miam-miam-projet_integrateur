import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createAuthMiddleware } from '../src/http/auth.ts';
import { registerOrderRoutes } from '../src/controllers/orders.controller.ts';
import { OrdersService } from '../src/services/orders.service.ts';
import { MemoryOrdersRepository } from '../src/repositories/memory-orders.repo.ts';
import type { AuthenticatedUser, OpeningHours } from '../src/domain/orders.ts';
import { demarrer as startServer, type Serveur as Server } from './helpers.ts';

const NOW = new Date('2026-10-26T08:00:00.000Z');
const ARRIVAL = '2026-10-26T10:00:00.000Z';
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function allDayOpeningHours(): OpeningHours {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, [{ open: '00:00', close: '23:59' }]]));
}

function createMemoryRepository(): MemoryOrdersRepository {
  const restaurants = [
    {
      id: 'restaurant-1',
      slug: 'restaurant-central',
      name: 'Restaurant Central',
      status: 'active' as const,
      settings: {
        deliveryEnabled: true,
        deliveryFeeFc: 2000,
        deliveryCommunes: ['Limete'],
        mobileMoneyEnabled: true,
        spendPerPointFc: 3000,
        pointsPerMeal: 15,
        freeMealCapFc: 3000,
        openingHours: allDayOpeningHours(),
      },
    },
    {
      id: 'restaurant-2',
      slug: 'restaurant-etu',
      name: 'Chez Étu',
      status: 'active' as const,
      settings: {
        deliveryEnabled: true,
        deliveryFeeFc: 1500,
        deliveryCommunes: ['Gombe'],
        mobileMoneyEnabled: true,
        spendPerPointFc: 3000,
        pointsPerMeal: 15,
        freeMealCapFc: 3000,
        openingHours: allDayOpeningHours(),
      },
    },
    {
      id: 'restaurant-closed',
      slug: 'restaurant-ferme',
      name: 'Le Réfectoire',
      status: 'inactive' as const,
      settings: {
        deliveryEnabled: true,
        deliveryFeeFc: 0,
        deliveryCommunes: ['Limete'],
        mobileMoneyEnabled: true,
        spendPerPointFc: 3000,
        pointsPerMeal: 15,
        freeMealCapFc: 3000,
        openingHours: allDayOpeningHours(),
      },
    },
  ];
  const menuItems = Array.from({ length: 32 }, (_unused, index) => ({
    id: `dish-${index + 1}`,
    restaurantId: 'restaurant-1',
    name: `Plat ${index + 1}`,
    category: 'plat',
    priceFc: index === 0 ? 3000 : 1000 + index * 100,
    isAvailable: true,
    deletedAt: null,
  }));
  menuItems.push({
    id: 'dish-etu-1',
    restaurantId: 'restaurant-2',
    name: 'Poulet grillé',
    category: 'plat',
    priceFc: 13000,
    isAvailable: true,
    deletedAt: null,
  });

  return new MemoryOrdersRepository({
    students: [
      { id: 'student-1', restaurantId: 'restaurant-1', phone: '+243820000001', loyaltyRemainderFc: 0 },
      { id: 'student-2', restaurantId: 'restaurant-1', phone: '+243820000002', loyaltyRemainderFc: 0 },
    ],
    restaurants,
    menuItems,
    balances: [
      { userId: 'student-1', restaurantId: 'restaurant-1', availablePoints: 15 },
      { userId: 'student-2', restaurantId: 'restaurant-1', availablePoints: 15 },
    ],
  });
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
  repository = createMemoryRepository();
  const service = new OrdersService(repository, { now: () => new Date(NOW) });
  const authenticate = createTestAuthMiddleware();
  const app = createApp(loadConfig({ NODE_ENV: 'test' }), {
    routes: (application) => registerOrderRoutes(application, { service, authenticate }),
  });
  server = await startServer(app);
});

afterEach(async () => server.fermer());

const dineInOrder = {
  restaurant: 'restaurant-central',
  type: 'dine_in',
  paymentMethod: 'cash',
  arrivalTime: ARRIVAL,
  items: [{ menuItemId: 'dish-1', quantity: 2 }],
  note: 'Sans piment.',
  redeemMeal: false,
};

async function postOrder(
  body: unknown = dineInOrder,
  options: { token?: string | null; key?: string | null; rawBody?: string } = {},
): Promise<Response> {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (options.token !== null) headers.set('authorization', `Bearer ${options.token ?? 'student-token'}`);
  if (options.key !== null) headers.set('Idempotency-Key', options.key ?? 'attempt-key-0001');
  return fetch(`${server.base}/api/orders`, {
    method: 'POST',
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
}

async function expectError(response: Response, status: number, code: string): Promise<void> {
  assert.equal(response.status, status);
  const body = (await response.json()) as { error: { code: string; message: string; details: unknown[] } };
  assert.equal(body.error.code, code);
  assert.ok(body.error.message.length > 0, 'le message doit être lisible');
  assert.deepEqual(body.error.details, []);
}

describe('POST /api/orders — APP-68', () => {
  it('crée une commande sur place avec heure d’arrivée et événement initial pending', async () => {
    const response = await postOrder();
    assert.equal(response.status, 201);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body['type'], 'dine_in');
    assert.equal(body['status'], 'pending');
    assert.equal(body['arrivalTime'], ARRIVAL);
    assert.equal(body['paymentStatus'], 'unpaid');
    assert.deepEqual(body['restaurant'], { slug: 'restaurant-central', name: 'Restaurant Central' });
    assert.deepEqual(body['events'], [{ status: 'pending', at: NOW.toISOString() }]);
  });

  it('crée une commande en livraison et utilise les frais et le téléphone du compte', async () => {
    const response = await postOrder({
      restaurant: 'restaurant-central',
      type: 'delivery',
      paymentMethod: 'cash',
      items: [{ menuItemId: 'dish-1', quantity: 1 }],
      delivery: { commune: 'Limete', quartier: 'Industriel', landmark: 'Station Engen' },
      redeemMeal: false,
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body['deliveryFeeFc'], 2000);
    assert.equal(body['totalFc'], 5000);
    assert.deepEqual(body['delivery'], {
      commune: 'Limete',
      quartier: 'Industriel',
      address: null,
      landmark: 'Station Engen',
      phone: '+243820000001',
    });
  });

  it('recalcule le prix depuis les plats du dépôt', async () => {
    const response = await postOrder({ ...dineInOrder, items: [{ menuItemId: 'dish-1', quantity: 2 }] });
    assert.equal(response.status, 201);
    const body = (await response.json()) as { items: Array<Record<string, unknown>>; subtotalFc: number; totalFc: number };
    assert.equal(body.items[0]?.['unitPriceFc'], 3000);
    assert.equal(body.items[0]?.['lineTotalFc'], 6000);
    assert.equal(body.subtotalFc, 6000);
    assert.equal(body.totalFc, 6000);
  });

  it('accepte les quantités limites, regroupe les doublons et accepte 30 lignes', async () => {
    const grouped = await postOrder({
      ...dineInOrder,
      items: [{ menuItemId: 'dish-1', quantity: 10 }, { menuItemId: 'dish-1', quantity: 10 }],
    });
    assert.equal(grouped.status, 201);
    const groupedBody = (await grouped.json()) as { items: Array<{ quantity: number }> };
    assert.equal(groupedBody.items.length, 1);
    assert.equal(groupedBody.items[0]?.quantity, 20);

    const thirtyLines = await postOrder({
      ...dineInOrder,
      items: Array.from({ length: 30 }, (_unused, index) => ({ menuItemId: `dish-${index + 1}`, quantity: 1 })),
    }, { key: 'thirty-lines-0001' });
    assert.equal(thirtyLines.status, 201);
    const body = (await thirtyLines.json()) as { items: unknown[] };
    assert.equal(body.items.length, 30);
  });

  it('refuse les quantités invalides, les paniers hors limites et les doublons au-dessus de 20', async () => {
    const cases = [
      { items: [{ menuItemId: 'dish-1', quantity: 0 }] },
      { items: [{ menuItemId: 'dish-1', quantity: 21 }] },
      { items: [{ menuItemId: 'dish-1', quantity: 1.5 }] },
      { items: [] },
      { items: Array.from({ length: 31 }, (_unused, index) => ({ menuItemId: `dish-${index + 1}`, quantity: 1 })) },
      { items: [{ menuItemId: 'dish-1', quantity: 11 }, { menuItemId: 'dish-1', quantity: 10 }] },
    ];
    for (const [index, input] of cases.entries()) {
      const response = await postOrder({ ...dineInOrder, ...input }, { key: `invalid-items-${index}-01` });
      await expectError(response, 400, 'VALIDATION_ERROR');
    }
    assert.equal(repository.orders.length, 0);
  });

  it('refuse un plat inconnu ou rattaché à un autre restaurant', async () => {
    await expectError(await postOrder({ ...dineInOrder, items: [{ menuItemId: 'unknown', quantity: 1 }] }), 422, 'ITEM_NOT_FOUND');
    await expectError(await postOrder({ ...dineInOrder, items: [{ menuItemId: 'dish-etu-1', quantity: 1 }] }, { key: 'other-restaurant-01' }), 422, 'ITEM_NOT_FOUND');
  });

  it('refuse un plat connu mais indisponible', async () => {
    repository.menuItems.get('dish-1')!.isAvailable = false;
    await expectError(await postOrder(), 422, 'ITEM_UNAVAILABLE');
  });

  it('refuse un restaurant inconnu ou désactivé', async () => {
    await expectError(await postOrder({ ...dineInOrder, restaurant: 'restaurant-inconnu' }), 404, 'NOT_FOUND');
    await expectError(await postOrder({ ...dineInOrder, restaurant: 'restaurant-ferme' }, { key: 'inactive-restaurant-01' }), 404, 'RESTAURANT_INACTIVE');
  });

  it('refuse un restaurant fermé au moment de la commande', async () => {
    repository.restaurants.get('restaurant-1')!.settings.openingHours = {};
    await expectError(await postOrder(), 422, 'RESTAURANT_CLOSED');
  });

  it('refuse une heure d’arrivée passée ou à plus de 12 heures', async () => {
    await expectError(await postOrder({ ...dineInOrder, arrivalTime: '2026-10-26T07:59:00.000Z' }), 422, 'INVALID_ARRIVAL_TIME');
    await expectError(await postOrder({ ...dineInOrder, arrivalTime: '2026-10-26T21:00:00.000Z' }, { key: 'arrival-too-late-01' }), 422, 'INVALID_ARRIVAL_TIME');
  });

  it('refuse une heure d’arrivée hors des horaires d’ouverture', async () => {
    repository.restaurants.get('restaurant-1')!.settings.openingHours = {
      mon: [{ open: '07:00', close: '10:00' }],
    };
    await expectError(await postOrder(), 422, 'OUTSIDE_OPENING_HOURS');
  });

  it('refuse une livraison désactivée ou une commune non desservie', async () => {
    const delivery = {
      restaurant: 'restaurant-central',
      type: 'delivery',
      items: [{ menuItemId: 'dish-1', quantity: 1 }],
      delivery: { commune: 'Gombe', landmark: 'Boulevard' },
    };
    await expectError(await postOrder(delivery), 422, 'COMMUNE_NOT_SERVED');
    repository.restaurants.get('restaurant-1')!.settings.deliveryEnabled = false;
    await expectError(await postOrder({ ...delivery, delivery: { commune: 'Limete', landmark: 'Boulevard' } }, { key: 'delivery-disabled-01' }), 422, 'DELIVERY_DISABLED');
  });

  it('refuse une livraison sans repère ni adresse', async () => {
    await expectError(await postOrder({
      restaurant: 'restaurant-central',
      type: 'delivery',
      items: [{ menuItemId: 'dish-1', quantity: 1 }],
      delivery: { commune: 'Limete' },
    }), 400, 'VALIDATION_ERROR');
  });

  it('refuse le paiement mobile money lorsqu’il est désactivé', async () => {
    repository.restaurants.get('restaurant-1')!.settings.mobileMoneyEnabled = false;
    await expectError(await postOrder({ ...dineInOrder, paymentMethod: 'mobile_money' }), 422, 'PAYMENT_METHOD_UNAVAILABLE');
  });

  it('refuse l’utilisation des points si le solde du restaurant est insuffisant', async () => {
    repository.balances.set('student-1:restaurant-1', 14);
    await expectError(await postOrder({ ...dineInOrder, redeemMeal: true }), 422, 'INSUFFICIENT_POINTS');
  });

  it('applique la réduction aux plats sans réduire les frais de livraison', async () => {
    const response = await postOrder({
      restaurant: 'restaurant-central',
      type: 'delivery',
      paymentMethod: 'cash',
      items: [{ menuItemId: 'dish-1', quantity: 2 }],
      delivery: { commune: 'Limete', address: 'Avenue du campus' },
      redeemMeal: true,
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as Record<string, number>;
    assert.equal(body['subtotalFc'], 6000);
    assert.equal(body['discountFc'], 3000);
    assert.equal(body['deliveryFeeFc'], 2000);
    assert.equal(body['totalFc'], 5000);
    assert.equal(body['pointsRedeemed'], 15);
  });

  it('exige une clé Idempotency-Key présente et bien formée', async () => {
    await expectError(await postOrder(dineInOrder, { key: null }), 400, 'VALIDATION_ERROR');
    await expectError(await postOrder(dineInOrder, { key: 'bad key!!' }), 400, 'VALIDATION_ERROR');
  });

  it('renvoie la commande d’origine en 200 pour la même clé et le même contenu regroupé', async () => {
    const first = await postOrder({ ...dineInOrder, items: [{ menuItemId: 'dish-1', quantity: 1 }, { menuItemId: 'dish-1', quantity: 1 }] }, { key: 'same-content-0001' });
    assert.equal(first.status, 201);
    const order = await first.json();
    const replay = await postOrder({ ...dineInOrder, items: [{ menuItemId: 'dish-1', quantity: 2 }] }, { key: 'same-content-0001' });
    assert.equal(replay.status, 200);
    assert.equal(replay.headers.get('Idempotent-Replayed'), 'true');
    assert.deepEqual(await replay.json(), order);
    assert.equal(repository.orders.length, 1);
  });

  it('répond 409 si la même clé est réutilisée avec un contenu différent sans créer de commande', async () => {
    const first = await postOrder(dineInOrder, { key: 'different-body-01' });
    assert.equal(first.status, 201);
    await expectError(await postOrder({ ...dineInOrder, note: 'Avec piment.' }, { key: 'different-body-01' }), 409, 'IDEMPOTENCY_KEY_REUSED');
    assert.equal(repository.orders.length, 1);
  });

  it('isole les mêmes clés entre deux étudiants', async () => {
    const first = await postOrder(dineInOrder, { key: 'shared-key-0001' });
    assert.equal(first.status, 201);
    const second = await postOrder(dineInOrder, { token: 'second-student-token', key: 'shared-key-0001' });
    assert.equal(second.status, 201);
    assert.equal(repository.orders.length, 2);
  });

  it('renvoie 401 si le jeton est absent ou invalide', async () => {
    await expectError(await postOrder(dineInOrder, { token: null }), 401, 'UNAUTHORIZED');
    await expectError(await postOrder(dineInOrder, { token: 'invalid-token' }), 401, 'UNAUTHORIZED');
  });

  it('renvoie 403 pour un rôle autre que student', async () => {
    await expectError(await postOrder(dineInOrder, { token: 'employee-token' }), 403, 'FORBIDDEN');
  });

  it('renvoie VALIDATION_ERROR pour un JSON invalide', async () => {
    await expectError(await postOrder(undefined, { rawBody: '{' }), 400, 'VALIDATION_ERROR');
  });

  it('utilise le restaurant d’origine et cash par défaut', async () => {
    const response = await postOrder({ type: 'dine_in', items: [{ menuItemId: 'dish-1', quantity: 1 }] });
    assert.equal(response.status, 201);
    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(body['restaurant'], { slug: 'restaurant-central', name: 'Restaurant Central' });
    assert.equal(body['paymentMethod'], 'cash');
  });

  it('numérote les commandes par restaurant et par jour à Kinshasa', async () => {
    const first = await postOrder(dineInOrder, { key: 'number-first-0001' });
    const second = await postOrder(dineInOrder, { key: 'number-second-01' });
    const otherRestaurant = await postOrder({
      ...dineInOrder,
      restaurant: 'restaurant-etu',
      items: [{ menuItemId: 'dish-etu-1', quantity: 1 }],
    }, { key: 'number-other-001' });
    assert.equal((await first.json() as { orderNumber: string }).orderNumber, '261026-001');
    assert.equal((await second.json() as { orderNumber: string }).orderNumber, '261026-002');
    assert.equal((await otherRestaurant.json() as { orderNumber: string }).orderNumber, '261026-001');
  });

  it('initialise cash et mobile money à unpaid, et marque paid une commande gratuite', async () => {
    const cash = await postOrder(dineInOrder, { key: 'payment-cash-0001' });
    const mobile = await postOrder({ ...dineInOrder, paymentMethod: 'mobile_money' }, { key: 'payment-mobile-01' });
    assert.equal((await cash.json() as { paymentStatus: string }).paymentStatus, 'unpaid');
    assert.equal((await mobile.json() as { paymentStatus: string }).paymentStatus, 'unpaid');

    repository.menuItems.get('dish-1')!.priceFc = 0;
    const free = await postOrder({ ...dineInOrder, items: [{ menuItemId: 'dish-1', quantity: 1 }] }, { key: 'payment-free-0001' });
    assert.equal((await free.json() as { paymentStatus: string }).paymentStatus, 'paid');
  });
});
