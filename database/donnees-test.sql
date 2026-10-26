-- Données de démonstration uniquement. Les empreintes sont volontairement inutilisables.
INSERT INTO restaurants (id, slug, name, tagline, font_family, created_at, status) VALUES
  ('resto-campus', 'campus', 'Le Campus', 'Repas du jour', 'Poppins', '2026-10-01T08:00:00.000Z', 'active'),
  ('resto-etu', 'etu', 'Chez Étu', 'Cuisine maison', 'Poppins', '2026-10-01T08:00:00.000Z', 'active'),
  ('resto-ferme', 'ferme', 'Le Réfectoire', NULL, 'Poppins', '2026-10-01T08:00:00.000Z', 'inactive');

INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
  ('resto-campus', '{}', '2026-10-01T08:00:00.000Z'),
  ('resto-etu', '{}', '2026-10-01T08:00:00.000Z'),
  ('resto-ferme', '{}', '2026-10-01T08:00:00.000Z');

INSERT INTO platform_admins (id, name, email, password_hash, created_at) VALUES
  ('platform-admin-1', 'Administrateur plateforme', 'platform@example.test', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', '2026-10-01T08:00:00.000Z');

INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, referral_code, created_at) VALUES
  ('staff-campus-1', 'resto-campus', 'admin', 'Admin Campus', 'admin.campus@example.test', '+243810000001', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', NULL, '2026-10-01T08:00:00.000Z'),
  ('staff-campus-2', 'resto-campus', 'manager', 'Manager Campus', 'manager.campus@example.test', '+243810000002', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', NULL, '2026-10-01T08:00:00.000Z'),
  ('staff-etu-1', 'resto-etu', 'admin', 'Admin Étu', 'admin.etu@example.test', '+243810000003', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', NULL, '2026-10-01T08:00:00.000Z'),
  ('staff-etu-2', 'resto-etu', 'manager', 'Manager Étu', 'manager.etu@example.test', '+243810000004', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', NULL, '2026-10-01T08:00:00.000Z'),
  ('staff-ferme-1', 'resto-ferme', 'admin', 'Admin Réfectoire', 'admin.ferme@example.test', '+243810000005', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', NULL, '2026-10-01T08:00:00.000Z'),
  ('staff-ferme-2', 'resto-ferme', 'manager', 'Manager Réfectoire', 'manager.ferme@example.test', '+243810000006', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', NULL, '2026-10-01T08:00:00.000Z'),
  ('student-1', 'resto-campus', 'student', 'Aline Mbuyi', 'aline@example.test', '+243820000001', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', 'ALINE-2026', '2026-10-02T09:00:00.000Z'),
  ('student-2', 'resto-campus', 'student', 'Benoît Ilunga', 'benoit@example.test', '+243820000002', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', 'BENOIT-2026', '2026-10-02T09:10:00.000Z'),
  ('student-3', 'resto-etu', 'student', 'Chantal Kabeya', 'chantal@example.test', '+243820000003', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', 'CHANTAL-2026', '2026-10-02T09:20:00.000Z'),
  ('student-4', 'resto-ferme', 'student', 'David Kanku', 'david@example.test', '+243820000004', 'EMPREINTE-FACTICE-NE-PAS-UTILISER', NULL, '2026-10-02T09:30:00.000Z');

INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES
  ('student-1', 'resto-campus', '2026-10-02T09:00:00.000Z'),
  ('student-1', 'resto-etu', '2026-10-02T09:00:00.000Z'),
  ('student-2', 'resto-campus', '2026-10-02T09:10:00.000Z'),
  ('student-3', 'resto-etu', '2026-10-02T09:20:00.000Z'),
  ('student-4', 'resto-ferme', '2026-10-02T09:30:00.000Z');

INSERT INTO menu_items (id, restaurant_id, name, description, price_fc, category, position, created_at, updated_at) VALUES
  ('campus-01', 'resto-campus', 'Poulet mayo', NULL, 12000, 'plat', 1, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('campus-02', 'resto-campus', 'Poisson braisé', NULL, 15000, 'plat', 2, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('campus-03', 'resto-campus', 'Riz sauté', NULL, 7000, 'plat', 3, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('campus-04', 'resto-campus', 'Pondu', NULL, 6000, 'plat', 4, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('campus-05', 'resto-campus', 'Fumbwa', NULL, 6500, 'plat', 5, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('campus-06', 'resto-campus', 'Sambusa', NULL, 2500, 'snack', 6, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('campus-07', 'resto-campus', 'Jus de gingembre', NULL, 3000, 'boisson', 7, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('campus-08', 'resto-campus', 'Eau', NULL, 1000, 'boisson', 8, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('campus-09', 'resto-campus', 'Beignet', NULL, 1500, 'dessert', 9, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('campus-10', 'resto-campus', 'Salade avocat', NULL, 5000, 'plat', 10, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('etu-01', 'resto-etu', 'Poulet grillé', NULL, 13000, 'plat', 1, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('etu-02', 'resto-etu', 'Liboke de poisson', NULL, 16000, 'plat', 2, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('etu-03', 'resto-etu', 'Riz aux légumes', NULL, 7500, 'plat', 3, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('etu-04', 'resto-etu', 'Pondu maison', NULL, 6500, 'plat', 4, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('etu-05', 'resto-etu', 'Haricots', NULL, 6000, 'plat', 5, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('etu-06', 'resto-etu', 'Samosa', NULL, 2500, 'snack', 6, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('etu-07', 'resto-etu', 'Jus de bissap', NULL, 3000, 'boisson', 7, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('etu-08', 'resto-etu', 'Eau', NULL, 1000, 'boisson', 8, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('etu-09', 'resto-etu', 'Fruit de saison', NULL, 2000, 'dessert', 9, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('etu-10', 'resto-etu', 'Salade fraîche', NULL, 5000, 'plat', 10, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('ferme-01', 'resto-ferme', 'Poulet sauce', NULL, 11000, 'plat', 1, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('ferme-02', 'resto-ferme', 'Poisson du jour', NULL, 14000, 'plat', 2, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('ferme-03', 'resto-ferme', 'Riz blanc', NULL, 5000, 'plat', 3, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('ferme-04', 'resto-ferme', 'Pondu', NULL, 6000, 'plat', 4, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('ferme-05', 'resto-ferme', 'Haricots rouges', NULL, 5500, 'plat', 5, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('ferme-06', 'resto-ferme', 'Beignet', NULL, 1500, 'snack', 6, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('ferme-07', 'resto-ferme', 'Jus de tamarin', NULL, 3000, 'boisson', 7, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('ferme-08', 'resto-ferme', 'Eau', NULL, 1000, 'boisson', 8, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('ferme-09', 'resto-ferme', 'Banane', NULL, 2000, 'dessert', 9, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z'),
  ('ferme-10', 'resto-ferme', 'Salade de tomates', NULL, 4000, 'plat', 10, '2026-10-03T08:00:00.000Z', '2026-10-03T08:00:00.000Z');

INSERT INTO promotions (id, restaurant_id, kind, title, description, starts_at, ends_at, created_at, updated_at) VALUES
  ('promo-campus', 'resto-campus', 'promotion', 'Menu étudiant', 'Un plat et une boisson à prix réduit.', '2026-10-01T00:00:00.000Z', '2026-12-31T23:59:59.000Z', '2026-10-01T08:00:00.000Z', '2026-10-01T08:00:00.000Z'),
  ('event-etu', 'resto-etu', 'event', 'Semaine congolaise', 'Découverte des plats locaux.', '2026-10-10T00:00:00.000Z', '2026-10-20T23:59:59.000Z', '2026-10-01T08:00:00.000Z', '2026-10-01T08:00:00.000Z');

INSERT INTO orders (id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
  subtotal_fc, discount_fc, delivery_fee_fc, total_fc, points_earned, created_at, updated_at) VALUES
  ('order-1', 'resto-campus', 'student-1', 'C-001', 'dine_in', 'completed', 'cash', 'paid', 12000, 0, 0, 12000, 4, '2026-10-05T11:00:00.000Z', '2026-10-05T11:30:00.000Z'),
  ('order-2', 'resto-campus', 'student-2', 'C-002', 'delivery', 'confirmed', 'mobile_money', 'paid', 10000, 0, 2000, 12000, 4, '2026-10-06T12:00:00.000Z', '2026-10-06T12:05:00.000Z'),
  ('order-3', 'resto-campus', 'student-2', 'C-003', 'dine_in', 'completed', 'cash', 'paid', 7000, 0, 0, 7000, 2, '2026-10-07T12:00:00.000Z', '2026-10-07T12:30:00.000Z'),
  ('order-4', 'resto-etu', 'student-1', 'E-001', 'dine_in', 'completed', 'cash', 'paid', 13000, 0, 0, 13000, 4, '2026-10-08T11:00:00.000Z', '2026-10-08T11:30:00.000Z'),
  ('order-5', 'resto-etu', 'student-3', 'E-002', 'delivery', 'pending', 'mobile_money', 'pending', 16000, 0, 2000, 18000, 0, '2026-10-09T12:00:00.000Z', '2026-10-09T12:00:00.000Z');

INSERT INTO order_items (id, order_id, menu_item_id, name, category, unit_price_fc, quantity, line_total_fc) VALUES
  ('line-1', 'order-1', 'campus-01', 'Poulet mayo', 'plat', 12000, 1, 12000),
  ('line-2', 'order-2', 'campus-03', 'Riz sauté', 'plat', 7000, 1, 7000),
  ('line-3', 'order-2', 'campus-08', 'Eau', 'boisson', 1000, 3, 3000),
  ('line-4', 'order-3', 'campus-03', 'Riz sauté', 'plat', 7000, 1, 7000),
  ('line-5', 'order-4', 'etu-01', 'Poulet grillé', 'plat', 13000, 1, 13000),
  ('line-6', 'order-5', 'etu-02', 'Liboke de poisson', 'plat', 16000, 1, 16000);

INSERT INTO referrals (id, restaurant_id, referrer_id, referee_id, status, reward_points, rewarded_order_id, created_at, rewarded_at) VALUES
  ('referral-1', 'resto-campus', 'student-1', 'student-2', 'rewarded', 1, 'order-2', '2026-10-04T08:00:00.000Z', '2026-10-06T12:05:00.000Z');

INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, remaining, expires_at, order_id, referral_id, note, created_at) VALUES
  ('points-campus-1', 'resto-campus', 'student-1', 'earn', 4, 4, '2027-10-05T00:00:00.000Z', 'order-1', NULL, 'Points de la commande C-001', '2026-10-05T11:30:00.000Z'),
  ('points-campus-2', 'resto-campus', 'student-2', 'earn', 4, 4, '2027-10-06T00:00:00.000Z', 'order-2', NULL, 'Points de la commande C-002', '2026-10-06T12:05:00.000Z'),
  ('points-etu-1', 'resto-etu', 'student-1', 'earn', 4, 4, '2027-10-08T00:00:00.000Z', 'order-4', NULL, 'Points de la commande E-001', '2026-10-08T11:30:00.000Z'),
  ('points-referral-1', 'resto-campus', 'student-1', 'referral', 1, 1, NULL, 'order-2', 'referral-1', 'Récompense de parrainage', '2026-10-06T12:05:00.000Z');

INSERT INTO claims (id, restaurant_id, user_id, order_id, kind, subject, message, status, created_at, updated_at) VALUES
  ('claim-1', 'resto-campus', 'student-1', 'order-1', 'order', 'Commande incomplète', 'La boisson était absente de ma commande.', 'open', '2026-10-05T13:00:00.000Z', '2026-10-05T13:00:00.000Z');
