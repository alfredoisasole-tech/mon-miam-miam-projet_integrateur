import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { seedDemoData } from '../src/seed.ts';
import { demarrer, type Serveur } from './helpers.ts';

/** Chaque restaurant de démonstration a son logo et sa propre charte graphique. */
describe('[MM-SEED] Logos et chartes des restaurants de démonstration', () => {
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

  const profile = async (slug: string) => (await fetch(`${server.base}/api/restaurants/${slug}`)).json() as Promise<Record<string, any>>;

  it('donne un logo à chaque restaurant, servi comme image PNG', async () => {
    for (const slug of ['zeduc-space', 'chez-lea']) {
      const brand = await profile(slug);
      assert.match(brand['logoUrl'], new RegExp(`^/api/restaurants/${slug}/assets/ast_`), `logo de ${slug}`);
      const image = await fetch(`${server.base}${brand['logoUrl']}`);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), 'image/png');
      const bytes = Buffer.from(await image.arrayBuffer());
      assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'signature PNG');
      assert.ok(bytes.length > 1000 && bytes.length <= 512 * 1024, 'taille raisonnable');
    }
  });

  it('ne partage pas les logos : chaque restaurant sert uniquement le sien', async () => {
    const zeduc = await profile('zeduc-space');
    const wrongSlug = zeduc['logoUrl'].replace('zeduc-space', 'chez-lea');
    assert.equal((await fetch(`${server.base}${wrongSlug}`)).status, 404);
  });

  it('donne à chaque restaurant sa charte : couleurs, police, mode et slogan distincts', async () => {
    const zeduc = await profile('zeduc-space');
    const lea = await profile('chez-lea');
    assert.notDeepEqual(zeduc['colors'], lea['colors']);
    assert.notEqual(zeduc['fontFamily'], lea['fontFamily']);
    assert.notEqual(zeduc['defaultMode'], lea['defaultMode']);
    assert.ok(zeduc['slogan'] && lea['slogan']);
    for (const brand of [zeduc, lea]) {
      assert.match(brand['colors']['primary'], /^#[0-9a-f]{6}$/i);
      assert.match(brand['colors']['secondary'], /^#[0-9a-f]{6}$/i);
    }
  });

  it('expose logo et couleurs de chaque restaurant à l’administrateur de la plateforme', async () => {
    const login = await fetch(`${server.base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: 'plateforme@monmiam.test', password: 'PlatformPass1' }) });
    const { token } = await login.json() as { token: string };
    const list = await fetch(`${server.base}/api/platform/restaurants`, { headers: { authorization: `Bearer ${token}` } });
    const items = (await list.json() as { items: Array<Record<string, any>> }).items;
    for (const item of items) {
      const brand = await profile(item['slug']);
      assert.equal(item['logoUrl'], brand['logoUrl'], `logo de ${item['slug']}`);
      assert.deepEqual(item['colors'], brand['colors']);
    }
  });

  it('relance le seed sans dupliquer les logos', () => {
    seedDemoData(db, {
      restaurantAdminPassword: 'AdminPass1', employeePassword: 'EmployePass1',
      studentPassword: 'EtudiantPass1', platformAdminPassword: 'PlatformPass1',
    });
    assert.equal(db.get<{ total: number }>("SELECT COUNT(*) AS total FROM assets WHERE kind = 'logo'")?.total, 2);
  });
});
