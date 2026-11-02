import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { SqliteOrdersRepository } from '../src/repositories/sqlite-orders.repo.ts';
import { demarrer, type Serveur } from './helpers.ts';

/** Jeu de données commun aux tests de fidélité : deux restaurants, deux étudiants, un employé du restaurant alpha. */
export const MAINTENANT = '2026-10-26T08:00:00.000Z';
const HORAIRES = JSON.stringify(Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((jour) => [jour, [{ open: '00:00', close: '23:59' }]]),
));

export interface CorpsCommande {
  restaurant?: string;
  type?: string;
  paymentMethod?: string;
  items?: Array<{ menuItemId: string; quantity: number }>;
  delivery?: Record<string, string>;
  redeemMeal?: boolean | string;
  [cle: string]: unknown;
}

export interface CommandeCreee {
  id: string;
  status: string;
  subtotalFc: number;
  discountFc: number;
  deliveryFeeFc: number;
  totalFc: number;
  pointsRedeemed: number;
  pointsEarned: number;
}

export interface Monde {
  db: Database;
  serveur: Serveur;
  /** Instant simulé du serveur ; modifiable pour tester les expirations. */
  horloge: { instant: string };
  commander(corps: CorpsCommande, cle: string, jeton?: string): Promise<Response>;
  /** Crée une commande attendue réussie (201) et renvoie son contenu. */
  commanderOk(corps: CorpsCommande, cle: string, jeton?: string): Promise<CommandeCreee>;
  changerStatut(commandeId: string, statut: string, jeton?: string): Promise<Response>;
  /** Fait passer une commande de « en attente » à « terminée » (avec l'étape « en livraison » si besoin). */
  terminer(commandeId: string, enLivraison?: boolean): Promise<CommandeCreee>;
  annulerParEtudiant(commandeId: string, jeton?: string): Promise<Response>;
  points(userId: string, restaurantId: string): Promise<number>;
  reliquat(userId: string, restaurantId: string): number;
  crediter(id: string, restaurantId: string, userId: string, points: number, expireLe: string, creeLe?: string): void;
  fermer(): Promise<void>;
}

const UTILISATEURS = new Map<string, AuthenticatedUser>([
  ['etudiant-1', { id: 'student-1', role: 'student' }],
  ['etudiant-2', { id: 'student-2', role: 'student' }],
  ['employe-alpha', { id: 'staff-alpha', role: 'employee', restaurantId: 'r-alpha' }],
]);

export async function creerMonde(): Promise<Monde> {
  const db = new Database(':memory:');
  migrate(db);
  const horloge = { instant: MAINTENANT };
  db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
    ('r-alpha', 'alpha', 'Restaurant Alpha', 'Arial', ?),
    ('r-beta', 'beta', 'Restaurant Beta', 'Arial', ?)`, [MAINTENANT, MAINTENANT]);
  db.run(`INSERT INTO restaurant_settings (restaurant_id, delivery_fee_fc, delivery_communes, opening_hours, updated_at) VALUES
    ('r-alpha', 2000, '["Limete"]', ?, ?),
    ('r-beta', 1500, '["Gombe"]', ?, ?)`, [HORAIRES, MAINTENANT, HORAIRES, MAINTENANT]);
  db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES
    ('student-1', 'r-alpha', 'student', 'Étudiant 1', 'student1@example.test', '+243820000001', 'hash-test', ?),
    ('student-2', 'r-alpha', 'student', 'Étudiant 2', 'student2@example.test', '+243820000002', 'hash-test', ?),
    ('staff-alpha', 'r-alpha', 'employee', 'Employé Alpha', 'staff@example.test', '+243820000003', 'hash-test', ?)`,
  [MAINTENANT, MAINTENANT, MAINTENANT]);
  db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES
    ('student-1', 'r-alpha', ?), ('student-1', 'r-beta', ?), ('student-2', 'r-alpha', ?)`,
  [MAINTENANT, MAINTENANT, MAINTENANT]);
  db.run(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at) VALUES
    ('alpha-dish', 'r-alpha', 'Poulet Alpha', 3000, 'plat', ?, ?),
    ('alpha-cheap', 'r-alpha', 'Beignets Alpha', 2000, 'snack', ?, ?),
    ('alpha-big', 'r-alpha', 'Plateau Alpha', 6000, 'plat', ?, ?),
    ('beta-dish', 'r-beta', 'Poulet Beta', 3000, 'plat', ?, ?)`,
  [MAINTENANT, MAINTENANT, MAINTENANT, MAINTENANT, MAINTENANT, MAINTENANT, MAINTENANT, MAINTENANT]);

  const serveur = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
    database: db,
    now: () => new Date(horloge.instant),
    resolveToken: (jeton) => UTILISATEURS.get(jeton) ?? null,
  }));
  const depot = new SqliteOrdersRepository(db);

  const monde: Monde = {
    db, serveur, horloge,
    commander(corps, cle, jeton = 'etudiant-1') {
      const corpsComplet = { restaurant: 'alpha', type: 'dine_in', paymentMethod: 'cash', ...corps };
      return fetch(`${serveur.base}/api/orders`, {
        method: 'POST',
        headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json', 'Idempotency-Key': cle },
        body: JSON.stringify(corpsComplet),
      });
    },
    async commanderOk(corps, cle, jeton) {
      const reponse = await monde.commander(corps, cle, jeton);
      assert.equal(reponse.status, 201, `la commande ${cle} devait être créée`);
      return reponse.json() as Promise<CommandeCreee>;
    },
    changerStatut(commandeId, statut, jeton = 'employe-alpha') {
      return fetch(`${serveur.base}/api/staff/orders/${commandeId}/status`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
        body: JSON.stringify({ status: statut }),
      });
    },
    async terminer(commandeId, enLivraison = false) {
      let derniere: Response | undefined;
      const etapes = enLivraison
        ? ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed']
        : ['confirmed', 'preparing', 'ready', 'completed'];
      for (const statut of etapes) {
        derniere = await monde.changerStatut(commandeId, statut);
        assert.equal(derniere.status, 200, `passage au statut ${statut}`);
      }
      return derniere!.json() as Promise<CommandeCreee>;
    },
    annulerParEtudiant(commandeId, jeton = 'etudiant-1') {
      return fetch(`${serveur.base}/api/orders/${commandeId}/cancel`, {
        method: 'POST', headers: { authorization: `Bearer ${jeton}` },
      });
    },
    points: (userId, restaurantId) => depot.getAvailablePoints(userId, restaurantId, horloge.instant),
    reliquat: (userId, restaurantId) => db.get<{ reste: number }>(
      'SELECT loyalty_remainder_fc AS reste FROM memberships WHERE user_id = ? AND restaurant_id = ?',
      [userId, restaurantId],
    )?.reste ?? 0,
    crediter(id, restaurantId, userId, points, expireLe, creeLe = MAINTENANT) {
      db.run(`INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, remaining, expires_at, created_at)
        VALUES (?, ?, ?, 'earn', ?, ?, ?, ?)`, [id, restaurantId, userId, points, points, expireLe, creeLe]);
    },
    async fermer() { await serveur.fermer(); db.close(); },
  };
  return monde;
}
