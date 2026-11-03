import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { seedDemoData } from '../src/seed.ts';
import { hashPassword } from '../src/services/auth.service.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-11-03T11:00:00.000Z');
const PASSWORD = 'AccessDemo1';

describe('APP-78 — protection de l’administration et restaurant désactivé', () => {
  let db: Database;
  let server: Serveur;
  const tokens: Record<string, string> = {};

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    seedDemoData(db, {
      restaurantAdminPassword: PASSWORD, employeePassword: PASSWORD,
      studentPassword: PASSWORD, platformAdminPassword: PASSWORD,
    });
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
      VALUES ('access-manager', 'demo-restaurant-zeduc', 'manager', 'Gérant test',
        'manager-access@example.test', '+243810000005', ?, ?)`, [hashPassword(PASSWORD), NOW.toISOString()]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), { database: db, now: () => new Date(NOW) }));
    for (const [role, identifier] of Object.entries({
      student: 'etudiant@monmiam.test', employee: 'employe@monmiam.test',
      manager: 'manager-access@example.test', admin: 'admin@zeduc-space.test',
      platform_admin: 'plateforme@monmiam.test',
    })) {
      const response = await fetch(`${server.base}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier, password: PASSWORD }),
      });
      assert.equal(response.status, 200);
      tokens[role] = (await response.json() as { token: string }).token;
    }
  });

  after(async () => { await server.fermer(); db.close(); });

  const mutate = (path: string, method: string, body: unknown, token?: string) => fetch(server.base + path, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

  for (const [role, expected] of [
    ['visiteur', 401], ['jeton-invalide', 401], ['student', 403],
    ['employee', 403], ['manager', 403], ['admin', 403],
  ] as const) {
    it(`refuse création et changement de statut au rôle ${role}, sans écriture`, async () => {
      const token = role === 'visiteur' ? undefined : role === 'jeton-invalide' ? 'invalid-token' : tokens[role];
      const count = db.get<{ total: number }>('SELECT COUNT(*) AS total FROM restaurants')!.total;
      const create = await mutate('/api/platform/restaurants', 'POST', {
        slug: 'creation-interdite', name: 'Création interdite', role: 'platform_admin',
        admin: { name: 'Admin test', email: 'creation@example.test', phone: '+243810000099', password: PASSWORD },
      }, token);
      assert.equal(create.status, expected);
      const status = await mutate('/api/platform/restaurants/zeduc-space/status', 'PATCH', {
        status: 'inactive', role: 'platform_admin', restaurantId: 'demo-restaurant-lea',
      }, token);
      assert.equal(status.status, expected);
      assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM restaurants')!.total, count);
      assert.equal(db.get<{ status: string }>("SELECT status FROM restaurants WHERE slug = 'zeduc-space'")!.status, 'active');
    });
  }

  it('permet uniquement à la plateforme de créer un restaurant et son premier administrateur', async () => {
    const created = await mutate('/api/platform/restaurants', 'POST', {
      slug: 'restaurant-access-test', name: 'Restaurant test',
      admin: { name: 'Admin restaurant', email: 'created-admin@example.test', phone: '+243810000098', password: PASSWORD },
    }, tokens.platform_admin);
    assert.equal(created.status, 201);
    const result = await created.json() as { administrator: { role: string } };
    assert.equal(result.administrator.role, 'admin');
    const account = db.get<{ role: string; restaurant_id: string }>("SELECT role, restaurant_id FROM users WHERE email = 'created-admin@example.test'")!;
    assert.equal(account.role, 'admin');
    assert.equal(account.restaurant_id, db.get<{ id: string }>("SELECT id FROM restaurants WHERE slug = 'restaurant-access-test'")!.id);
  });

  it('retire le restaurant désactivé du choix public et bloque toute nouvelle commande, même avec une sélection conservée', async () => {
    const dish = db.get<{ id: string }>("SELECT id FROM menu_items WHERE restaurant_id = 'demo-restaurant-zeduc' LIMIT 1")!;
    const order = { restaurant: 'zeduc-space', type: 'dine_in', paymentMethod: 'cash', items: [{ menuItemId: dish.id, quantity: 1 }] };
    const place = (key: string, body: unknown) => fetch(server.base + '/api/orders', {
      method: 'POST', headers: {
        authorization: `Bearer ${tokens.student}`, 'content-type': 'application/json', 'Idempotency-Key': key,
      }, body: JSON.stringify(body),
    });
    assert.equal((await place('app78-before-disable', order)).status, 201);
    const before = db.get<{ total: number }>('SELECT COUNT(*) AS total FROM orders')!.total;
    assert.equal((await mutate('/api/platform/restaurants/zeduc-space/status', 'PATCH', { status: 'inactive' }, tokens.platform_admin)).status, 200);
    try {
      const publicList = await fetch(server.base + '/api/restaurants');
      assert.equal(publicList.status, 200);
      const list = await publicList.json() as { items: Array<{ slug: string }> };
      assert.ok(!list.items.some(item => item.slug === 'zeduc-space'));
      // Isolation : désactiver un restaurant ne touche pas l'autre restaurant.
      assert.ok(list.items.some(item => item.slug === 'chez-lea'));
      assert.equal((await fetch(server.base + '/api/restaurants/chez-lea')).status, 200);
      for (const suffix of ['', '/menu', '/promotions']) {
        assert.equal((await fetch(server.base + '/api/restaurants/zeduc-space' + suffix)).status, 404);
      }
      const blocked = await place('app78-stale-selection', order);
      assert.equal(blocked.status, 404);
      assert.equal((await blocked.json() as { error: { code: string } }).error.code, 'RESTAURANT_INACTIVE');
      const { restaurant: _restaurant, ...implicitRestaurant } = order;
      assert.equal((await place('app78-default-selection', implicitRestaurant)).status, 404);
      assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM orders')!.total, before);
      assert.ok(db.get('SELECT id FROM orders LIMIT 1'), 'Les commandes historiques sont conservées');
    } finally {
      assert.equal((await mutate('/api/platform/restaurants/zeduc-space/status', 'PATCH', { status: 'active' }, tokens.platform_admin)).status, 200);
    }
    assert.equal((await fetch(server.base + '/api/restaurants/zeduc-space')).status, 200);
    assert.equal((await place('app78-after-reactivation', order)).status, 201);
  });
});
