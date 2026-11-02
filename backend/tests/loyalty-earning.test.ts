import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { creerMonde, type Monde } from './loyalty-setup.ts';

/**
 * APP-79 : règles de gain des points (docs/regles-commande-paiement.md, §5).
 * 3 000 FC dépensés sur les plats = 1 point ; le reste est reporté ; crédit à la fin de la commande uniquement.
 */
describe('Fidélité : calcul et crédit des points', () => {
  let monde: Monde;
  beforeEach(async () => { monde = await creerMonde(); });
  afterEach(async () => { await monde.fermer(); });

  it('crédite 1 point pour 3 000 FC de plats, à la fin de la commande seulement', async () => {
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-dish', quantity: 1 }] }, 'gain-simple-0001');
    for (const statut of ['confirmed', 'preparing', 'ready']) {
      assert.equal((await monde.changerStatut(commande.id, statut)).status, 200);
      assert.equal(await monde.points('student-1', 'r-alpha'), 0, `aucun point au statut ${statut}`);
    }
    const terminee = await monde.changerStatut(commande.id, 'completed');
    assert.equal(terminee.status, 200);
    assert.equal((await terminee.json() as { pointsEarned: number }).pointsEarned, 1);
    assert.equal(await monde.points('student-1', 'r-alpha'), 1);
    assert.equal(monde.reliquat('student-1', 'r-alpha'), 0);
  });

  it('reporte le reste : 2 000 FC puis 2 000 FC donnent 1 point et 1 000 FC reportés', async () => {
    const premiere = await monde.commanderOk({ items: [{ menuItemId: 'alpha-cheap', quantity: 1 }] }, 'gain-reste-0001');
    const apresPremiere = await monde.terminer(premiere.id);
    assert.equal(apresPremiere.pointsEarned, 0);
    assert.equal(monde.reliquat('student-1', 'r-alpha'), 2000);
    assert.equal(await monde.points('student-1', 'r-alpha'), 0);

    const seconde = await monde.commanderOk({ items: [{ menuItemId: 'alpha-cheap', quantity: 1 }] }, 'gain-reste-0002');
    const apresSeconde = await monde.terminer(seconde.id);
    assert.equal(apresSeconde.pointsEarned, 1);
    assert.equal(monde.reliquat('student-1', 'r-alpha'), 1000);
    assert.equal(await monde.points('student-1', 'r-alpha'), 1);
  });

  it('arrondit à l’entier inférieur : 8 000 FC donnent 2 points et 2 000 FC reportés', async () => {
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-cheap', quantity: 4 }] }, 'gain-arrondi-001');
    const terminee = await monde.terminer(commande.id);
    assert.equal(terminee.pointsEarned, 2);
    assert.equal(monde.reliquat('student-1', 'r-alpha'), 2000);
  });

  it('ne compte jamais les frais de livraison', async () => {
    const commande = await monde.commanderOk({
      type: 'delivery',
      items: [{ menuItemId: 'alpha-cheap', quantity: 1 }],
      delivery: { commune: 'Limete', address: '12 avenue de la Paix' },
    }, 'gain-livraison-01');
    assert.equal(commande.deliveryFeeFc, 2000);
    assert.equal(commande.totalFc, 4000);
    const terminee = await monde.terminer(commande.id, true);
    assert.equal(terminee.pointsEarned, 0, '2 000 FC de plats seulement : pas de point');
    assert.equal(monde.reliquat('student-1', 'r-alpha'), 2000);
  });

  it('ne compte pas la part payée avec des points : la remise est déduite de la dépense', async () => {
    monde.crediter('points-depart', 'r-alpha', 'student-1', 15, '2027-10-26T00:00:00.000Z');
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-big', quantity: 1 }], redeemMeal: true }, 'gain-remise-0001');
    assert.equal(commande.discountFc, 3000);
    const terminee = await monde.terminer(commande.id);
    assert.equal(terminee.pointsEarned, 1, '6 000 FC de plats moins 3 000 FC de remise : 3 000 FC dépensés');
    assert.equal(await monde.points('student-1', 'r-alpha'), 1);
  });

  it('ne rapporte aucun point pour une commande annulée', async () => {
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-big', quantity: 1 }] }, 'gain-annule-0001');
    assert.equal((await monde.annulerParEtudiant(commande.id)).status, 200);
    assert.equal(await monde.points('student-1', 'r-alpha'), 0);
    assert.equal(monde.reliquat('student-1', 'r-alpha'), 0);
    const credits = monde.db.get<{ total: number }>("SELECT COUNT(*) AS total FROM points_ledger WHERE order_id = ? AND kind = 'earn'", [commande.id]);
    assert.equal(credits?.total, 0);
  });

  it('fait expirer les points gagnés 12 mois après la fin de la commande', async () => {
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-dish', quantity: 1 }] }, 'gain-expire-0001');
    await monde.terminer(commande.id);
    const ligne = monde.db.get<{ expires_at: string; points: number; remaining: number }>(
      "SELECT expires_at, points, remaining FROM points_ledger WHERE order_id = ? AND kind = 'earn'", [commande.id]);
    assert.equal(ligne?.expires_at, '2027-10-26T08:00:00.000Z');
    assert.equal(ligne?.points, 1);
    assert.equal(ligne?.remaining, 1);

    monde.horloge.instant = '2027-10-26T08:00:01.000Z';
    assert.equal(await monde.points('student-1', 'r-alpha'), 0, 'les points expirés ne comptent plus dans le solde');
  });

  it('garde les points propres à chaque restaurant : un gain chez alpha ne crédite pas beta', async () => {
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-big', quantity: 1 }] }, 'gain-isole-00001');
    await monde.terminer(commande.id);
    assert.equal(await monde.points('student-1', 'r-alpha'), 2);
    assert.equal(await monde.points('student-1', 'r-beta'), 0);
    assert.equal(monde.reliquat('student-1', 'r-beta'), 0);
  });

  it('crédite une seule fois : une seconde fin de commande est refusée sans nouveau point', async () => {
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-dish', quantity: 1 }] }, 'gain-unique-0001');
    await monde.terminer(commande.id);
    assert.equal((await monde.changerStatut(commande.id, 'completed')).status, 409);
    assert.equal(await monde.points('student-1', 'r-alpha'), 1);
    const credits = monde.db.get<{ total: number }>("SELECT COUNT(*) AS total FROM points_ledger WHERE order_id = ? AND kind = 'earn'", [commande.id]);
    assert.equal(credits?.total, 1);
  });
});
