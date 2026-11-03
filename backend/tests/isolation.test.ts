import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-11-03T10:00:00.000Z');
const OPENING_HOURS = JSON.stringify(Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '00:00', close: '23:59' }]]),
));

// Utilisateurs des deux restaurants A et B
const TOKENS = new Map<string, AuthenticatedUser>([
  ['token-admin-a', { id: 'admin-a', role: 'admin', restaurantId: 'resto-a', status: 'active' }],
  ['token-staff-a', { id: 'staff-a', role: 'employee', restaurantId: 'resto-a', status: 'active' }],
  ['token-student-a', { id: 'student-a', role: 'student', status: 'active' }],

  ['token-admin-b', { id: 'admin-b', role: 'admin', restaurantId: 'resto-b', status: 'active' }],
  ['token-staff-b', { id: 'staff-b', role: 'employee', restaurantId: 'resto-b', status: 'active' }],
  ['token-student-b', { id: 'student-b', role: 'student', status: 'active' }],
]);

describe('Tests d’isolation stricte inter-restaurants (Jira 12.3 & 19.2 / D-12)', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);

    // Création des 2 restaurants A et B
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, status, created_at) VALUES
      ('resto-a', 'resto-a', 'Restaurant Alpha', 'Arial', 'active', ?),
      ('resto-b', 'resto-b', 'Restaurant Beta', 'Arial', 'active', ?)`,
    [NOW.toISOString(), NOW.toISOString()]);

    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, spend_per_point_fc, points_per_meal, free_meal_cap_fc, updated_at) VALUES
      ('resto-a', ?, 3000, 15, 3000, ?),
      ('resto-b', ?, 3000, 15, 3000, ?)`,
    [OPENING_HOURS, NOW.toISOString(), OPENING_HOURS, NOW.toISOString()]);

    // Utilisateurs dans chaque restaurant
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES
      ('admin-a', 'resto-a', 'admin', 'Admin A', 'admin-a@test.com', '+243820000010', 'hash', ?),
      ('staff-a', 'resto-a', 'employee', 'Staff A', 'staff-a@test.com', '+243820000011', 'hash', ?),
      ('student-a', 'resto-a', 'student', 'Student A', 'student-a@test.com', '+243820000012', 'hash', ?),

      ('admin-b', 'resto-b', 'admin', 'Admin B', 'admin-b@test.com', '+243820000020', 'hash', ?),
      ('staff-b', 'resto-b', 'employee', 'Staff B', 'staff-b@test.com', '+243820000021', 'hash', ?),
      ('student-b', 'resto-b', 'student', 'Student B', 'student-b@test.com', '+243820000022', 'hash', ?)`,
    [NOW.toISOString(), NOW.toISOString(), NOW.toISOString(), NOW.toISOString(), NOW.toISOString(), NOW.toISOString()]);

    // Adhésions
    db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES
      ('student-a', 'resto-a', ?),
      ('student-b', 'resto-b', ?)`,
    [NOW.toISOString(), NOW.toISOString()]);

    // Plats dans chaque restaurant
    db.run(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, is_available, created_at, updated_at) VALUES
      ('plat-a-1', 'resto-a', 'Madesu Alpha', 4000, 'plat', 1, ?, ?),
      ('plat-b-1', 'resto-b', 'Pondu Beta', 5000, 'plat', 1, ?, ?)`,
    [NOW.toISOString(), NOW.toISOString(), NOW.toISOString(), NOW.toISOString()]);

    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db,
      now: () => new Date(NOW),
      resolveToken: (token) => TOKENS.get(token) ?? null,
    }));
  });

  after(async () => {
    await server.fermer();
    db.close();
  });

  it('l’employé de A ne voit pas les commandes du restaurant B', async () => {
    // Student B commande chez Resto B
    const createRes = await fetch(`${server.base}/api/orders`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-student-b',
        'content-type': 'application/json',
        'Idempotency-Key': 'order-isolation-b-01',
      },
      body: JSON.stringify({
        restaurant: 'resto-b',
        type: 'dine_in',
        paymentMethod: 'cash',
        items: [{ menuItemId: 'plat-b-1', quantity: 1 }],
      }),
    });
    assert.equal(createRes.status, 201);
    const orderB = await createRes.json() as { id: string };

    // Staff de A liste les commandes du personnel
    const listA = await fetch(`${server.base}/api/staff/orders`, {
      headers: { authorization: 'Bearer token-staff-a' },
    });
    assert.equal(listA.status, 200);
    const ordersA = (await listA.json() as { items: Array<{ id: string }> }).items;
    assert.ok(ordersA.every((o) => o.id !== orderB.id));

    // Staff de A tente d'avancer la commande de B -> refusé (404 Not Found)
    const updateRes = await fetch(`${server.base}/api/staff/orders/${orderB.id}/status`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer token-staff-a',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    assert.equal(updateRes.status, 404);
  });

  it('l’administrateur de A ne peut pas modifier un plat de B', async () => {
    // Admin A essaie de modifier le plat du restaurant B
    const updateRes = await fetch(`${server.base}/api/admin/menu/plat-b-1`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer token-admin-a',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Piratage de Plat B' }),
    });
    assert.equal(updateRes.status, 404);

    // Le plat de B n'a pas été altéré
    const dish = db.get<{ name: string }>('SELECT name FROM menu_items WHERE id = ?', ['plat-b-1']);
    assert.equal(dish?.name, 'Pondu Beta');
  });

  it('les points gagnés en A ne sont pas utilisables en B', async () => {
    // Crédit de 20 points pour student-a dans restaurant A
    db.run(`INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, remaining, created_at) VALUES
      ('points-a-1', 'resto-a', 'student-a', 'earn', 20, 20, ?)`,
    [NOW.toISOString()]);

    // Student A adhère aussi à B
    db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES ('student-a', 'resto-b', ?)`,
      [NOW.toISOString()]);

    // Tentative de passer une commande avec remise de points chez B -> Solde insuffisant (422)
    const res = await fetch(`${server.base}/api/orders`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-student-a',
        'content-type': 'application/json',
        'Idempotency-Key': 'order-isolation-points-01',
      },
      body: JSON.stringify({
        restaurant: 'resto-b',
        type: 'dine_in',
        paymentMethod: 'cash',
        redeemMeal: true,
        items: [{ menuItemId: 'plat-b-1', quantity: 1 }],
      }),
    });
    assert.equal(res.status, 422);
  });

  it('la désactivation de A ne bloque pas l’activité de B', async () => {
    // Désactivation de restaurant A
    db.run(`UPDATE restaurants SET status = 'inactive' WHERE id = 'resto-a'`);

    // Vérification que le restaurant A refuse les nouvelles commandes
    const resA = await fetch(`${server.base}/api/orders`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-student-a',
        'content-type': 'application/json',
        'Idempotency-Key': 'order-disabled-a-01',
      },
      body: JSON.stringify({
        restaurant: 'resto-a',
        type: 'dine_in',
        paymentMethod: 'cash',
        items: [{ menuItemId: 'plat-a-1', quantity: 1 }],
      }),
    });
    assert.equal(resA.status, 404);

    // Vérification que le restaurant B fonctionne toujours normalement
    const resB = await fetch(`${server.base}/api/orders`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer token-student-b',
        'content-type': 'application/json',
        'Idempotency-Key': 'order-active-b-02',
      },
      body: JSON.stringify({
        restaurant: 'resto-b',
        type: 'dine_in',
        paymentMethod: 'cash',
        items: [{ menuItemId: 'plat-b-1', quantity: 1 }],
      }),
    });
    assert.equal(resB.status, 201);
  });
});
