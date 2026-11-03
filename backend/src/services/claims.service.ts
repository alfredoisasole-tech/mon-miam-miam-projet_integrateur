import { randomUUID } from 'node:crypto';
import type { Database } from '../db/database.ts';
import { AppError } from '../http/errors.ts';

type ClaimKind = 'order' | 'points' | 'other';
type ClaimStatus = 'open' | 'pending_validation' | 'resolved';
type ClaimDecision = 'accept' | 'refuse';

interface ClaimRow {
  id: string;
  restaurant_id: string;
  restaurant_slug: string;
  restaurant_name: string;
  user_id: string;
  student_name: string;
  student_phone: string;
  order_id: string | null;
  kind: ClaimKind;
  subject: string;
  message: string;
  requested_points: number | null;
  status: ClaimStatus;
  proposed_decision: ClaimDecision | null;
  proposed_response: string | null;
  proposed_by: string | null;
  decision: ClaimDecision | null;
  response: string | null;
  resolved_by: string | null;
  manager_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

const CLAIM_SELECT = `
  SELECT c.id, c.restaurant_id, r.slug AS restaurant_slug, r.name AS restaurant_name,
    c.user_id, u.name AS student_name, u.phone AS student_phone, c.order_id,
    c.kind, c.subject, c.message, c.requested_points, c.status,
    c.proposed_decision, c.proposed_response, c.proposed_by, c.decision,
    c.response, c.resolved_by, c.manager_note, c.created_at, c.updated_at, c.resolved_at
  FROM claims c
  JOIN restaurants r ON r.id = c.restaurant_id
  JOIN users u ON u.id = c.user_id
`;

function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, 'INVALID_BODY', 'Le corps de la requête doit être un objet JSON.');
  }
  return value as Record<string, unknown>;
}

function onlyFields(body: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new AppError(400, 'INVALID_BODY', 'Un ou plusieurs champs de la réclamation sont invalides.');
  }
}

function studentOutput(claim: ClaimRow) {
  return {
    id: claim.id,
    restaurant: { slug: claim.restaurant_slug, name: claim.restaurant_name },
    orderId: claim.order_id,
    kind: claim.kind,
    subject: claim.subject,
    message: claim.message,
    requestedPoints: claim.requested_points,
    status: claim.status === 'open' ? 'ouverte' : claim.status === 'pending_validation' ? 'en cours d’examen' : 'traitée',
    ...(claim.status === 'resolved' ? { decision: claim.decision, response: claim.response } : {}),
    createdAt: claim.created_at,
    updatedAt: claim.updated_at,
    resolvedAt: claim.resolved_at,
  };
}

function staffOutput(claim: ClaimRow) {
  return {
    id: claim.id,
    restaurant: { slug: claim.restaurant_slug, name: claim.restaurant_name },
    student: { id: claim.user_id, name: claim.student_name, phone: claim.student_phone },
    orderId: claim.order_id,
    kind: claim.kind,
    subject: claim.subject,
    message: claim.message,
    requestedPoints: claim.requested_points,
    status: claim.status,
    proposedDecision: claim.proposed_decision,
    proposedResponse: claim.proposed_response,
    proposedBy: claim.proposed_by,
    decision: claim.decision,
    response: claim.response,
    managerNote: claim.manager_note,
    createdAt: claim.created_at,
    updatedAt: claim.updated_at,
    resolvedAt: claim.resolved_at,
  };
}

