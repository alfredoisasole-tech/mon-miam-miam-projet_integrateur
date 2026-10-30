import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const racine = new URL('.', import.meta.url);
const schema = await readFile(new URL('schema.sql', racine), 'utf8');
const donnees = await readFile(new URL('donnees-test.sql', racine), 'utf8');
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec(schema);
function executerLot(sql) {
  for (const instruction of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
    try {
      db.exec(instruction);
    } catch (error) {
      throw new Error(`Échec de la requête de données:\n${instruction}`, { cause: error });
    }
  }
}
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
utilisateur('u4', 'r1', 'other-student@example.test', '+243844444444', 'student', 'CODE-U4');
db.prepare(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES
  ('u1', 'r1', ?), ('u2', 'r1', ?), ('u4', 'r1', ?)`)
  .run(maintenant, maintenant, maintenant);
commande('o1', 'N-001');
db.prepare(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at)
  VALUES ('m1', 'r1', 'Plat de test', 1000, 'plat', ?, ?)`).run(maintenant, maintenant);
db.prepare(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at)
  VALUES ('m2', 'r2', 'Plat autre restaurant', 1000, 'plat', ?, ?)`).run(maintenant, maintenant);
db.prepare(`INSERT INTO assets (id, restaurant_id, kind, mime, data, size, created_at)
  VALUES ('a1', 'r1', 'poster', 'image/png', X'01', 1, ?)`).run(maintenant);
db.prepare(`INSERT INTO assets (id, restaurant_id, kind, mime, data, size, created_at)
  VALUES ('a-logo', 'r1', 'logo', 'image/png', X'02', 1, ?)`).run(maintenant);
db.prepare("UPDATE restaurants SET logo_asset_id = 'a-logo' WHERE id = 'r1'").run();

doitRefuser('e-mail en doublon sans distinction de casse', () => utilisateur('u-email', 'r2', 'STUDENT@example.test', '+243844444444'));
doitRefuser('téléphone en doublon', () => utilisateur('u-phone', 'r2', 'phone@example.test', '+243811111111'));
doitRefuser('restaurant avec slug en doublon', () => restaurant('r-duplicate', 'r1'));
doitRefuser('logo de restaurant appartenant à un autre restaurant', () => db.prepare("UPDATE restaurants SET logo_asset_id = 'a-logo' WHERE id = 'r2'").run());
doitRefuser('déplacement d’une image déjà liée', () => db.prepare("UPDATE assets SET restaurant_id = 'r2', kind = 'menu' WHERE id = 'a-logo'").run());
doitRefuser('mode d’affichage de restaurant inconnu', () => db.prepare("UPDATE restaurants SET default_mode = 'auto' WHERE id = 'r1'").run());
doitRefuser('statut de restaurant inconnu', () => db.prepare("UPDATE restaurants SET status = 'paused' WHERE id = 'r1'").run());
doitRefuser('rôle inconnu', () => utilisateur('u-role', 'r1', 'role@example.test', '+243855555555', 'chef'));
doitRefuser('statut utilisateur inconnu', () => db.prepare("UPDATE users SET status = 'blocked' WHERE id = 'u1'").run());
doitRefuser('code de parrainage en doublon', () => db.prepare("UPDATE users SET referral_code = 'CODE-U1' WHERE id = 'u4'").run());
doitRefuser('spend_per_point nul', () => db.prepare(`INSERT INTO restaurant_settings (restaurant_id, spend_per_point_fc, opening_hours, updated_at)
  VALUES ('r1', 0, '{}', ?)`).run(maintenant));
doitRefuser('points_per_meal nul', () => db.prepare(`INSERT INTO restaurant_settings (restaurant_id, points_per_meal, opening_hours, updated_at)
  VALUES ('r1', 0, '{}', ?)`).run(maintenant));
doitRefuser('plafond de réduction négatif', () => db.prepare(`INSERT INTO restaurant_settings (restaurant_id, free_meal_cap_fc, opening_hours, updated_at)
  VALUES ('r1', -1, '{}', ?)`).run(maintenant));
doitRefuser('validité des points nulle', () => db.prepare(`INSERT INTO restaurant_settings (restaurant_id, points_validity_months, opening_hours, updated_at)
  VALUES ('r1', 0, '{}', ?)`).run(maintenant));
doitRefuser('booléen livraison invalide', () => db.prepare(`INSERT INTO restaurant_settings (restaurant_id, delivery_enabled, opening_hours, updated_at)
  VALUES ('r1', 2, '{}', ?)`).run(maintenant));
doitRefuser('frais de livraison négatifs', () => db.prepare(`INSERT INTO restaurant_settings (restaurant_id, delivery_fee_fc, opening_hours, updated_at)
  VALUES ('r1', -1, '{}', ?)`).run(maintenant));
doitRefuser('reliquat de fidélité négatif', () => db.prepare(`INSERT INTO memberships (user_id, restaurant_id, loyalty_remainder_fc, created_at)
  VALUES ('u3', 'r1', -1, ?)`)
  .run(maintenant));
doitRefuser('adhésion en doublon', () => db.prepare(`INSERT INTO memberships (user_id, restaurant_id, created_at)
  VALUES ('u1', 'r1', ?)`)
  .run(maintenant));
doitRefuser('statut de compte administrateur de plateforme inconnu', () => db.prepare(`INSERT INTO platform_admins
  (id, name, email, password_hash, status, created_at)
  VALUES ('platform-invalid', 'Admin', 'platform-invalid@example.test', 'hash', 'blocked', ?)`)
  .run(maintenant));
doitRefuser('statut de commande inconnu', () => commande('o-status', 'N-002', { statut: 'shipped' }));
doitRefuser('commande par un étudiant non membre du restaurant', () => commande('o-other-restaurant', 'N-003', { restaurant: 'r2' }));
doitRefuser('déplacement de commande vers un restaurant dont le client n’est pas membre', () => db.prepare("UPDATE orders SET restaurant_id = 'r2' WHERE id = 'o1'").run());
doitRefuser('prix négatif', () => db.prepare(`INSERT INTO menu_items
  (id, restaurant_id, name, price_fc, category, created_at, updated_at) VALUES ('m-negative', 'r1', 'Plat', -1, 'plat', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('catégorie de plat inconnue', () => db.prepare(`INSERT INTO menu_items
  (id, restaurant_id, name, price_fc, category, created_at, updated_at) VALUES ('m-category', 'r1', 'Plat', 1000, 'entrée', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('plat indisponible hors booléen', () => db.prepare("UPDATE menu_items SET is_available = 2 WHERE id = 'm1'").run());
doitRefuser('plat du jour hors booléen', () => db.prepare("UPDATE menu_items SET is_daily = 2 WHERE id = 'm1'").run());
doitRefuser('type de fichier inconnu', () => db.prepare(`INSERT INTO assets (id, restaurant_id, kind, mime, data, size, created_at)
  VALUES ('a-kind', 'r1', 'video', 'video/mp4', X'01', 1, ?)`)
  .run(maintenant));
doitRefuser('taille de fichier nulle', () => db.prepare(`INSERT INTO assets (id, restaurant_id, kind, mime, data, size, created_at)
  VALUES ('a-size', 'r1', 'menu', 'image/png', X'01', 0, ?)`)
  .run(maintenant));
doitRefuser('type de promotion inconnu', () => db.prepare(`INSERT INTO promotions
  (id, restaurant_id, kind, title, starts_at, ends_at, created_at, updated_at)
  VALUES ('promo-kind', 'r1', 'sale', 'Promo', ?, ?, ?, ?)`)
  .run(maintenant, '2026-10-27T00:00:00.000Z', maintenant, maintenant));
doitRefuser('booléen promotion invalide', () => db.prepare(`INSERT INTO promotions
  (id, restaurant_id, kind, title, starts_at, ends_at, is_active, created_at, updated_at)
  VALUES ('promo-active', 'r1', 'promotion', 'Promo', ?, ?, 2, ?, ?)`)
  .run(maintenant, '2026-10-27T00:00:00.000Z', maintenant, maintenant));
doitRefuser('quantité à zéro', () => db.prepare(`INSERT INTO order_items
  (id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc)
  VALUES ('oi-zero', 'o1', 'm1', 'Plat', 'plat', 1000, 0, 0)`).run());
doitRefuser('total de ligne différent du prix unitaire multiplié par la quantité', () => db.prepare(`INSERT INTO order_items
  (id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc)
  VALUES ('oi-total', 'o1', 'm1', 'Plat', 'plat', 1000, 2, 1000)`).run());
doitRefuser('article de commande venant d’un autre restaurant', () => db.prepare(`INSERT INTO order_items
  (id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc)
  VALUES ('oi-tenant', 'o1', 'm2', 'Plat', 'plat', 1000, 1, 1000)`).run());
doitRefuser('état d’événement de commande inconnu', () => db.prepare(`INSERT INTO order_events (id, order_id, status, created_at)
  VALUES ('event-invalid', 'o1', 'shipped', ?)`).run(maintenant));
doitRefuser('type de commande inconnu', () => db.prepare("UPDATE orders SET type = 'takeaway' WHERE id = 'o1'").run());
doitRefuser('moyen de paiement de commande inconnu', () => db.prepare("UPDATE orders SET payment_method = 'card' WHERE id = 'o1'").run());
doitRefuser('statut de paiement de commande inconnu', () => db.prepare("UPDATE orders SET payment_status = 'refunded' WHERE id = 'o1'").run());
doitRefuser('sous-total négatif', () => db.prepare("UPDATE orders SET subtotal_fc = -1 WHERE id = 'o1'").run());
doitRefuser('réduction négative', () => db.prepare("UPDATE orders SET discount_fc = -1 WHERE id = 'o1'").run());
doitRefuser('frais de livraison négatifs sur une commande', () => db.prepare("UPDATE orders SET delivery_fee_fc = -1 WHERE id = 'o1'").run());
doitRefuser('total incohérent avec le sous-total, la réduction et la livraison', () => db.prepare("UPDATE orders SET total_fc = 2999 WHERE id = 'o1'").run());
doitRefuser('réduction supérieure au sous-total', () => db.prepare("UPDATE orders SET subtotal_fc = 1000, discount_fc = 2000, delivery_fee_fc = 0, total_fc = 0 WHERE id = 'o1'").run());
doitRefuser('points utilisés négatifs', () => db.prepare("UPDATE orders SET points_redeemed = -1 WHERE id = 'o1'").run());
doitRefuser('points gagnés négatifs', () => db.prepare("UPDATE orders SET points_earned = -1 WHERE id = 'o1'").run());
doitRefuser('catégorie de ligne de commande inconnue', () => db.prepare(`INSERT INTO order_items
  (id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc)
  VALUES ('oi-category', 'o1', 'm1', 'Plat', 'entrée', 1000, 1, 1000)`).run());
doitRefuser('prix unitaire négatif', () => db.prepare(`INSERT INTO order_items
  (id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc)
  VALUES ('oi-price', 'o1', 'm1', 'Plat', 'plat', -1, 1, 0)`).run());
doitRefuser('paiement associé à un autre restaurant que la commande', () => db.prepare(`INSERT INTO payments
  (id, restaurant_id, order_id, operator, phone, amount_fc, status, created_at, updated_at)
  VALUES ('payment-tenant', 'r2', 'o1', 'mpesa', '+243811111111', 3000, 'pending', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('opérateur de paiement inconnu', () => db.prepare(`INSERT INTO payments
  (id, restaurant_id, order_id, operator, phone, amount_fc, status, created_at, updated_at)
  VALUES ('payment-operator', 'r1', 'o1', 'bank', '+243811111111', 3000, 'pending', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('montant de paiement nul', () => db.prepare(`INSERT INTO payments
  (id, restaurant_id, order_id, operator, phone, amount_fc, status, created_at, updated_at)
  VALUES ('payment-zero', 'r1', 'o1', 'mpesa', '+243811111111', 0, 'pending', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('statut de paiement inconnu', () => db.prepare(`INSERT INTO payments
  (id, restaurant_id, order_id, operator, phone, amount_fc, status, created_at, updated_at)
  VALUES ('payment-status', 'r1', 'o1', 'mpesa', '+243811111111', 3000, 'refunded', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('réclamation déposée dans un restaurant sans adhésion', () => db.prepare(`INSERT INTO claims
  (id, restaurant_id, user_id, kind, subject, message, created_at, updated_at)
  VALUES ('claim-tenant', 'r2', 'u1', 'other', 'Sujet', 'Message', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('points rattachés à un restaurant sans adhésion', () => db.prepare(`INSERT INTO points_ledger
  (id, restaurant_id, user_id, kind, points, created_at) VALUES ('ledger-tenant', 'r2', 'u1', 'earn', 1, ?)`)
  .run(maintenant));
doitRefuser('type de mouvement de points inconnu', () => db.prepare(`INSERT INTO points_ledger
  (id, restaurant_id, user_id, kind, points, created_at) VALUES ('ledger-kind', 'r1', 'u1', 'bonus', 1, ?)`)
  .run(maintenant));
doitRefuser('mouvement de zéro point', () => db.prepare(`INSERT INTO points_ledger
  (id, restaurant_id, user_id, kind, points, created_at) VALUES ('ledger-zero', 'r1', 'u1', 'earn', 0, ?)`)
  .run(maintenant));
doitRefuser('reste de points négatif', () => db.prepare(`INSERT INTO points_ledger
  (id, restaurant_id, user_id, kind, points, remaining, created_at) VALUES ('ledger-remaining', 'r1', 'u1', 'earn', 1, -1, ?)`)
  .run(maintenant));
doitRefuser('promotion dont la fin précède le début', () => db.prepare(`INSERT INTO promotions
  (id, restaurant_id, kind, title, starts_at, ends_at, created_at, updated_at)
  VALUES ('promo-dates', 'r1', 'promotion', 'Dates invalides', '2026-10-27T00:00:00.000Z', '2026-10-26T00:00:00.000Z', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('image de promotion appartenant à un autre restaurant', () => db.prepare(`INSERT INTO promotions
  (id, restaurant_id, kind, title, image_asset_id, starts_at, ends_at, created_at, updated_at)
  VALUES ('promo-image', 'r2', 'promotion', 'Affiche', 'a1', ?, ?, ?, ?)`)
  .run(maintenant, '2026-10-27T00:00:00.000Z', maintenant, maintenant));
doitRefuser('note de 6', () => db.prepare("UPDATE orders SET rating = 6 WHERE id = 'o1'").run());
doitRefuser('référence vers un restaurant inexistant', () => utilisateur('u-fk', 'absent', 'absent@example.test', '+243866666666'));
doitRefuser('numéro de commande répété dans le même restaurant', () => commande('o-duplicate', 'N-001'));
doitRefuser('clé d’idempotence réutilisée par le même client', () => {
  const inserer = db.prepare(`INSERT INTO orders
    (id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
     subtotal_fc, discount_fc, delivery_fee_fc, total_fc, idempotency_key, created_at, updated_at)
    VALUES (?, 'r1', 'u1', ?, 'dine_in', 'pending', 'cash', 'unpaid', 3000, 0, 0, 3000, 'once', ?, ?)`);
  inserer.run('o-idempotent-1', 'N-010', maintenant, maintenant);
  inserer.run('o-idempotent-2', 'N-011', maintenant, maintenant);
});
db.prepare(`INSERT INTO referrals (id, restaurant_id, referrer_id, referee_id, created_at)
  VALUES ('ref-1', 'r1', 'u1', 'u2', ?)`).run(maintenant);
doitRefuser('filleul parrainé deux fois', () => db.prepare(`INSERT INTO referrals
  (id, restaurant_id, referrer_id, referee_id, created_at) VALUES ('ref-2', 'r1', 'u3', 'u2', ?)`)
  .run(maintenant));
doitRefuser('auto-parrainage', () => db.prepare(`INSERT INTO referrals
  (id, restaurant_id, referrer_id, referee_id, created_at) VALUES ('ref-self', 'r1', 'u1', 'u1', ?)`)
  .run(maintenant));
doitRefuser('statut de parrainage inconnu', () => db.prepare(`INSERT INTO referrals
  (id, restaurant_id, referrer_id, referee_id, status, created_at) VALUES ('ref-status', 'r1', 'u1', 'u4', 'done', ?)`)
  .run(maintenant));
doitRefuser('récompense de parrainage négative', () => db.prepare(`INSERT INTO referrals
  (id, restaurant_id, referrer_id, referee_id, reward_points, created_at) VALUES ('ref-reward', 'r1', 'u1', 'u4', -1, ?)`)
  .run(maintenant));
doitRefuser('réclamation de type inconnu', () => db.prepare(`INSERT INTO claims
  (id, restaurant_id, user_id, kind, subject, message, created_at, updated_at) VALUES ('claim-kind', 'r1', 'u1', 'refund', 'Sujet', 'Message', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('points demandés nuls', () => db.prepare(`INSERT INTO claims
  (id, restaurant_id, user_id, kind, subject, message, requested_points, created_at, updated_at)
  VALUES ('claim-points', 'r1', 'u1', 'points', 'Sujet', 'Message', 0, ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('statut de réclamation inconnu', () => db.prepare(`INSERT INTO claims
  (id, restaurant_id, user_id, kind, subject, message, status, created_at, updated_at)
  VALUES ('claim-status', 'r1', 'u1', 'other', 'Sujet', 'Message', 'closed', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('décision de réclamation inconnue', () => db.prepare(`INSERT INTO claims
  (id, restaurant_id, user_id, kind, subject, message, proposed_decision, created_at, updated_at)
  VALUES ('claim-decision', 'r1', 'u1', 'other', 'Sujet', 'Message', 'maybe', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('décision finale de réclamation inconnue', () => db.prepare(`INSERT INTO claims
  (id, restaurant_id, user_id, kind, subject, message, decision, created_at, updated_at)
  VALUES ('claim-final-decision', 'r1', 'u1', 'other', 'Sujet', 'Message', 'maybe', ?, ?)`)
  .run(maintenant, maintenant));
doitRefuser('jeton de réinitialisation dupliqué', () => {
  db.prepare(`INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
    VALUES ('reset-1', 'u1', 'token-hash', ?, ?)`).run(maintenant, maintenant);
  db.prepare(`INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
    VALUES ('reset-2', 'u1', 'token-hash', ?, ?)`).run(maintenant, maintenant);
});
doitRefuser('valeur booléenne égale à 2', () => db.prepare("UPDATE users SET must_change_password = 2 WHERE id = 'u1'").run());

assert.deepEqual(rejets, [], `Contraintes manquantes : ${rejets.join(', ')}`);

executerLot(donnees);
const comptesApresPremierChargement = Object.fromEntries(nomsTables.map((nom) => [
  nom,
  db.prepare(`SELECT COUNT(*) AS total FROM "${nom}"`).get().total,
]));
executerLot(donnees);
for (const nom of nomsTables) {
  assert.equal(
    db.prepare(`SELECT COUNT(*) AS total FROM "${nom}"`).get().total,
    comptesApresPremierChargement[nom],
    `les données de test ne doivent pas créer de doublon dans ${nom}`,
  );
}
assert.equal(db.prepare("SELECT COUNT(*) AS total FROM restaurants WHERE id LIKE 'resto-%'").get().total, 3);
assert.equal(db.prepare("SELECT COUNT(*) AS total FROM orders WHERE id LIKE 'order-%'").get().total, 5);
doitRefuser('suppression d’une adhésion avec historique de commandes', () => db.prepare(`
  DELETE FROM memberships WHERE user_id = 'student-1' AND restaurant_id = 'resto-campus'
`).run());
doitRefuser('changement de restaurant d’un plat déjà commandé', () => db.prepare(`
  UPDATE menu_items SET restaurant_id = 'resto-etu' WHERE id = 'campus-01'
`).run());
doitRefuser('acteur d’événement rattaché à un autre restaurant', () => db.prepare(`
  INSERT INTO order_events (id, order_id, status, user_id, created_at)
  VALUES ('event-other-restaurant', 'order-1', 'completed', 'student-3', ?)
`).run(maintenant));
assert.deepEqual(rejets, [], `Contraintes manquantes : ${rejets.join(', ')}`);
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

