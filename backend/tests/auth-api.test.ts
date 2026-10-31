import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { demarrer, type Serveur } from './helpers.ts';

describe('API des comptes', () => {
  let db: Database;
  let server: Serveur;
  let resetCode = '';
  let oldToken = '';

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at)
      VALUES ('restaurant-auth', 'auth-demo', 'Auth Demo', 'Arial', '2026-10-01T00:00:00.000Z')`);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at)
      VALUES ('restaurant-auth', '{}', '2026-10-01T00:00:00.000Z')`);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-with-more-than-32-characters' }), {
      database: db,
      sendPasswordResetCode: async (_identifier, code) => { resetCode = code; },
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  it('inscrit un étudiant, crée son adhésion, permet la connexion et protège son profil', async () => {
    const registration = await fetch(`${server.base}/api/restaurants/auth-demo/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Mbuyi',
        email: 'Alice@exemple.com',
        phone: '+243815554433',
        password: 'MotDePasse1',
        acceptTerms: true,
      }),
    });
    assert.equal(registration.status, 201);
    const registered = await registration.json() as { token: string; user: { role: string; memberships: unknown[] } };
    oldToken = registered.token;
    assert.equal(registered.user.role, 'student');
    assert.equal(registered.user.memberships.length, 1);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM memberships')?.total, 1);

    const login = await fetch(`${server.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'alice@EXEMPLE.com', password: 'MotDePasse1' }),
    });
    assert.equal(login.status, 200);
    const authenticated = await login.json() as { token: string };
    const profile = await fetch(`${server.base}/api/me`, { headers: { authorization: `Bearer ${authenticated.token}` } });
    assert.equal(profile.status, 200);
    assert.equal((await profile.json() as { email: string }).email, 'alice@exemple.com');
  });

  it('refuse les doublons, les mots de passe faibles et les identifiants invalides sans révéler le compte', async () => {
    const body = {
      name: 'Alice Mbuyi', email: 'alice@exemple.com', phone: '+243815554433',
      password: 'MotDePasse1', acceptTerms: true,
    };
    const duplicate = await fetch(`${server.base}/api/restaurants/auth-demo/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal(duplicate.status, 409);

    const weak = await fetch(`${server.base}/api/restaurants/auth-demo/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, email: 'weak@exemple.com', phone: '+243815554434', password: 'faible123' }),
    });
    assert.equal(weak.status, 400);

    const [unknown, wrongPassword] = await Promise.all(['inconnu@exemple.com', 'alice@exemple.com'].map((identifier) =>
      fetch(`${server.base}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier, password: 'Incorrect1' }),
      }),
    ));
    assert.equal(unknown.status, 401);
    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(await unknown.json(), await wrongPassword.json());
  });

  it('ne compte pas les inscriptions réussies comme des échecs de limitation', async () => {
    for (let index = 0; index < 8; index += 1) {
      const response = await fetch(`${server.base}/api/restaurants/auth-demo/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: `Test User ${index}`,
          email: `test-${index}@exemple.com`,
          phone: `+24381555${String(index).padStart(4, '0')}`,
          password: 'MotDePasse1',
          acceptTerms: true,
        }),
      });
      assert.equal(response.status, 201);
    }
  });

  it('réinitialise le mot de passe par code à usage unique sans révéler les comptes inconnus', async () => {
    const requestReset = (identifier: string) => fetch(`${server.base}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    const known = await requestReset('alice@exemple.com');
    const unknown = await requestReset('absent@exemple.com');
    assert.equal(known.status, 202);
    assert.deepEqual(await known.json(), await unknown.json());
    assert.ok(resetCode);

    const reset = await fetch(`${server.base}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'alice@exemple.com', code: resetCode, newPassword: 'NouveauMot1' }),
    });
    assert.equal(reset.status, 200);
    const revoked = await fetch(`${server.base}/api/me`, { headers: { authorization: `Bearer ${oldToken}` } });
    assert.equal(revoked.status, 401);
    const replay = await fetch(`${server.base}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'alice@exemple.com', code: resetCode, newPassword: 'AutreMot1' }),
    });
    assert.equal(replay.status, 422);
  });
});
