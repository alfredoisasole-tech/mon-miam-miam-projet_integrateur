import { AppError } from '../http/errors.ts';

export const CLAIM_KINDS = ['order', 'points', 'other'] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];
export const CLAIM_STATUSES = ['open', 'pending_validation', 'resolved'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export type ClaimDecision = 'accept' | 'refuse';

/** Un étudiant ne peut pas avoir plus de réclamations non résolues dans un même restaurant. */
export const MAX_UNRESOLVED_CLAIMS = 5;

export interface CreateClaimInput {
  kind: ClaimKind;
  orderId: string | null;
  subject: string;
  message: string;
  requestedPoints: number | null;
}

export interface ProposeClaimInput { decision: ClaimDecision; response: string }
export interface ValidateClaimInput { decision: ClaimDecision | null; response: string | null; grantedPoints: number | null }

function invalid(field: string, message: string): AppError {
  return new AppError(400, 'VALIDATION_ERROR', message, [{ field, message }]);
}

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Le corps de la requête doit être un objet JSON.');
  }
  return input as Record<string, unknown>;
}

function text(value: unknown, field: string, label: string, min: number, max: number): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length < min || result.length > max) throw invalid(field, `${label} doit contenir entre ${min} et ${max} caractères.`);
  return result;
}

function integer(value: unknown, field: string, label: string, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    throw invalid(field, `${label} doit être un entier entre 1 et ${max}.`);
  }
  return value;
}

function decisionOf(value: unknown): ClaimDecision {
  if (value !== 'accept' && value !== 'refuse') throw invalid('decision', 'La décision doit être « accept » ou « refuse ».');
  return value;
}

export function parseCreateClaim(input: unknown): CreateClaimInput {
  const body = record(input);
  const kind = body['kind'];
  if (typeof kind !== 'string' || !(CLAIM_KINDS as readonly string[]).includes(kind)) {
    throw invalid('kind', 'Le type de réclamation est invalide (commande, points ou autre).');
  }
  const orderId = body['orderId'] === undefined || body['orderId'] === null ? null : text(body['orderId'], 'orderId', 'La commande', 1, 80);
  if (kind === 'order' && !orderId) throw invalid('orderId', 'Choisissez la commande concernée.');
  const requestedPoints = kind === 'points' ? integer(body['requestedPoints'], 'requestedPoints', 'Le nombre de points demandés', 1000) : null;
  return {
    kind: kind as ClaimKind,
    orderId,
    subject: text(body['subject'], 'subject', 'L’objet', 3, 100),
    message: text(body['message'], 'message', 'Le message', 10, 1000),
    requestedPoints,
  };
}

export function parseProposeClaim(input: unknown): ProposeClaimInput {
  const body = record(input);
  return { decision: decisionOf(body['decision']), response: text(body['response'], 'response', 'La réponse', 5, 500) };
}

export function parseValidateClaim(input: unknown): ValidateClaimInput {
  const body = input === undefined || input === null ? {} : record(input);
  return {
    decision: body['decision'] === undefined ? null : decisionOf(body['decision']),
    response: body['response'] === undefined ? null : text(body['response'], 'response', 'La réponse', 5, 500),
    grantedPoints: body['grantedPoints'] === undefined ? null : integer(body['grantedPoints'], 'grantedPoints', 'Les points accordés', 1000),
  };
}

export function parseRejectClaim(input: unknown): string {
  return text(record(input)['note'], 'note', 'La consigne', 3, 300);
}
