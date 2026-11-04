import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Database } from './db/database.ts';
import { hashPassword } from './services/auth.service.ts';

export interface SeedCredentials {
  restaurantAdminPassword: string;
  employeePassword: string;
  studentPassword: string;
  platformAdminPassword: string;
}

const DEMO_IDS = ['demo-restaurant-zeduc', 'demo-restaurant-lea'];
/** Restaurants ajoutés ensuite : ils sont créés à part s'ils manquent, sans toucher à une base déjà peuplée. */
const EXTRA_IDS = ['demo-restaurant-wok', 'demo-restaurant-pizza'];
const ALL_IDS = [...DEMO_IDS, ...EXTRA_IDS];

/** Logo de démonstration d'un restaurant, lu dans backend/assets ; absent, le restaurant n'a simplement pas de logo. */
function demoLogo(file: string): Buffer | null {
  try { return readFileSync(fileURLToPath(new URL(`../assets/demo-logos/${file}`, import.meta.url))); } catch { return null; }
}
const passwordPattern = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

type Dish = [name: string, description: string, category: string, priceFc: number];

/** Menus propres aux restaurants ajoutés : une autre cuisine chacun, pour que la plateforme ne ressemble pas à un seul menu recopié. */
const EXTRA_MENUS: Record<string, Dish[]> = {
  'demo-restaurant-wok': [
    ['Nouilles sautées au poulet', 'Nouilles sautées au wok avec poulet, carottes, poivrons et sauce soja.', 'plat', 6000],
    ['Riz cantonais', 'Riz sauté aux petits pois, œuf, jambon et oignons verts.', 'plat', 5000],
    ['Bœuf aux oignons', 'Lamelles de bœuf saisies au wok, oignons et gingembre, servies avec du riz.', 'plat', 8000],
    ['Crevettes sautées à l’ail', 'Crevettes décortiquées, ail, piment doux et coriandre.', 'plat', 9000],
    ['Poulet aigre-doux', 'Morceaux de poulet croustillants, ananas, poivrons et sauce aigre-douce.', 'plat', 7000],
    ['Nems au porc', 'Quatre nems croustillants à la menthe, avec sauce pimentée douce.', 'snack', 3000],
    ['Samoussas aux légumes', 'Trois samoussas dorés farcis de légumes épicés.', 'snack', 2000],
    ['Thé glacé au citron', 'Thé noir infusé, citron et glaçons, peu sucré.', 'boisson', 1500],
    ['Jus de mangue', 'Jus de mangue pressé, sans conservateur.', 'boisson', 2000],
    ['Perles de coco', 'Boules de riz glutineux fourrées au coco râpé.', 'dessert', 2500],
  ],
  'demo-restaurant-pizza': [
    ['Pizza Margherita', 'Sauce tomate, mozzarella et basilic sur pâte fine cuite au feu de bois.', 'plat', 8000],
    ['Pizza Reine', 'Tomate, mozzarella, jambon et champignons.', 'plat', 9000],
    ['Pizza Quatre fromages', 'Mozzarella, gorgonzola, chèvre et parmesan.', 'plat', 9000],
    ['Spaghetti bolognaise', 'Spaghetti, sauce à la viande hachée mijotée aux tomates.', 'plat', 6000],
    ['Lasagnes maison', 'Pâtes, viande, béchamel et fromage gratiné au four.', 'plat', 7000],
    ['Pain à l’ail', 'Demi-baguette beurrée à l’ail et au persil, gratinée.', 'snack', 2000],
    ['Salade César', 'Laitue, poulet grillé, croûtons et parmesan.', 'snack', 4000],
    ['Limonade maison', 'Citron pressé, sucre et eau pétillante, bien froide.', 'boisson', 1500],
    ['Jus d’ananas', 'Ananas frais pressé, servi avec des glaçons.', 'boisson', 2000],
    ['Tiramisu', 'Biscuits imbibés de café, crème au mascarpone et cacao.', 'dessert', 3500],
  ],
};

