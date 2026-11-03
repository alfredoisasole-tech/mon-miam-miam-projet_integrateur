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
