import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { seedDemoData } from '../src/seed.ts';
import { demarrer, type Serveur } from './helpers.ts';

/** Le personnel doit connaître son restaurant pour que le site applique sa charte graphique. */
describe('[MM-PROFIL] Restaurant du personnel dans le profil', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    seedDemoData(db, {
      restaurantAdminPassword: 'AdminPass1', employeePassword: 'EmployePass1',
      studentPassword: 'EtudiantPass1', platformAdminPassword: 'PlatformPass1',
    });
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-with-more-than-32-characters' }), { database: db }));
  });
  after(async () => { await server.fermer(); db.close(); });

  async function login(identifier: string, password: string) {
    const response = await fetch(`${server.base}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier, password }),
    });
    assert.equal(response.status, 200);
    return await response.json() as { token: string; user: Record<string, unknown> };
  }
  const me = async (token: string) => (await fetch(`${server.base}/api/me`, { headers: { authorization: `Bearer ${token}` } })).json() as Promise<Record<string, unknown>>;

  it('indique le restaurant d’un administrateur à la connexion et dans /api/me', async () => {
    const session = await login('admin@chez-lea.test', 'AdminPass1');
    assert.deepEqual(session.user['restaurant'], { slug: 'chez-lea', name: 'Chez Léa' });
    assert.deepEqual((await me(session.token))['restaurant'], { slug: 'chez-lea', name: 'Chez Léa' });
  });

  it('indique le restaurant d’un employé', async () => {
    const session = await login('employe@monmiam.test', 'EmployePass1');
    assert.deepEqual((await me(session.token))['restaurant'], { slug: 'zeduc-space', name: 'ZeDuc@Space' });
  });

  it('ne rattache ni un étudiant ni l’administrateur de la plateforme à un restaurant', async () => {
    const student = await login('etudiant@monmiam.test', 'EtudiantPass1');
    assert.equal((await me(student.token))['restaurant'], null, 'un étudiant choisit son restaurant lui-même');
    const platform = await login('plateforme@monmiam.test', 'PlatformPass1');
    assert.equal((await me(platform.token))['restaurant'], null);
  });
});
