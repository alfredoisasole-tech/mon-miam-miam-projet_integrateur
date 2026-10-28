import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { registerPromotionRoutes } from '../src/controllers/promotions.controller.ts';
import type { Promotion, PromotionRestaurant } from '../src/domain/promotions.ts';
import { MemoryPromotionsRepository } from '../src/repositories/memory-promotions.repo.ts';
import { PromotionsService } from '../src/services/promotions.service.ts';
import { demarrer as startServer, type Serveur as Server } from './helpers.ts';

const NOW = new Date('2026-10-28T12:00:00.000Z');
const RESTAURANTS: PromotionRestaurant[] = [
  { id: 'restaurant-1', slug: 'restaurant-central', status: 'active' },
  { id: 'restaurant-2', slug: 'restaurant-etu', status: 'active' },
  { id: 'restaurant-closed', slug: 'restaurant-ferme', status: 'inactive' },
];

function createPromotion(overrides: Partial<Promotion> & Pick<Promotion, 'id' | 'restaurantId'>): Promotion {
  return {
    kind: 'promotion',
    title: `Promotion ${overrides.id}`,
    description: null,
    imageAssetId: null,
    startsAt: '2026-10-28T10:00:00.000Z',
    endsAt: '2026-10-28T14:00:00.000Z',
    isActive: true,
    ...overrides,
  };
}

let server: Server;

async function start(promotions: Promotion[]): Promise<Server> {
  const repository = new MemoryPromotionsRepository({ restaurants: RESTAURANTS, promotions });
  const service = new PromotionsService(repository, { now: () => new Date(NOW) });
  const app = createApp(loadConfig({ NODE_ENV: 'test' }), {
    routes: (application) => registerPromotionRoutes(application, service),
  });
  return startServer(app);
}

beforeEach(async () => { server = await start([]); });

afterEach(async () => server.fermer());

async function getPromotions(slug: string): Promise<Response> {
  return fetch(`${server.base}/api/restaurants/${slug}/promotions`);
}

async function expectError(response: Response, status: number, code: string): Promise<void> {
  assert.equal(response.status, status);
  const body = (await response.json()) as { error: { code: string; message: string; details: unknown[] } };
  assert.equal(body.error.code, code);
  assert.ok(body.error.message.length > 0);
  assert.deepEqual(body.error.details, []);
}

describe('GET /api/restaurants/:slug/promotions — APP-18', () => {
  it('retourne seulement les promotions actives dans leur période', async () => {
    await server.fermer();
    server = await start([
      createPromotion({ id: 'visible', restaurantId: 'restaurant-1' }),
      createPromotion({ id: 'disabled', restaurantId: 'restaurant-1', isActive: false }),
      createPromotion({ id: 'future', restaurantId: 'restaurant-1', startsAt: '2026-10-28T12:00:00.001Z' }),
      createPromotion({ id: 'expired', restaurantId: 'restaurant-1', endsAt: '2026-10-28T12:00:00.000Z' }),
    ]);

    const response = await getPromotions('restaurant-central');
    assert.equal(response.status, 200);
    const body = (await response.json()) as { items: Array<{ id: string; active: boolean }> };
    assert.deepEqual(body.items.map((item) => item.id), ['visible']);
    assert.ok(body.items.every((item) => item.active));
  });

  it('inclut la borne de début et exclut la borne de fin', async () => {
    await server.fermer();
    server = await start([
      createPromotion({ id: 'starts-now', restaurantId: 'restaurant-1', startsAt: NOW.toISOString() }),
      createPromotion({ id: 'ends-now', restaurantId: 'restaurant-1', endsAt: NOW.toISOString() }),
    ]);

    const response = await getPromotions('restaurant-central');
    const body = (await response.json()) as { items: Array<{ id: string }> };
    assert.deepEqual(body.items.map((item) => item.id), ['starts-now']);
  });

  it('filtre par restaurant et trie par date de début puis identifiant', async () => {
    await server.fermer();
    server = await start([
      createPromotion({ id: 'z-later', restaurantId: 'restaurant-1', startsAt: '2026-10-28T11:00:00.000Z' }),
      createPromotion({ id: 'b-first', restaurantId: 'restaurant-1', startsAt: '2026-10-28T10:00:00.000Z' }),
      createPromotion({ id: 'a-first', restaurantId: 'restaurant-1', startsAt: '2026-10-28T10:00:00.000Z' }),
      createPromotion({ id: 'other-restaurant', restaurantId: 'restaurant-2' }),
    ]);

    const response = await getPromotions('restaurant-central');
    const body = (await response.json()) as { items: Array<Record<string, unknown>> };
    assert.deepEqual(body.items.map((item) => item['id']), ['a-first', 'b-first', 'z-later']);
    assert.deepEqual(body.items[0], {
      id: 'a-first',
      kind: 'promotion',
      title: 'Promotion a-first',
      description: null,
      imageAssetId: null,
      startsAt: '2026-10-28T10:00:00.000Z',
      endsAt: '2026-10-28T14:00:00.000Z',
      active: true,
    });
  });

  it('retourne une liste vide sans erreur si aucune promotion n’est visible', async () => {
    const response = await getPromotions('restaurant-central');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: [] });
  });

  it('masque un restaurant inactif comme un restaurant inconnu', async () => {
    await expectError(await getPromotions('restaurant-ferme'), 404, 'RESTAURANT_NOT_FOUND');
    await expectError(await getPromotions('restaurant-inconnu'), 404, 'RESTAURANT_NOT_FOUND');
  });
});