function readClaim(db: Database, query: string, parameters: Array<string | number>): ClaimRow | undefined {
  return db.get<ClaimRow>(`${CLAIM_SELECT} ${query}`, parameters);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export class ClaimsService {
  private readonly db: Database;
  private readonly now: () => Date;

  constructor(db: Database, now: () => Date = () => new Date()) {
    this.db = db;
    this.now = now;
  }

  create(studentId: string, input: unknown) {
    const body = bodyObject(input);
    onlyFields(body, ['restaurant', 'kind', 'orderId', 'subject', 'message', 'requestedPoints']);
    const restaurantSlug = typeof body['restaurant'] === 'string' ? body['restaurant'].trim() : '';
    const kind = body['kind'];
    const subject = typeof body['subject'] === 'string' ? body['subject'].trim() : '';
    const message = typeof body['message'] === 'string' ? body['message'].trim() : '';
    const orderId = body['orderId'] === undefined ? null : body['orderId'];
    const requestedPoints = body['requestedPoints'] === undefined ? null : body['requestedPoints'];
    if (!restaurantSlug || (kind !== 'order' && kind !== 'points' && kind !== 'other')
      || subject.length < 3 || subject.length > 100 || message.length < 10 || message.length > 1000
      || (orderId !== null && (typeof orderId !== 'string' || !orderId.trim()))
      || (kind === 'points' && requestedPoints !== null
        && (!Number.isSafeInteger(requestedPoints) || (requestedPoints as number) <= 0))
      || (kind !== 'points' && requestedPoints !== null)) {
      throw new AppError(400, 'INVALID_BODY', 'Les informations de la réclamation sont invalides.');
    }
    const normalizedOrderId = orderId === null ? null : orderId as string;
    const normalizedRequestedPoints = requestedPoints === null ? null : requestedPoints as number;

    const restaurant = this.db.get<{ id: string }>(
      `SELECT r.id FROM restaurants r JOIN memberships m ON m.restaurant_id = r.id
       WHERE r.slug = ? AND r.status = 'active' AND m.user_id = ?`, [restaurantSlug, studentId],
    );
    if (!restaurant) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable ou adhésion absente.');
    const id = `claim_${randomUUID()}`;
    const at = this.now().toISOString();
    this.db.transaction(() => {
      const openClaims = this.db.get<{ total: number }>(
        "SELECT COUNT(*) AS total FROM claims WHERE user_id = ? AND status <> 'resolved'", [studentId],
      )?.total ?? 0;
      if (openClaims >= 5) throw new AppError(429, 'CLAIM_LIMIT_REACHED', 'Vous avez déjà cinq réclamations en cours.');
      if (normalizedOrderId !== null && !this.db.get(
        'SELECT id FROM orders WHERE id = ? AND user_id = ? AND restaurant_id = ?',
        [normalizedOrderId, studentId, restaurant.id],
      )) throw new AppError(404, 'ORDER_NOT_FOUND', 'Commande introuvable pour ce restaurant.');
      this.db.run(`INSERT INTO claims (
        id, restaurant_id, user_id, order_id, kind, subject, message, requested_points, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, restaurant.id, studentId, normalizedOrderId, kind as ClaimKind, subject, message, normalizedRequestedPoints, at, at]);
    });
    const claim = readClaim(this.db, 'WHERE c.id = ? AND c.user_id = ?', [id, studentId]);
    if (!claim) throw new Error('La réclamation créée ne peut pas être relue.');
    return studentOutput(claim);
  }

  listForStudent(studentId: string) {
    return this.db.all<ClaimRow>(
      `${CLAIM_SELECT} WHERE c.user_id = ? ORDER BY c.created_at DESC, c.id DESC`, [studentId],
    ).map(studentOutput);
  }

  getForStudent(studentId: string, id: string) {
    const claim = readClaim(this.db, 'WHERE c.id = ? AND c.user_id = ?', [id, studentId]);
    if (!claim) throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
    return studentOutput(claim);
  }

  listForStaff(restaurantId: string, status?: ClaimStatus) {
    const where = status ? 'WHERE c.restaurant_id = ? AND c.status = ?' : 'WHERE c.restaurant_id = ?';
    const params = status ? [restaurantId, status] : [restaurantId];
    return this.db.all<ClaimRow>(
      `${CLAIM_SELECT} ${where} ORDER BY c.created_at ASC, c.id ASC`, params,
    ).map(staffOutput);
  }

  getForStaff(restaurantId: string, id: string) {
    const claim = readClaim(this.db, 'WHERE c.id = ? AND c.restaurant_id = ?', [id, restaurantId]);
    if (!claim) throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
    return staffOutput(claim);
  }

  propose(restaurantId: string, staffId: string, id: string, input: unknown) {
    const body = bodyObject(input);
    onlyFields(body, ['decision', 'response']);
    const decision = body['decision'];
    const response = typeof body['response'] === 'string' ? body['response'].trim() : '';
    if ((decision !== 'accept' && decision !== 'refuse') || response.length < 5 || response.length > 500) {
      throw new AppError(400, 'INVALID_BODY', 'La décision ou la réponse proposée est invalide.');
    }
    const at = this.now().toISOString();
    const result = this.db.run(`UPDATE claims SET status = 'pending_validation', proposed_decision = ?,
      proposed_response = ?, proposed_by = ?, updated_at = ?
      WHERE id = ? AND restaurant_id = ? AND status = 'open'`,
    [decision, response, staffId, at, id, restaurantId]);
    if (!Number(result.changes)) {
      if (!this.db.get('SELECT id FROM claims WHERE id = ? AND restaurant_id = ?', [id, restaurantId])) {
        throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
      }
      throw new AppError(409, 'CLAIM_NOT_OPEN', 'Cette réclamation n’est plus en attente de traitement.');
    }
    return this.getForStaff(restaurantId, id);
  }

  validate(restaurantId: string, staffId: string, role: string, id: string, input: unknown) {
    const body = bodyObject(input);
    onlyFields(body, ['pointsGranted']);
    return this.db.transaction(() => {
      const claim = readClaim(this.db, 'WHERE c.id = ? AND c.restaurant_id = ?', [id, restaurantId]);
      if (!claim) throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
      if (claim.status !== 'pending_validation' || !claim.proposed_decision || !claim.proposed_response) {
        throw new AppError(409, 'CLAIM_NOT_PENDING_VALIDATION', 'Cette réclamation n’est pas en attente de validation.');
      }
      if (claim.kind === 'points' && role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'Seul l’administrateur peut valider une réclamation de points.');
      }
      let grantedPoints = 0;
      if (claim.kind === 'points' && claim.proposed_decision === 'accept') {
        const points = body['pointsGranted'];
        if (!Number.isSafeInteger(points) || (points as number) <= 0
          || claim.requested_points === null || (points as number) > claim.requested_points) {
          throw new AppError(400, 'INVALID_BODY', 'Les points accordés doivent être positifs et ne pas dépasser les points demandés.');
        }
        grantedPoints = points as number;
      } else if (body['pointsGranted'] !== undefined) {
        throw new AppError(400, 'INVALID_BODY', 'pointsGranted ne s’applique qu’à une réclamation de points acceptée.');
      }

      const atDate = this.now();
      const at = atDate.toISOString();
      if (grantedPoints > 0) {
        const settings = this.db.get<{ points_validity_months: number }>(
          'SELECT points_validity_months FROM restaurant_settings WHERE restaurant_id = ?', [restaurantId],
        );
        if (!settings) throw new Error('Les paramètres de fidélité du restaurant sont introuvables.');
        const expiresAt = addMonths(atDate, settings.points_validity_months).toISOString();
        this.db.run(`INSERT INTO points_ledger (
          id, restaurant_id, user_id, kind, points, remaining, expires_at, note, created_by, created_at
        ) VALUES (?, ?, ?, 'adjust', ?, ?, ?, ?, ?, ?)`,
        [`ledger_${randomUUID()}`, restaurantId, claim.user_id, grantedPoints, grantedPoints,
          expiresAt, `Réclamation ${claim.id}`, staffId, at]);
      }
      const result = this.db.run(`UPDATE claims SET status = 'resolved', decision = proposed_decision,
        response = proposed_response, resolved_by = ?, updated_at = ?, resolved_at = ?
        WHERE id = ? AND restaurant_id = ? AND status = 'pending_validation'`,
      [staffId, at, at, id, restaurantId]);
      if (!Number(result.changes)) throw new AppError(409, 'CLAIM_ALREADY_RESOLVED', 'Cette réclamation a déjà été traitée.');
      return this.getForStaff(restaurantId, id);
    });
  }

  reject(restaurantId: string, id: string, input: unknown) {
    const body = bodyObject(input);
    onlyFields(body, ['note']);
    const note = typeof body['note'] === 'string' ? body['note'].trim() : '';
    if (note.length < 5 || note.length > 500) throw new AppError(400, 'INVALID_BODY', 'La note doit contenir entre 5 et 500 caractères.');
    const at = this.now().toISOString();
    const result = this.db.run(`UPDATE claims SET status = 'open', proposed_decision = NULL,
      proposed_response = NULL, proposed_by = NULL, manager_note = ?, updated_at = ?
      WHERE id = ? AND restaurant_id = ? AND status = 'pending_validation'`,
    [note, at, id, restaurantId]);
    if (!Number(result.changes)) {
      if (!this.db.get('SELECT id FROM claims WHERE id = ? AND restaurant_id = ?', [id, restaurantId])) {
        throw new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
      }
      throw new AppError(409, 'CLAIM_NOT_PENDING_VALIDATION', 'Cette réclamation n’est pas en attente de validation.');
    }
    return this.getForStaff(restaurantId, id);
  }
}
