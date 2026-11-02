import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { creerMonde, type Monde } from './loyalty-setup.ts';

/**
 * Consultation du solde : GET /api/restaurants/:slug/loyalty (réservé à l'étudiant, par restaurant).
 * Le solde est associé au compte de l'étudiant et propre à chaque restaurant (docs/regles-multi-restaurants.md, §5).
 */
interface Solde {
  restaurant: { slug: string; name: string };
  availablePoints: number;
  remainderFc: number;
  canRedeem: boolean;
  rules: { spendPerPointFc: number; pointsForReward: number; rewardValueFc: number; validityMonths: number };
  movements: Array<{ kind: string; points: number; orderId: string | null; orderNumber: string | null; createdAt: string; expiresAt: string | null }>;
}

describe('Fidélité : consultation du solde', () => {
  let monde: Monde;
  beforeEach(async () => { monde = await creerMonde(); });
  afterEach(async () => { await monde.fermer(); });

  function lire(slug: string, jeton?: string): Promise<Response> {
    const entetes: Record<string, string> = jeton ? { authorization: `Bearer ${jeton}` } : {};
    return fetch(`${monde.serveur.base}/api/restaurants/${slug}/loyalty`, { headers: entetes });
  }
  async function solde(slug: string, jeton = 'etudiant-1'): Promise<Solde> {
    const reponse = await lire(slug, jeton);
    assert.equal(reponse.status, 200);
    return reponse.json() as Promise<Solde>;
  }
  async function code(reponse: Response): Promise<string> {
    return (await reponse.json() as { error: { code: string } }).error.code;
  }

  it('renvoie un solde vide et les règles du restaurant pour un étudiant sans point', async () => {
    const resultat = await solde('alpha');
    assert.deepEqual(resultat.restaurant, { slug: 'alpha', name: 'Restaurant Alpha' });
    assert.equal(resultat.availablePoints, 0);
    assert.equal(resultat.remainderFc, 0);
    assert.equal(resultat.canRedeem, false);
    assert.deepEqual(resultat.rules, { spendPerPointFc: 3000, pointsForReward: 15, rewardValueFc: 3000, validityMonths: 12 });
    assert.deepEqual(resultat.movements, []);
  });

  it('compte les points valides et ignore les points expirés', async () => {
    monde.crediter('valide', 'r-alpha', 'student-1', 20, '2027-10-26T00:00:00.000Z');
    monde.crediter('expire', 'r-alpha', 'student-1', 100, '2026-10-26T07:59:59.999Z');
    const resultat = await solde('alpha');
    assert.equal(resultat.availablePoints, 20);
    assert.equal(resultat.canRedeem, true);
  });

  it('indique le reste de dépense reporté vers le prochain point', async () => {
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-cheap', quantity: 1 }] }, 'solde-reliquat-001');
    await monde.terminer(commande.id);
    const resultat = await solde('alpha');
    assert.equal(resultat.remainderFc, 2000);
    assert.equal(resultat.availablePoints, 0);
  });

  it('garde le solde propre à chaque restaurant', async () => {
    monde.crediter('points-alpha', 'r-alpha', 'student-1', 15, '2027-10-26T00:00:00.000Z');
    assert.equal((await solde('alpha')).availablePoints, 15);
    assert.equal((await solde('beta')).availablePoints, 0);
  });

  it('ne montre à l’étudiant que ses propres points', async () => {
    monde.crediter('points-etu-1', 'r-alpha', 'student-1', 15, '2027-10-26T00:00:00.000Z');
    assert.equal((await solde('alpha', 'etudiant-1')).availablePoints, 15);
    const autre = await solde('alpha', 'etudiant-2');
    assert.equal(autre.availablePoints, 0);
    assert.deepEqual(autre.movements, []);
  });

  it('liste les mouvements du plus récent au plus ancien, sans données internes', async () => {
    monde.crediter('points-depart', 'r-alpha', 'student-1', 15, '2027-10-26T00:00:00.000Z', '2026-10-20T08:00:00.000Z');
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-big', quantity: 1 }], redeemMeal: true }, 'solde-mouvements-1');
    const resultat = await solde('alpha');
    assert.deepEqual(resultat.movements.map((mouvement) => [mouvement.kind, mouvement.points]), [['redeem', -15], ['earn', 15]]);
    assert.equal(resultat.movements[0]?.orderId, commande.id);
    assert.match(resultat.movements[0]?.orderNumber ?? '', /^\d{6}-\d{3}$/);
    assert.equal(resultat.movements[1]?.orderId, null);
    assert.equal(resultat.movements[1]?.expiresAt, '2027-10-26T00:00:00.000Z');
    for (const mouvement of resultat.movements) {
      assert.equal('note' in mouvement, false, 'le détail interne du débit n’est pas exposé');
      assert.equal('userId' in mouvement, false);
    }
  });

  it('limite l’historique aux 50 mouvements les plus récents', async () => {
    for (let index = 0; index < 55; index += 1) {
      monde.crediter(`lot-${index}`, 'r-alpha', 'student-1', 1, '2027-10-26T00:00:00.000Z', new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString());
    }
    const resultat = await solde('alpha');
    assert.equal(resultat.movements.length, 50);
    assert.equal(resultat.availablePoints, 55, 'le solde porte sur tous les points, pas seulement sur l’historique affiché');
  });

  it('exige une connexion', async () => {
    const reponse = await lire('alpha');
    assert.equal(reponse.status, 401);
    assert.equal(await code(reponse), 'UNAUTHORIZED');
  });

  it('est réservé aux étudiants', async () => {
    const reponse = await lire('alpha', 'employe-alpha');
    assert.equal(reponse.status, 403);
    assert.equal(await code(reponse), 'FORBIDDEN');
  });

  it('refuse un étudiant qui n’est pas inscrit au restaurant', async () => {
    const reponse = await lire('beta', 'etudiant-2');
    assert.equal(reponse.status, 403);
    assert.equal(await code(reponse), 'FORBIDDEN');
  });

  it('répond 404 pour un restaurant inconnu', async () => {
    const reponse = await lire('inconnu', 'etudiant-1');
    assert.equal(reponse.status, 404);
    assert.equal(await code(reponse), 'NOT_FOUND');
  });
});
