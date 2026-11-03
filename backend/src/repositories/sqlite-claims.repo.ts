import { randomUUID } from 'node:crypto';
import type { SQLInputValue } from 'node:sqlite';
import type { Database } from '../db/database.ts';
import type { ClaimDecision, ClaimKind, ClaimStatus } from '../domain/claims.ts';

export interface ClaimRecord {
  id: string;
  restaurantId: string;
  userId: string;
  orderId: string | null;
  orderNumber: string | null;
  kind: ClaimKind;
  subject: string;
  message: string;
  requestedPoints: number | null;
  status: ClaimStatus;
  proposedDecision: ClaimDecision | null;
  proposedResponse: string | null;
  proposedBy: string | null;
  proposedByName: string | null;
  decision: ClaimDecision | null;
  response: string | null;
  resolvedBy: string | null;
  managerNote: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

interface ClaimRow {
  id: string; restaurant_id: string; user_id: string; order_id: string | null; order_number: string | null;
  kind: ClaimKind; subject: string; message: string; requested_points: number | null; status: ClaimStatus;
  proposed_decision: ClaimDecision | null; proposed_response: string | null; proposed_by: string | null; proposed_by_name: string | null;
  decision: ClaimDecision | null; response: string | null; resolved_by: string | null; manager_note: string | null;
  customer_name: string | null; customer_phone: string | null;
  created_at: string; updated_at: string; resolved_at: string | null;
}

const SELECT = `
  SELECT c.*, o.order_number AS order_number, u.name AS customer_name, u.phone AS customer_phone, p.name AS proposed_by_name
  FROM claims c
  LEFT JOIN orders o ON o.id = c.order_id
  LEFT JOIN users u ON u.id = c.user_id
  LEFT JOIN users p ON p.id = c.proposed_by`;

function mapClaim(row: ClaimRow): ClaimRecord {
  return {
    id: row.id, restaurantId: row.restaurant_id, userId: row.user_id, orderId: row.order_id, orderNumber: row.order_number,
    kind: row.kind, subject: row.subject, message: row.message, requestedPoints: row.requested_points, status: row.status,
    proposedDecision: row.proposed_decision, proposedResponse: row.proposed_response, proposedBy: row.proposed_by,
    proposedByName: row.proposed_by_name, decision: row.decision, response: row.response, resolvedBy: row.resolved_by,
    managerNote: row.manager_note, customerName: row.customer_name, customerPhone: row.customer_phone,
    createdAt: row.created_at, updatedAt: row.updated_at, resolvedAt: row.resolved_at,
  };
}

export interface ClaimPatch {
  status?: ClaimStatus;
  proposedDecision?: ClaimDecision | null;
  proposedResponse?: string | null;
  proposedBy?: string | null;
  decision?: ClaimDecision | null;
  response?: string | null;
  resolvedBy?: string | null;
  managerNote?: string | null;
  updatedAt: string;
  resolvedAt?: string | null;
}

const COLUMNS: Record<Exclude<keyof ClaimPatch, never>, string> = {
  status: 'status', proposedDecision: 'proposed_decision', proposedResponse: 'proposed_response', proposedBy: 'proposed_by',
  decision: 'decision', response: 'response', resolvedBy: 'resolved_by', managerNote: 'manager_note',
  updatedAt: 'updated_at', resolvedAt: 'resolved_at',
};

export class SqliteClaimsRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  findRestaurantBySlug(slug: string): { id: string; status: string } | undefined {
    return this.db.get<{ id: string; status: string }>('SELECT id, status FROM restaurants WHERE slug = ?', [slug]);
  }

  hasMembership(userId: string, restaurantId: string): boolean {
    return Boolean(this.db.get('SELECT 1 AS found FROM memberships WHERE user_id = ? AND restaurant_id = ?', [userId, restaurantId]));
  }

  findOrder(orderId: string): { id: string; userId: string; restaurantId: string } | undefined {
    const row = this.db.get<{ id: string; user_id: string; restaurant_id: string }>(
      'SELECT id, user_id, restaurant_id FROM orders WHERE id = ?', [orderId],
    );
    return row && { id: row.id, userId: row.user_id, restaurantId: row.restaurant_id };
  }

