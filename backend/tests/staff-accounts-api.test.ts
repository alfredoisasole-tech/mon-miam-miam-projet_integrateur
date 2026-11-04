import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { hashPassword } from '../src/services/auth.service.ts';
import { demarrer, type Serveur } from './helpers.ts';

const PASSWORD = 'AdminDemo1';
let phoneSequence = 10;

describe('API des comptes du personnel', () => {
  let db: Database;
  let server: Serveur;
  let adminToken: string;
  let adminBToken: string;
  let managerToken: string;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    const createdAt = '2026-11-03T08:00:00.000Z';
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('restaurant-a', 'staff-a', 'Restaurant A', 'Arial', ?),
      ('restaurant-b', 'staff-b', 'Restaurant B', 'Arial', ?)`, [createdAt, createdAt]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
      ('restaurant-a', '{}', ?), ('restaurant-b', '{}', ?)`, [createdAt, createdAt]);
    const passwordHash = hashPassword(PASSWORD);
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES
      ('admin-a', 'restaurant-a', 'admin', 'Admin A', 'admin-a@example.test', '+243810000001', ?, ?),
      ('manager-a', 'restaurant-a', 'manager', 'Manager A', 'manager-a@example.test', '+243810000002', ?, ?),
      ('admin-b', 'restaurant-b', 'admin', 'Admin B', 'admin-b@example.test', '+243810000003', ?, ?)`,
    [passwordHash, createdAt, passwordHash, createdAt, passwordHash, createdAt]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'staff-account-test-secret-long-enough' }), { database: db }));
    adminToken = await login('admin-a@example.test');
    adminBToken = await login('admin-b@example.test');
    managerToken = await login('manager-a@example.test');
  });

  after(async () => { await server.fermer(); db.close(); });

  function auth(token: string): HeadersInit {
    return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  }

  async function login(identifier: string, password = PASSWORD): Promise<string> {
    const response = await fetch(`${server.base}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  }

  async function create(token: string, email: string, role = 'employee') {
    const phone = `+24382${String(phoneSequence++).padStart(7, '0')}`;
    return fetch(`${server.base}/api/staff/accounts`, {
      method: 'POST', headers: auth(token),
      body: JSON.stringify({ name: 'Compte Test', email, phone, role }),
    });
  }

  it('réserve les rôles, rattache les comptes au restaurant et ne montre le mot de passe qu’à la création', async () => {
    const unauthenticated = await fetch(`${server.base}/api/staff/accounts`);
    assert.equal(unauthenticated.status, 401);

    const employee = await create(managerToken, 'employee@example.test');
    assert.equal(employee.status, 201);
    const created = await employee.json() as {
      account: { id: string; role: string; mustChangePassword: boolean };
      temporaryPassword: string;
    };
    assert.equal(created.account.role, 'employee');
    assert.equal(created.account.mustChangePassword, true);
    assert.match(created.temporaryPassword, /^(?=.*[A-Z])(?=.*\d).{8,}$/);
    const persisted = db.get<{ restaurant_id: string; must_change_password: number; password_hash: string }>(
      'SELECT restaurant_id, must_change_password, password_hash FROM users WHERE id = ?', [created.account.id],
    );
    assert.equal(persisted?.restaurant_id, 'restaurant-a');
    assert.equal(persisted?.must_change_password, 1);
    assert.notEqual(persisted?.password_hash, created.temporaryPassword);

    const listed = await fetch(`${server.base}/api/staff/accounts`, { headers: auth(managerToken) });
    assert.equal(listed.status, 200);
    const accounts = await listed.json() as Array<Record<string, unknown>>;
    assert.ok(accounts.some((account) => account.id === created.account.id));
    assert.ok(accounts.every((account) => !('password' in account) && !('passwordHash' in account) && !('temporaryPassword' in account)));
    assert.ok(accounts.every((account) => account.id !== 'admin-b'));

    const cannotCreateManager = await create(managerToken, 'manager-new@example.test', 'manager');
    assert.equal(cannotCreateManager.status, 400);
    const cannotCreateAdmin = await create(adminToken, 'admin-new@example.test', 'admin');
    assert.equal(cannotCreateAdmin.status, 400);
    const canCreateManager = await create(adminToken, 'manager-new@example.test', 'manager');
    assert.equal(canCreateManager.status, 201);
  });

  it('désactive un compte, invalide son ancien jeton et masque les comptes des autres restaurants', async () => {
    const createdResponse = await create(adminToken, 'disable-me@example.test');
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json() as { account: { id: string; email: string }; temporaryPassword: string };
    const employeeToken = await login(created.account.email, created.temporaryPassword);

    const crossRestaurant = await fetch(`${server.base}/api/staff/accounts/admin-b`, {
      method: 'PATCH', headers: auth(adminToken), body: JSON.stringify({ status: 'inactive' }),
    });
    assert.equal(crossRestaurant.status, 404);

    const disabled = await fetch(`${server.base}/api/staff/accounts/${created.account.id}`, {
      method: 'PATCH', headers: auth(adminToken), body: JSON.stringify({ status: 'inactive' }),
    });
    assert.equal(disabled.status, 200);
    const denied = await fetch(`${server.base}/api/staff/accounts`, { headers: auth(employeeToken) });
    assert.equal(denied.status, 401);
  });

  describe('modification d’un compte du personnel', () => {
    async function made(email: string, role = 'employee') {
      const response = await create(adminToken, email, role);
      assert.equal(response.status, 201);
      return await response.json() as { account: { id: string; email: string; phone: string }; temporaryPassword: string };
    }
    const patch = (token: string, id: string, body: unknown) => fetch(`${server.base}/api/staff/accounts/${id}`, {
      method: 'PATCH', headers: auth(token), body: JSON.stringify(body),
    });

    it('modifie le nom, le téléphone et le rôle, puis renvoie le compte à jour', async () => {
      const created = await made('edit-me@example.test');
      const response = await patch(adminToken, created.account.id, { name: 'Nouveau Nom', phone: '0821234567', role: 'manager' });
      assert.equal(response.status, 200);
      const body = await response.json() as { account: Record<string, unknown> };
      assert.equal(body.account['name'], 'Nouveau Nom');
      assert.equal(body.account['phone'], '+243821234567');
      assert.equal(body.account['role'], 'manager');
      assert.equal(body.account['email'], created.account.email, 'l’e-mail, identifiant de connexion, ne change pas');
      assert.ok(!('passwordHash' in body.account));
      assert.equal(db.get<{ name: string }>('SELECT name FROM users WHERE id = ?', [created.account.id])?.name, 'Nouveau Nom');
    });

    it('accepte une modification partielle', async () => {
      const created = await made('partial@example.test');
      const response = await patch(adminToken, created.account.id, { name: 'Seulement Le Nom' });
      assert.equal(response.status, 200);
      assert.equal(db.get<{ role: string; phone: string }>('SELECT role, phone FROM users WHERE id = ?', [created.account.id])?.role, 'employee');
    });

    it('révoque les jetons quand le rôle ou le téléphone change, mais pas quand seul le nom change', async () => {
      const created = await made('revoke@example.test');
      const token = await login(created.account.email, created.temporaryPassword);
      // Un employé n'a pas accès à cette liste : 403 tant que son jeton est valide, 401 une fois révoqué.
      const probe = () => fetch(`${server.base}/api/staff/accounts`, { headers: auth(token) }).then(r => r.status);
      assert.equal(await probe(), 403);
      await patch(adminToken, created.account.id, { name: 'Autre Nom' });
      assert.equal(await probe(), 403, 'un simple changement de nom garde la session');
      await patch(adminToken, created.account.id, { role: 'manager' });
      assert.equal(await probe(), 401, 'un changement de rôle oblige à se reconnecter');
    });

    it('réactive un compte désactivé, qui peut de nouveau se connecter', async () => {
      const created = await made('reactivate@example.test');
      assert.equal((await patch(adminToken, created.account.id, { status: 'inactive' })).status, 200);
      const blocked = await fetch(`${server.base}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: created.account.email, password: created.temporaryPassword }),
      });
      assert.notEqual(blocked.status, 200);
      const reactivated = await patch(adminToken, created.account.id, { status: 'active' });
      assert.equal(reactivated.status, 200);
      assert.equal(((await reactivated.json()) as { account: { status: string } }).account.status, 'active');
      await login(created.account.email, created.temporaryPassword);
    });

    it('refuse un téléphone déjà utilisé par un autre compte', async () => {
      const first = await made('phone-1@example.test');
      const second = await made('phone-2@example.test');
      const response = await patch(adminToken, second.account.id, { phone: first.account.phone });
      assert.equal(response.status, 409);
      assert.equal(((await response.json()) as { error: { code: string } }).error.code, 'ACCOUNT_TAKEN');
    });

    it('accepte de rejouer son propre numéro', async () => {
      const created = await made('same-phone@example.test');
      assert.equal((await patch(adminToken, created.account.id, { phone: created.account.phone })).status, 200);
    });

    it('refuse les champs interdits, les valeurs invalides, les corps vides et le rôle administrateur', async () => {
      const created = await made('invalid@example.test');
      for (const body of [{}, { email: 'autre@example.test' }, { restaurantId: 'restaurant-b' }, { name: 'A' }, { phone: '12' },
        { role: 'admin' }, { role: 'student' }, { status: 'deleted' }, { name: 'Ok Nom', status: 'inactive' }, [], 'x']) {
        const response = await patch(adminToken, created.account.id, body);
        assert.equal(response.status, 400, JSON.stringify(body));
      }
    });

    it('interdit à un administrateur de modifier son propre rôle ou son propre état', async () => {
      assert.equal((await patch(adminToken, 'admin-a', { role: 'employee' })).status, 400);
      assert.equal((await patch(adminToken, 'admin-a', { status: 'inactive' })).status, 400);
      assert.equal((await patch(adminToken, 'admin-a', { name: 'Admin A Renommé' })).status, 200, 'son nom reste modifiable');
    });

    it('ne modifie ni les comptes d’un autre restaurant ni les comptes non personnels', async () => {
      const created = await made('scope@example.test');
      assert.equal((await patch(adminBToken, created.account.id, { name: 'Intrus Total' })).status, 404);
      assert.equal(db.get<{ name: string }>('SELECT name FROM users WHERE id = ?', [created.account.id])?.name, 'Compte Test');
      db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
        VALUES ('student-scope', 'restaurant-a', 'student', 'Étudiant', 'student-scope@example.test', '+243810009999', 'x', '2026-11-03T08:00:00.000Z')`);
      assert.equal((await patch(adminToken, 'student-scope', { name: 'Hors Personnel' })).status, 404);
    });

    it('est réservé à l’administrateur du restaurant', async () => {
      const created = await made('forbidden@example.test');
      assert.equal((await patch(managerToken, created.account.id, { name: 'Gérant Interdit' })).status, 403);
      const anonymous = await fetch(`${server.base}/api/staff/accounts/${created.account.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Sans Jeton' }),
      });
      assert.equal(anonymous.status, 401);
    });
  });

  it('déduit le restaurant du jeton et refuse la lecture ou la désactivation directe des comptes d’un autre restaurant', async () => {
    const createdResponse = await create(adminBToken, 'employee-b@example.test');
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json() as { account: { id: string } };
    assert.equal(db.get<{ restaurant_id: string }>(
      'SELECT restaurant_id FROM users WHERE id = ?', [created.account.id],
    )?.restaurant_id, 'restaurant-b');

    const listA = await fetch(`${server.base}/api/staff/accounts?restaurantId=restaurant-b`, {
      headers: auth(adminToken),
    });
    assert.equal(listA.status, 200);
    const accountsA = await listA.json() as Array<{ id: string }>;
    assert.ok(accountsA.every((account) => account.id !== created.account.id));

    const crossRestaurant = await fetch(`${server.base}/api/staff/accounts/${created.account.id}`, {
      method: 'PATCH', headers: auth(adminToken), body: JSON.stringify({ status: 'inactive' }),
    });
    assert.equal(crossRestaurant.status, 404);
    assert.equal(db.get<{ status: string }>(
      'SELECT status FROM users WHERE id = ?', [created.account.id],
    )?.status, 'active');
  });
});
