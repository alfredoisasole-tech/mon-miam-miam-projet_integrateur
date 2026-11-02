import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-10-26T08:00:00.000Z');
const TOKEN_USERS = new Map<string, AuthenticatedUser>([
  ['alpha-admin', { id: 'alpha-admin', role: 'admin', restaurantId: 'restaurant-alpha' }],
  ['alpha-employee', { id: 'alpha-employee', role: 'employee', restaurantId: 'restaurant-alpha' }],
  ['beta-admin', { id: 'beta-admin', role: 'admin', restaurantId: 'restaurant-beta' }],
]);

describe('API de gestion des menus par restaurant', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('restaurant-alpha', 'alpha', 'Alpha', 'Arial', ?),
      ('restaurant-beta', 'beta', 'Beta', 'Arial', ?)`, [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
      ('restaurant-alpha', '{}', ?), ('restaurant-beta', '{}', ?)`, [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES
      ('alpha-admin', 'restaurant-alpha', 'admin', 'Admin Alpha', 'admin-alpha@example.test', '+243820000001', 'hash', ?),
      ('alpha-employee', 'restaurant-alpha', 'employee', 'Employé Alpha', 'employee-alpha@example.test', '+243820000002', 'hash', ?),
      ('beta-admin', 'restaurant-beta', 'admin', 'Admin Beta', 'admin-beta@example.test', '+243820000003', 'hash', ?)`,
    [NOW.toISOString(), NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO menu_items (id, restaurant_id, name, description, price_fc, category, is_available, is_daily, position, created_at, updated_at) VALUES
      ('alpha-dish', 'restaurant-alpha', 'Poulet Alpha', NULL, 4000, 'plat', 1, 0, 0, ?, ?),
      ('beta-dish', 'restaurant-beta', 'Poulet Beta', NULL, 5000, 'plat', 1, 0, 0, ?, ?)`,
    [NOW.toISOString(), NOW.toISOString(), NOW.toISOString(), NOW.toISOString()]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db,
      now: () => new Date(NOW),
      resolveToken: (token) => TOKEN_USERS.get(token) ?? null,
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  function headers(token: string): HeadersInit {
    return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  }

  it('liste uniquement les plats du restaurant du membre du personnel', async () => {
    const response = await fetch(`${server.base}/api/staff/menu`, { headers: headers('alpha-employee') });
    assert.equal(response.status, 200);
    const dishes = await response.json() as Array<{ id: string; isAvailable: boolean }>;
    assert.deepEqual(dishes.map((dish) => dish.id), ['alpha-dish']);
    assert.equal(dishes[0]?.isAvailable, true);
  });

  it('autorise les mises à jour rapides du personnel mais masque les plats d’un autre restaurant', async () => {
    const update = await fetch(`${server.base}/api/staff/menu/alpha-dish`, {
      method: 'PATCH',
      headers: headers('alpha-employee'),
      body: JSON.stringify({ isAvailable: false, isDaily: true }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual(
      ((await update.json()) as { isAvailable: boolean; isDaily: boolean }),
      { isAvailable: false, isDaily: true },
    );

    const crossRestaurant = await fetch(`${server.base}/api/staff/menu/beta-dish`, {
      method: 'PATCH',
      headers: headers('alpha-employee'),
      body: JSON.stringify({ isAvailable: false }),
    });
    assert.equal(crossRestaurant.status, 404);
  });

  it('réserve la création, la modification et la suppression logique aux admins du restaurant', async () => {
    const payload = {
      name: 'Jus frais',
      description: '',
      priceFc: 1500,
      category: 'boisson',
      isDaily: false,
      isAvailable: true,
    };
    const forbidden = await fetch(`${server.base}/api/admin/menu`, {
      method: 'POST',
      headers: headers('alpha-employee'),
      body: JSON.stringify(payload),
    });
    assert.equal(forbidden.status, 403);

    const created = await fetch(`${server.base}/api/admin/menu`, {
      method: 'POST',
      headers: headers('alpha-admin'),
      body: JSON.stringify(payload),
    });
    assert.equal(created.status, 201);
    const dish = await created.json() as { id: string; description: string | null; priceFc: number };
    assert.equal(dish.description, null);
    assert.equal(dish.priceFc, 1500);

    const updated = await fetch(`${server.base}/api/admin/menu/${dish.id}`, {
      method: 'PATCH',
      headers: headers('alpha-admin'),
      body: JSON.stringify({ priceFc: 2000 }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json() as { priceFc: number }).priceFc, 2000);

    const removed = await fetch(`${server.base}/api/admin/menu/${dish.id}`, {
      method: 'DELETE',
      headers: headers('alpha-admin'),
    });
    assert.equal(removed.status, 204);
    assert.ok(db.get<{ deleted_at: string }>('SELECT deleted_at FROM menu_items WHERE id = ?', [dish.id])?.deleted_at);
  });

  it('refuse les champs hors contrat et les écritures inter-restaurant', async () => {
    const invalid = await fetch(`${server.base}/api/admin/menu`, {
      method: 'POST',
      headers: headers('alpha-admin'),
      body: JSON.stringify({
        name: 'Plat invalide', description: '', priceFc: -1, category: 'plat', isDaily: false, isAvailable: true,
      }),
    });
    assert.equal(invalid.status, 400);

    const crossRestaurant = await fetch(`${server.base}/api/admin/menu/beta-dish`, {
      method: 'PATCH',
      headers: headers('alpha-admin'),
      body: JSON.stringify({ name: 'Falsification' }),
    });
    assert.equal(crossRestaurant.status, 404);
    assert.equal(db.get<{ name: string }>('SELECT name FROM menu_items WHERE id = ?', ['beta-dish'])?.name, 'Poulet Beta');
  });
});
