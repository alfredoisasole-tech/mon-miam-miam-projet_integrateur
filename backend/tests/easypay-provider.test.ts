import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EasypayPaymentProvider } from '../src/domain/easypay.ts';

/**
 * Adaptateur Easypay, testé sans réseau avec un faux client HTTP.
 * Les formats viennent de la documentation d'Easypay et d'essais au bac à sable le 3 novembre 2026 :
 * une erreur d'initialisation revient en HTTP 200 avec `code: 0`, la vérification d'un paiement non
 * effectué revient en HTTP 500, et le corps peut commencer par du bruit HTML.
 */
const CID = 'cid/avec+des=caracteres';
const TOKEN = 'jeton.secret.signe';
const PAYMENT_ID = 'pay_0f3c9a2e-1b7d-4c11-9a5e-2d6f8b4c7e10';
const ORDER_REF = 'pay0f3c9a2e1b7d4c119a5e2d6f8b4c7e10';
const REFERENCE = 'VVk5cm1sZC81djRMdWhNaWZ2cjhQdk9LcHJtZHdjaTN0cG9GUWwrQ1VRWmhOUT09';

interface Appel { url: URL; method: string; body: unknown; headers: Record<string, string>; hasSignal: boolean }

function faux(reponses: Array<{ status?: number; corps: string } | Error>): { fetchImpl: typeof fetch; appels: Appel[] } {
  const appels: Appel[] = [];
  const fetchImpl = (async (entree: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(entree));
    const texte = typeof init?.body === 'string' ? init.body : '';
    let corps: unknown = null;
    try { corps = texte === '' ? null : JSON.parse(texte); } catch { corps = texte; }
    appels.push({ url, method: String(init?.method ?? 'GET'), body: corps, headers: { ...(init?.headers as Record<string, string> ?? {}) }, hasSignal: init?.signal instanceof AbortSignal });
    const suivante = reponses.shift();
    if (!suivante) throw new Error('appel inattendu');
    if (suivante instanceof Error) throw suivante;
    return new Response(suivante.corps, { status: suivante.status ?? 200 });
  }) as typeof fetch;
  return { fetchImpl, appels };
}

function creer(fetchImpl: typeof fetch, mode: 'sandbox' | 'v1' = 'sandbox'): EasypayPaymentProvider {
  return new EasypayPaymentProvider({ mode, cid: CID, token: TOKEN, ipnKey: 'x'.repeat(32), siteUrl: 'https://site.exemple' }, { fetchImpl });
}

const DEMARRAGE = { paymentId: PAYMENT_ID, orderId: 'ord_123', amountFc: 3000, operator: 'mpesa' as const, phone: '+243822717230', customerName: 'Aline Mbuyi' };

