import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { seedDemoData } from '../src/seed.ts';
import { demarrer, type Serveur } from './helpers.ts';

/** Un seul compte pour toute la plateforme : l'adhésion à un restaurant se crée à la première commande. */
describe('[MM-COMPTE-UNIQUE] Adhésion à un restaurant à la première commande', () => {
  let db: Database;
  let server: Serveur;
  let token = '';
  let leaDish = '';

  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(`${server.base}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) as Record<string, any> : {} };
  }
  const memberships = () => db.all<{ slug: string }>(
    `SELECT r.slug FROM memberships m JOIN restaurants r ON r.id = m.restaurant_id
     JOIN users u ON u.id = m.user_id WHERE u.email = 'nouveau@example.com' ORDER BY r.slug`);

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    seedDemoData(db, {
      restaurantAdminPassword: 'AdminPass1', employeePassword: 'EmployePass1',
      studentPassword: 'EtudiantPass1', platformAdminPassword: 'PlatformPass1',
    });
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-with-more-than-32-characters' }), {
      database: db, now: () => new Date('2026-11-04T10:00:00.000Z'),
    }));
    const menu = await call('GET', '/api/restaurants/chez-lea/menu');
    leaDish = (menu.body['categories'] as Array<{ items: Array<{ id: string }> }>).flatMap((category) => category.items)[0]!.id;
    const registered = await call('POST', '/api/auth/register', {
      name: 'Nouvel Étudiant', email: 'nouveau@example.com', phone: '+243990000111',
      password: 'Motdepasse1', confirmPassword: 'Motdepasse1', acceptTerms: true,
    });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));
    token = registered.body['token'];
  });
  after(async () => { await server.fermer(); db.close(); });

  it('à l’inscription, le compte n’est lié à aucun restaurant et n’a aucune adhésion', () => {
    assert.deepEqual(memberships(), []);
    assert.equal(db.get<{ restaurant_id: string | null }>("SELECT restaurant_id FROM users WHERE email = 'nouveau@example.com'")?.restaurant_id, null);
  });

  it('la première commande dans un restaurant crée l’adhésion à ce restaurant', async () => {
    const created = await call('POST', '/api/orders', {
      restaurant: 'chez-lea', type: 'dine_in', paymentMethod: 'cash', items: [{ menuItemId: leaDish, quantity: 1 }],
    }, { 'idempotency-key': 'adhesion-premiere-commande-1' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.deepEqual(memberships().map((row) => row.slug), ['chez-lea']);
  });

  it('rejouer la même commande ne crée pas de seconde adhésion ni de seconde commande', async () => {
    const replay = await call('POST', '/api/orders', {
      restaurant: 'chez-lea', type: 'dine_in', paymentMethod: 'cash', items: [{ menuItemId: leaDish, quantity: 1 }],
    }, { 'idempotency-key': 'adhesion-premiere-commande-1' });
    assert.equal(replay.status, 200);
    assert.equal(memberships().length, 1);
  });

  it('une commande refusée ne crée pas d’adhésion', async () => {
    db.run("UPDATE restaurants SET status = 'inactive' WHERE slug = 'chez-lea'");
    const refused = await call('POST', '/api/orders', {
      restaurant: 'chez-lea', type: 'dine_in', paymentMethod: 'cash', items: [{ menuItemId: leaDish, quantity: 1 }],
    }, { 'idempotency-key': 'adhesion-refusee-2' });
    assert.equal(refused.status, 404);
    db.run("UPDATE restaurants SET status = 'active' WHERE slug = 'chez-lea'");
    assert.equal(memberships().length, 1);
  });

  it('une commande sans restaurant indiqué est refusée : aucun restaurant par défaut', async () => {
    const refused = await call('POST', '/api/orders', { type: 'dine_in', paymentMethod: 'cash', items: [{ menuItemId: leaDish, quantity: 1 }] }, { 'idempotency-key': 'sans-restaurant-3' });
    assert.equal(refused.status, 422);
    assert.equal(refused.body['error'].code, 'RESTAURANT_REQUIRED');
  });

  it('commander dans un second restaurant crée une seconde adhésion, séparée', async () => {
    const zeducDish = ((await call('GET', '/api/restaurants/zeduc-space/menu')).body['categories'] as Array<{ items: Array<{ id: string }> }>).flatMap((category) => category.items)[0]!.id;
    const created = await call('POST', '/api/orders', {
      restaurant: 'zeduc-space', type: 'dine_in', paymentMethod: 'cash', items: [{ menuItemId: zeducDish, quantity: 1 }],
    }, { 'idempotency-key': 'adhesion-second-restaurant-4' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.deepEqual(memberships().map((row) => row.slug), ['chez-lea', 'zeduc-space']);
  });

  it('le solde de points reste séparé par restaurant', async () => {
    const zeduc = await call('GET', '/api/restaurants/zeduc-space/loyalty');
    const lea = await call('GET', '/api/restaurants/chez-lea/loyalty');
    assert.equal(zeduc.status, 200, JSON.stringify(zeduc.body));
    assert.equal(lea.status, 200, JSON.stringify(lea.body));
    assert.equal(zeduc.body['availablePoints'], 0);
    assert.equal(lea.body['availablePoints'], 0);
  });
});
