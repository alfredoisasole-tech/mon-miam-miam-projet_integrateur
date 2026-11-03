import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ConfigError, loadConfig } from '../config.ts';
import { Database } from '../db/database.ts';
import { migrate } from '../db/migrations.ts';

// Crée (ou met à jour) les tables de la base sans démarrer le serveur.
// Rejouer ce script est sans danger : les migrations déjà appliquées sont ignorées.
try {
  const config = loadConfig();
  mkdirSync(dirname(config.databasePath), { recursive: true });
  const db = new Database(config.databasePath);
  try {
    migrate(db);
    const total = db.get<{ total: number }>('SELECT COUNT(*) AS total FROM schema_migrations')?.total ?? 0;
    console.log(`Base prête : ${config.databasePath} (${total} migrations appliquées).`);
  } finally { db.close(); }
} catch (error) {
  if (error instanceof ConfigError) console.error(`Configuration invalide : ${error.message}`);
  else console.error('Échec de la création de la base :', error);
  process.exitCode = 1;
}
