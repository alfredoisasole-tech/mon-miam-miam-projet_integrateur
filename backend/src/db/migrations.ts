import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Database } from './database.ts';

export type Migration = { id: string; sql: string };

const schemaPath = new URL('../../../database/schema.sql', import.meta.url);

// Règle : une migration déjà fusionnée ne se modifie jamais. Tout changement
// de la base ajoute une nouvelle migration numérotée (002_..., 003_...),
// sinon les bases existantes ne seraient pas mises à jour.
// Le schéma est lu depuis le dossier `database/` à la racine du dépôt :
// le serveur doit donc être lancé avec le dépôt complet.
export const migrations: Migration[] = [
  { id: '001_initial', sql: readFileSync(fileURLToPath(schemaPath), 'utf8') },
  { id: '002_order_sequences', sql: `
    CREATE TABLE IF NOT EXISTS order_sequences (
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
      day_key TEXT NOT NULL,
      next_value INTEGER NOT NULL CHECK (next_value > 0),
      PRIMARY KEY (restaurant_id, day_key)
    );
    INSERT INTO order_sequences (restaurant_id, day_key, next_value)
    SELECT restaurant_id, substr(order_number, 1, 6), MAX(CAST(substr(order_number, 8) AS INTEGER)) + 1
    FROM orders
    WHERE length(order_number) >= 10 AND substr(order_number, 7, 1) = '-'
      AND substr(order_number, 8) NOT GLOB '*[^0-9]*'
    GROUP BY restaurant_id, substr(order_number, 1, 6)
    ON CONFLICT (restaurant_id, day_key) DO UPDATE SET next_value = MAX(next_value, excluded.next_value);
  ` },
  { id: '003_auth_lockouts', sql: `
    CREATE TABLE IF NOT EXISTS auth_lockouts (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      locked_at TEXT NOT NULL
    );
  ` },
  { id: '004_auth_versions', sql: `
    ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE platform_admins ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
  ` },
];

export function migrate(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  for (const migration of migrations) {
    const alreadyApplied = db.get<{ id: string }>(
      'SELECT id FROM schema_migrations WHERE id = ?',
      [migration.id],
    );
    if (alreadyApplied) continue;

    db.transaction(() => {
      db.exec(migration.sql);
      db.run('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [
        migration.id,
        new Date().toISOString(),
      ]);
    });
  }
}
