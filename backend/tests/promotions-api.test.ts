import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-11-03T10:00:00.000Z');
const TOKENS = new Map<string, AuthenticatedUser>([
  ['admin-a', { id: 'admin-a', role: 'admin', restaurantId: 'restaurant-a', status: 'active' }],
  ['admin-b', { id: 'admin-b', role: 'admin', restaurantId: 'restaurant-b', status: 'active' }],
  ['manager-a', { id: 'manager-a', role: 'manager', restaurantId: 'restaurant-a', status: 'active' }],
  ['student-a', { id: 'student-a', role: 'student', restaurantId: 'restaurant-a', status: 'active' }],
]);

describe('API des promotions', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('restaurant-a', 'restaurant-a', 'Restaurant A', 'Arial', ?),
      ('restaurant-b', 'restaurant-b', 'Restaurant B', 'Arial', ?)`, [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
      ('restaurant-a', '{}', ?), ('restaurant-b', '{}', ?)`, [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO assets (id, restaurant_id, kind, mime, data, size, created_at) VALUES
      ('poster-a', 'restaurant-a', 'poster', 'image/png', X'01', 1, ?),
      ('poster-b', 'restaurant-b', 'poster', 'image/png', X'02', 1, ?)`, [NOW.toISOString(), NOW.toISOString()]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db,
      now: () => new Date(NOW),
      resolveToken: (token) => TOKENS.get(token) ?? null,
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  function headers(token?: string): HeadersInit {
    return {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
    };
  }

  it('inclut les promotions actives aux deux bornes et masque les autres', async () => {
    db.run(`INSERT INTO promotions (id, restaurant_id, kind, title, starts_at, ends_at, is_active, created_at, updated_at) VALUES
      ('at-start', 'restaurant-a', 'promotion', 'Début inclus', ?, ?, 1, ?, ?),
      ('at-end', 'restaurant-a', 'event', 'Fin incluse', ?, ?, 1, ?, ?),
      ('future', 'restaurant-a', 'game', 'À venir', ?, ?, 1, ?, ?),
      ('inactive', 'restaurant-a', 'promotion', 'Désactivée', ?, ?, 0, ?, ?),
      ('other-restaurant', 'restaurant-b', 'promotion', 'Autre restaurant', ?, ?, 1, ?, ?)`, [
      NOW.toISOString(), new Date(NOW.getTime() + 60_000).toISOString(), NOW.toISOString(), NOW.toISOString(),
      new Date(NOW.getTime() - 60_000).toISOString(), NOW.toISOString(), NOW.toISOString(), NOW.toISOString(),
      new Date(NOW.getTime() + 60_000).toISOString(), new Date(NOW.getTime() + 120_000).toISOString(), NOW.toISOString(), NOW.toISOString(),
      new Date(NOW.getTime() - 120_000).toISOString(), new Date(NOW.getTime() + 120_000).toISOString(), NOW.toISOString(), NOW.toISOString(),
      NOW.toISOString(), new Date(NOW.getTime() + 60_000).toISOString(), NOW.toISOString(), NOW.toISOString(),
    ]);

    const response = await fetch(`${server.base}/api/restaurants/restaurant-a/promotions`);
    assert.equal(response.status, 200);
    const body = await response.json() as { items: Array<{ id: string }> };
    assert.deepEqual(body.items.map((item) => item.id).sort(), ['at-end', 'at-start']);
  });

  it('protège la gestion, isole les promotions et permet leur CRUD', async () => {
    const noToken = await fetch(`${server.base}/api/admin/promotions`);
    assert.equal(noToken.status, 401);
    const wrongRole = await fetch(`${server.base}/api/admin/promotions`, { headers: headers('manager-a') });
    assert.equal(wrongRole.status, 403);

    const create = await fetch(`${server.base}/api/admin/promotions`, {
      method: 'POST', headers: headers('admin-a'),
      body: JSON.stringify({
        type: 'event', title: 'Soirée du restaurant A', description: 'Musique et repas', imageAssetId: 'poster-a',
        startDate: '2026-11-03T10:00:00Z', endDate: '2026-11-03T12:00:00Z', isActive: true,
      }),
    });
    assert.equal(create.status, 201);
    const created = await create.json() as { id: string; type: string; isActive: boolean };
    assert.equal(created.type, 'event');
    assert.equal(created.isActive, true);

    const list = await fetch(`${server.base}/api/admin/promotions`, { headers: headers('admin-a') });
    assert.equal(list.status, 200);
    const items = await list.json() as Array<{ id: string }>;
    assert.ok(items.some((item) => item.id === created.id));
    assert.ok(items.every((item) => item.id !== 'other-restaurant'));

    const update = await fetch(`${server.base}/api/admin/promotions/${created.id}`, {
      method: 'PATCH', headers: headers('admin-a'),
      body: JSON.stringify({ title: 'Soirée mise à jour', isActive: false }),
    });
    assert.equal(update.status, 200);
    const updated = await update.json() as { title: string; isActive: boolean };
    assert.equal(updated.title, 'Soirée mise à jour');
    assert.equal(updated.isActive, false);

    const crossRestaurant = await fetch(`${server.base}/api/admin/promotions/${created.id}`, {
      method: 'PATCH', headers: headers('admin-b'), body: JSON.stringify({ title: 'Modification croisée' }),
    });
    assert.equal(crossRestaurant.status, 404);

    const remove = await fetch(`${server.base}/api/admin/promotions/${created.id}`, {
      method: 'DELETE', headers: headers('admin-a'),
    });
    assert.equal(remove.status, 204);
  });

  it('refuse les périodes inversées, les dates non ISO et les affiches d’un autre restaurant', async () => {
    for (const body of [
      { type: 'promotion', title: 'Période inversée', startDate: '2026-11-04T00:00:00Z', endDate: '2026-11-03T00:00:00Z' },
      { type: 'promotion', title: 'Date invalide', startDate: '03/11/2026', endDate: '2026-11-04T00:00:00Z' },
      { type: 'promotion', title: 'Affiche étrangère', imageAssetId: 'poster-b', startDate: '2026-11-03T00:00:00Z', endDate: '2026-11-04T00:00:00Z' },
    ]) {
      const response = await fetch(`${server.base}/api/admin/promotions`, {
        method: 'POST', headers: headers('admin-a'), body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
    }
  });
});
