import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const racine = new URL('.', import.meta.url);
const schema = await readFile(new URL('schema.sql', racine), 'utf8');
const donnees = await readFile(new URL('donnees-test.sql', racine), 'utf8');
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec(schema);
const tables = db.prepare(`SELECT COUNT(*) AS total FROM sqlite_master
  WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).get().total;
const nomsTables = db.prepare(`SELECT name FROM sqlite_master
  WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all().map(({ name }) => name);
const clesEtrangeres = nomsTables.reduce(
  (total, nom) => total + db.prepare(`PRAGMA foreign_key_list("${nom}")`).all().length,
  0,
);
assert.equal(tables, 16, 'le schéma doit contenir exactement 16 tables métier');
assert.equal(clesEtrangeres, 34, 'le schéma doit contenir exactement 34 clés étrangères');
assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, 'les clés étrangères doivent être activées');

const maintenant = '2026-10-26T10:00:00.000Z';
const rejets = [];
function doitRefuser(label, operation) {
  try {
    operation();
    rejets.push(label);
  } catch {
    // L'insertion invalide a bien été rejetée par SQLite.
  }
}
function restaurant(id, slug = id) {
  db.prepare('INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, slug, `Restaurant ${id}`, 'Poppins', maintenant);
}
function utilisateur(id, restaurantId, email, phone, role = 'student', referralCode = null) {
  db.prepare(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, referral_code, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, restaurantId, role, id, email, phone, 'empreinte-factice', referralCode, maintenant);
}
function commande(id, numero, overrides = {}) {
  const v = { restaurant: 'r1', user: 'u1', statut: 'pending', ...overrides };
  db.prepare(`INSERT INTO orders (id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
    subtotal_fc, discount_fc, delivery_fee_fc, total_fc, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'dine_in', ?, 'cash', 'unpaid', 3000, 0, 0, 3000, ?, ?)`)
    .run(id, v.restaurant, v.user, numero, v.statut, maintenant, maintenant);
}

restaurant('r1');
restaurant('r2');
utilisateur('u1', 'r1', 'student@example.test', '+243811111111', 'student', 'CODE-U1');
utilisateur('u2', 'r1', 'friend@example.test', '+243822222222', 'student', 'CODE-U2');
utilisateur('u3', 'r1', 'staff@example.test', '+243833333333', 'employee');
commande('o1', 'N-001');
db.prepare(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at)
  VALUES ('m1', 'r1', 'Plat de test', 1000, 'plat', ?, ?)`).run(maintenant, maintenant);

doitRefuser('e-mail en doublon sans distinction de casse', () => utilisateur('u-email', 'r2', 'STUDENT@example.test', '+243844444444'));
doitRefuser('téléphone en doublon', () => utilisateur('u-phone', 'r2', 'phone@example.test', '+243811111111'));
doitRefuser('rôle inconnu', () => utilisateur('u-role', 'r1', 'role@example.test', '+243855555555', 'chef'));
doitRefuser('statut de commande inconnu', () => commande('o-status', 'N-002', { statut: 'shipped' }));
doitRefuser('prix négatif', () => db.prepare(`INSERT INTO menu_items
  (id, restaurant_id, name, price_fc, category, created_at, updated_at) VALUES ('m-negative', 'r1', 'Plat', -1, 'plat', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('quantité à zéro', () => db.prepare(`INSERT INTO order_items
  (id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc)
  VALUES ('oi-zero', 'o1', 'm1', 'Plat', 'plat', 1000, 0, 0)`).run());
doitRefuser('note de 6', () => db.prepare("UPDATE orders SET rating = 6 WHERE id = 'o1'").run());
doitRefuser('référence vers un restaurant inexistant', () => utilisateur('u-fk', 'absent', 'absent@example.test', '+243866666666'));
doitRefuser('numéro de commande répété dans le même restaurant', () => commande('o-duplicate', 'N-001'));
db.prepare(`INSERT INTO referrals (id, restaurant_id, referrer_id, referee_id, created_at)
  VALUES ('ref-1', 'r1', 'u1', 'u2', ?)`).run(maintenant);
doitRefuser('filleul parrainé deux fois', () => db.prepare(`INSERT INTO referrals
  (id, restaurant_id, referrer_id, referee_id, created_at) VALUES ('ref-2', 'r1', 'u3', 'u2', ?)`)
  .run(maintenant));
doitRefuser('valeur booléenne égale à 2', () => db.prepare("UPDATE users SET must_change_password = 2 WHERE id = 'u1'").run());

assert.deepEqual(rejets, [], `Contraintes manquantes : ${rejets.join(', ')}`);

db.exec(donnees);
const commandesAvecLignes = db.prepare(`SELECT o.id, COUNT(oi.id) AS nombre_lignes
  FROM orders AS o JOIN order_items AS oi ON oi.order_id = o.id
  GROUP BY o.id`).all();
assert.equal(commandesAvecLignes.length, 5, 'les cinq commandes de démonstration doivent avoir des lignes');
assert.ok(commandesAvecLignes.every((commande) => commande.nombre_lignes > 0));
const pointsCampus = db.prepare(`SELECT COUNT(*) AS total FROM points_ledger
  WHERE user_id = 'student-2' AND restaurant_id = 'resto-campus'`).get();
const pointsEtu = db.prepare(`SELECT COUNT(*) AS total FROM points_ledger
  WHERE user_id = 'student-2' AND restaurant_id = 'resto-etu'`).get();
assert.ok(pointsCampus.total > 0, 'l’étudiante doit avoir des points au restaurant Campus');
assert.equal(pointsEtu.total, 0, 'l’étudiante doit avoir zéro point au restaurant Étu dans ce jeu de données');

console.log('Vérification des contraintes et des données de test réussie.');

