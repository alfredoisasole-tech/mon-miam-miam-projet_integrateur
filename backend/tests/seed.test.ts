import assert from 'node:assert/strict';
import test from 'node:test';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { seedDemoData } from '../src/seed.ts';

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
  } finally { db.close(); }
});
