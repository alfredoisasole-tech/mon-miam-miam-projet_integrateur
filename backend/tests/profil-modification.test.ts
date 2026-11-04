import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { seedDemoData } from '../src/seed.ts';
import { demarrer, type Serveur } from './helpers.ts';

/** PATCH /api/me : chacun modifie ses propres coordonnées ; changer de numéro exige le mot de passe. */
describe('[MM-PROFIL] Modification du profil', () => {
  let db: Database;
  let server: Serveur;
  const PASSWORD = 'EtudiantPass1';
  let student = '';
  let employee = '';

  async function call(method: string, path: string, token: string | null, body?: unknown) {
    const response = await fetch(`${server.base}${path}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> };
  }
  async function login(identifier: string, password: string) {
    const result = await call('POST', '/api/auth/login', null, { identifier, password });
    assert.equal(result.status, 200);
    return result.body['token'] as string;
  }

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    seedDemoData(db, { restaurantAdminPassword: 'AdminPass1', employeePassword: 'EmployePass1', studentPassword: PASSWORD, platformAdminPassword: 'PlatformPass1' });
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-with-more-than-32-characters' }), { database: db }));
    student = await login('etudiant@monmiam.test', PASSWORD);
    employee = await login('employe@monmiam.test', 'EmployePass1');
  });
  after(async () => { await server.fermer(); db.close(); });

  it('exige une connexion', async () => {
    assert.equal((await call('PATCH', '/api/me', null, { name: 'Nouveau Nom' })).status, 401);
  });

  it('un étudiant modifie son nom et son adresse habituelle, et /api/me les renvoie', async () => {
    const updated = await call('PATCH', '/api/me', student, { name: 'Étudiante Modifiée', commune: 'limete', quartier: 'Mososo', address: '12 avenue du Marché' });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body['name'], 'Étudiante Modifiée');
    assert.equal(updated.body['commune'], 'Limete', 'la commune est remise à sa graphie officielle');
    assert.equal(updated.body['quartier'], 'Mososo');
    assert.equal(updated.body['address'], '12 avenue du Marché');
    const me = await call('GET', '/api/me', student);
    assert.deepEqual([me.body['commune'], me.body['quartier'], me.body['address']], ['Limete', 'Mososo', '12 avenue du Marché']);
    assert.equal(me.body['email'], 'etudiant@monmiam.test', 'l’e-mail, identifiant de connexion, ne change pas');
  });

  it('efface une information facultative avec null ou un texte vide', async () => {
    const cleared = await call('PATCH', '/api/me', student, { quartier: null, address: '' });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body['quartier'], null);
    assert.equal(cleared.body['address'], null);
    assert.equal(cleared.body['commune'], 'Limete', 'les autres champs sont conservés');
  });

  it('refuse une commune inconnue, un nom trop court et des champs interdits', async () => {
    for (const body of [{ commune: 'Paris' }, { name: 'A' }, { name: 'x'.repeat(81) }, { quartier: 'x'.repeat(81) }, { address: 'x'.repeat(201) },
      { email: 'autre@example.test' }, { role: 'admin' }, { status: 'inactive' }, {}, [], 'x']) {
      const response = await call('PATCH', '/api/me', student, body);
      assert.equal(response.status, 400, JSON.stringify(body));
    }
  });

  it('changer de téléphone exige le mot de passe actuel, normalise le numéro et garde la session', async () => {
    assert.equal((await call('PATCH', '/api/me', student, { phone: '0990001111' })).status, 400, 'mot de passe absent');
    const wrong = await call('PATCH', '/api/me', student, { phone: '0990001111', currentPassword: 'Mauvais123' });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body['error']['code'], 'INVALID_CREDENTIALS');
    const ok = await call('PATCH', '/api/me', student, { phone: '0990001111', currentPassword: PASSWORD });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body['phone'], '+243990001111');
    assert.equal((await call('GET', '/api/me', student)).status, 200, 'la session reste valable');
    assert.equal((await call('POST', '/api/auth/login', null, { identifier: '+243990001111', password: PASSWORD })).status, 200, 'connexion possible avec le nouveau numéro');
  });

  it('refuse un numéro déjà utilisé et un numéro invalide', async () => {
    const taken = await call('PATCH', '/api/me', student, { phone: '+243810000003', currentPassword: PASSWORD });
    assert.equal(taken.status, 409);
    assert.equal(taken.body['error']['code'], 'PHONE_TAKEN');
    assert.equal((await call('PATCH', '/api/me', student, { phone: '12', currentPassword: PASSWORD })).status, 400);
  });

  it('rejouer son propre numéro, sans mot de passe, n’est pas un changement', async () => {
    const same = await call('PATCH', '/api/me', student, { phone: '+243990001111' });
    assert.equal(same.status, 200);
  });

  it('un membre du personnel modifie son nom et son téléphone, mais pas d’adresse de livraison', async () => {
    const renamed = await call('PATCH', '/api/me', employee, { name: 'Employé Renommé' });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body['name'], 'Employé Renommé');
    assert.equal(renamed.body['restaurant']['slug'], 'zeduc-space', 'le restaurant reste indiqué');
    assert.equal((await call('PATCH', '/api/me', employee, { commune: 'Gombe' })).status, 400);
    assert.equal((await call('PATCH', '/api/me', employee, { address: 'Quelque part' })).status, 400);
  });

  it('un compte à mot de passe temporaire ne peut pas modifier son profil avant de le changer', async () => {
    db.run("UPDATE users SET must_change_password = 1 WHERE id = 'demo-employee'");
    try {
      const blocked = await call('PATCH', '/api/me', employee, { name: 'Autre Nom' });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body['error']['code'], 'PASSWORD_CHANGE_REQUIRED');
    } finally { db.run("UPDATE users SET must_change_password = 0 WHERE id = 'demo-employee'"); }
  });

  it('ne touche jamais au compte d’un autre', async () => {
    const before = db.get<{ name: string }>("SELECT name FROM users WHERE id = 'demo-admin-zeduc'")!.name;
    await call('PATCH', '/api/me', student, { name: 'Intrus Total', id: 'demo-admin-zeduc' });
    assert.equal(db.get<{ name: string }>("SELECT name FROM users WHERE id = 'demo-admin-zeduc'")!.name, before);
  });
});
