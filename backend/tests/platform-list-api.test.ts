import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { hashPassword } from '../src/services/auth.service.ts';
import { demarrer, type Serveur } from './helpers.ts';

describe('[MM-PLATEFORME] liste des restaurants pour l’administration de la plateforme', () => {
  let db: Database;
  let server: Serveur;
  let platformToken: string;
  let adminToken: string;

  async function login(identifier: string, password: string) {
    const response = await fetch(`${server.base}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier, password }),
    });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  }

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    db.run(`INSERT INTO platform_admins (id, name, email, password_hash, created_at)
      VALUES ('pa', 'Plateforme', 'platform@example.test', ?, '2026-10-01T00:00:00.000Z')`, [hashPassword('PlatformPass1')]);
    db.run(`INSERT INTO restaurants (id, slug, name, tagline, primary_color, secondary_color, font_family, timezone, created_at, status)
      VALUES ('r-a', 'alpha', 'Alpha', NULL, '#cfbd97', '#000000', 'Arial', 'Africa/Kinshasa', '2026-10-01T00:00:00.000Z', 'active'),
             ('r-b', 'bravo', 'Bravo', NULL, '#cfbd97', '#000000', 'Arial', 'Africa/Kinshasa', '2026-10-02T00:00:00.000Z', 'inactive')`);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES ('r-a', '{}', '2026-10-01T00:00:00.000Z'), ('r-b', '{}', '2026-10-02T00:00:00.000Z')`);
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
      VALUES ('adm-a', 'r-a', 'admin', 'Admin Alpha', 'admin-a@example.test', '+243820000001', ?, '2026-10-01T00:00:00.000Z'),
             ('stu-a', 'r-a', 'student', 'Élève', 'eleve@example.test', '+243820000002', ?, '2026-10-01T00:00:00.000Z')`,
    [hashPassword('AdminPass1'), hashPassword('StudentPass1')]);
    db.run("INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES ('stu-a', 'r-a', '2026-10-01T00:00:00.000Z')");
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-with-more-than-32-characters' }), {
      database: db, now: () => new Date('2026-10-30T12:00:00.000Z'),
    }));
    platformToken = await login('platform@example.test', 'PlatformPass1');
    adminToken = await login('admin-a@example.test', 'AdminPass1');
  });
  after(async () => { await server.fermer(); db.close(); });

  it('liste tous les restaurants, y compris désactivés, avec leur statut et leur administrateur', async () => {
    const response = await fetch(`${server.base}/api/platform/restaurants`, { headers: { authorization: `Bearer ${platformToken}` } });
    assert.equal(response.status, 200);
    const body = await response.json() as { items: Array<Record<string, unknown>> };
    assert.deepEqual(body.items.map((item) => [item['slug'], item['status']]), [['alpha', 'active'], ['bravo', 'inactive']]);
    assert.deepEqual(body.items[0]?.['administrators'], [{ name: 'Admin Alpha', email: 'admin-a@example.test' }]);
    assert.deepEqual(body.items[1]?.['administrators'], []);
    assert.equal(body.items[0]?.['students'], 1);
  });

  it('ne renvoie jamais de mot de passe ni de téléphone', async () => {
    const response = await fetch(`${server.base}/api/platform/restaurants`, { headers: { authorization: `Bearer ${platformToken}` } });
    const text = await response.text();
    assert.ok(!/password|hash|\+243/i.test(text));
  });

  it('refuse un administrateur de restaurant et une requête sans jeton', async () => {
    const forbidden = await fetch(`${server.base}/api/platform/restaurants`, { headers: { authorization: `Bearer ${adminToken}` } });
    assert.equal(forbidden.status, 403);
    const anonymous = await fetch(`${server.base}/api/platform/restaurants`);
    assert.equal(anonymous.status, 401);
  });
});
