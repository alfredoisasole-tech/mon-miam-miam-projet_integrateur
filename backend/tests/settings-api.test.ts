import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-11-04T10:00:00.000Z');
const TOKENS = new Map<string, AuthenticatedUser>([
  ['admin-a', { id: 'admin-a', role: 'admin', restaurantId: 'restaurant-a', status: 'active' }],
  ['admin-b', { id: 'admin-b', role: 'admin', restaurantId: 'restaurant-b', status: 'active' }],
  ['manager-a', { id: 'manager-a', role: 'manager', restaurantId: 'restaurant-a', status: 'active' }],
  ['employee-a', { id: 'employee-a', role: 'employee', restaurantId: 'restaurant-a', status: 'active' }],
  ['student-a', { id: 'student-a', role: 'student', restaurantId: 'restaurant-a', status: 'active' }],
]);

// Petit PNG valide (signature + en-tête), JPEG et WEBP minimaux : seule la signature est contrôlée.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('suite-du-fichier')]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('suite-du-fichier')]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

interface Settings {
  restaurant: { slug: string; name: string; tagline: string | null };
  brand: { primaryColor: string; secondaryColor: string; fontFamily: string; defaultMode: string; logoUrl: string | null; logoAssetId: string | null };
  openingHours: Record<string, Array<{ open: string; close: string }>>;
  delivery: { enabled: boolean; feeFc: number; communes: string[] };
  loyalty: { spendPerPointFc: number; pointsForReward: number; rewardValueFc: number; validityMonths: number };
}

