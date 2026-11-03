import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../domain/orders.ts';
import {
  MAX_UNRESOLVED_CLAIMS, parseCreateClaim, parseProposeClaim, parseRejectClaim, parseValidateClaim,
  type ClaimDecision, type ClaimKind, type ClaimStatus,
} from '../domain/claims.ts';
import { AppError } from '../http/errors.ts';
import type { ClaimRecord, SqliteClaimsRepository } from '../repositories/sqlite-claims.repo.ts';

export interface Page { page: number; pageSize: number }

export interface StudentClaim {
  id: string;
  kind: ClaimKind;
  orderId: string | null;
  orderNumber: string | null;
  subject: string;
  message: string;
  requestedPoints: number | null;
  /** « in_review » : le personnel prépare une réponse que l'étudiant ne voit pas encore. */
  status: 'open' | 'in_review' | 'resolved';
  decision: ClaimDecision | null;
  response: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface StaffClaim extends Omit<StudentClaim, 'status' | 'decision' | 'response'> {
  status: ClaimStatus;
  decision: ClaimDecision | null;
  response: string | null;
  customer: { id: string; name: string; phone: string } | null;
  proposal: { decision: ClaimDecision; response: string; proposedBy: string | null } | null;
  managerNote: string | null;
}

export interface Paginated<Item> { items: Item[]; total: number; page: number; pageSize: number }

function notFound(): AppError {
  return new AppError(404, 'CLAIM_NOT_FOUND', 'Réclamation introuvable.');
}

function invalidState(claim: ClaimRecord, action: string): AppError {
  return new AppError(409, 'INVALID_CLAIM_STATE', `Action impossible (${action}) : la réclamation est « ${claim.status} ».`, [{ status: claim.status }]);
}

export class ClaimsService {
  private readonly repository: SqliteClaimsRepository;
  private readonly now: () => Date;

  constructor(repository: SqliteClaimsRepository, options: { now?: () => Date } = {}) {
    this.repository = repository;
    this.now = options.now ?? (() => new Date());
  }

  private base(claim: ClaimRecord) {
    return {
      id: claim.id, kind: claim.kind, orderId: claim.orderId, orderNumber: claim.orderNumber, subject: claim.subject,
      message: claim.message, requestedPoints: claim.requestedPoints, createdAt: claim.createdAt, updatedAt: claim.updatedAt,
      resolvedAt: claim.resolvedAt,
    };
  }

  /** L'étudiant ne voit ni la proposition, ni la décision, tant que la réclamation n'est pas résolue. */
  private studentView(claim: ClaimRecord): StudentClaim {
    const resolved = claim.status === 'resolved';
    return {
      ...this.base(claim),
      status: claim.status === 'pending_validation' ? 'in_review' : claim.status,
      decision: resolved ? claim.decision : null,
      response: resolved ? claim.response : null,
    };
  }

  private staffView(claim: ClaimRecord): StaffClaim {
    return {
      ...this.base(claim),
      status: claim.status,
      decision: claim.decision,
      response: claim.response,
      customer: claim.customerName ? { id: claim.userId, name: claim.customerName, phone: claim.customerPhone ?? '' } : null,
      proposal: claim.proposedDecision && claim.proposedResponse
        ? { decision: claim.proposedDecision, response: claim.proposedResponse, proposedBy: claim.proposedByName }
        : null,
      managerNote: claim.managerNote,
    };
  }

  private restaurantForStudent(userId: string, slug: string): string {
    const restaurant = this.repository.findRestaurantBySlug(slug);
    if (!restaurant || restaurant.status !== 'active') throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable ou désactivé.');
    if (!this.repository.hasMembership(userId, restaurant.id)) {
      throw new AppError(403, 'NOT_A_MEMBER', 'Vous n’êtes pas client de ce restaurant.');
    }
    return restaurant.id;
  }

  private inRestaurant(restaurantId: string, id: string): ClaimRecord {
    const claim = this.repository.findById(id);
    if (!claim || claim.restaurantId !== restaurantId) throw notFound();
    return claim;
  }

  private requireAdminForPoints(claim: ClaimRecord, staff: AuthenticatedUser): void {
    if (claim.kind === 'points' && staff.role !== 'admin') {
      throw new AppError(403, 'POINTS_CLAIM_ADMIN_ONLY', 'Les réclamations de points sont tranchées par l’administrateur.');
    }
  }

  // --- Étudiant ------------------------------------------------------------

  create(userId: string, slug: string, input: unknown): StudentClaim {
    const claim = parseCreateClaim(input);
    const restaurantId = this.restaurantForStudent(userId, slug);
    if (claim.orderId) {
      const order = this.repository.findOrder(claim.orderId);
      if (!order || order.userId !== userId || order.restaurantId !== restaurantId) {
        throw new AppError(422, 'ORDER_NOT_FOUND', 'Commande introuvable.');
      }
    }
    if (this.repository.countUnresolved(userId, restaurantId) >= MAX_UNRESOLVED_CLAIMS) {
      throw new AppError(409, 'TOO_MANY_OPEN_CLAIMS',
        `Vous avez déjà ${MAX_UNRESOLVED_CLAIMS} réclamations en cours : attendez qu’elles soient traitées.`);
    }
    const id = `claim_${randomUUID()}`;
    this.repository.insert({ id, restaurantId, userId, ...claim, createdAt: this.now().toISOString() });
    return this.studentView(this.repository.findById(id)!);
  }

