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
