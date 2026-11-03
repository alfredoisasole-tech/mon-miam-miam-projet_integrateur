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
  ['referrer', { id: 'referrer', role: 'student', restaurantId: 'restaurant-a', status: 'active' }],
  ['loner', { id: 'loner', role: 'student', restaurantId: 'restaurant-a', status: 'active' }],
  ['outsider', { id: 'outsider', role: 'student', restaurantId: 'restaurant-b', status: 'active' }],
  ['employee', { id: 'employee', role: 'employee', restaurantId: 'restaurant-a', status: 'active' }],
]);

describe('[MM-PARRAINAGE] Suivi du parrainage et refus des codes inconnus', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    const at = NOW.toISOString();
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('restaurant-a', 'parr-a', 'Restaurant A', 'Arial', ?), ('restaurant-b', 'parr-b', 'Restaurant B', 'Arial', ?)`, [at, at]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
      ('restaurant-a', '{}', ?), ('restaurant-b', '{}', ?)`, [at, at]);
    const users: Array<[string, string, string, string, string, string | null, string | null]> = [
      ['referrer', 'restaurant-a', 'student', 'Parrain Kabila', '+243810000201', 'PARRAIN12345', null],
      ['loner', 'restaurant-a', 'student', 'Seul Mukendi', '+243810000202', 'SEULCODE1234', null],
      ['outsider', 'restaurant-b', 'student', 'Externe Tshala', '+243810000203', 'EXTERNE12345', null],
      ['employee', 'restaurant-a', 'employee', 'Employé A', '+243810000204', null, null],
      ['friend-waiting', 'restaurant-a', 'student', 'Alice Mbuyi', '+243810000205', 'ALICECODE123', 'referrer'],
      ['friend-rewarded', 'restaurant-a', 'student', 'Bob Ilunga Mwamba', '+243810000206', 'BOBCODE12345', 'referrer'],
    ];
    for (const [id, restaurant, role, name, phone, code, referredBy] of users) {
      db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, referral_code, referred_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'x', ?, ?, ?)`, [id, restaurant, role, name, `${id}@example.test`, phone, code, referredBy, at]);
    }
    for (const [user, restaurant] of [['referrer', 'restaurant-a'], ['loner', 'restaurant-a'], ['outsider', 'restaurant-b'],
      ['friend-waiting', 'restaurant-a'], ['friend-rewarded', 'restaurant-a']] as const) {
      db.run('INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES (?, ?, ?)', [user, restaurant, at]);
    }
    db.run(`INSERT INTO orders (id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
      subtotal_fc, discount_fc, delivery_fee_fc, total_fc, created_at, updated_at)
      VALUES ('order-ref', 'restaurant-a', 'friend-rewarded', '261104-001', 'dine_in', 'completed', 'cash', 'paid', 6000, 0, 0, 6000, ?, ?)`, [at, at]);
    db.run(`INSERT INTO referrals (id, restaurant_id, referrer_id, referee_id, status, reward_points, rewarded_order_id, created_at, rewarded_at)
      VALUES ('referral-1', 'restaurant-a', 'referrer', 'friend-rewarded', 'rewarded', 2, 'order-ref', ?, ?)`, [at, at]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db, now: () => new Date(NOW), resolveToken: (token) => TOKENS.get(token) ?? null,
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  const headers = (token?: string): HeadersInit => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' });
  const referral = (slug: string, token?: string) => fetch(`${server.base}/api/restaurants/${slug}/referral`, { headers: headers(token) });

  interface ReferralBody {
    code: string;
    restaurant: { slug: string };
    referees: Array<{ name: string; status: string; rewardPoints: number | null; rewardRestaurant: { slug: string } | null; [key: string]: unknown }>;
    totals: { referees: number; rewarded: number; pointsEarned: number };
  }

  it('affiche le code du parrain et l’état de chaque filleul avec des noms partiellement masqués', async () => {
    const response = await referral('parr-a', 'referrer');
    assert.equal(response.status, 200);
    const body = await response.json() as ReferralBody;
    assert.equal(body.code, 'PARRAIN12345');
    assert.equal(body.restaurant.slug, 'parr-a');
    assert.deepEqual(body.referees.map((referee) => [referee.name, referee.status, referee.rewardPoints]).sort(),
      [['Alice M.', 'pending', null], ['Bob I.', 'rewarded', 2]]);
    assert.equal(body.referees.find((referee) => referee.name === 'Bob I.')?.rewardRestaurant?.slug, 'parr-a');
    assert.deepEqual(body.totals, { referees: 2, rewarded: 1, pointsEarned: 2 });
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes('@example.test') && !serialized.includes('+2438') && !serialized.includes('Mwamba'));
  });

  it('ne montre à chaque étudiant que son propre code et ses propres filleuls', async () => {
    const body = await (await referral('parr-a', 'loner')).json() as ReferralBody;
    assert.equal(body.code, 'SEULCODE1234');
    assert.deepEqual(body.referees, []);
    assert.deepEqual(body.totals, { referees: 0, rewarded: 0, pointsEarned: 0 });
  });

  it('refuse les accès non autorisés', async () => {
    assert.equal((await referral('parr-a')).status, 401);
    assert.equal((await referral('parr-a', 'employee')).status, 403);
    assert.equal((await referral('parr-a', 'outsider')).status, 403);
    assert.equal((await referral('inconnu', 'referrer')).status, 404);
  });

  it('refuse l’inscription avec un code de parrainage inconnu et accepte un code valide', async () => {
    const register = (referralCode: string, suffix: string) => fetch(`${server.base}/api/restaurants/parr-a/auth/register`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        name: `Nouvel Étudiant ${suffix}`, email: `nouveau-${suffix}@example.test`, phone: `+24381555${suffix}`,
        password: 'MotDePasse1', confirmPassword: 'MotDePasse1', referralCode, acceptTerms: true,
      }),
    });
    const unknown = await register('CODEINCONNU', '1001');
    assert.equal(unknown.status, 422);
    assert.equal(((await unknown.json()) as { error: { code: string } }).error.code, 'INVALID_REFERRAL_CODE');
    assert.equal(db.get('SELECT id FROM users WHERE email = ?', ['nouveau-1001@example.test']), undefined);

    const known = await register('PARRAIN12345', '1002');
    assert.equal(known.status, 201);
    assert.equal(db.get<{ referred_by: string }>('SELECT referred_by FROM users WHERE email = ?', ['nouveau-1002@example.test'])?.referred_by, 'referrer');

    const staffCode = await register('SEULCODE1234'.toLowerCase(), '1003');
    assert.equal(staffCode.status, 201, 'le code est reconnu sans tenir compte des majuscules');
  });
});
