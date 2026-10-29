import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { demarrer, type Serveur } from './helpers.ts';

describe('API publique restaurants et menu (L-7)', () => {
  let db: Database;
  let serveur: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    db.run(`INSERT INTO restaurants (id, slug, name, tagline, primary_color, secondary_color, font_family, timezone, created_at, status)
      VALUES ('r-a', 'alpha', 'Alpha', 'Cuisine alpha', '#111111', '#eeeeee', 'Arial', 'Africa/Kinshasa', '2026-10-01T00:00:00.000Z', 'active')`);
    db.run(`INSERT INTO restaurants (id, slug, name, tagline, primary_color, secondary_color, font_family, timezone, created_at, status)
      VALUES ('r-b', 'bravo', 'Bravo', NULL, '#cfbd97', '#000000', 'Arial', 'Africa/Kinshasa', '2026-10-01T00:00:00.000Z', 'active')`);
    db.run(`INSERT INTO restaurants (id, slug, name, primary_color, secondary_color, font_family, timezone, created_at, status)
      VALUES ('r-off', 'inactive', 'Inactive', '#cfbd97', '#000000', 'Arial', 'Africa/Kinshasa', '2026-10-01T00:00:00.000Z', 'inactive')`);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
      ('r-a', ?, '2026-10-01T00:00:00.000Z'),
      ('r-b', '{}', '2026-10-01T00:00:00.000Z')`, [JSON.stringify({ thu: [{ open: '09:00', close: '10:00' }] })]);
    db.run(`INSERT INTO menu_items (id, restaurant_id, name, description, price_fc, category, is_available, is_daily, position, created_at, updated_at)
      VALUES ('a-daily', 'r-a', 'Plat du jour', NULL, 3500, 'plat', 1, 1, 0, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
      ('a-main', 'r-a', 'Poulet', 'Poulet braisé', 4500, 'plat', 1, 0, 1, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
      ('a-sold', 'r-a', 'Épuisé', NULL, 1000, 'boisson', 0, 0, 2, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
      ('b-main', 'r-b', 'Plat de Bravo', NULL, 2000, 'plat', 1, 0, 0, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')`);
    serveur = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db,
      now: () => new Date('2026-10-29T08:30:00.000Z'), // 09:30 à Kinshasa
    }));
  });
  after(async () => { await serveur.fermer(); db.close(); });

  it('ne liste que les restaurants actifs, triés par nom et paginés', async () => {
    const response = await fetch(`${serveur.base}/api/restaurants?page=1&pageSize=1`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      items: [{ slug: 'alpha', name: 'Alpha', slogan: 'Cuisine alpha', logoUrl: null,
        colors: { primary: '#111111', secondary: '#eeeeee' }, isOpenNow: true }],
      total: 2, page: 1, pageSize: 1,
    });
  });

  it('renvoie le profil et les réglages publics, et masque les restaurants désactivés', async () => {
    const response = await fetch(`${serveur.base}/api/restaurants/alpha`);
    assert.equal(response.status, 200);
    const profile = await response.json() as { settings: { loyalty: { spendPerPointFc: number }; openingHours: { thu: unknown[] } } };
    assert.equal(profile.settings.loyalty.spendPerPointFc, 3000);
    assert.equal(profile.settings.openingHours.thu.length, 1);
    const missing = await fetch(`${serveur.base}/api/restaurants/inactive`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json() as { error: { code: string } }).error.code, 'RESTAURANT_NOT_FOUND');
  });

  it('isole le menu par restaurant, sépare le plat du jour et cache les plats indisponibles', async () => {
    const response = await fetch(`${serveur.base}/api/restaurants/alpha/menu`);
    assert.equal(response.status, 200);
    const menu = await response.json() as { categories: Array<{ name: string; items: Array<{ id: string }> }>; dailyItems: Array<{ id: string }> };
    assert.deepEqual(menu.dailyItems.map((item) => item.id), ['a-daily']);
    assert.deepEqual(menu.categories.map((category) => category.name), ['Plats']);
    assert.deepEqual(menu.categories[0]?.items.map((item) => item.id), ['a-main']);
    assert.ok(!JSON.stringify(menu).includes('b-main'));
    const inactive = await fetch(`${serveur.base}/api/restaurants/inactive/menu`);
    assert.equal(inactive.status, 404);
  });

  it('refuse une taille de page supérieure à 100', async () => {
    const response = await fetch(`${serveur.base}/api/restaurants?pageSize=101`);
    assert.equal(response.status, 400);
  });
});
