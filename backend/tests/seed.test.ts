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
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM restaurants')?.total, 4);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM users')?.total, 8);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM menu_items')?.total, 40);
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

test('le seed ajoute les restaurants manquants à une base déjà peuplée, sans toucher à l’existant', () => {
  const db = new Database(':memory:');
  try {
    migrate(db);
    const credentials = { restaurantAdminPassword: 'AdminDemo1', employeePassword: 'EmployeDemo1', studentPassword: 'EtudiantDemo1', platformAdminPassword: 'PlateformeDemo1' };
    seedDemoData(db, credentials);
    // Une base d'avant l'ajout des deux derniers restaurants.
    for (const id of ['demo-restaurant-wok', 'demo-restaurant-pizza']) {
      db.run('DELETE FROM menu_items WHERE restaurant_id = ?', [id]);
      db.run('DELETE FROM restaurant_settings WHERE restaurant_id = ?', [id]);
      db.run('DELETE FROM users WHERE restaurant_id = ?', [id]);
      db.run('DELETE FROM restaurants WHERE id = ?', [id]);
    }
    const before = db.get<{ total: number }>('SELECT COUNT(*) AS total FROM menu_items')?.total;
    assert.equal(seedDemoData(db, credentials), 'created');
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM restaurants')?.total, 4);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM menu_items')?.total, (before ?? 0) + 20);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM platform_admins')?.total, 1);
    assert.equal(db.get<{ total: number }>("SELECT COUNT(*) AS total FROM users WHERE role = 'student'")?.total, 1);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM memberships')?.total, 2);
    assert.equal(seedDemoData(db, credentials), 'already-present');
  } finally { db.close(); }
});
