import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { hashPassword } from '../src/services/auth.service.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-10-30T12:00:00.000Z');

describe('administration des restaurants et promotions', () => {
  let db: Database;
  let server: Serveur;
  let platformToken: string;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    db.run(`INSERT INTO platform_admins (id, name, email, password_hash, created_at)
      VALUES ('platform-admin', 'Admin plateforme', 'platform@example.test', ?, '2026-10-01T00:00:00.000Z')`,
    [hashPassword('PlatformPass1')]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-with-more-than-32-characters' }), {
      database: db,
      now: () => new Date(NOW),
    }));
    const login = await fetch(`${server.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'platform@example.test', password: 'PlatformPass1' }),
    });
    assert.equal(login.status, 200);
    platformToken = (await login.json() as { token: string }).token;
  });

  after(async () => { await server.fermer(); db.close(); });

  it('crée le restaurant et son premier admin, puis permet de le désactiver/réactiver', async () => {
    const create = await fetch(`${server.base}/api/platform/restaurants`, {
      method: 'POST',
      headers: { authorization: `Bearer ${platformToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'nouveau-restaurant',
        name: 'Nouveau restaurant',
        admin: {
          name: 'Admin local', email: 'admin-local@example.test', phone: '+243820000010', password: 'LocalAdmin1',
        },
      }),
    });
    assert.equal(create.status, 201);
    assert.equal(db.get<{ total: number }>("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'")?.total, 1);
    assert.equal(db.get<{ total: number }>("SELECT COUNT(*) AS total FROM restaurant_settings WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = 'nouveau-restaurant')")?.total, 1);

    const deactivate = await fetch(`${server.base}/api/platform/restaurants/nouveau-restaurant/status`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${platformToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' }),
    });
    assert.equal(deactivate.status, 200);
    const hidden = await fetch(`${server.base}/api/restaurants/nouveau-restaurant`);
    assert.equal(hidden.status, 404);

    const reactivate = await fetch(`${server.base}/api/platform/restaurants/nouveau-restaurant/status`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${platformToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    assert.equal(reactivate.status, 200);
    const visible = await fetch(`${server.base}/api/restaurants/nouveau-restaurant`);
    assert.equal(visible.status, 200);
  });

  it('ne renvoie que les promotions actives dans leur période avec les URLs d’images isolées', async () => {
    const restaurantId = db.get<{ id: string }>("SELECT id FROM restaurants WHERE slug = 'nouveau-restaurant'")?.id;
    assert.ok(restaurantId);
    db.run(`INSERT INTO assets (id, restaurant_id, kind, mime, data, size, created_at)
      VALUES ('poster-demo', ?, 'poster', 'image/png', ?, 8, '2026-10-01T00:00:00.000Z')`,
    [restaurantId, Buffer.from('89504e470d0a1a0a', 'hex')]);
    db.run(`INSERT INTO promotions (id, restaurant_id, kind, title, image_asset_id, starts_at, ends_at, created_at, updated_at)
      VALUES ('promo-active', ?, 'promotion', 'Happy Hour', 'poster-demo', '2026-10-29T00:00:00.000Z', '2026-11-01T00:00:00.000Z', ?, ?)`,
    [restaurantId, NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO promotions (id, restaurant_id, kind, title, starts_at, ends_at, created_at, updated_at)
      VALUES ('promo-expired', ?, 'event', 'Ancien événement', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z', ?, ?)`,
    [restaurantId, NOW.toISOString(), NOW.toISOString()]);

    const response = await fetch(`${server.base}/api/restaurants/nouveau-restaurant/promotions`);
    assert.equal(response.status, 200);
    const result = await response.json() as { items: Array<{ id: string; type: string; imageUrl: string }> };
    assert.deepEqual(result.items.map((item) => item.id), ['promo-active']);
    assert.equal(result.items[0]?.type, 'promotion');
    assert.equal(result.items[0]?.imageUrl, '/api/restaurants/nouveau-restaurant/assets/poster-demo');
  });
});
