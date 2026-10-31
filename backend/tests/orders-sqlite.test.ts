import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { hashPassword } from '../src/services/auth.service.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-10-29T08:30:00.000Z');
const JWT_SECRET = 'test-secret-with-more-than-32-characters';

describe('commandes SQLite en production', () => {
  let db: Database;
  let server: Serveur;
  let studentToken: string;
  let employeeToken: string;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    const now = '2026-10-01T00:00:00.000Z';
    const openingHours = JSON.stringify({ thu: [{ open: '09:00', close: '10:00' }] });
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at)
      VALUES ('restaurant-sql', 'restaurant-sql', 'Restaurant SQL', 'Arial', ?)`, [now]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at)
      VALUES ('restaurant-sql', ?, ?)`, [openingHours, now]);
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
      VALUES ('student-sql', 'restaurant-sql', 'student', 'Étudiant SQL', 'student@example.test', '+243820000001', ?, ?)`,
    [hashPassword('StudentPass1'), now]);
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
      VALUES ('employee-sql', 'restaurant-sql', 'employee', 'Employé SQL', 'employee@example.test', '+243820000002', ?, ?)`,
    [hashPassword('EmployeePass1'), now]);
    db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at)
      VALUES ('student-sql', 'restaurant-sql', ?)`, [now]);
    db.run(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at)
      VALUES ('dish-sql', 'restaurant-sql', 'Plat SQL', 3000, 'plat', ?, ?)`, [now, now]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET }), { database: db, now: () => new Date(NOW) }));

    studentToken = await login('student@example.test', 'StudentPass1');
    employeeToken = await login('employee@example.test', 'EmployeePass1');
  });

  after(async () => { await server.fermer(); db.close(); });

  async function login(identifier: string, password: string): Promise<string> {
    const response = await fetch(`${server.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  }

  it('crée une commande persistée, la rejoue sans doublon et suit les statuts du personnel', async () => {
    const body = {
      restaurant: 'restaurant-sql',
      type: 'dine_in',
      items: [{ menuItemId: 'dish-sql', quantity: 2 }],
      redeemMeal: false,
    };
    const create = () => fetch(`${server.base}/api/orders`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${studentToken}`,
        'content-type': 'application/json',
        'Idempotency-Key': 'sqlite-order-key-01',
      },
      body: JSON.stringify(body),
    });
    const response = await create();
    assert.equal(response.status, 201);
    const order = await response.json() as { id: string; totalFc: number; status: string };
    assert.equal(order.totalFc, 6000);
    assert.equal(order.status, 'pending');
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM orders')?.total, 1);

    const replay = await create();
    assert.equal(replay.status, 200);
    assert.equal(replay.headers.get('Idempotent-Replayed'), 'true');

    const statusChange = await fetch(`${server.base}/api/staff/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${employeeToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    assert.equal(statusChange.status, 200);

    const detail = await fetch(`${server.base}/api/orders/${order.id}`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    assert.equal(detail.status, 200);
    const tracked = await detail.json() as { status: string; events: Array<{ status: string }> };
    assert.equal(tracked.status, 'confirmed');
    assert.deepEqual(tracked.events.map((event) => event.status), ['pending', 'confirmed']);
  });
});