  listMine(userId: string, slug: string, page: Page): Paginated<StudentClaim> {
    const restaurantId = this.restaurantForStudent(userId, slug);
    const { rows, total } = this.repository.listForUser(userId, restaurantId, page.pageSize, (page.page - 1) * page.pageSize);
    return { items: rows.map((row) => this.studentView(row)), total, page: page.page, pageSize: page.pageSize };
  }

  getMine(userId: string, id: string): StudentClaim {
    const claim = this.repository.findById(id);
    if (!claim || claim.userId !== userId) throw notFound();
    return this.studentView(claim);
  }

  // --- Personnel -----------------------------------------------------------

  listForStaff(restaurantId: string, status: ClaimStatus | 'active', page: Page): Paginated<StaffClaim> {
    const active = status === 'active';
    const { rows, total } = this.repository.listForRestaurant(
      restaurantId, active ? ['open', 'pending_validation'] : [status], active, page.pageSize, (page.page - 1) * page.pageSize,
    );
    return { items: rows.map((row) => this.staffView(row)), total, page: page.page, pageSize: page.pageSize };
  }

  getForStaff(restaurantId: string, id: string): StaffClaim {
    return this.staffView(this.inRestaurant(restaurantId, id));
  }

  /** Un employé propose une réponse : elle reste interne jusqu'à validation. */
  propose(staff: AuthenticatedUser & { restaurantId: string }, id: string, input: unknown): StaffClaim {
    const proposal = parseProposeClaim(input);
    const claim = this.inRestaurant(staff.restaurantId, id);
    if (claim.status !== 'open') throw invalidState(claim, 'proposer une réponse');
    this.repository.update(claim.id, {
      status: 'pending_validation', proposedDecision: proposal.decision, proposedResponse: proposal.response,
      proposedBy: staff.id, updatedAt: this.now().toISOString(),
    });
    return this.staffView(this.repository.findById(claim.id)!);
  }

  /**
   * Le gérant valide la proposition d'un employé. L'administrateur peut aussi répondre directement (ou corriger la
   * proposition) et seul lui tranche les réclamations de points, en accordant les points.
   */
  validate(staff: AuthenticatedUser & { restaurantId: string }, id: string, input: unknown): StaffClaim {
    const body = parseValidateClaim(input);
    const claim = this.inRestaurant(staff.restaurantId, id);
    this.requireAdminForPoints(claim, staff);
    if (claim.status === 'resolved') throw invalidState(claim, 'valider');

    const isAdmin = staff.role === 'admin';
    const decision = (isAdmin ? body.decision : null) ?? claim.proposedDecision;
    const response = (isAdmin ? body.response : null) ?? claim.proposedResponse;
    if (!decision || !response) {
      throw new AppError(409, 'NO_PROPOSAL', 'Aucune réponse n’a été proposée : un employé doit d’abord en proposer une.');
    }

    let points = 0;
    if (claim.kind === 'points' && decision === 'accept') {
      points = body.grantedPoints ?? claim.requestedPoints ?? 0;
      if (points < 1 || points > (claim.requestedPoints ?? 0)) {
        throw new AppError(400, 'VALIDATION_ERROR', `Accordez entre 1 et ${claim.requestedPoints} points.`,
          [{ field: 'grantedPoints', message: `Accordez entre 1 et ${claim.requestedPoints} points.` }]);
      }
    }

    const at = this.now().toISOString();
    this.repository.transaction(() => {
      if (points > 0) {
        this.repository.grantPoints({
          restaurantId: claim.restaurantId, userId: claim.userId, points,
          note: `Réclamation acceptée : ${claim.subject}`.slice(0, 200), staffId: staff.id, at,
        });
      }
      this.repository.update(claim.id, { status: 'resolved', decision, response, resolvedBy: staff.id, resolvedAt: at, updatedAt: at });
    });
    return this.staffView(this.repository.findById(claim.id)!);
  }

  /** Le gérant renvoie la proposition avec une consigne : la réclamation redevient ouverte. */
  reject(staff: AuthenticatedUser & { restaurantId: string }, id: string, input: unknown): StaffClaim {
    const note = parseRejectClaim(input);
    const claim = this.inRestaurant(staff.restaurantId, id);
    this.requireAdminForPoints(claim, staff);
    if (claim.status !== 'pending_validation') throw invalidState(claim, 'rejeter');
    this.repository.update(claim.id, {
      status: 'open', proposedDecision: null, proposedResponse: null, proposedBy: null, managerNote: note,
      updatedAt: this.now().toISOString(),
    });
    return this.staffView(this.repository.findById(claim.id)!);
  }
}
