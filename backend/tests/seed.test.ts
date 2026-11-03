import assert from 'node:assert/strict';
import test from 'node:test';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { seedDemoData } from '../src/seed.ts';
import { AuthService } from '../src/services/auth.service.ts';

test('le seed crée les données de démonstration sans doublons au second lancement', () => {
  const db = new Database(':memory:');
  try {
    migrate(db);
    const credentials = {
      restaurantAdminPassword: 'AdminDemo1',
      employeePassword: 'EmployeDemo1',
      studentPassword: 'EtudiantDemo1',
      platformAdminPassword: 'PlateformeDemo1',
    };
    assert.equal(seedDemoData(db, credentials), 'created');
    assert.equal(seedDemoData(db, credentials), 'already-present');
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM restaurants')?.total, 2);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM users')?.total, 4);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM menu_items')?.total, 20);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM memberships')?.total, 2);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM platform_admins')?.total, 1);
    assert.equal(db.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = 'demo-student'")?.password_hash.startsWith('scrypt$'), true);
    const auth = new AuthService(db, 'seed-test-secret-long-enough-for-signing');
    const zeducAdmin = auth.login('admin@zeduc-space.test', credentials.restaurantAdminPassword, '127.0.0.1');
    const leaAdmin = auth.login('admin@chez-lea.test', credentials.restaurantAdminPassword, '127.0.0.1');
    assert.equal(zeducAdmin.user.role, 'admin');
    assert.equal(leaAdmin.user.role, 'admin');
    assert.equal(auth.authenticate(zeducAdmin.token)?.restaurantId, 'demo-restaurant-zeduc');
    assert.equal(auth.authenticate(leaAdmin.token)?.restaurantId, 'demo-restaurant-lea');
  } finally { db.close(); }
});
