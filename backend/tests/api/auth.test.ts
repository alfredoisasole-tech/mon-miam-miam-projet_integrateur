import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config.ts';
import { Database } from '../../src/db/database.ts';
import { migrate } from '../../src/db/migrations.ts';
import { demarrer, type Serveur } from '../helpers.ts';

describe('contrat HTTP de l’authentification', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at)
      VALUES ('auth-test-restaurant', 'auth-test', 'Restaurant de test', 'Arial', ?)`, [new Date().toISOString()]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at)
      VALUES ('auth-test-restaurant', '{}', ?)`, [new Date().toISOString()]);
    server = await demarrer(createApp(loadConfig({
      NODE_ENV: 'test',
      JWT_SECRET: 'secret-de-test-assez-long-pour-les-jetons',
    }), { database: db }));
  });

  after(async () => {
    await server.fermer();
    db.close();
  });

  it('renvoie le message uniforme Connexion requise quand le jeton manque ou est invalide', async () => {
    const responses = await Promise.all([
      fetch(`${server.base}/api/me`),
      fetch(`${server.base}/api/me`, { headers: { authorization: 'Bearer jeton-invalide' } }),
    ]);

    for (const response of responses) {
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        error: { code: 'UNAUTHORIZED', message: 'Connexion requise', details: [] },
      });
    }
  });

  it('stocke uniquement une empreinte scrypt après inscription et permet la connexion par téléphone', async () => {
    const registration = await fetch(`${server.base}/api/restaurants/auth-test/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Étudiante Test', email: 'etudiante@example.test', phone: '+243815554431',
        password: 'MotDePasse1', acceptTerms: true,
      }),
    });
    assert.equal(registration.status, 201);
    const registered = await registration.json() as { user: { id: string }; token: string };
    const stored = db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [registered.user.id]);
    assert.ok(stored?.password_hash.startsWith('scrypt$'));
    assert.notEqual(stored?.password_hash, 'MotDePasse1');

    const login = await fetch(`${server.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: '+243815554431', password: 'MotDePasse1' }),
    });
    assert.equal(login.status, 200);
    assert.ok((await login.json() as { token: string }).token);
  });
});
