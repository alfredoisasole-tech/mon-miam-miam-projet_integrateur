import { randomUUID } from 'node:crypto';
import type { Database } from './db/database.ts';
import { hashPassword } from './services/auth.service.ts';

export interface SeedCredentials {
  restaurantAdminPassword: string;
  employeePassword: string;
  studentPassword: string;
  platformAdminPassword: string;
}

const DEMO_IDS = ['demo-restaurant-zeduc', 'demo-restaurant-lea'];
const passwordPattern = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export function seedDemoData(db: Database, credentials: SeedCredentials): 'created' | 'already-present' {
  const existing = db.get<{ total: number }>(
    `SELECT COUNT(*) AS total FROM restaurants WHERE id IN (?, ?)`, DEMO_IDS,
  )?.total ?? 0;
  if (existing === DEMO_IDS.length) return 'already-present';
  if (existing !== 0) throw new Error('Le seed est incomplet : un seul restaurant de démonstration existe.');
  for (const [label, password] of Object.entries(credentials)) {
    if (!passwordPattern.test(password)) throw new Error(`${label} doit contenir 8 caractères, une majuscule et un chiffre.`);
  }

  const now = new Date().toISOString();
  const restaurantRows = [
    { id: DEMO_IDS[0]!, slug: 'zeduc-space', name: 'ZeDuc@Space', primary: '#cfbd97', secondary: '#000000' },
    { id: DEMO_IDS[1]!, slug: 'chez-lea', name: 'Chez Léa', primary: '#cfbd97', secondary: '#000000' },
  ];
  const accounts = [
    { id: 'demo-admin-zeduc', restaurant: DEMO_IDS[0]!, role: 'admin', name: 'Administrateur ZeDuc', email: 'admin@zeduc-space.test', phone: '+243810000001', password: credentials.restaurantAdminPassword },
    { id: 'demo-admin-lea', restaurant: DEMO_IDS[1]!, role: 'admin', name: 'Administrateur Chez Léa', email: 'admin@chez-lea.test', phone: '+243810000002', password: credentials.restaurantAdminPassword },
    { id: 'demo-employee', restaurant: DEMO_IDS[0]!, role: 'employee', name: 'Employé de démonstration', email: 'employe@monmiam.test', phone: '+243810000003', password: credentials.employeePassword },
    { id: 'demo-student', restaurant: DEMO_IDS[0]!, role: 'student', name: 'Étudiant de démonstration', email: 'etudiant@monmiam.test', phone: '+243810000004', password: credentials.studentPassword },
  ];

  db.transaction(() => {
    for (const restaurant of restaurantRows) {
      db.run(`INSERT INTO restaurants (id, slug, name, primary_color, secondary_color, font_family, timezone, created_at)
        VALUES (?, ?, ?, ?, ?, 'Arial', 'Africa/Kinshasa', ?)`,
      [restaurant.id, restaurant.slug, restaurant.name, restaurant.primary, restaurant.secondary, now]);
      db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, delivery_communes, updated_at)
        VALUES (?, ?, ?, ?)`,
      [restaurant.id, JSON.stringify(Object.fromEntries(
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '08:00', close: '22:00' }]]),
      )), JSON.stringify(['Gombe', 'Limete', 'Lemba']), now]);
    }

    for (const account of accounts) db.run(`INSERT INTO users (
      id, restaurant_id, role, name, email, phone, password_hash, accepted_terms_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [account.id, account.restaurant, account.role, account.name, account.email, account.phone, hashPassword(account.password), now, now]);

    for (const restaurant of restaurantRows) db.run(
      'INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES (?, ?, ?)',
      ['demo-student', restaurant.id, now],
    );

    db.run(`INSERT INTO platform_admins (id, name, email, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)`,
    ['demo-platform-admin', 'Administrateur de la plateforme', 'plateforme@monmiam.test', hashPassword(credentials.platformAdminPassword), now]);

    const dishes = ['Poulet braisé', 'Riz cantonais', 'Poisson grillé', 'Frites maison', 'Pondu', 'Samosas', 'Jus frais', 'Eau minérale', 'Salade du jour', 'Beignets'];
    for (const restaurant of restaurantRows) {
      dishes.forEach((name, index) => {
        const category = index < 6 ? 'plat' : index < 8 ? 'boisson' : index === 8 ? 'snack' : 'dessert';
        db.run(`INSERT INTO menu_items (id, restaurant_id, name, description, price_fc, category, position, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`demo-item-${restaurant.id}-${index + 1}-${randomUUID().slice(0, 8)}`, restaurant.id, name, null,
          (index + 1) * 500, category, index, now, now]);
      });
    }
  });
  return 'created';
}