export function seedDemoData(db: Database, credentials: SeedCredentials): 'created' | 'already-present' {
  const present = new Set(db.all<{ id: string }>(
    `SELECT id FROM restaurants WHERE id IN (${ALL_IDS.map(() => '?').join(', ')})`, ALL_IDS,
  ).map((row) => row.id));
  if (ALL_IDS.every((id) => present.has(id))) return 'already-present';
  const baseCount = DEMO_IDS.filter((id) => present.has(id)).length;
  if (baseCount !== 0 && baseCount !== DEMO_IDS.length) throw new Error('Le seed est incomplet : un seul restaurant de démonstration existe.');
  for (const [label, password] of Object.entries(credentials)) {
    if (!passwordPattern.test(password)) throw new Error(`${label} doit contenir 8 caractères, une majuscule et un chiffre.`);
  }

  const now = new Date().toISOString();
  const allRestaurants = [
    // Chaque restaurant a sa propre charte (couleurs, police, mode) et son logo : la plateforme, elle, garde la sienne.
    { id: DEMO_IDS[0]!, slug: 'zeduc-space', name: 'ZeDuc@Space', tagline: 'Le goût de la terrasse', primary: '#2f9e5b', secondary: '#0f2a1d', font: 'Trebuchet MS', mode: 'dark', logo: 'zeduc-space.png' },
    { id: DEMO_IDS[1]!, slug: 'chez-lea', name: 'Chez Léa', tagline: 'Cuisine familiale', primary: '#c4552d', secondary: '#3b1f14', font: 'Georgia', mode: 'light', logo: 'chez-lea.png' },
    { id: EXTRA_IDS[0]!, slug: 'wok-kinois', name: 'Wok Kinois', tagline: 'Wok et saveurs d’Asie à Kin', primary: '#d9382b', secondary: '#1c1c24', font: 'Verdana', mode: 'dark', logo: '' },
    { id: EXTRA_IDS[1]!, slug: 'pizza-unikin', name: 'Pizza Unikin', tagline: 'Pizzas au feu de bois', primary: '#e08a00', secondary: '#2b2118', font: 'Poppins', mode: 'light', logo: '' },
  ];
  const restaurantRows = allRestaurants.filter((restaurant) => !present.has(restaurant.id));
  const accounts = [
    { id: 'demo-admin-zeduc', restaurant: DEMO_IDS[0]!, role: 'admin', name: 'Administrateur ZeDuc', email: 'admin@zeduc-space.test', phone: '+243810000001', password: credentials.restaurantAdminPassword },
    { id: 'demo-admin-lea', restaurant: DEMO_IDS[1]!, role: 'admin', name: 'Administrateur Chez Léa', email: 'admin@chez-lea.test', phone: '+243810000002', password: credentials.restaurantAdminPassword },
    { id: 'demo-employee', restaurant: DEMO_IDS[0]!, role: 'employee', name: 'Employé de démonstration', email: 'employe@monmiam.test', phone: '+243810000003', password: credentials.employeePassword },
    { id: 'demo-student', restaurant: DEMO_IDS[0]!, role: 'student', name: 'Étudiant de démonstration', email: 'etudiant@monmiam.test', phone: '+243810000004', password: credentials.studentPassword },
    { id: 'demo-admin-wok', restaurant: EXTRA_IDS[0]!, role: 'admin', name: 'Administrateur Wok Kinois', email: 'admin@wok-kinois.test', phone: '+243810000101', password: credentials.restaurantAdminPassword },
    { id: 'demo-employee-wok', restaurant: EXTRA_IDS[0]!, role: 'employee', name: 'Employé Wok Kinois', email: 'employe@wok-kinois.test', phone: '+243810000102', password: credentials.employeePassword },
    { id: 'demo-admin-pizza', restaurant: EXTRA_IDS[1]!, role: 'admin', name: 'Administrateur Pizza Unikin', email: 'admin@pizza-unikin.test', phone: '+243810000103', password: credentials.restaurantAdminPassword },
    { id: 'demo-employee-pizza', restaurant: EXTRA_IDS[1]!, role: 'employee', name: 'Employé Pizza Unikin', email: 'employe@pizza-unikin.test', phone: '+243810000104', password: credentials.employeePassword },
  ].filter((account) => account.role === 'student' ? !db.get('SELECT 1 FROM users WHERE id = ?', [account.id]) : !present.has(account.restaurant));

  db.transaction(() => {
    for (const restaurant of restaurantRows) {
      db.run(`INSERT INTO restaurants (id, slug, name, tagline, primary_color, secondary_color, font_family, default_mode, timezone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Africa/Kinshasa', ?)`,
      [restaurant.id, restaurant.slug, restaurant.name, restaurant.tagline, restaurant.primary, restaurant.secondary, restaurant.font, restaurant.mode, now]);
      const logo = demoLogo(restaurant.logo);
      if (logo) {
        const assetId = `ast_${randomUUID()}`;
        db.run("INSERT INTO assets (id, restaurant_id, kind, mime, data, size, created_at) VALUES (?, ?, 'logo', 'image/png', ?, ?, ?)", [assetId, restaurant.id, logo, logo.length, now]);
        db.run('UPDATE restaurants SET logo_asset_id = ? WHERE id = ?', [assetId, restaurant.id]);
      }
      db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, delivery_communes, updated_at)
        VALUES (?, ?, ?, ?)`,
      [restaurant.id, JSON.stringify(Object.fromEntries(
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '08:00', close: '22:00' }]]),
      )), JSON.stringify(['Gombe', 'Limete', 'Lemba']), now]);
    }

    for (const account of accounts) db.run(`INSERT INTO users (
      id, restaurant_id, role, name, email, phone, password_hash, accepted_terms_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [account.id, account.role === 'student' ? null : account.restaurant, account.role, account.name, account.email, account.phone, hashPassword(account.password), now, now]);

    // Les deux premiers restaurants ont déjà une adhésion pour l'étudiant de démonstration (points visibles d'emblée) ;
    // chez les autres, elle se crée à sa première commande, comme pour un vrai client.
    for (const restaurant of restaurantRows.filter((row) => DEMO_IDS.includes(row.id))) db.run(
      'INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES (?, ?, ?)',
      ['demo-student', restaurant.id, now],
    );

    if (!db.get("SELECT 1 FROM platform_admins WHERE id = 'demo-platform-admin'")) db.run(`INSERT INTO platform_admins (id, name, email, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)`,
    ['demo-platform-admin', 'Administrateur de la plateforme', 'plateforme@monmiam.test', hashPassword(credentials.platformAdminPassword), now]);

    // Menu de démonstration : plats courants de Kinshasa, décrits, aux prix habituels en FC.
    const dishes: Array<[name: string, description: string, category: string, priceFc: number]> = [
      ['Riz-haricots', 'Riz blanc, haricots mijotés à l’huile de palme et bananes plantain frites.', 'plat', 3000],
      ['Pondu et chikwangue', 'Feuilles de manioc pilées et mijotées, servies avec du bâton de manioc.', 'plat', 4000],
      ['Poulet à la moambe', 'Poulet mijoté dans la sauce de noix de palme, avec du riz.', 'plat', 7000],
      ['Poisson braisé et makemba', 'Tilapia grillé aux épices, bananes plantain frites et piment.', 'plat', 8000],
      ['Brochettes de bœuf', 'Quatre brochettes marinées, grillées au charbon, avec des frites.', 'plat', 5000],
      ['Mikate', 'Beignets de farine moelleux, légèrement sucrés, servis chauds.', 'snack', 1000],
      ['Jus de gingembre', 'Jus frais de gingembre, citron et sucre de canne, servi bien froid.', 'boisson', 1500],
      ['Bissap', 'Infusion froide de fleurs d’hibiscus, parfumée à la menthe.', 'boisson', 1500],
      ['Salade de fruits', 'Ananas, mangue, papaye et banane de saison.', 'dessert', 2500],
      ['Beignets de banane', 'Beignets de banane mûre saupoudrés de sucre, croustillants dehors.', 'dessert', 2000],
    ];
    for (const restaurant of restaurantRows) {
      (EXTRA_MENUS[restaurant.id] ?? dishes).forEach(([name, description, category, priceFc], index) => {
        db.run(`INSERT INTO menu_items (id, restaurant_id, name, description, price_fc, category, position, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`demo-item-${restaurant.id}-${index + 1}-${randomUUID().slice(0, 8)}`, restaurant.id, name, description, priceFc, category, index, now, now]);
      });
    }
  });
  return 'created';
}
