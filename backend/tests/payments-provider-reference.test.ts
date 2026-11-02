import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { SimulatedPaymentProvider, type PaymentProvider, type PaymentProviderStartInput } from '../src/domain/payments.ts';
import { demarrer, type Serveur } from './helpers.ts';

/**
 * Référence du fournisseur : un fournisseur comme Easypay renvoie, à l'initialisation, une référence qui sert
 * ensuite à retrouver le paiement et à rejouer la redirection sans créer une seconde transaction chez lui.
 */
const NOW = new Date('2026-10-26T08:00:00.000Z');
const OPENING_HOURS = JSON.stringify(Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '00:00', close: '23:59' }]]),
));

class FournisseurAvecReference extends SimulatedPaymentProvider {
  readonly demarrages: PaymentProviderStartInput[] = [];
  override async startPayment(input: PaymentProviderStartInput): Promise<{ redirectUrl: string; providerReference: string }> {
    this.demarrages.push(input);
    const reference = `REF-${this.demarrages.length}`;
    return { redirectUrl: this.redirectUrlFor(reference), providerReference: reference };
  }
  redirectUrlFor(reference: string): string { return `https://passerelle.exemple/payer?reference=${reference}`; }
}

let db: Database;
let serveur: Serveur;

async function demarrerAvec(fournisseur?: PaymentProvider): Promise<void> {
  db = new Database(':memory:');
  migrate(db);
  const maintenant = NOW.toISOString();
  db.run("INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES ('r-alpha', 'alpha', 'Alpha', 'Arial', ?)", [maintenant]);
  db.run("INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES ('r-alpha', ?, ?)", [OPENING_HOURS, maintenant]);
  db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
    VALUES ('student-1', 'r-alpha', 'student', 'Aline Mbuyi', 'e@example.test', '+243820000001', 'hash-test', ?)`, [maintenant]);
  db.run("INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES ('student-1', 'r-alpha', ?)", [maintenant]);
  db.run(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at)
    VALUES ('alpha-dish', 'r-alpha', 'Poulet', 3000, 'plat', ?, ?)`, [maintenant, maintenant]);
  const utilisateurs = new Map<string, AuthenticatedUser>([['jeton', { id: 'student-1', role: 'student' }]]);
  serveur = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', PAYMENT_WEBHOOK_SECRET: randomBytes(32).toString('hex') }), {
    database: db,
    now: () => new Date(NOW),
    resolveToken: (jeton) => utilisateurs.get(jeton) ?? null,
    ...(fournisseur ? { paymentProvider: fournisseur } : {}),
  }));
}

async function commande(): Promise<string> {
  const reponse = await fetch(`${serveur.base}/api/orders`, {
    method: 'POST',
    headers: { authorization: 'Bearer jeton', 'content-type': 'application/json', 'Idempotency-Key': 'reference-commande-1' },
    body: JSON.stringify({ restaurant: 'alpha', type: 'dine_in', paymentMethod: 'mobile_money', items: [{ menuItemId: 'alpha-dish', quantity: 1 }] }),
  });
  assert.equal(reponse.status, 201);
  return (await reponse.json() as { id: string }).id;
}

function payer(orderId: string): Promise<Response> {
  return fetch(`${serveur.base}/api/orders/${orderId}/pay`, {
    method: 'POST',
    headers: { authorization: 'Bearer jeton', 'content-type': 'application/json' },
    body: JSON.stringify({ operator: 'mpesa', phone: '+243812345678' }),
  });
}

describe('Paiements : référence du fournisseur', () => {
  afterEach(async () => { await serveur.fermer(); db.close(); });

  describe('fournisseur qui renvoie une référence', () => {
    let fournisseur: FournisseurAvecReference;
    beforeEach(async () => { fournisseur = new FournisseurAvecReference(randomBytes(32).toString('hex')); await demarrerAvec(fournisseur); });

    it('enregistre la référence, renvoie son adresse et transmet le nom du client', async () => {
      const orderId = await commande();
      const reponse = await payer(orderId);
      assert.equal(reponse.status, 201);
      const paiement = await reponse.json() as { paymentId: string; redirectUrl: string };
      assert.equal(paiement.redirectUrl, 'https://passerelle.exemple/payer?reference=REF-1');
      assert.equal(db.get<{ ref: string }>('SELECT provider_reference AS ref FROM payments WHERE id = ?', [paiement.paymentId])?.ref, 'REF-1');
      assert.equal(fournisseur.demarrages.length, 1);
      assert.equal(fournisseur.demarrages[0]?.customerName, 'Aline Mbuyi');
      assert.equal(fournisseur.demarrages[0]?.amountFc, 3000);
    });

    it('rejoue la redirection depuis la référence, sans créer de seconde transaction chez le fournisseur', async () => {
      const orderId = await commande();
      const premier = await (await payer(orderId)).json() as { redirectUrl: string };
      const rejeu = await payer(orderId);
      assert.equal(rejeu.status, 200);
      assert.equal((await rejeu.json() as { redirectUrl: string }).redirectUrl, premier.redirectUrl);
      assert.equal(fournisseur.demarrages.length, 1, 'le fournisseur n’est appelé qu’une fois');
    });

    it('ne laisse pas de paiement orphelin quand l’enregistrement de la référence est impossible', async () => {
      const orderId = await commande();
      db.run("INSERT INTO payments (id, restaurant_id, order_id, operator, phone, amount_fc, status, provider_ref, provider_reference, created_at, updated_at) VALUES ('autre', 'r-alpha', ?, 'mpesa', '+243800000000', 1, 'failed', NULL, 'REF-1', ?, ?)", [orderId, NOW.toISOString(), NOW.toISOString()]);
      const reponse = await payer(orderId);
      assert.equal(reponse.status, 502, 'la référence en doublon est refusée par la base');
      assert.equal(db.get<{ ref: string | null }>("SELECT provider_reference AS ref FROM payments WHERE id <> 'autre'")?.ref ?? null, null);
    });
  });

  describe('simulation (défaut)', () => {
    beforeEach(async () => { await demarrerAvec(); });

    it('n’enregistre aucune référence de fournisseur', async () => {
      const paiement = await (await payer(await commande())).json() as { paymentId: string; redirectUrl: string };
      assert.match(paiement.redirectUrl, /^\/paiement\/simulation\//);
      assert.equal(db.get<{ ref: string | null }>('SELECT provider_reference AS ref FROM payments WHERE id = ?', [paiement.paymentId])?.ref, null);
    });

    it('la table des paiements porte une colonne et un index uniques pour la référence', () => {
      const colonnes = db.all<{ name: string }>("PRAGMA table_info('payments')").map((colonne) => colonne.name);
      assert.ok(colonnes.includes('provider_reference'));
      const index = db.all<{ name: string; unique: number }>("PRAGMA index_list('payments')").find((ligne) => ligne.name === 'idx_payments_provider_reference');
      assert.equal(index?.unique, 1);
    });
  });
});
