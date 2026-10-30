import { randomUUID } from 'node:crypto';
import { AppError } from '../http/errors.ts';
import type {
  OrderStatus,
} from '../domain/orders.ts';
import type {
  PaymentFinalStatus,
  PaymentNotification,
  PaymentOperator,
  PaymentProvider,
  PaymentsRepository,
} from '../domain/payments.ts';

const OPERATORS = new Set<PaymentOperator>(['mpesa', 'orange_money', 'airtel_money', 'africell_money']);

function validationError(message: string): AppError {
  return new AppError(400, 'VALIDATION_ERROR', message);
}

function parseStartInput(value: unknown): { operator: PaymentOperator; phone: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('Le corps doit contenir un opérateur et un numéro de téléphone.');
  }
  const body = value as Record<string, unknown>;
  const operator = body['operator'];
  if (typeof operator !== 'string' || !OPERATORS.has(operator as PaymentOperator)) {
    throw validationError('L’opérateur de paiement indiqué est invalide.');
  }
  const phone = body['phone'];
  if (typeof phone !== 'string' || !/^\+?[1-9]\d{7,14}$/.test(phone.trim())) {
    throw validationError('Le numéro de téléphone doit contenir de 8 à 15 chiffres.');
  }
  return { operator: operator as PaymentOperator, phone: phone.trim() };
}

function parseNotification(value: unknown): PaymentNotification {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('La notification doit être un objet JSON.');
  }
  const body = value as Record<string, unknown>;
  const paymentId = body['paymentId'];
  const status = body['status'];
  const providerRef = body['providerRef'];
  if (typeof paymentId !== 'string' || paymentId.trim().length === 0 || paymentId.length > 128) {
    throw validationError('L’identifiant du paiement est invalide.');
  }
  if (status !== 'paid' && status !== 'failed') {
    throw validationError('Le statut du paiement doit être « paid » ou « failed ».');
  }
  if (typeof providerRef !== 'string' || providerRef.trim().length === 0 || providerRef.trim().length > 200) {
    throw validationError('La référence du fournisseur doit être un texte non vide de 200 caractères maximum.');
  }
  return { paymentId: paymentId.trim(), status: status as PaymentFinalStatus, providerRef: providerRef.trim() };
}

export class PaymentsService {
  private readonly repository: PaymentsRepository;
  private readonly provider: PaymentProvider;
  private readonly now: () => Date;

  constructor(repository: PaymentsRepository, provider: PaymentProvider, options: { now?: () => Date } = {}) {
    this.repository = repository;
    this.provider = provider;
    this.now = options.now ?? (() => new Date());
  }

  async start(userId: string, orderId: string, body: unknown): Promise<{
    payment: { paymentId: string; status: 'pending'; amountFc: number; redirectUrl: string };
    replayed: boolean;
  }> {
    const input = parseStartInput(body);
    const at = this.now().toISOString();
    const result = await this.repository.startPayment({
      userId,
      orderId,
      paymentId: `pay_${randomUUID()}`,
      operator: input.operator,
      phone: input.phone,
      at,
    });
    if (result.kind === 'not_found') throw new AppError(404, 'NOT_FOUND', 'Commande introuvable.');
    if (result.kind === 'not_payable') {
      throw new AppError(409, 'ORDER_NOT_PAYABLE', 'Le paiement ne peut démarrer que pour une commande mobile money en attente, impayée ou avec un paiement échoué.');
    }

    const { payment } = result;
    if (!result.created && (payment.operator !== input.operator || payment.phone !== input.phone)) {
      throw new AppError(409, 'PAYMENT_ALREADY_STARTED', 'Un paiement est déjà en cours avec d’autres coordonnées.');
    }

    let redirectUrl: string;
    try {
      ({ redirectUrl } = await this.provider.startPayment({
        paymentId: payment.id,
        orderId: payment.orderId,
        amountFc: payment.amountFc,
        operator: payment.operator,
        phone: payment.phone,
      }));
    } catch {
      if (result.created) await this.repository.failPaymentStart(payment.id, this.now().toISOString());
      throw new AppError(502, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Le service de paiement est momentanément indisponible.');
    }

    return {
      payment: { paymentId: payment.id, status: 'pending', amountFc: payment.amountFc, redirectUrl },
      replayed: !result.created,
    };
  }

  async receiveWebhook(rawBody: Buffer, signature: string | undefined, body: unknown): Promise<{
    paymentId: string;
    status: PaymentFinalStatus;
    orderStatus: OrderStatus;
  }> {
    if (!this.provider.verifyNotification(rawBody, signature)) {
      throw new AppError(401, 'INVALID_SIGNATURE', 'La signature du fournisseur est absente ou invalide.');
    }
    const notification = parseNotification(body);
    const result = await this.repository.applyNotification({ ...notification, at: this.now().toISOString() });
    if (result.kind === 'not_found') throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
    if (result.kind === 'already_finalized') {
      throw new AppError(409, 'PAYMENT_ALREADY_FINALIZED', 'Le paiement a déjà reçu une confirmation différente ou sa commande ne peut plus être modifiée.');
    }
    return { paymentId: notification.paymentId, status: result.paymentStatus, orderStatus: result.orderStatus };
  }

  async simulate(userId: string, paymentId: string, body: unknown): Promise<{
    paymentId: string;
    status: PaymentFinalStatus;
    orderStatus: OrderStatus;
  }> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw validationError('Le corps doit indiquer le résultat du paiement simulé.');
    }
    const outcome = (body as Record<string, unknown>)['outcome'];
    if (outcome !== 'paid' && outcome !== 'failed') {
      throw validationError('Le résultat du paiement doit être « paid » ou « failed ».');
    }
    if (paymentId.trim().length === 0 || paymentId.length > 128) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
    }
    const result = await this.repository.applySimulationNotification({
      userId,
      paymentId,
      status: outcome,
      providerRef: `simulation-${paymentId}`,
      at: this.now().toISOString(),
    });
    if (result.kind === 'not_found') throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
    if (result.kind === 'already_finalized') {
      throw new AppError(409, 'PAYMENT_ALREADY_FINALIZED', 'Le paiement a déjà reçu une confirmation différente ou sa commande ne peut plus être modifiée.');
    }
    return { paymentId, status: result.paymentStatus, orderStatus: result.orderStatus };
  }
}