  countUnresolved(userId: string, restaurantId: string): number {
    return this.db.get<{ total: number }>(
      "SELECT COUNT(*) AS total FROM claims WHERE user_id = ? AND restaurant_id = ? AND status <> 'resolved'", [userId, restaurantId],
    )?.total ?? 0;
  }

  insert(claim: { id: string; restaurantId: string; userId: string; orderId: string | null; kind: ClaimKind; subject: string;
    message: string; requestedPoints: number | null; createdAt: string }): void {
    this.db.run(`INSERT INTO claims (id, restaurant_id, user_id, order_id, kind, subject, message, requested_points, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    [claim.id, claim.restaurantId, claim.userId, claim.orderId, claim.kind, claim.subject, claim.message,
      claim.requestedPoints, claim.createdAt, claim.createdAt]);
  }

  findById(id: string): ClaimRecord | undefined {
    const row = this.db.get<ClaimRow>(`${SELECT} WHERE c.id = ?`, [id]);
    return row && mapClaim(row);
  }

  update(id: string, patch: ClaimPatch): void {
    const entries = (Object.keys(patch) as Array<keyof ClaimPatch>).filter((key) => patch[key] !== undefined);
    const assignments = entries.map((key) => `${COLUMNS[key]} = ?`).join(', ');
    this.db.run(`UPDATE claims SET ${assignments} WHERE id = ?`, [...entries.map((key) => patch[key] as SQLInputValue), id]);
  }

  listForUser(userId: string, restaurantId: string, limit: number, offset: number): { rows: ClaimRecord[]; total: number } {
    const total = this.db.get<{ total: number }>(
      'SELECT COUNT(*) AS total FROM claims WHERE user_id = ? AND restaurant_id = ?', [userId, restaurantId],
    )?.total ?? 0;
    const rows = this.db.all<ClaimRow>(
      `${SELECT} WHERE c.user_id = ? AND c.restaurant_id = ? ORDER BY c.created_at DESC, c.rowid DESC LIMIT ? OFFSET ?`,
      [userId, restaurantId, limit, offset],
    ).map(mapClaim);
    return { rows, total };
  }

  listForRestaurant(restaurantId: string, statuses: ClaimStatus[], ascending: boolean, limit: number, offset: number): { rows: ClaimRecord[]; total: number } {
    const marks = statuses.map(() => '?').join(', ');
    const total = this.db.get<{ total: number }>(
      `SELECT COUNT(*) AS total FROM claims WHERE restaurant_id = ? AND status IN (${marks})`, [restaurantId, ...statuses],
    )?.total ?? 0;
    const direction = ascending ? 'ASC' : 'DESC';
    const rows = this.db.all<ClaimRow>(
      `${SELECT} WHERE c.restaurant_id = ? AND c.status IN (${marks}) ORDER BY c.created_at ${direction}, c.rowid ${direction} LIMIT ? OFFSET ?`,
      [restaurantId, ...statuses, limit, offset],
    ).map(mapClaim);
    return { rows, total };
  }

  /** Crédite des points dans le restaurant de la réclamation, avec la durée de validité du restaurant. */
  grantPoints(input: { restaurantId: string; userId: string; points: number; note: string; staffId: string; at: string }): void {
    const months = this.db.get<{ points_validity_months: number }>(
      'SELECT points_validity_months FROM restaurant_settings WHERE restaurant_id = ?', [input.restaurantId],
    )?.points_validity_months ?? 12;
    const expiresAt = new Date(input.at);
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months);
    this.db.run(`INSERT INTO points_ledger (id, restaurant_id, user_id, kind, points, remaining, expires_at, note, created_by, created_at)
      VALUES (?, ?, ?, 'adjust', ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), input.restaurantId, input.userId, input.points, input.points, expiresAt.toISOString(), input.note, input.staffId, input.at]);
  }

  transaction<Result>(operation: () => Result): Result {
    return this.db.transaction(operation);
  }
}
