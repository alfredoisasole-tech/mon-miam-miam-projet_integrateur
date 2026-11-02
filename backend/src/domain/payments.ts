import { createHmac, timingSafeEqual } from 'node:crypto';
import type { OrderStatus } from './orders.ts';

export type PaymentOperator = 'mpesa' | 'orange_money' | 'airtel_money' | 'africell_money';
export type PaymentFinalStatus = 'paid' | 'failed';
export type PaymentRecordStatus = 'pending' | PaymentFinalStatus;

export interface PaymentStartInput {
  operator: PaymentOperator;
  phone: string;
}

export interface PaymentProviderStartInput extends PaymentStartInput {
  paymentId: string;
  orderId: string;
  amountFc: number;
  /** Nom du client, affiché sur la page de paiement du fournisseur. */
  customerName: string;
}

/** État d'un paiement d'après le fournisseur : « pending » tant qu'il n'a rien confirmé. */
export type ProviderPaymentStatus = 'paid' | 'failed' | 'pending';

export interface PaymentNotification {
  paymentId: string;
  status: PaymentFinalStatus;
  providerRef: string;
  /** Montant en FC annoncé par le fournisseur ; s'il est présent, il doit égaler le montant attendu du paiement. */
  amountFc?: number;
}

export interface PaymentProvider {
  /** Un fournisseur réel doit l'indiquer : ses notifications sans montant sont alors refusées. */
  readonly requiresAmountVerification?: boolean;
  startPayment(input: PaymentProviderStartInput): Promise<{ redirectUrl: string; providerReference?: string }>;
  /** Adresse de redirection d'un paiement déjà initialisé chez le fournisseur, sans nouvel appel. */
  redirectUrlFor?(providerReference: string): string;
  /**
   * Interroge le fournisseur sur l'état d'un paiement. Présent quand ses notifications ne sont pas signées :
   * elles ne sont alors jamais crues, seule cette réponse confirme un paiement.
   */
  checkPayment?(input: { providerReference: string; paymentId: string }): Promise<ProviderPaymentStatus>;
  verifyNotification(rawBody: Buffer, signature: string | undefined): boolean;
}

export interface PaymentRecord {
  id: string;
  restaurantId: string;
  orderId: string;
  operator: PaymentOperator;
  phone: string;
  amountFc: number;
  status: PaymentRecordStatus;
  providerRef: string | null;
  /** Référence renvoyée par le fournisseur à l'initialisation (vide en simulation). */
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StartPaymentResult =
  | { kind: 'not_found' }
  | { kind: 'not_payable' }
  | { kind: 'pending'; created: boolean; payment: PaymentRecord; customerName: string };

export type ApplyPaymentNotificationResult =
  | { kind: 'not_found' }
  | { kind: 'already_finalized' }
  | { kind: 'amount_mismatch' }
  | { kind: 'applied' | 'replayed'; paymentStatus: PaymentFinalStatus; orderStatus: OrderStatus };

export interface PaymentsRepository {
  startPayment(input: {
    userId: string;
    orderId: string;
    paymentId: string;
    operator: PaymentOperator;
    phone: string;
    at: string;
  }): Promise<StartPaymentResult>;
  failPaymentStart(paymentId: string, at: string): Promise<void>;
  /** Enregistre la référence du fournisseur ; elle est unique et ne s'écrit qu'une fois. */
  setProviderReference(paymentId: string, providerReference: string): Promise<void>;
  findPaymentByProviderReference(providerReference: string): Promise<{ id: string; status: PaymentRecordStatus } | null>;
  applyNotification(input: {
    paymentId: string;
    status: PaymentFinalStatus;
    providerRef: string;
    amountFc?: number;
    at: string;
  }): Promise<ApplyPaymentNotificationResult>;
  applySimulationNotification(input: {
    userId: string;
    paymentId: string;
    status: PaymentFinalStatus;
    providerRef: string;
    at: string;
  }): Promise<ApplyPaymentNotificationResult>;
}

/** Fournisseur local de simulation. L’adaptateur EasyPay viendra ici après réception et validation de sa documentation. */
export class SimulatedPaymentProvider implements PaymentProvider {
  private readonly webhookSecret: string;

  constructor(webhookSecret: string) {
    if (webhookSecret.length === 0) throw new Error('Le secret du webhook de paiement doit être configuré.');
    this.webhookSecret = webhookSecret;
  }

  async startPayment(input: PaymentProviderStartInput): Promise<{ redirectUrl: string }> {
    return { redirectUrl: `/paiement/simulation/${encodeURIComponent(input.paymentId)}` };
  }

  verifyNotification(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature || !/^[a-f\d]{64}$/i.test(signature)) return false;
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest();
    const received = Buffer.from(signature, 'hex');
    return received.length === expected.length && timingSafeEqual(expected, received);
  }
}
