import { createApp } from './app.ts';
import { ConfigError, loadConfig } from './config.ts';

try {
  const config = loadConfig();
  const app = createApp(config);
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[${new Date().toISOString()}] Mon Miam Miam : API prête sur le port ${config.port} (${config.env}).`);
  });
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
