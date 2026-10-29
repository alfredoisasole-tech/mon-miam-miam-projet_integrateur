import assert from 'node:assert/strict';
import test from 'node:test';
import { Database } from '../../src/db/database.ts';
import { migrate } from '../../src/db/migrations.ts';

test('les migrations peuvent être rejouées sans recréer le schéma', () => {
  const db = new Database(':memory:');
  try {
    migrate(db);
    migrate(db);
    assert.equal(db.get<{ total: number }>(
      "SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )?.total, 17);
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM schema_migrations')?.total, 1);
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
