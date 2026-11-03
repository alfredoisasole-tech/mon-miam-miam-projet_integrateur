import { createHmac, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { EasypayPaymentProvider, easypayOrderRef } from '../src/domain/easypay.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { demarrer, type Serveur } from './helpers.ts';

/**
 * Notification Easypay (IPN) : elle n'est ni signée ni accompagnée d'un montant, donc jamais crue.
 * Le serveur retrouve le paiement par la référence, puis rappelle Easypay (faux client HTTP ici) et ne
 * confirme que sur la réponse d'Easypay.
 */
const NOW = new Date('2026-10-26T08:00:00.000Z');
const OPENING_HOURS = JSON.stringify(Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, [{ open: '00:00', close: '23:59' }]]),
));
const IPN_KEY = randomBytes(32).toString('hex');
const WEBHOOK_SECRET = randomBytes(32).toString('hex');
const REFERENCE = 'VVk5cm1sZC81djRMdWhNaWZ2cjhQdk9LcHJtZHdjaTN0cG9GUWwrQ1VRWmhOUT09';

type ReponseEasypay = 'SUCCESS' | 'DECLINED' | 'CANCELED' | 'PENDING' | 'ERREUR_500' | 'INCONNUE_404' | 'RESEAU';

let db: Database;
let serveur: Serveur;
let appelsDeVerification = 0;
let reponseEasypay: ReponseEasypay = 'SUCCESS';
let paymentIdCourant = '';

const fetchImpl = (async (entree: string | URL | Request): Promise<Response> => {
  const url = new URL(String(entree));
  if (url.pathname.endsWith('/payment/initialization')) {
    return new Response(JSON.stringify({ code: 1, reference: REFERENCE }), { status: 200 });
  }
  appelsDeVerification += 1;
  if (reponseEasypay === 'RESEAU') throw new Error('réseau coupé');
  if (reponseEasypay === 'ERREUR_500') return new Response('{"message":"An error occured during the operation."}', { status: 500 });
  if (reponseEasypay === 'INCONNUE_404') return new Response('{"message":"No transaction found"}', { status: 404 });
  return new Response(JSON.stringify({
    transaction: { order_ref: easypayOrderRef(paymentIdCourant), reference: REFERENCE },
    payment: { channel: 'MOBILE MONEY', status: reponseEasypay, reference: REFERENCE },
  }), { status: 200 });
}) as typeof fetch;

async function demarrerAvecEasypay(): Promise<void> {
  const config = loadConfig({
    NODE_ENV: 'test', PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET, PAYMENT_PROVIDER: 'easypay',
    EASYPAY_CID: 'cid', EASYPAY_TOKEN: 'jeton', EASYPAY_IPN_KEY: IPN_KEY, SITE_URL: 'https://site.exemple',
  });
  assert.ok(config.easypay);
  await demarrerAvec(config, new EasypayPaymentProvider(config.easypay, { fetchImpl }));
}

async function demarrerAvec(config: ReturnType<typeof loadConfig>, fournisseur?: EasypayPaymentProvider): Promise<void> {
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
  serveur = await demarrer(createApp(config, {
    database: db,
    now: () => new Date(NOW),
    resolveToken: (jeton) => utilisateurs.get(jeton) ?? null,
    ...(fournisseur ? { paymentProvider: fournisseur } : {}),
  }));
}

