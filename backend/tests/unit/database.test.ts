import assert from 'node:assert/strict';
import test from 'node:test';
import { Database } from '../../src/db/database.ts';
import { migrate, migrations } from '../../src/db/migrations.ts';

test('les migrations peuvent être rejouées sans recréer le schéma', () => {
  const db = new Database(':memory:');
  try {
    migrate(db);
    migrate(db);
    assert.equal(db.get<{ total: number }>(
      "SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )?.total, 19);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM schema_migrations')?.total, 6);
  } finally {
    db.close();
  }
});

test('une erreur annule toutes les écritures de la transaction', () => {
  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE transaction_probe (value TEXT NOT NULL)');
    assert.throws(() => db.transaction(() => {
      db.run('INSERT INTO transaction_probe (value) VALUES (?)', ['temporary']);
      throw new Error('rollback');
    }), /rollback/);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM transaction_probe')?.total, 0);
  } finally {
    db.close();
  }
});

test('les clés étrangères sont activées sur chaque connexion', () => {
  const db = new Database(':memory:');
  try {
    assert.equal(db.get<{ foreign_keys: number }>('PRAGMA foreign_keys')?.foreign_keys, 1);
  } finally {
    db.close();
  }
});

test('la migration 006 retire le restaurant d’origine des étudiants sans toucher au personnel ni aux adhésions', () => {
  const db = new Database(':memory:');
  try {
    // Base existante : seules les migrations 001 à 005 ont été appliquées.
    db.exec('CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    for (const migration of migrations.slice(0, 5)) {
      db.exec(migration.sql);
      db.run('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [migration.id, 'now']);
    }
    db.run("INSERT INTO restaurants (id, slug, name, primary_color, secondary_color, font_family, default_mode, timezone, created_at) VALUES ('r1', 'r1', 'R1', '#000000', '#ffffff', 'Poppins', 'light', 'Africa/Kinshasa', 'now')");
    db.run("INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES ('s1', 'r1', 'student', 'S', 's@x.test', '+243810000001', 'x', 'now')");
    db.run("INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, referred_by, created_at) VALUES ('s2', 'r1', 'student', 'S2', 's2@x.test', '+243810000004', 'x', 's1', 'now')");
    db.run("INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES ('a1', 'r1', 'admin', 'A', 'a@x.test', '+243810000002', 'x', 'now')");
    db.run("INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES ('s1', 'r1', 'now')");

    migrate(db);

    const restaurantOf = (id: string) => db.get<{ restaurant_id: string | null }>('SELECT restaurant_id FROM users WHERE id = ?', [id])?.restaurant_id;
    assert.equal(restaurantOf('s1'), null);
    assert.equal(restaurantOf('s2'), null);
    assert.equal(restaurantOf('a1'), 'r1');
    assert.equal(db.get<{ referred_by: string }>("SELECT referred_by FROM users WHERE id = 's2'")?.referred_by, 's1');
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM memberships')?.total, 1);
    assert.deepEqual(db.all('PRAGMA foreign_key_check'), []);
    assert.throws(() => db.run("INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES ('e1', NULL, 'employee', 'E', 'e@x.test', '+243810000003', 'x', 'now')"));
  } finally {
    db.close();
  }
});
