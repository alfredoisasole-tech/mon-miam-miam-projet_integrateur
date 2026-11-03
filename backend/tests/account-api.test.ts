import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { hashPassword } from '../src/services/auth.service.ts';
import { demarrer, type Serveur } from './helpers.ts';

const PASSWORD = 'MotDePasse1';
const NOW = new Date('2026-11-04T10:00:00.000Z');

describe('[MM-COMPTE] Données personnelles et mot de passe', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    const at = NOW.toISOString();
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES ('restaurant-a', 'compte-a', 'Restaurant A', 'Arial', ?)`, [at]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES ('restaurant-a', '{}', ?)`, [at]);
    const hash = hashPassword(PASSWORD);
    const users: Array<[string, string, string, string, string, number, string | null]> = [
      ['etu', 'student', 'Étudiant Mukendi', 'etu@example.test', '+243810000501', 0, 'ETUCODE12345'],
      ['busy', 'student', 'Étudiant Occupé', 'busy@example.test', '+243810000502', 0, 'BUSYCODE1234'],
      ['filleul', 'student', 'Filleul Banza Kasongo', 'filleul@example.test', '+243810000503', 0, 'FILLCODE1234'],
      ['staff', 'employee', 'Employé Neuf', 'staff@example.test', '+243810000504', 1, null],
      ['other', 'student', 'Autre Étudiant', 'other@example.test', '+243810000505', 0, 'OTHERCODE123'],
    ];
    for (const [id, role, name, email, phone, mustChange, code] of users) {
      db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, address, commune, referral_code, must_change_password, created_at)
        VALUES (?, 'restaurant-a', ?, ?, ?, ?, ?, '12 avenue de la Paix', 'Gombe', ?, ?, ?)`, [id, role, name, email, phone, hash, code, mustChange, at]);
      if (role === 'student') db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES (?, 'restaurant-a', ?)`, [id, at]);
    }
    db.run('UPDATE users SET referred_by = ? WHERE id = ?', ['etu', 'filleul']);
    const order = (id: string, user: string, status: string, number: string) => db.run(`INSERT INTO orders (id, restaurant_id, user_id, order_number, type, status,
      payment_method, payment_status, subtotal_fc, discount_fc, delivery_fee_fc, total_fc, delivery_commune, delivery_address, delivery_phone, note, comment,
      created_at, updated_at) VALUES (?, 'restaurant-a', ?, ?, 'delivery', ?, 'cash', 'paid', 4000, 0, 0, 4000, 'Gombe', '12 avenue de la Paix', '+243810000501',
      'Sonner deux fois', 'Très bon', ?, ?)`, [id, user, number, status, at, at]);
    order('order-etu', 'etu', 'completed', '261104-001');
    order('order-busy', 'busy', 'preparing', '261104-002');
    order('order-other', 'other', 'completed', '261104-003');
    db.run(`INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, remaining, expires_at, order_id, created_at)
      VALUES ('lot-etu', 'restaurant-a', 'etu', 'earn', 3, 3, '2027-11-04T10:00:00.000Z', 'order-etu', ?)`, [at]);
    db.run(`INSERT INTO claims (id, restaurant_id, user_id, order_id, kind, subject, message, status, created_at, updated_at)
      VALUES ('claim-etu', 'restaurant-a', 'etu', 'order-etu', 'order', 'Plat froid', 'Mon plat est arrivé froid.', 'open', ?, ?)`, [at, at]);
    db.run(`INSERT INTO claims (id, restaurant_id, user_id, kind, subject, message, status, created_at, updated_at)
      VALUES ('claim-other', 'restaurant-a', 'other', 'other', 'Question', 'Une question d’un autre étudiant.', 'open', ?, ?)`, [at, at]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'compte-test-secret-long-enough-for-tests' }), {
      database: db, now: () => new Date(NOW),
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  const headers = (token?: string): HeadersInit => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' });

  async function login(identifier: string, password = PASSWORD): Promise<string> {
    const response = await fetch(`${server.base}/api/auth/login`, { method: 'POST', headers: headers(), body: JSON.stringify({ identifier, password }) });
    assert.equal(response.status, 200, `connexion de ${identifier}`);
    return ((await response.json()) as { token: string }).token;
  }

  const send = (method: string, path: string, token: string | undefined, body?: unknown) =>
    fetch(`${server.base}${path}`, { method, headers: headers(token), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

  it('exporte les données de l’étudiant, et seulement les siennes', async () => {
    const token = await login('etu@example.test');
    const response = await send('GET', '/api/me/export', token);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition') ?? '', /attachment; filename="mes-donnees\.json"/);
    const data = await response.json() as {
      account: { id: string; email: string; name: string }; memberships: Array<{ restaurant: string }>;
      orders: Array<{ id: string; orderNumber: string }>; points: Array<{ points: number }>;
      claims: Array<{ id: string }>; referrals: Array<{ name: string }>; exportedAt: string;
    };
    assert.equal(data.account.email, 'etu@example.test');
    assert.equal(data.exportedAt, NOW.toISOString());
    assert.deepEqual(data.memberships.map((item) => item.restaurant), ['compte-a']);
    assert.deepEqual(data.orders.map((item) => item.id), ['order-etu']);
    assert.deepEqual(data.points.map((item) => item.points), [3]);
    assert.deepEqual(data.claims.map((item) => item.id), ['claim-etu']);
    assert.deepEqual(data.referrals.map((item) => item.name), ['Filleul B.']);
    const serialized = JSON.stringify(data);
    for (const forbidden of ['password', 'order-other', 'claim-other', 'other@example.test', 'Kasongo', 'filleul@example.test']) {
      assert.ok(!serialized.includes(forbidden), `l’export ne doit pas contenir ${forbidden}`);
    }
    assert.equal((await send('GET', '/api/me/export', undefined)).status, 401);
  });

  it('change le mot de passe, invalide les anciens jetons et lève l’obligation de changement', async () => {
    const oldToken = await login('staff@example.test');
    assert.equal((await send('POST', '/api/auth/change-password', undefined, { currentPassword: PASSWORD, newPassword: 'Nouveau123' })).status, 401);
    const wrong = await send('POST', '/api/auth/change-password', oldToken, { currentPassword: 'Mauvais123', newPassword: 'Nouveau123' });
    assert.equal(wrong.status, 401);
    assert.equal(((await wrong.json()) as { error: { code: string } }).error.code, 'INVALID_CREDENTIALS');
    const weak = await send('POST', '/api/auth/change-password', oldToken, { currentPassword: PASSWORD, newPassword: 'faible' });
    assert.equal(weak.status, 422);
    assert.equal(((await weak.json()) as { error: { code: string } }).error.code, 'WEAK_PASSWORD');
    assert.equal((await send('POST', '/api/auth/change-password', oldToken, { currentPassword: PASSWORD, newPassword: PASSWORD })).status, 422);

    const changed = await send('POST', '/api/auth/change-password', oldToken, { currentPassword: PASSWORD, newPassword: 'Nouveau123' });
    assert.equal(changed.status, 200);
    const body = await changed.json() as { token: string; user: { mustChangePassword: boolean } };
    assert.equal(body.user.mustChangePassword, false);
    assert.equal(db.get<{ must_change_password: number }>('SELECT must_change_password FROM users WHERE id = ?', ['staff'])?.must_change_password, 0);
    assert.equal((await send('GET', '/api/me', oldToken)).status, 401, 'l’ancien jeton est invalidé');
    assert.equal((await send('GET', '/api/me', body.token)).status, 200);
    await login('staff@example.test', 'Nouveau123');
    assert.equal((await send('POST', '/api/auth/login', undefined, { identifier: 'staff@example.test', password: PASSWORD })).status, 401);
  });

  it('refuse la suppression avec un mauvais mot de passe, pour le personnel ou avec une commande en cours', async () => {
    const busy = await login('busy@example.test');
    const wrong = await send('DELETE', '/api/me', busy, { password: 'Mauvais123' });
    assert.equal(wrong.status, 401);
    const inProgress = await send('DELETE', '/api/me', busy, { password: PASSWORD });
    assert.equal(inProgress.status, 409);
    assert.equal(((await inProgress.json()) as { error: { code: string } }).error.code, 'ORDER_IN_PROGRESS');
    assert.equal(db.get<{ status: string }>('SELECT status FROM users WHERE id = ?', ['busy'])?.status, 'active');

    const staff = await login('staff@example.test', 'Nouveau123');
    assert.equal((await send('DELETE', '/api/me', staff, { password: 'Nouveau123' })).status, 403);
    assert.equal((await send('DELETE', '/api/me', undefined, { password: PASSWORD })).status, 401);
  });

  it('anonymise le compte, conserve la comptabilité, libère l’e-mail et le téléphone', async () => {
    const token = await login('etu@example.test');
    const response = await send('DELETE', '/api/me', token, { password: PASSWORD });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { deleted: true });

    const user = db.get<{ name: string; email: string; phone: string; address: string | null; commune: string | null; status: string; referral_code: string | null }>(
      'SELECT name, email, phone, address, commune, status, referral_code FROM users WHERE id = ?', ['etu']);
    assert.equal(user?.status, 'deleted');
    assert.equal(user?.name, 'Compte supprimé');
    assert.ok(user?.email.endsWith('@supprime.invalid') && !user.email.includes('etu@example.test'));
    assert.ok(!user?.phone.includes('810000501'));
    assert.equal(user?.address, null);
    assert.equal(user?.commune, null);
    assert.equal(user?.referral_code, null);

    const order = db.get<{ total_fc: number; delivery_address: string | null; delivery_phone: string | null; note: string | null; comment: string | null }>(
      'SELECT total_fc, delivery_address, delivery_phone, note, comment FROM orders WHERE id = ?', ['order-etu']);
    assert.deepEqual(order, { total_fc: 4000, delivery_address: null, delivery_phone: null, note: null, comment: null });
    const claim = db.get<{ subject: string; message: string }>('SELECT subject, message FROM claims WHERE id = ?', ['claim-etu']);
    assert.deepEqual(claim, { subject: 'Contenu supprimé', message: 'Contenu supprimé' });
    assert.equal(db.get<{ remaining: number }>('SELECT remaining FROM points_ledger WHERE id = ?', ['lot-etu'])?.remaining, 0);
    assert.equal(db.get<{ subject: string }>('SELECT subject FROM claims WHERE id = ?', ['claim-other'])?.subject, 'Question');

    assert.equal((await send('GET', '/api/me', token)).status, 401, 'le jeton ne marche plus');
    assert.equal((await send('POST', '/api/auth/login', undefined, { identifier: 'etu@example.test', password: PASSWORD })).status, 401);
    const again = await send('POST', '/api/restaurants/compte-a/auth/register', undefined, {
      name: 'Étudiant Mukendi', email: 'etu@example.test', phone: '+243810000501', password: PASSWORD, confirmPassword: PASSWORD, acceptTerms: true,
    });
    assert.equal(again.status, 201, 'l’e-mail et le téléphone sont libérés');
  });
});