async function creerPaiement(): Promise<{ orderId: string; paymentId: string }> {
  const commande = await fetch(`${serveur.base}/api/orders`, {
    method: 'POST',
    headers: { authorization: 'Bearer jeton', 'content-type': 'application/json', 'Idempotency-Key': 'ipn-commande-1' },
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
  const { paymentId, redirectUrl } = await paiement.json() as { paymentId: string; redirectUrl: string };
  assert.match(redirectUrl, /^https:\/\/www\.e-com-easypay\.com\/sandbox\/payment\/initialization\?reference=/);
  paymentIdCourant = paymentId;
  return { orderId: id, paymentId };
}

function ipn(corps: unknown, options: { cle?: string | null; contentType?: string } = {}): Promise<Response> {
  const cle = options.cle === undefined ? IPN_KEY : options.cle;
  const url = `${serveur.base}/api/payments/easypay/ipn${cle === null ? '' : `?key=${encodeURIComponent(cle)}`}`;
  return fetch(url, { method: 'POST', headers: { 'content-type': options.contentType ?? 'application/json' }, body: typeof corps === 'string' ? corps : JSON.stringify(corps) });
}

const notification = (statut = 'SUCCESS', reference = REFERENCE) => ({
  transaction: { order_ref: 'peu-importe', reference },
  payment: { channel: 'MOBILE MONEY', status: statut, reference },
});

function etat(paymentId: string): { paiement: string; commande: string; paiementCommande: string; refFournisseur: string | null } {
  const ligne = db.get<{ paiement: string; commande: string; paiementCommande: string; refFournisseur: string | null }>(`
    SELECT p.status AS paiement, o.status AS commande, o.payment_status AS paiementCommande, p.provider_ref AS refFournisseur
    FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?`, [paymentId]);
  assert.ok(ligne);
  return { ...ligne };
}

async function code(reponse: Response): Promise<string> {
  return (await reponse.json() as { error: { code: string } }).error.code;
}

describe('Paiements Easypay : notification (IPN)', () => {
  beforeEach(async () => { appelsDeVerification = 0; reponseEasypay = 'SUCCESS'; await demarrerAvecEasypay(); });
  afterEach(async () => { await serveur.fermer(); db.close(); });

  it('confirme le paiement et la commande quand Easypay répond SUCCESS', async () => {
    const { orderId, paymentId } = await creerPaiement();
    const reponse = await ipn(notification());
    assert.equal(reponse.status, 200);
    assert.deepEqual(await reponse.json(), { paymentId, status: 'paid', orderStatus: 'confirmed' });
    assert.deepEqual(etat(paymentId), { paiement: 'paid', commande: 'confirmed', paiementCommande: 'paid', refFournisseur: REFERENCE });
    assert.equal(db.get<{ total: number }>("SELECT COUNT(*) AS total FROM order_events WHERE order_id = ? AND status = 'confirmed'", [orderId])?.total, 1);
  });

  for (const statut of ['DECLINED', 'CANCELED'] as const) {
    it(`marque le paiement échoué quand Easypay répond ${statut}, la commande restant en attente`, async () => {
      const { paymentId } = await creerPaiement();
      reponseEasypay = statut;
      assert.equal((await ipn(notification(statut))).status, 200);
      assert.deepEqual(etat(paymentId), { paiement: 'failed', commande: 'pending', paiementCommande: 'failed', refFournisseur: REFERENCE });
    });
  }

  it('ne croit jamais le corps : une notification SUCCESS que démentent les faits ne confirme rien', async () => {
    const { paymentId } = await creerPaiement();
    reponseEasypay = 'PENDING';
    const reponse = await ipn(notification('SUCCESS'));
    assert.equal(reponse.status, 202);
    assert.deepEqual(etat(paymentId), { paiement: 'pending', commande: 'pending', paiementCommande: 'pending', refFournisseur: null });
  });

  it('suit la réponse d’Easypay et non le statut annoncé par la notification', async () => {
    const { paymentId } = await creerPaiement();
    reponseEasypay = 'SUCCESS';
    assert.equal((await ipn(notification('DECLINED'))).status, 200);
    assert.equal(etat(paymentId).paiement, 'paid');
  });

  it('ne confirme rien quand Easypay est injoignable ou en erreur, et répond 502', async () => {
    const { paymentId } = await creerPaiement();
    for (const panne of ['ERREUR_500', 'RESEAU'] as const) {
      reponseEasypay = panne;
      const reponse = await ipn(notification());
      assert.equal(reponse.status, 502);
      assert.equal(await code(reponse), 'PAYMENT_PROVIDER_UNAVAILABLE');
    }
    assert.equal(etat(paymentId).paiement, 'pending');
  });

  it('ne confirme rien quand Easypay ne connaît pas la transaction', async () => {
    const { paymentId } = await creerPaiement();
    reponseEasypay = 'INCONNUE_404';
    assert.equal((await ipn(notification())).status, 202);
    assert.equal(etat(paymentId).paiement, 'pending');
  });

  it('refuse une clé absente ou fausse, sans rappeler Easypay', async () => {
    await creerPaiement();
    for (const cle of [null, 'fausse', IPN_KEY.slice(0, -1)]) {
      const reponse = await ipn(notification(), { cle });
      assert.equal(reponse.status, 401);
      assert.equal(await code(reponse), 'INVALID_IPN_KEY');
    }
    assert.equal(appelsDeVerification, 0);
  });

  it('répond 404 pour une référence inconnue, sans rappeler Easypay', async () => {
    await creerPaiement();
    const reponse = await ipn(notification('SUCCESS', 'REFERENCE-INCONNUE'));
    assert.equal(reponse.status, 404);
    assert.equal(await code(reponse), 'PAYMENT_NOT_FOUND');
    assert.equal(appelsDeVerification, 0);
  });

  it('refuse un corps sans référence', async () => {
    await creerPaiement();
    for (const corps of [{}, { transaction: {} }, { transaction: { reference: 42 } }, [], 'pas du json']) {
      const reponse = await ipn(corps);
      assert.equal(reponse.status, 400);
    }
    assert.equal(appelsDeVerification, 0);
  });

  it('accepte un corps JSON envoyé sans type de contenu JSON', async () => {
    const { paymentId } = await creerPaiement();
    assert.equal((await ipn(JSON.stringify(notification()), { contentType: 'text/plain' })).status, 200);
    assert.equal(etat(paymentId).paiement, 'paid');
  });

  it('traite le rejeu d’une notification sans nouvelle modification', async () => {
    const { orderId, paymentId } = await creerPaiement();
    assert.equal((await ipn(notification())).status, 200);
    assert.equal((await ipn(notification())).status, 200);
    assert.equal(etat(paymentId).paiement, 'paid');
    assert.equal(db.get<{ total: number }>("SELECT COUNT(*) AS total FROM order_events WHERE order_id = ? AND status = 'confirmed'", [orderId])?.total, 1);
  });

  it('refuse un état contradictoire après un état final', async () => {
    const { paymentId } = await creerPaiement();
    assert.equal((await ipn(notification())).status, 200);
    reponseEasypay = 'DECLINED';
    const reponse = await ipn(notification());
    assert.equal(reponse.status, 409);
    assert.equal(await code(reponse), 'PAYMENT_ALREADY_FINALIZED');
    assert.equal(etat(paymentId).paiement, 'paid');
  });

  it('ferme la route à signature HMAC et la simulation : rien d’autre ne peut confirmer un paiement', async () => {
    const { paymentId } = await creerPaiement();
    const brut = JSON.stringify({ paymentId, status: 'paid', providerRef: 'forge' });
    const webhook = await fetch(`${serveur.base}/api/payments/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Payment-Signature': createHmac('sha256', WEBHOOK_SECRET).update(brut).digest('hex') },
      body: brut,
    });
    assert.equal(webhook.status, 401);
    const simulation = await fetch(`${serveur.base}/api/payments/${paymentId}/simulate`, {
      method: 'POST',
      headers: { authorization: 'Bearer jeton', 'content-type': 'application/json' },
      body: JSON.stringify({ outcome: 'paid' }),
    });
    assert.equal(simulation.status, 404);
    assert.equal(etat(paymentId).paiement, 'pending');
  });
});

describe('Paiements Easypay : simulation par défaut', () => {
  beforeEach(async () => { await demarrerAvec(loadConfig({ NODE_ENV: 'test', PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET })); });
  afterEach(async () => { await serveur.fermer(); db.close(); });

  it('n’expose pas la route de notification Easypay', async () => {
    const reponse = await ipn(notification());
    assert.equal(reponse.status, 404);
    assert.equal(await code(reponse), 'NOT_FOUND');
  });
});
