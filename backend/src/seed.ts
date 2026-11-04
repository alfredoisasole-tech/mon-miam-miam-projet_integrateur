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

    // Images publiques référencées dans les maquettes Stitch (CDN Google aida-public)
    const DISH_URLS: Record<string, string> = {
      'Poulet DG':              'https://lh3.googleusercontent.com/aida-public/AB6AXuBJ9H7oTB2Rr_DjZEIUJ90YNw8aKRxIJk_WecN62Pn7rXxBU3DAEziXvW0du-YgUCeeCL',
      'Ndolé aux crevettes':    'https://lh3.googleusercontent.com/aida-public/AB6AXuBhXXdjY1WR1gfDOgyQ_z0sRMTW-SSyobiWWWkTVHH5-oHAPkUSSSYkDL0MdNaaRCWswK',
      'Riz sauté au bœuf':      'https://lh3.googleusercontent.com/aida-public/AB6AXuAZL3W1lM3Z32oqzaRS-7umCqr4fI2ngkPXbBHSt8crpRxcT0omFuqG3wBAo7a_rppK-l',
      'Poisson braisé':         'https://lh3.googleusercontent.com/aida-public/AB6AXuBhXXdjY1WR1gfDOgyQ_z0sRMTW-SSyobiWWWkTVHH5-oHAPkUSSSYkDL0MdNaaRCWswK',
      'Pondu':                  'https://lh3.googleusercontent.com/aida-public/AB6AXuBhXXdjY1WR1gfDOgyQ_z0sRMTW-SSyobiWWWkTVHH5-oHAPkUSSSYkDL0MdNaaRCWswK',
      'Brochettes bœuf':        'https://lh3.googleusercontent.com/aida-public/AB6AXuAH0DbJ5k0D4qRy3CufbvLocjMRSAhR57wGUP5RLmGNSmgx4FqZ1Cceo-9WkplC3rK9fJM',
      'Alloco':                 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbcxXQUuj1mBRc4IZ56NdmkrAPcbhJyGskbTCOX-TVKixiVdyO2qfyy0jeazpRmt8Jck',
      'Jus de bissap':          'https://lh3.googleusercontent.com/aida-public/AB6AXuB6z1Dz_feEuEWDUaqhrX852kIBaTBTHfBT4fN0OggYHefADxVc8FsHvJQkLu56a3l9eh',
      'Eau minérale 50 cl':     'https://lh3.googleusercontent.com/aida-public/AB6AXuB6z1Dz_feEuEWDUaqhrX852kIBaTBTHfBT4fN0OggYHefADxVc8FsHvJQkLu56a3l9eh',
      'Beignets maison':        'https://lh3.googleusercontent.com/aida-public/AB6AXuCbcxXQUuj1mBRc4IZ56NdmkrAPcbhJyGskbTCOX-TVKixiVdyO2qfyy0jeazpRmt8Jck',
    };

    const dishes = [
      { name: 'Poulet DG',           desc: 'Poulet mijoté aux légumes frais, servi avec alloco et riz blanc.',   category: 'plat',    price: 4500, daily: true  },
      { name: 'Ndolé aux crevettes', desc: 'Feuilles de ndolé mijotées, crevettes et pâte de pistache.',         category: 'plat',    price: 5000, daily: false },
      { name: 'Riz sauté au bœuf',   desc: 'Riz cantonais sauté avec légumes croquants et lamelles de bœuf.',    category: 'plat',    price: 4000, daily: false },
      { name: 'Poisson braisé',      desc: 'Poisson frais grillé au charbon, marinade citron-piment.',            category: 'plat',    price: 4500, daily: false },
      { name: 'Pondu',               desc: 'Feuilles de manioc pilées, arachides et huile de palme.',             category: 'plat',    price: 3000, daily: false },
      { name: 'Brochettes bœuf',     desc: 'Brochettes de bœuf grillées, sauce piment maison.',                  category: 'snack',   price: 2500, daily: false },
      { name: 'Alloco',              desc: 'Bananes plantain mûres frites, piment et oignons.',                   category: 'snack',   price: 1500, daily: false },
      { name: 'Jus de bissap',       desc: "Infusion d'hibiscus glacée, sucrée à la canne.",                     category: 'boisson', price: 1000, daily: false },
      { name: 'Eau minérale 50 cl',  desc: 'Eau fraîche en bouteille 50 cl.',                                     category: 'boisson', price:  500, daily: false },
      { name: 'Beignets maison',     desc: 'Beignets dorés à la farine de manioc, servis chauds.',               category: 'dessert', price: 1000, daily: false },
    ];

    for (const restaurant of restaurantRows) {
      dishes.forEach((dish, index) => {
        const imageUrl = DISH_URLS[dish.name] ?? null;
        db.run(`INSERT INTO menu_items (id, restaurant_id, name, description, price_fc, category, is_daily, image_url, position, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`demo-item-${restaurant.id}-${index + 1}-${randomUUID().slice(0, 8)}`, restaurant.id,
          dish.name, dish.desc, dish.price, dish.category, dish.daily ? 1 : 0, imageUrl, index, now, now]);
      });
    }
  });
  return 'created';
}
