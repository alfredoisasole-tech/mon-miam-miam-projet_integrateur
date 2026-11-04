import type { EasypayConfig } from '../config.ts';
import type { PaymentProvider, PaymentProviderStartInput, ProviderPaymentStatus } from './payments.ts';

const BASE_URL = 'https://www.e-com-easypay.com';
const DELAI_MAXIMAL_MS = 10_000;

export interface EasypayOptions {
  /** Client HTTP, remplaçable dans les tests : aucun appel réseau réel n'y est fait. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

/** Erreur du fournisseur. Son message ne contient jamais d'identifiant ni d'adresse d'appel (elle porte le token). */
export class EasypayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EasypayError';
  }
}

/** Easypay attend une référence de commande alphanumérique : on retire les « _ » et les « - » de l'identifiant. */
export function easypayOrderRef(paymentId: string): string {
  return paymentId.replace(/[^A-Za-z0-9]/g, '');
}

/** Lit un corps JSON qui peut commencer par du bruit HTML (avertissements PHP observés au bac à sable). */
function lireJson(texte: string): Record<string, unknown> {
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut === -1 || fin < debut) throw new EasypayError('La réponse d’Easypay est illisible.');
  try {
    const valeur: unknown = JSON.parse(texte.slice(debut, fin + 1));
    if (valeur && typeof valeur === 'object' && !Array.isArray(valeur)) return valeur as Record<string, unknown>;
  } catch { /* traité ci-dessous */ }
  throw new EasypayError('La réponse d’Easypay est illisible.');
}

/** Précision sûre d'une panne réseau : « délai dépassé » ou un code technique en majuscules, jamais un message libre. */
function precisionPanne(erreur: unknown): string {
  if (erreur instanceof Error && erreur.name === 'TimeoutError') return ' (délai dépassé)';
  const cause = erreur instanceof Error ? (erreur.cause as { code?: unknown } | undefined) : undefined;
  const code = cause?.code;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{2,40}$/.test(code) ? ` (code ${code})` : '';
}

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : null;
}

/**
 * Passerelle e-COM EasyPay (parcours avec redirection, canal Mobile Money ; carte aussi au bac à sable).
 * Ses notifications (IPN) n'ont ni signature ni montant documentés : elles ne sont jamais crues,
 * `checkPayment` rappelle Easypay pour confirmer l'état du paiement (voir docs/api/easypay.md).
 */
export class EasypayPaymentProvider implements PaymentProvider {
  /** Easypay n'annonce pas de montant dans sa notification : l'état du paiement est confirmé par `checkPayment`. */
  readonly requiresAmountVerification = false;
  private readonly config: EasypayConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: EasypayConfig, options: EasypayOptions = {}) {
    this.config = config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DELAI_MAXIMAL_MS;
  }

  async startPayment(input: PaymentProviderStartInput): Promise<{ redirectUrl: string; providerReference: string }> {
    const { cid, token, siteUrl, mode } = this.config;
    const retour = (resultat: string): string => `${siteUrl}/orders?commande=${encodeURIComponent(input.orderId)}&paiement=${resultat}`;
    const reponse = await this.appeler(
      `${this.baseUrl}/${mode}/payment/initialization?${new URLSearchParams({ cid, token }).toString()}`,
      {
        order_ref: easypayOrderRef(input.paymentId),
        amount: input.amountFc,
        currency: 'CDF',
        description: 'Commande Mon Miam Miam',
        customer_name: input.customerName,
        language: 'FR',
        // Au bac à sable, aucun numéro de test Mobile Money n'existe : la carte de test publiée par Easypay
        // permet d'y obtenir un paiement réussi. En production, seul le Mobile Money est proposé.
        channels: mode === 'sandbox' ? [{ channel: 'MOBILE MONEY' }, { channel: 'CREDIT CARD' }] : [{ channel: 'MOBILE MONEY' }],
        success_url: retour('succes'),
        cancel_url: retour('annule'),
        error_url: retour('erreur'),
      },
    );
    if (reponse.status !== 200) throw new EasypayError(`Easypay a répondu avec le statut HTTP ${reponse.status}.`);
    const corps = lireJson(reponse.texte);
    if (corps['code'] !== 1) {
      const raison = texte(corps['message'])?.slice(0, 200) ?? 'raison inconnue';
      throw new EasypayError(`Easypay a refusé l’initialisation du paiement : ${raison}.`);
    }
    const reference = texte(corps['reference']);
    if (!reference || reference.length > 200) throw new EasypayError('Easypay n’a pas renvoyé de référence de transaction.');
    return { redirectUrl: this.redirectUrlFor(reference), providerReference: reference };
  }

  redirectUrlFor(providerReference: string): string {
    return `${this.baseUrl}/${this.config.mode}/payment/initialization?reference=${encodeURIComponent(providerReference)}`;
  }

  async checkPayment(input: { providerReference: string; paymentId: string }): Promise<ProviderPaymentStatus> {
    const reponse = await this.appeler(
      `${this.baseUrl}/${this.config.mode}/payment/${encodeURIComponent(input.providerReference)}/checking-payment`,
      {},
    );
    if (reponse.status === 404) return 'pending';
    if (reponse.status !== 200) throw new EasypayError(`Easypay a répondu avec le statut HTTP ${reponse.status}.`);
    const corps = lireJson(reponse.texte);
    const transaction = corps['transaction'];
    const paiement = corps['payment'];
    if (!transaction || typeof transaction !== 'object' || !paiement || typeof paiement !== 'object') return 'pending';
    // La réponse doit concerner exactement ce paiement : sinon on ne confirme rien.
    if ((transaction as Record<string, unknown>)['order_ref'] !== easypayOrderRef(input.paymentId)) return 'pending';
    switch ((paiement as Record<string, unknown>)['status']) {
      case 'SUCCESS': return 'paid';
      case 'DECLINED':
      case 'CANCELED': return 'failed';
      default: return 'pending';
    }
  }

  /** Easypay ne signe pas ses notifications : la route à signature HMAC n'accepte jamais rien pour lui. */
  verifyNotification(_rawBody: Buffer, _signature: string | undefined): boolean {
    return false;
  }

  private async appeler(url: string, corps: unknown): Promise<{ status: number; texte: string }> {
    try {
      const reponse = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return { status: reponse.status, texte: await reponse.text() };
    } catch (erreur) {
      // Le message d'origine peut contenir l'adresse de l'appel, donc le token : il n'est jamais repris.
      // Seul un code technique de forme stricte (par exemple ECONNREFUSED) ou le délai dépassé est indiqué.
      throw new EasypayError(`Easypay est injoignable ou a dépassé le délai${precisionPanne(erreur)}.`);
    }
  }
}
