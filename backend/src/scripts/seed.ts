import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ConfigError, loadConfig } from '../config.ts';
import { Database } from '../db/database.ts';
import { migrate } from '../db/migrations.ts';
import { seedDemoData, type SeedCredentials } from '../seed.ts';

function readCredentials(): SeedCredentials {
  const values = {
    restaurantAdminPassword: process.env['SEED_RESTAURANT_ADMIN_PASSWORD'],
    employeePassword: process.env['SEED_EMPLOYEE_PASSWORD'],
    studentPassword: process.env['SEED_STUDENT_PASSWORD'],
    platformAdminPassword: process.env['SEED_PLATFORM_ADMIN_PASSWORD'],
  };
  for (const [key, value] of Object.entries(values)) {
    if (!value) throw new Error(`${key} doit être défini dans l’environnement.`);
  }
  return {
    restaurantAdminPassword: values.restaurantAdminPassword!,
    employeePassword: values.employeePassword!,
    studentPassword: values.studentPassword!,
    platformAdminPassword: values.platformAdminPassword!,
  };
}

try {
  const config = loadConfig();
  mkdirSync(dirname(config.databasePath), { recursive: true });
  const db = new Database(config.databasePath);
  try {
    migrate(db);
    const result = seedDemoData(db, readCredentials());
    console.log(result === 'created' ? 'Données de démonstration créées.' : 'Données de démonstration déjà présentes.');
  } finally { db.close(); }
} catch (error) {
  if (error instanceof ConfigError) console.error(`Configuration invalide : ${error.message}`);
  else console.error('Échec du seed des données de démonstration :', error);
  process.exitCode = 1;
}