describe('Adaptateur Easypay : démarrage du paiement', () => {
  it('initialise la transaction avec les bons champs et renvoie l’adresse de redirection', async () => {
    const { fetchImpl, appels } = faux([{ corps: JSON.stringify({ code: 1, reference: REFERENCE, provider: 'e-COM SAS' }) }]);
    const resultat = await creer(fetchImpl).startPayment(DEMARRAGE);

    assert.equal(appels.length, 1);
    const appel = appels[0]!;
    assert.equal(appel.method, 'POST');
    assert.equal(appel.url.origin + appel.url.pathname, 'https://www.e-com-easypay.com/sandbox/payment/initialization');
    assert.equal(appel.url.searchParams.get('cid'), CID, 'cid correctement encodé');
    assert.equal(appel.url.searchParams.get('token'), TOKEN);
    assert.equal(appel.headers['Content-Type'], 'application/json');
    assert.equal(appel.hasSignal, true, 'un délai maximal est appliqué');
    assert.deepEqual(appel.body, {
      order_ref: ORDER_REF,
      amount: 3000,
      currency: 'CDF',
      description: 'Commande Mon Miam Miam',
      customer_name: 'Aline Mbuyi',
      language: 'FR',
      channels: [{ channel: 'MOBILE MONEY' }, { channel: 'CREDIT CARD' }],
      success_url: 'https://site.exemple/orders?commande=ord_123&paiement=succes',
      cancel_url: 'https://site.exemple/orders?commande=ord_123&paiement=annule',
      error_url: 'https://site.exemple/orders?commande=ord_123&paiement=erreur',
    });
    assert.equal(resultat.providerReference, REFERENCE);
    assert.equal(resultat.redirectUrl, `https://www.e-com-easypay.com/sandbox/payment/initialization?reference=${encodeURIComponent(REFERENCE)}`);
  });

  it('utilise le mode production v1 quand il est configuré', async () => {
    const { fetchImpl, appels } = faux([{ corps: JSON.stringify({ code: 1, reference: REFERENCE }) }]);
    const resultat = await creer(fetchImpl, 'v1').startPayment(DEMARRAGE);
    assert.equal(appels[0]!.url.pathname, '/v1/payment/initialization');
    assert.match(resultat.redirectUrl, /\/v1\/payment\/initialization\?reference=/);
  });

  it('ne propose la carte qu’au bac à sable : la production reste en Mobile Money seul', async () => {
    const sandbox = faux([{ corps: JSON.stringify({ code: 1, reference: REFERENCE }) }]);
    await creer(sandbox.fetchImpl, 'sandbox').startPayment(DEMARRAGE);
    assert.deepEqual((sandbox.appels[0]!.body as { channels: unknown }).channels, [{ channel: 'MOBILE MONEY' }, { channel: 'CREDIT CARD' }]);
    const production = faux([{ corps: JSON.stringify({ code: 1, reference: REFERENCE }) }]);
    await creer(production.fetchImpl, 'v1').startPayment(DEMARRAGE);
    assert.deepEqual((production.appels[0]!.body as { channels: unknown }).channels, [{ channel: 'MOBILE MONEY' }]);
  });

  it('reconstruit l’adresse de redirection d’une référence sans appeler Easypay', () => {
    const { fetchImpl, appels } = faux([]);
    assert.equal(creer(fetchImpl).redirectUrlFor(REFERENCE), `https://www.e-com-easypay.com/sandbox/payment/initialization?reference=${encodeURIComponent(REFERENCE)}`);
    assert.equal(appels.length, 0);
  });

  it('tolère du bruit HTML avant la réponse JSON', async () => {
    const { fetchImpl } = faux([{ corps: `<br />\n<b>Deprecated</b>: bruit\n${JSON.stringify({ code: 1, reference: REFERENCE })}` }]);
    assert.equal((await creer(fetchImpl).startPayment(DEMARRAGE)).providerReference, REFERENCE);
  });

  for (const [nom, reponse] of [
    ['un refus (code 0) renvoyé en HTTP 200', { corps: JSON.stringify({ code: 0, message: 'This credentials parameters (token and cid) are not found' }) }],
    ['une erreur HTTP 500', { status: 500, corps: '{"message":"An error occured during the operation."}' }],
    ['une réponse illisible', { corps: '<html>erreur</html>' }],
    ['une référence absente', { corps: JSON.stringify({ code: 1 }) }],
    ['une injoignabilité réseau', new Error('connect ECONNREFUSED https://www.e-com-easypay.com/sandbox/payment/initialization?cid=SECRET&token=SECRET')],
  ] as const) {
    it(`échoue sur ${nom}, sans jamais écrire les identifiants dans l’erreur`, async () => {
      const { fetchImpl } = faux([reponse as { status?: number; corps: string } | Error]);
      await assert.rejects(creer(fetchImpl).startPayment(DEMARRAGE), (erreur: unknown) => {
        assert.ok(erreur instanceof Error);
        for (const secret of [CID, TOKEN, encodeURIComponent(CID), 'SECRET']) assert.equal(erreur.message.includes(secret), false);
        return true;
      });
    });
  }
});

describe('Adaptateur Easypay : diagnostic des pannes réseau', () => {
  it('indique le code technique de la panne, sans jamais écrire l’adresse ni les identifiants', async () => {
    const panne = new Error(`connect ECONNREFUSED https://www.e-com-easypay.com/sandbox/payment/initialization?cid=${CID}&token=${TOKEN}`, { cause: { code: 'ECONNREFUSED' } });
    const { fetchImpl } = faux([panne]);
    await assert.rejects(creer(fetchImpl).startPayment(DEMARRAGE), (erreur: unknown) => {
      assert.ok(erreur instanceof Error);
      assert.match(erreur.message, /ECONNREFUSED/);
      for (const secret of [CID, TOKEN, 'e-com-easypay.com', 'https://']) assert.equal(erreur.message.includes(secret), false);
      return true;
    });
  });

  it('distingue le délai dépassé d’une autre panne', async () => {
    const delai = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const { fetchImpl } = faux([delai as unknown as Error]);
    await assert.rejects(creer(fetchImpl).startPayment(DEMARRAGE), /délai/);
  });

  it('ignore un code qui ne ressemble pas à un code technique', async () => {
    const panne = new Error('x', { cause: { code: 'https://www.e-com-easypay.com/?token=SECRET' } });
    const { fetchImpl } = faux([panne]);
    await assert.rejects(creer(fetchImpl).startPayment(DEMARRAGE), (erreur: unknown) => {
      assert.ok(erreur instanceof Error);
      assert.equal(erreur.message.includes('SECRET'), false);
      return true;
    });
  });
});

