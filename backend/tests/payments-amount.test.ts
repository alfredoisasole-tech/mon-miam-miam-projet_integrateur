import { createHmac, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import type { PaymentProvider } from '../src/domain/payments.ts';
import { SimulatedPaymentProvider } from '../src/domain/payments.ts';
import { demarrer, type Serveur } from './helpers.ts';

/**
 * Vérification du montant d'une notification de paiement (docs/api/paiements.md, §2) :
 * avant de confirmer un paiement réel, le montant reçu doit égaler le montant attendu de la commande.
 * Ce contrôle est indépendant du fournisseur : il s'applique à tout adaptateur, y compris Easypay.
 */
const WEBHOOK_SECRET = randomBytes(32).toString('hex');
const NOW = new Date('2026-10-26T08:00:00.000Z');
const OPENING_HOURS = JSON.stringify(Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '00:00', close: '23:59' }]]),
));
const MONTANT_ATTENDU = 3000;

/** Fournisseur de test qui exige le montant, comme le fera un fournisseur réel. */
class FournisseurExigeantLeMontant extends SimulatedPaymentProvider implements PaymentProvider {
  readonly requiresAmountVerification = true;
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
    VALUES ('student-1', 'r-alpha', 'student', 'Étudiant', 'e@example.test', '+243820000001', 'hash-test', ?)`, [maintenant]);
  db.run("INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES ('student-1', 'r-alpha', ?)", [maintenant]);
  db.run(`INSERT INTO menu_items (id, restaurant_id, name, price_fc, category, created_at, updated_at)
    VALUES ('alpha-dish', 'r-alpha', 'Poulet', 3000, 'plat', ?, ?)`, [maintenant, maintenant]);
  const utilisateurs = new Map<string, AuthenticatedUser>([['jeton', { id: 'student-1', role: 'student' }]]);
  serveur = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET }), {
    database: db,
    now: () => new Date(NOW),
    resolveToken: (jeton) => utilisateurs.get(jeton) ?? null,
    ...(fournisseur ? { paymentProvider: fournisseur } : {}),
  }));
}

async function creerPaiement(): Promise<{ orderId: string; paymentId: string }> {
  const commande = await fetch(`${serveur.base}/api/orders`, {
    method: 'POST',
    headers: { authorization: 'Bearer jeton', 'content-type': 'application/json', 'Idempotency-Key': 'montant-commande-1' },
    body: JSON.stringify({ restaurant: 'alpha', type: 'dine_in', paymentMethod: 'mobile_money', items: [{ menuItemId: 'alpha-dish', quantity: 1 }] }),
  });
  assert.equal(commande.status, 201);
  const { id } = await commande.json() as { id: string };
  const paiement = await fetch(`${serveur.base}/api/orders/${id}/pay`, {
    method: 'POST',
    headers: { authorization: 'Bearer jeton', 'content-type': 'application/json' },
    body: JSON.stringify({ operator: 'mpesa', phone: '+243812345678' }),
  });
  assert.equal(paiement.status, 201);
  const { paymentId, amountFc } = await paiement.json() as { paymentId: string; amountFc: number };
  assert.equal(amountFc, MONTANT_ATTENDU);
  return { orderId: id, paymentId };
}

async function notifier(corps: Record<string, unknown>): Promise<Response> {
  const brut = JSON.stringify(corps);
  return fetch(`${serveur.base}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Payment-Signature': createHmac('sha256', WEBHOOK_SECRET).update(brut).digest('hex') },
    body: brut,
  });
}

function etat(orderId: string, paymentId: string): { paiement: string; commande: string; paiementCommande: string } {
  const ligne = db.get<{ paiement: string; commande: string; paiementCommande: string }>(`
    SELECT p.status AS paiement, o.status AS commande, o.payment_status AS paiementCommande
    FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ? AND o.id = ?`, [paymentId, orderId]);
  assert.ok(ligne);
  return { ...ligne };
}

async function code(reponse: Response): Promise<string> {
  return (await reponse.json() as { error: { code: string } }).error.code;
}

