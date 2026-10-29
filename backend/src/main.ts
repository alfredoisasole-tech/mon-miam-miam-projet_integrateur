import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app.ts';
import { ConfigError, loadConfig } from './config.ts';
import { Database } from './db/database.ts';
import { migrate } from './db/migrations.ts';

try {
  const config = loadConfig();
  mkdirSync(dirname(config.databasePath), { recursive: true });
  const database = new Database(config.databasePath);
  migrate(database);
  const app = createApp(config, { database });
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[${new Date().toISOString()}] Mon Miam Miam : API prête sur le port ${config.port} (${config.env}).`);
  });
  server.on('close', () => database.close());
  // Arrêt propre : on laisse les requêtes en cours se terminer.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
} catch (erreur) {
  if (erreur instanceof ConfigError) {
    console.error(`Configuration invalide : ${erreur.message}`);
    process.exit(1);
  }
  throw erreur;
}