describe('Adaptateur Easypay : vérification du statut', () => {
  const reponseStatut = (status: string, orderRef = ORDER_REF) => ({
    corps: JSON.stringify({ transaction: { order_ref: orderRef, reference: REFERENCE }, payment: { channel: 'MOBILE MONEY', status, reference: REFERENCE } }),
  });

  it('interroge la référence, encodée dans le chemin', async () => {
    const { fetchImpl, appels } = faux([reponseStatut('SUCCESS')]);
    await creer(fetchImpl).checkPayment({ providerReference: REFERENCE, paymentId: PAYMENT_ID });
    assert.equal(appels[0]!.method, 'POST');
    assert.equal(appels[0]!.url.pathname, `/sandbox/payment/${REFERENCE}/checking-payment`);
    assert.equal(appels[0]!.url.search, '', 'aucun identifiant dans l’adresse de vérification');
  });

  for (const [statut, attendu] of [['SUCCESS', 'paid'], ['DECLINED', 'failed'], ['CANCELED', 'failed'], ['PENDING', 'pending'], ['INCONNU', 'pending']] as const) {
    it(`traduit ${statut} en ${attendu}`, async () => {
      const { fetchImpl } = faux([reponseStatut(statut)]);
      assert.equal(await creer(fetchImpl).checkPayment({ providerReference: REFERENCE, paymentId: PAYMENT_ID }), attendu);
    });
  }

  it('ne confirme rien quand la commande de la réponse n’est pas celle du paiement', async () => {
    const { fetchImpl } = faux([reponseStatut('SUCCESS', 'payAUTREPAIEMENT')]);
    assert.equal(await creer(fetchImpl).checkPayment({ providerReference: REFERENCE, paymentId: PAYMENT_ID }), 'pending');
  });

  it('ne confirme rien quand la réponse n’indique pas la commande', async () => {
    const { fetchImpl } = faux([{ corps: JSON.stringify({ payment: { status: 'SUCCESS' } }) }]);
    assert.equal(await creer(fetchImpl).checkPayment({ providerReference: REFERENCE, paymentId: PAYMENT_ID }), 'pending');
  });

  it('répond « en attente » pour une transaction inconnue (404)', async () => {
    const { fetchImpl } = faux([{ status: 404, corps: '{"message":"No transaction found with << X >> as reference."}' }]);
    assert.equal(await creer(fetchImpl).checkPayment({ providerReference: REFERENCE, paymentId: PAYMENT_ID }), 'pending');
  });

  it('échoue sur une erreur serveur ou réseau, sans rien confirmer', async () => {
    for (const reponse of [{ status: 500, corps: '{"message":"An error occured during the operation."}' }, new Error('réseau')]) {
      const { fetchImpl } = faux([reponse]);
      await assert.rejects(creer(fetchImpl).checkPayment({ providerReference: REFERENCE, paymentId: PAYMENT_ID }));
    }
  });

  it('tolère du bruit HTML avant le JSON', async () => {
    const { fetchImpl } = faux([{ corps: `<br /><b>Deprecated</b>\n${reponseStatut('SUCCESS').corps}` }]);
    assert.equal(await creer(fetchImpl).checkPayment({ providerReference: REFERENCE, paymentId: PAYMENT_ID }), 'paid');
  });
});

describe('Adaptateur Easypay : notifications', () => {
  it('ne reconnaît aucune signature : la route à signature HMAC reste fermée', () => {
    const { fetchImpl } = faux([]);
    assert.equal(creer(fetchImpl).verifyNotification(Buffer.from('{}'), 'a'.repeat(64)), false);
    assert.equal(creer(fetchImpl).verifyNotification(Buffer.from('{}'), undefined), false);
  });

  it('n’exige pas de montant : Easypay n’en annonce pas', () => {
    const { fetchImpl } = faux([]);
    assert.notEqual(creer(fetchImpl).requiresAmountVerification, true);
  });
});