describe('[MM-PARAMETRES] Paramètres et personnalisation du restaurant', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    const at = NOW.toISOString();
    db.run(`INSERT INTO restaurants (id, slug, name, tagline, font_family, created_at) VALUES
      ('restaurant-a', 'param-a', 'Restaurant A', 'Le bon goût', 'Arial', ?), ('restaurant-b', 'param-b', 'Restaurant B', NULL, 'Arial', ?)`, [at, at]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, delivery_communes, updated_at) VALUES
      ('restaurant-a', '{"mon":[{"open":"08:00","close":"22:00"}]}', '["Gombe"]', ?), ('restaurant-b', '{}', '[]', ?)`, [at, at]);
    for (const [id, restaurant, role, phone] of [['admin-a', 'restaurant-a', 'admin', '+243810000601'], ['admin-b', 'restaurant-b', 'admin', '+243810000602'],
      ['manager-a', 'restaurant-a', 'manager', '+243810000603'], ['employee-a', 'restaurant-a', 'employee', '+243810000604'],
      ['student-a', 'restaurant-a', 'student', '+243810000605']]) {
      db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'x', ?)`, [id, restaurant, role, id, `${id}@example.test`, phone, at]);
    }
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db, now: () => new Date(NOW), resolveToken: (token) => TOKENS.get(token) ?? null,
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  const headers = (token?: string): HeadersInit => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' });
  const send = (method: string, path: string, token: string | undefined, body?: unknown) =>
    fetch(`${server.base}${path}`, { method, headers: headers(token), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const settings = async (token: string) => (await (await send('GET', '/api/admin/settings', token)).json()) as Settings;
  const upload = (token: string | undefined, kind: string, file: Buffer) =>
    send('POST', '/api/admin/assets', token, { kind, data: file.toString('base64') });

  it('réserve les paramètres à l’administrateur du restaurant et les lui montre', async () => {
    assert.equal((await send('GET', '/api/admin/settings', undefined)).status, 401);
    for (const token of ['manager-a', 'employee-a', 'student-a']) assert.equal((await send('GET', '/api/admin/settings', token)).status, 403, token);
    const body = await settings('admin-a');
    assert.equal(body.restaurant.slug, 'param-a');
    assert.equal(body.restaurant.tagline, 'Le bon goût');
    assert.deepEqual(body.brand, { primaryColor: '#cfbd97', secondaryColor: '#000000', fontFamily: 'Arial', defaultMode: 'light', logoUrl: null, logoAssetId: null });
    assert.deepEqual(body.openingHours, { mon: [{ open: '08:00', close: '22:00' }] });
    assert.deepEqual(body.delivery, { enabled: true, feeFc: 0, communes: ['Gombe'] });
    assert.deepEqual(body.loyalty, { spendPerPointFc: 3000, pointsForReward: 15, rewardValueFc: 3000, validityMonths: 12 });
  });

  it('personnalise la charte du restaurant et la rend visible publiquement, sans toucher aux autres restaurants', async () => {
    const response = await send('PATCH', '/api/admin/settings', 'admin-a', {
      name: 'Chez Mama Rose', tagline: 'La cuisine de chez nous',
      brand: { primaryColor: '#B7791F', secondaryColor: '#1A202C', fontFamily: 'Georgia', defaultMode: 'dark' },
    });
    assert.equal(response.status, 200);
    const updated = await response.json() as Settings;
    assert.equal(updated.restaurant.name, 'Chez Mama Rose');
    assert.deepEqual({ ...updated.brand }, { primaryColor: '#b7791f', secondaryColor: '#1a202c', fontFamily: 'Georgia', defaultMode: 'dark', logoUrl: null, logoAssetId: null });

    const profile = await (await fetch(`${server.base}/api/restaurants/param-a`)).json() as {
      name: string; slogan: string; colors: { primary: string; secondary: string }; fontFamily: string; defaultMode: string;
    };
    assert.equal(profile.name, 'Chez Mama Rose');
    assert.equal(profile.slogan, 'La cuisine de chez nous');
    assert.deepEqual(profile.colors, { primary: '#b7791f', secondary: '#1a202c' });
    assert.equal(profile.fontFamily, 'Georgia');
    assert.equal(profile.defaultMode, 'dark');

    const other = await settings('admin-b');
    assert.equal(other.restaurant.name, 'Restaurant B');
    assert.equal(other.brand.primaryColor, '#cfbd97');
  });

  it('refuse les couleurs, polices et modes dangereux ou invalides', async () => {
    const invalid = [
      { brand: { primaryColor: 'red' } }, { brand: { primaryColor: '#12345' } }, { brand: { primaryColor: '#cfbd97;} body{display:none' } },
      { brand: { secondaryColor: 'url(javascript:alert(1))' } }, { brand: { fontFamily: 'Comic Sans; } * { display:none' } },
      { brand: { fontFamily: 'Police inconnue' } }, { brand: { defaultMode: 'sepia' } }, { name: 'x' }, { name: 'y'.repeat(81) },
      { tagline: 'z'.repeat(121) }, { inconnu: true }, { brand: { inconnu: true } }, {}, { brand: {} },
    ];
    for (const body of invalid) assert.equal((await send('PATCH', '/api/admin/settings', 'admin-b', body)).status, 400, JSON.stringify(body));
    assert.equal((await send('PATCH', '/api/admin/settings', 'manager-a', { name: 'Autre nom' })).status, 403);
    assert.equal((await send('PATCH', '/api/admin/settings', undefined, { name: 'Autre nom' })).status, 401);
    const unchanged = await settings('admin-b');
    assert.equal(unchanged.restaurant.name, 'Restaurant B');
    assert.equal(unchanged.brand.primaryColor, '#cfbd97');
  });

  it('modifie les horaires, la livraison et les règles de fidélité avec des bornes raisonnables', async () => {
    const ok = await send('PATCH', '/api/admin/settings', 'admin-b', {
      openingHours: { mon: [{ open: '09:00', close: '14:00' }, { open: '17:00', close: '22:30' }], sun: [] },
      delivery: { enabled: false, feeFc: 1500, communes: ['Limete', 'Lemba'] },
      loyalty: { spendPerPointFc: 2000, pointsForReward: 10, rewardValueFc: 2500, validityMonths: 6 },
    });
    assert.equal(ok.status, 200);
    const body = await ok.json() as Settings;
    assert.deepEqual(body.openingHours, { mon: [{ open: '09:00', close: '14:00' }, { open: '17:00', close: '22:30' }], sun: [] });
    assert.deepEqual(body.delivery, { enabled: false, feeFc: 1500, communes: ['Limete', 'Lemba'] });
    assert.deepEqual(body.loyalty, { spendPerPointFc: 2000, pointsForReward: 10, rewardValueFc: 2500, validityMonths: 6 });
    const profile = await (await fetch(`${server.base}/api/restaurants/param-b`)).json() as { loyalty: { validityMonths: number }; delivery: { enabled: boolean } };
    assert.equal(profile.loyalty.validityMonths, 6);
    assert.equal(profile.delivery.enabled, false);
    assert.equal((await settings('admin-a')).loyalty.spendPerPointFc, 3000, 'l’autre restaurant n’est pas modifié');

    const invalid = [
      { openingHours: { lundi: [] } }, { openingHours: { mon: [{ open: '9h', close: '14:00' }] } }, { openingHours: { mon: [{ open: '14:00', close: '09:00' }] } },
      { openingHours: { mon: [{ open: '08:00', close: '09:00' }, { open: '09:00', close: '10:00' }, { open: '11:00', close: '12:00' }, { open: '13:00', close: '14:00' }] } },
      { delivery: { feeFc: -1 } }, { delivery: { feeFc: 1.5 } }, { delivery: { enabled: 'oui' } }, { delivery: { communes: [''] } }, { delivery: { communes: 'Gombe' } },
      { loyalty: { spendPerPointFc: 0 } }, { loyalty: { pointsForReward: 0 } }, { loyalty: { rewardValueFc: -5 } }, { loyalty: { validityMonths: 0 } },
      { loyalty: { validityMonths: 61 } }, { loyalty: { spendPerPointFc: '3000' } },
    ];
    for (const body of invalid) assert.equal((await send('PATCH', '/api/admin/settings', 'admin-a', body)).status, 400, JSON.stringify(body));
    assert.equal((await settings('admin-a')).loyalty.spendPerPointFc, 3000);
  });

  it('envoie des images vérifiées par leur signature et les attache au restaurant', async () => {
    assert.equal((await upload(undefined, 'logo', PNG)).status, 401);
    assert.equal((await upload('manager-a', 'logo', PNG)).status, 403);
    for (const [file, mime] of [[PNG, 'image/png'], [JPEG, 'image/jpeg'], [WEBP, 'image/webp']] as const) {
      const created = await upload('admin-a', 'poster', file);
      assert.equal(created.status, 201, mime);
      const body = await created.json() as { id: string; kind: string; mime: string; size: number; url: string };
      assert.equal(body.mime, mime);
      assert.equal(body.size, file.length);
      assert.equal(body.url, `/api/restaurants/param-a/assets/${body.id}`);
    }
    assert.equal((await upload('admin-a', 'inconnu', PNG)).status, 400);
    assert.equal((await upload('admin-a', 'logo', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).status, 400);
    assert.equal((await upload('admin-a', 'logo', Buffer.from('texte quelconque'))).status, 400);
    assert.equal((await send('POST', '/api/admin/assets', 'admin-a', { kind: 'logo', data: '###pas-du-base64###' })).status, 400);
    assert.equal((await send('POST', '/api/admin/assets', 'admin-a', { kind: 'logo' })).status, 400);
    const tooBig = await upload('admin-a', 'logo', Buffer.concat([PNG, Buffer.alloc(512 * 1024)]));
    assert.equal(tooBig.status, 413);
    assert.equal(((await tooBig.json()) as { error: { code: string } }).error.code, 'IMAGE_TOO_LARGE');
  });

  it('applique un logo du restaurant et refuse un logo d’un autre restaurant', async () => {
    const foreign = await (await upload('admin-b', 'logo', PNG)).json() as { id: string };
    const refused = await send('PATCH', '/api/admin/settings', 'admin-a', { brand: { logoAssetId: foreign.id } });
    assert.equal(refused.status, 422);
    assert.equal(((await refused.json()) as { error: { code: string } }).error.code, 'ASSET_NOT_FOUND');

    const own = await (await upload('admin-a', 'logo', PNG)).json() as { id: string; url: string };
    const applied = await send('PATCH', '/api/admin/settings', 'admin-a', { brand: { logoAssetId: own.id } });
    assert.equal(applied.status, 200);
    assert.equal(((await applied.json()) as Settings).brand.logoUrl, own.url);
    const profile = await (await fetch(`${server.base}/api/restaurants/param-a`)).json() as { logoUrl: string };
    assert.equal(profile.logoUrl, own.url);
    const served = await fetch(`${server.base}${own.url}`);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), PNG);

    const removed = await send('PATCH', '/api/admin/settings', 'admin-a', { brand: { logoAssetId: null } });
    assert.equal(((await removed.json()) as Settings).brand.logoUrl, null);
  });

  it('permet d’illustrer un plat avec une image du restaurant', async () => {
    db.run(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at)
      VALUES ('dish-a', 'restaurant-a', 'Poulet DG', 3500, 'plat', ?, ?)`, [NOW.toISOString(), NOW.toISOString()]);
    const image = await (await upload('admin-a', 'menu', JPEG)).json() as { id: string; url: string };
    const other = await (await upload('admin-b', 'menu', JPEG)).json() as { id: string };
    const updated = await send('PATCH', '/api/admin/menu/dish-a', 'admin-a', { imageAssetId: image.id });
    assert.equal(updated.status, 200);
    assert.equal(((await updated.json()) as { imageUrl: string }).imageUrl, image.url);
    assert.equal((await send('PATCH', '/api/admin/menu/dish-a', 'admin-a', { imageAssetId: other.id })).status, 422);
    assert.equal((await send('PATCH', '/api/admin/menu/dish-a', 'admin-a', { imageAssetId: 12 })).status, 400);
    const created = await send('POST', '/api/admin/menu', 'admin-a', {
      name: 'Riz sauté', description: 'Riz et légumes', priceFc: 2800, category: 'plat', isDaily: false, isAvailable: true, imageAssetId: image.id,
    });
    assert.equal(created.status, 201);
    assert.equal(((await created.json()) as { imageUrl: string }).imageUrl, image.url);
    const withoutImage = await send('POST', '/api/admin/menu', 'admin-a', {
      name: 'Sans image', description: 'Plat sans photo', priceFc: 1000, category: 'snack', isDaily: false, isAvailable: true,
    });
    assert.equal(withoutImage.status, 201);
    assert.equal(((await withoutImage.json()) as { imageUrl: string | null }).imageUrl, null);
    const cleared = await send('PATCH', '/api/admin/menu/dish-a', 'admin-a', { imageAssetId: null });
    assert.equal(((await cleared.json()) as { imageUrl: string | null }).imageUrl, null);
  });
});
