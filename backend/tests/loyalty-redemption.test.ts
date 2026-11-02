import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { creerMonde, type Monde } from './loyalty-setup.ts';

/**
 * APP-80 : utilisation des points (docs/regles-commande-paiement.md, §5 et docs/api/commandes.md).
 * 15 points = 3 000 FC de réduction, uniquement sur les plats, jamais sur la livraison.
 */
describe('Fidélité : remise avec les points', () => {
  let monde: Monde;
  beforeEach(async () => {
    monde = await creerMonde();
    monde.crediter('points-alpha', 'r-alpha', 'student-1', 15, '2027-10-26T00:00:00.000Z');
  });
  afterEach(async () => { await monde.fermer(); });

  async function codeErreur(reponse: Response): Promise<string> {
    return (await reponse.json() as { error: { code: string } }).error.code;
  }
  function nombreDeCommandes(): number {
    return monde.db.get<{ total: number }>('SELECT COUNT(*) AS total FROM orders')?.total ?? 0;
  }

  it('applique 3 000 FC de remise pour 15 points et déduit les points du solde', async () => {
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-big', quantity: 1 }], redeemMeal: true }, 'remise-simple-001');
    assert.equal(commande.subtotalFc, 6000);
    assert.equal(commande.discountFc, 3000);
    assert.equal(commande.totalFc, 3000);
    assert.equal(commande.pointsRedeemed, 15);
    assert.equal(await monde.points('student-1', 'r-alpha'), 0);
  });

  it('ne dépasse jamais le prix des plats : 2 000 FC de plats donnent 2 000 FC de remise', async () => {
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-cheap', quantity: 1 }], redeemMeal: true }, 'remise-plafond-01');
    assert.equal(commande.discountFc, 2000);
    assert.equal(commande.totalFc, 0);
  });

  it('ne réduit jamais les frais de livraison', async () => {
    const commande = await monde.commanderOk({
      type: 'delivery',
      items: [{ menuItemId: 'alpha-dish', quantity: 1 }],
      delivery: { commune: 'Limete', address: '12 avenue de la Paix' },
      redeemMeal: true,
    }, 'remise-livraison-1');
    assert.equal(commande.discountFc, 3000);
    assert.equal(commande.deliveryFeeFc, 2000);
    assert.equal(commande.totalFc, 2000, 'seuls les frais de livraison restent à payer');
  });

  it('plafonne la remise aux plats même avec la livraison : 2 000 FC de plats + 2 000 FC de livraison', async () => {
    const commande = await monde.commanderOk({
      type: 'delivery',
      items: [{ menuItemId: 'alpha-cheap', quantity: 1 }],
      delivery: { commune: 'Limete', address: '12 avenue de la Paix' },
      redeemMeal: true,
    }, 'remise-livraison-2');
    assert.equal(commande.discountFc, 2000);
    assert.equal(commande.totalFc, 2000);
  });

  it('n’utilise aucun point si la remise n’est pas demandée', async () => {
    const commande = await monde.commanderOk({ items: [{ menuItemId: 'alpha-dish', quantity: 1 }], redeemMeal: false }, 'sans-remise-00001');
    assert.equal(commande.discountFc, 0);
    assert.equal(commande.pointsRedeemed, 0);
    assert.equal(await monde.points('student-1', 'r-alpha'), 15);
  });

  it('ne retire que 15 points même si le solde est plus élevé', async () => {
    monde.crediter('points-bonus', 'r-alpha', 'student-1', 25, '2027-12-31T00:00:00.000Z');
    await monde.commanderOk({ items: [{ menuItemId: 'alpha-dish', quantity: 1 }], redeemMeal: true }, 'remise-reste-0001');
    assert.equal(await monde.points('student-1', 'r-alpha'), 25);
  });

  it('refuse avec 14 points : INSUFFICIENT_POINTS, aucune commande créée et solde inchangé', async () => {
    monde.db.run("UPDATE points_ledger SET points = 14, remaining = 14 WHERE id = 'points-alpha'");
    const reponse = await monde.commander({ items: [{ menuItemId: 'alpha-dish', quantity: 1 }], redeemMeal: true }, 'remise-14-points-1');
    assert.equal(reponse.status, 422);
    assert.equal(await codeErreur(reponse), 'INSUFFICIENT_POINTS');
    assert.equal(nombreDeCommandes(), 0);
    assert.equal(await monde.points('student-1', 'r-alpha'), 14);
  });

  it('refuse d’utiliser chez beta les points gagnés chez alpha', async () => {
    const reponse = await monde.commander({ restaurant: 'beta', items: [{ menuItemId: 'beta-dish', quantity: 1 }], redeemMeal: true }, 'remise-autre-resto');
    assert.equal(reponse.status, 422);
    assert.equal(await codeErreur(reponse), 'INSUFFICIENT_POINTS');
    assert.equal(nombreDeCommandes(), 0);
    assert.equal(await monde.points('student-1', 'r-alpha'), 15, 'le solde alpha est intact');
  });

  it('refuse d’utiliser les points d’un autre étudiant', async () => {
    const reponse = await monde.commander({ items: [{ menuItemId: 'alpha-dish', quantity: 1 }], redeemMeal: true }, 'remise-autre-etu-1', 'etudiant-2');
    assert.equal(reponse.status, 422);
    assert.equal(await codeErreur(reponse), 'INSUFFICIENT_POINTS');
    assert.equal(await monde.points('student-1', 'r-alpha'), 15);
  });

  it('refuse d’utiliser des points expirés', async () => {
    monde.horloge.instant = '2027-10-26T00:00:01.000Z';
    const reponse = await monde.commander({ items: [{ menuItemId: 'alpha-dish', quantity: 1 }], redeemMeal: true }, 'remise-expiree-001');
    assert.equal(reponse.status, 422);
    assert.equal(await codeErreur(reponse), 'INSUFFICIENT_POINTS');
  });

  it('refuse une valeur de remise qui n’est pas un booléen', async () => {
    const reponse = await monde.commander({ items: [{ menuItemId: 'alpha-dish', quantity: 1 }], redeemMeal: 'oui' }, 'remise-invalide-01');
    assert.equal(reponse.status, 400);
    assert.equal(nombreDeCommandes(), 0);
  });
});
