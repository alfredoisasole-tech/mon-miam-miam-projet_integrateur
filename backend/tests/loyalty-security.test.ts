import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { creerMonde, type Monde } from './loyalty-setup.ts';

/**
 * APP-81 : sécuriser le solde de fidélité.
 * Le serveur est la seule source de vérité : un solde ne peut pas être utilisé deux fois,
 * les mouvements sont enregistrés dans le journal, et les points restitués ne le sont qu'une fois.
 */
describe('Fidélité : sécurité du solde', () => {
  let monde: Monde;
  const PLAT = [{ menuItemId: 'alpha-dish', quantity: 1 }];
  /** 6 000 FC de plats : avec la remise, il reste 3 000 FC à payer, donc la commande reste annulable. */
  const GROS = [{ menuItemId: 'alpha-big', quantity: 1 }];
  beforeEach(async () => {
    monde = await creerMonde();
    monde.crediter('points-alpha', 'r-alpha', 'student-1', 15, '2027-10-26T00:00:00.000Z');
  });
  afterEach(async () => { await monde.fermer(); });

  function lignesRachat(): Array<{ points: number; order_id: string }> {
    return monde.db.all<{ points: number; order_id: string }>(
      "SELECT points, order_id FROM points_ledger WHERE kind = 'redeem' ORDER BY created_at, id");
  }
  function reste(id: string): number {
    return monde.db.get<{ remaining: number }>('SELECT remaining FROM points_ledger WHERE id = ?', [id])?.remaining ?? -1;
  }

  it('refuse de réutiliser les mêmes 15 points pour une seconde remise', async () => {
    await monde.commanderOk({ items: PLAT, redeemMeal: true }, 'double-usage-0001');
    const seconde = await monde.commander({ items: PLAT, redeemMeal: true }, 'double-usage-0002');
    assert.equal(seconde.status, 422);
    assert.equal((await seconde.json() as { error: { code: string } }).error.code, 'INSUFFICIENT_POINTS');
    assert.equal(lignesRachat().length, 1);
    assert.equal(await monde.points('student-1', 'r-alpha'), 0);
  });

  it('accepte une seule de deux requêtes simultanées qui visent les mêmes 15 points', async () => {
    const [premiere, seconde] = await Promise.all([
      monde.commander({ items: PLAT, redeemMeal: true }, 'simultane-00001'),
      monde.commander({ items: PLAT, redeemMeal: true }, 'simultane-00002'),
    ]);
    assert.deepEqual([premiere.status, seconde.status].sort(), [201, 422]);
    assert.equal(lignesRachat().length, 1);
    assert.equal(await monde.points('student-1', 'r-alpha'), 0);
    assert.equal(monde.db.get<{ total: number }>('SELECT COUNT(*) AS total FROM orders')?.total, 1);
  });

  it('ne débite qu’une fois quand la même requête est rejouée avec la même clé', async () => {
    const corps = { items: PLAT, redeemMeal: true };
    const creation = await monde.commander(corps, 'rejeu-meme-cle-01');
    assert.equal(creation.status, 201);
    for (let essai = 0; essai < 3; essai += 1) {
      const rejeu = await monde.commander(corps, 'rejeu-meme-cle-01');
      assert.equal(rejeu.status, 200);
      assert.equal(rejeu.headers.get('Idempotent-Replayed'), 'true');
    }
    assert.equal(lignesRachat().length, 1);
    assert.equal(monde.db.get<{ total: number }>('SELECT COUNT(*) AS total FROM orders')?.total, 1);
  });

  it('refuse la même clé avec un contenu différent sans toucher au solde', async () => {
    await monde.commanderOk({ items: PLAT, redeemMeal: true }, 'rejeu-autre-cont-1');
    const conflit = await monde.commander({ items: PLAT, redeemMeal: false }, 'rejeu-autre-cont-1');
    assert.equal(conflit.status, 409);
    assert.equal(lignesRachat().length, 1);
    assert.equal(await monde.points('student-1', 'r-alpha'), 0);
  });

  it('ignore les montants et les points envoyés par le navigateur', async () => {
    const reponse = await monde.commander({
      items: PLAT, redeemMeal: false, discountFc: 3000, totalFc: 1, pointsRedeemed: 15, pointsEarned: 500,
    }, 'client-menteur-001');
    if (reponse.status === 201) {
      const commande = await reponse.json() as { discountFc: number; totalFc: number; pointsRedeemed: number; pointsEarned: number };
      assert.equal(commande.discountFc, 0);
      assert.equal(commande.totalFc, 3000);
      assert.equal(commande.pointsRedeemed, 0);
      assert.equal(commande.pointsEarned, 0);
    } else {
      assert.equal(reponse.status, 400);
    }
    assert.equal(await monde.points('student-1', 'r-alpha'), 15);
  });

  it('restitue les points une seule fois quand l’étudiant annule, même si l’annulation est répétée', async () => {
    const commande = await monde.commanderOk({ items: GROS, redeemMeal: true }, 'annulation-double-1');
    assert.equal((await monde.annulerParEtudiant(commande.id)).status, 200);
    assert.equal((await monde.annulerParEtudiant(commande.id)).status, 409);
    assert.equal(await monde.points('student-1', 'r-alpha'), 15, 'ni 0, ni 30 points');
  });

  it('restitue les points une seule fois quand le personnel annule une commande confirmée', async () => {
    const commande = await monde.commanderOk({ items: PLAT, redeemMeal: true }, 'annulation-staff-01');
    assert.equal((await monde.changerStatut(commande.id, 'confirmed')).status, 200);
    assert.equal((await monde.changerStatut(commande.id, 'cancelled')).status, 200);
    assert.equal((await monde.changerStatut(commande.id, 'cancelled')).status, 409);
    assert.equal((await monde.annulerParEtudiant(commande.id)).status, 409);
    assert.equal(await monde.points('student-1', 'r-alpha'), 15);
  });

  it('permet à l’étudiant d’annuler une commande réglée entièrement avec ses points et lui rend ses points', async () => {
    const commande = await monde.commanderOk({ items: PLAT, redeemMeal: true }, 'total-zero-000001');
    assert.equal(commande.totalFc, 0, '3 000 FC de plats moins 3 000 FC de remise');
    assert.equal(await monde.points('student-1', 'r-alpha'), 0);
    assert.equal((await monde.annulerParEtudiant(commande.id)).status, 200, 'rien n’a été payé : la commande en attente reste annulable');
    assert.equal(await monde.points('student-1', 'r-alpha'), 15);
    assert.equal((await monde.annulerParEtudiant(commande.id)).status, 409);
    assert.equal(await monde.points('student-1', 'r-alpha'), 15);
  });

  it('permet de réutiliser les points restitués, une seule fois', async () => {
    const annulee = await monde.commanderOk({ items: GROS, redeemMeal: true }, 'reutilisation-0001');
    await monde.annulerParEtudiant(annulee.id);
    await monde.commanderOk({ items: GROS, redeemMeal: true }, 'reutilisation-0002');
    const encore = await monde.commander({ items: GROS, redeemMeal: true }, 'reutilisation-0003');
    assert.equal(encore.status, 422);
    assert.equal(await monde.points('student-1', 'r-alpha'), 0);
  });

  it('utilise d’abord les points qui expirent le plus tôt et les restitue au même lot', async () => {
    monde.db.run("DELETE FROM points_ledger WHERE id = 'points-alpha'");
    monde.crediter('lot-tardif', 'r-alpha', 'student-1', 20, '2027-06-30T00:00:00.000Z');
    monde.crediter('lot-precoce', 'r-alpha', 'student-1', 10, '2027-01-31T00:00:00.000Z');
    const commande = await monde.commanderOk({ items: GROS, redeemMeal: true }, 'lots-ordre-000001');
    assert.equal(reste('lot-precoce'), 0, 'le lot qui expire en premier est consommé en premier');
    assert.equal(reste('lot-tardif'), 15);
    assert.equal(await monde.points('student-1', 'r-alpha'), 15);

    await monde.annulerParEtudiant(commande.id);
    assert.equal(reste('lot-precoce'), 10);
    assert.equal(reste('lot-tardif'), 20);
    assert.equal(await monde.points('student-1', 'r-alpha'), 30);
  });

  it('enregistre chaque utilisation dans le journal avec la commande concernée', async () => {
    const commande = await monde.commanderOk({ items: PLAT, redeemMeal: true }, 'journal-mouvement-1');
    const mouvements = lignesRachat();
    assert.equal(mouvements.length, 1);
    assert.equal(mouvements[0]?.points, -15);
    assert.equal(mouvements[0]?.order_id, commande.id);
    const ligne = monde.db.get<{ restaurant_id: string; user_id: string }>("SELECT restaurant_id, user_id FROM points_ledger WHERE kind = 'redeem'");
    assert.equal(ligne?.restaurant_id, 'r-alpha');
    assert.equal(ligne?.user_id, 'student-1');
  });

  it('crédite une seule fois quand deux fins de commande arrivent en même temps', async () => {
    const commande = await monde.commanderOk({ items: PLAT }, 'fin-simultanee-001');
    for (const statut of ['confirmed', 'preparing', 'ready']) await monde.changerStatut(commande.id, statut);
    const [premiere, seconde] = await Promise.all([
      monde.changerStatut(commande.id, 'completed'),
      monde.changerStatut(commande.id, 'completed'),
    ]);
    assert.deepEqual([premiere.status, seconde.status].sort(), [200, 409]);
    const credits = monde.db.get<{ total: number }>("SELECT COUNT(*) AS total FROM points_ledger WHERE order_id = ? AND kind = 'earn'", [commande.id]);
    assert.equal(credits?.total, 1);
    assert.equal(await monde.points('student-1', 'r-alpha'), 16);
  });

  it('ne laisse jamais le solde devenir négatif après une série d’opérations', async () => {
    const premiere = await monde.commanderOk({ items: GROS, redeemMeal: true }, 'serie-000000001');
    assert.equal((await monde.commander({ items: GROS, redeemMeal: true }, 'serie-000000002')).status, 422);
    assert.equal((await monde.annulerParEtudiant(premiere.id)).status, 200);
    assert.equal((await monde.annulerParEtudiant(premiere.id)).status, 409);
    const troisieme = await monde.commanderOk({ items: GROS, redeemMeal: true }, 'serie-000000003');
    await monde.terminer(troisieme.id);
    const total = await monde.points('student-1', 'r-alpha');
    assert.equal(total, 1, '6 000 FC de plats moins 3 000 FC de remise : 1 point gagné, les 15 points sont consommés');
    const solde = monde.db.get<{ somme: number }>(`SELECT COALESCE(SUM(remaining), 0) AS somme FROM points_ledger
      WHERE user_id = 'student-1' AND restaurant_id = 'r-alpha' AND points > 0`);
    assert.equal(solde?.somme, total);
  });
});