describe('Paiements : vérification du montant de la notification', () => {
  afterEach(async () => { await serveur.fermer(); db.close(); });

  describe('fournisseur simulé (le montant est facultatif)', () => {
    beforeEach(async () => { await demarrerAvec(); });

    it('confirme un paiement dont le montant correspond', async () => {
      const { orderId, paymentId } = await creerPaiement();
      const reponse = await notifier({ paymentId, status: 'paid', providerRef: 'ref-1', amountFc: MONTANT_ATTENDU });
      assert.equal(reponse.status, 200);
      assert.deepEqual(etat(orderId, paymentId), { paiement: 'paid', commande: 'confirmed', paiementCommande: 'paid' });
    });

    it('refuse un montant différent sans confirmer le paiement ni la commande', async () => {
      const { orderId, paymentId } = await creerPaiement();
      const reponse = await notifier({ paymentId, status: 'paid', providerRef: 'ref-2', amountFc: 1 });
      assert.equal(reponse.status, 422);
      assert.equal(await code(reponse), 'AMOUNT_MISMATCH');
      assert.deepEqual(etat(orderId, paymentId), { paiement: 'pending', commande: 'pending', paiementCommande: 'pending' });
      assert.equal(db.get<{ total: number }>("SELECT COUNT(*) AS total FROM order_events WHERE order_id = ? AND status = 'confirmed'", [orderId])?.total, 0);
    });

    it('refuse aussi un montant supérieur au montant attendu', async () => {
      const { orderId, paymentId } = await creerPaiement();
      const reponse = await notifier({ paymentId, status: 'paid', providerRef: 'ref-3', amountFc: MONTANT_ATTENDU + 1 });
      assert.equal(reponse.status, 422);
      assert.equal(etat(orderId, paymentId).paiement, 'pending');
    });

    it('refuse une notification d’échec dont le montant est incohérent', async () => {
      const { orderId, paymentId } = await creerPaiement();
      const reponse = await notifier({ paymentId, status: 'failed', providerRef: 'ref-4', amountFc: 10 });
      assert.equal(reponse.status, 422);
      assert.equal(etat(orderId, paymentId).paiement, 'pending');
    });

    it('refuse un rejeu à montant incorrect sans modifier un paiement déjà confirmé', async () => {
      const { orderId, paymentId } = await creerPaiement();
      assert.equal((await notifier({ paymentId, status: 'paid', providerRef: 'ref-5', amountFc: MONTANT_ATTENDU })).status, 200);
      const rejeu = await notifier({ paymentId, status: 'paid', providerRef: 'ref-5', amountFc: 1 });
      assert.equal(rejeu.status, 422);
      assert.deepEqual(etat(orderId, paymentId), { paiement: 'paid', commande: 'confirmed', paiementCommande: 'paid' });
    });

    it('accepte toujours une notification sans montant (compatibilité avec la simulation)', async () => {
      const { orderId, paymentId } = await creerPaiement();
      const reponse = await notifier({ paymentId, status: 'paid', providerRef: 'ref-6' });
      assert.equal(reponse.status, 200);
      assert.equal(etat(orderId, paymentId).paiement, 'paid');
    });

    it('refuse un montant qui n’est pas un entier positif', async () => {
      const { paymentId } = await creerPaiement();
      for (const amountFc of ['3000', 3000.5, -3000, 0, null, true]) {
        const reponse = await notifier({ paymentId, status: 'paid', providerRef: 'ref-7', amountFc });
        assert.equal(reponse.status, 400, `amountFc = ${JSON.stringify(amountFc)}`);
        assert.equal(await code(reponse), 'VALIDATION_ERROR');
      }
    });
  });

  describe('fournisseur réel (le montant est obligatoire)', () => {
    beforeEach(async () => { await demarrerAvec(new FournisseurExigeantLeMontant(WEBHOOK_SECRET)); });

    it('refuse une notification sans montant et ne confirme rien', async () => {
      const { orderId, paymentId } = await creerPaiement();
      const reponse = await notifier({ paymentId, status: 'paid', providerRef: 'ref-8' });
      assert.equal(reponse.status, 400);
      assert.equal(await code(reponse), 'VALIDATION_ERROR');
      assert.deepEqual(etat(orderId, paymentId), { paiement: 'pending', commande: 'pending', paiementCommande: 'pending' });
    });

    it('confirme une notification dont le montant correspond', async () => {
      const { orderId, paymentId } = await creerPaiement();
      const reponse = await notifier({ paymentId, status: 'paid', providerRef: 'ref-9', amountFc: MONTANT_ATTENDU });
      assert.equal(reponse.status, 200);
      assert.deepEqual(etat(orderId, paymentId), { paiement: 'paid', commande: 'confirmed', paiementCommande: 'paid' });
    });

    it('refuse un montant différent', async () => {
      const { orderId, paymentId } = await creerPaiement();
      const reponse = await notifier({ paymentId, status: 'paid', providerRef: 'ref-10', amountFc: 2999 });
      assert.equal(reponse.status, 422);
      assert.equal(await code(reponse), 'AMOUNT_MISMATCH');
      assert.equal(etat(orderId, paymentId).paiement, 'pending');
    });
  });
});
