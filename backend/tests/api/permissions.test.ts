import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.ts';
import { loadConfig } from '../../src/config.ts';
import { Database } from '../../src/db/database.ts';
import { migrate } from '../../src/db/migrations.ts';
import type { AuthenticatedUser } from '../../src/domain/orders.ts';
import { hashPassword } from '../../src/services/auth.service.ts';
import { seedDemoData } from '../../src/seed.ts';
import { demarrer, type Serveur } from '../helpers.ts';

type Role = 'student' | 'employee' | 'manager' | 'admin' | 'platform_admin';

const ROLES: Role[] = ['student', 'employee', 'manager', 'admin', 'platform_admin'];
const STAFF = ['employee', 'manager', 'admin'] as const;
const TOKENS = new Map<string, AuthenticatedUser>([
  ['student', { id: 'demo-student', role: 'student', restaurantId: 'demo-restaurant-zeduc', status: 'active' }],
  ['employee', { id: 'demo-employee', role: 'employee', restaurantId: 'demo-restaurant-zeduc', status: 'active' }],
  ['manager', { id: 'permission-manager', role: 'manager', restaurantId: 'demo-restaurant-zeduc', status: 'active' }],
  ['admin', { id: 'demo-admin-zeduc', role: 'admin', restaurantId: 'demo-restaurant-zeduc', status: 'active' }],
  ['platform_admin', { id: 'demo-platform-admin', role: 'platform_admin', status: 'active' }],
]);

// Les rôles attendus viennent des contrats API et de docs/roles-permissions.md,
// pas des gardes du contrôleur : toute divergence de code doit faire échouer la matrice.
const cases: Array<{ method: string; path: string; allowed: Role[] }> = [
  { method: 'GET', path: '/api/me', allowed: ROLES },
  { method: 'POST', path: '/api/orders', allowed: ['student'] },
  { method: 'GET', path: '/api/orders', allowed: ['student'] },
  { method: 'GET', path: '/api/orders/missing', allowed: ['student'] },
  { method: 'POST', path: '/api/orders/missing/cancel', allowed: ['student'] },
  { method: 'POST', path: '/api/orders/missing/pay', allowed: ['student'] },
  { method: 'POST', path: '/api/payments/missing/simulate', allowed: ['student'] },
  { method: 'GET', path: '/api/restaurants/zeduc-space/loyalty', allowed: ['student'] },
  { method: 'GET', path: '/api/staff/orders', allowed: [...STAFF] },
  { method: 'PATCH', path: '/api/staff/orders/missing/status', allowed: [...STAFF] },
  { method: 'GET', path: '/api/staff/menu', allowed: [...STAFF] },
  { method: 'PATCH', path: '/api/staff/menu/missing', allowed: [...STAFF] },
  { method: 'GET', path: '/api/staff/accounts', allowed: ['manager', 'admin'] },
  { method: 'POST', path: '/api/staff/accounts', allowed: ['manager', 'admin'] },
  { method: 'PATCH', path: '/api/staff/accounts/missing', allowed: ['admin'] },
  { method: 'POST', path: '/api/admin/menu', allowed: ['admin'] },
  { method: 'PATCH', path: '/api/admin/menu/missing', allowed: ['admin'] },
  { method: 'DELETE', path: '/api/admin/menu/missing', allowed: ['admin'] },
  { method: 'GET', path: '/api/admin/promotions', allowed: ['admin'] },
  { method: 'POST', path: '/api/admin/promotions', allowed: ['admin'] },
  { method: 'PATCH', path: '/api/admin/promotions/missing', allowed: ['admin'] },
  { method: 'DELETE', path: '/api/admin/promotions/missing', allowed: ['admin'] },
  { method: 'GET', path: '/api/staff/stats/overview', allowed: ['manager', 'admin'] },
  { method: 'GET', path: '/api/staff/stats/weekly', allowed: [...STAFF] },
  { method: 'POST', path: '/api/platform/restaurants', allowed: ['platform_admin'] },
  { method: 'PATCH', path: '/api/platform/restaurants/missing/status', allowed: ['platform_admin'] },
];

describe('matrice rôle × route — accès API sensibles', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    seedDemoData(db, {
      restaurantAdminPassword: 'AdminDemo1', employeePassword: 'EmployeDemo1',
      studentPassword: 'EtudiantDemo1', platformAdminPassword: 'PlateformeDemo1',
    });
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
      VALUES ('permission-manager', 'demo-restaurant-zeduc', 'manager', 'Gérant test',
        'permission-manager@example.test', '+243810000099', ?, '2026-11-03T00:00:00.000Z')`, [hashPassword('ManagerPass1')]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db,
      resolveToken: (token) => TOKENS.get(token) ?? null,
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  for (const route of cases) {
    it(`${route.method} ${route.path} répond 401 sans jeton ou jeton invalide et applique la matrice de rôles`, async () => {
      const call = (token?: Role) => fetch(`${server.base}${route.path}`, {
        method: route.method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          'content-type': 'application/json',
        },
        ...(['POST', 'PATCH'].includes(route.method) ? { body: '{}' } : {}),
      });

      assert.equal((await call()).status, 401, 'une route sensible doit refuser une requête sans jeton');
      assert.equal((await fetch(`${server.base}${route.path}`, {
        method: route.method,
        headers: { authorization: 'Bearer jeton-invalide', 'content-type': 'application/json' },
        ...(['POST', 'PATCH'].includes(route.method) ? { body: '{}' } : {}),
      })).status, 401, 'une route sensible doit refuser un jeton invalide');
      for (const role of ROLES) {
        const response = await call(role);
        if (route.allowed.includes(role)) {
          assert.notEqual(response.status, 401, `${role} doit être authentifié`);
          assert.notEqual(response.status, 403, `${role} doit être autorisé`);
        } else {
          assert.equal(response.status, 403, `${role} ne doit pas accéder à cette route`);
        }
      }
    });
  }
});
