import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Database } from './database.ts';

export type Migration = { id: string; sql: string };

const schemaPath = new URL('../../../database/schema.sql', import.meta.url);

export const migrations: Migration[] = [
  { id: '001_initial', sql: readFileSync(fileURLToPath(schemaPath), 'utf8') },
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
