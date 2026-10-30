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
}

export interface PaymentNotification {
  paymentId: string;
  status: PaymentFinalStatus;
  providerRef: string;
}

export interface PaymentProvider {
  startPayment(input: PaymentProviderStartInput): Promise<{ redirectUrl: string }>;
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
  createdAt: string;
  updatedAt: string;
}

export type StartPaymentResult =
  | { kind: 'not_found' }
  | { kind: 'not_payable' }
  | { kind: 'pending'; created: boolean; payment: PaymentRecord };

export type ApplyPaymentNotificationResult =
  | { kind: 'not_found' }
  | { kind: 'already_finalized' }
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
  applyNotification(input: {
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
