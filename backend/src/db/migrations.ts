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
  // Référence renvoyée par le fournisseur de paiement à l'initialisation (Easypay) : elle sert à retrouver le
  // paiement d'une notification. `provider_ref` ne change pas : il reste vide tant que le fournisseur n'a rien confirmé.
  { id: '005_payment_provider_reference', sql: `
    ALTER TABLE payments ADD COLUMN provider_reference TEXT;
    CREATE UNIQUE INDEX idx_payments_provider_reference ON payments (provider_reference) WHERE provider_reference IS NOT NULL;
  ` },
  // Un compte étudiant appartient à la plateforme, plus à un restaurant : `users.restaurant_id` devient facultatif
  // (obligatoire seulement pour le personnel) et les étudiants existants perdent leur « restaurant d'origine ».
  // Leurs adhésions (`memberships`) restent : elles ne portent plus que les points de chaque restaurant.
  // SQLite ne sait pas retirer un NOT NULL : la table est reconstruite (copie, suppression, recréation, recopie ;
  // les contrôles de clés étrangères attendent la fin de la transaction), ses index et son déclencheur recréés.
  { id: '006_students_belong_to_platform', sql: `
    PRAGMA defer_foreign_keys = ON;
    CREATE TEMP TABLE users_backup AS SELECT * FROM users;
    DROP TABLE users;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT REFERENCES restaurants(id),
      role TEXT NOT NULL CHECK (role IN ('student', 'employee', 'manager', 'admin')),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      commune TEXT,
      quartier TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
      must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
      referral_code TEXT UNIQUE,
      referred_by TEXT REFERENCES users(id),
      accepted_terms_at TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT,
      auth_version INTEGER NOT NULL DEFAULT 0,
      UNIQUE (phone),
      CHECK (role = 'student' OR restaurant_id IS NOT NULL)
    );
    INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, commune, quartier, address, status,
      must_change_password, referral_code, referred_by, accepted_terms_at, created_at, last_login_at, auth_version)
    SELECT id, CASE WHEN role = 'student' THEN NULL ELSE restaurant_id END, role, name, email, phone, password_hash, commune,
      quartier, address, status, must_change_password, referral_code, referred_by, accepted_terms_at, created_at, last_login_at, auth_version
    FROM users_backup;
    DROP TABLE users_backup;
    CREATE UNIQUE INDEX idx_users_email_global ON users (lower(email));
    CREATE INDEX idx_users_restaurant_role ON users (restaurant_id, role);
    CREATE TRIGGER user_role_with_orders_guard
    BEFORE UPDATE OF role ON users
    WHEN NEW.role <> 'student' AND EXISTS (SELECT 1 FROM orders o WHERE o.user_id = OLD.id)
    BEGIN SELECT RAISE(ABORT, 'an account with orders cannot stop being a student'); END;
    DROP TRIGGER order_events_restaurant_insert;
    DROP TRIGGER order_events_restaurant_update;
    CREATE TRIGGER order_events_restaurant_insert
    BEFORE INSERT ON order_events
    WHEN NEW.user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM orders o JOIN users u ON u.id = NEW.user_id
      WHERE o.id = NEW.order_id AND (o.restaurant_id = u.restaurant_id OR (u.role = 'student' AND o.user_id = u.id))
    )
    BEGIN SELECT RAISE(ABORT, 'order event actor must belong to the order restaurant'); END;
    CREATE TRIGGER order_events_restaurant_update
    BEFORE UPDATE OF order_id, user_id ON order_events
    WHEN NEW.user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM orders o JOIN users u ON u.id = NEW.user_id
      WHERE o.id = NEW.order_id AND (o.restaurant_id = u.restaurant_id OR (u.role = 'student' AND o.user_id = u.id))
    )
    BEGIN SELECT RAISE(ABORT, 'order event actor must belong to the order restaurant'); END;
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
