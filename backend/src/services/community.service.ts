import { randomBytes } from 'node:crypto';
import type { Database } from '../db/database.ts';
import { maskName } from '../domain/names.ts';
import { isRankingPeriod, periodStart, type RankingPeriod } from '../domain/periods.ts';
import { AppError } from '../http/errors.ts';
import { SqliteCommunityRepository } from '../repositories/sqlite-community.repo.ts';
import { requireStudentRestaurant } from '../repositories/student-restaurant.ts';

const RANKING_SIZE = 10;
const MAX_COMMENT_LENGTH = 500;

export interface ReviewInput { rating: number; comment: string | null }

export function parseReview(input: unknown): ReviewInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Le corps de la requête doit être un objet JSON.');
  }
  const body = input as Record<string, unknown>;
  const rating = body['rating'];
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError(400, 'VALIDATION_ERROR', 'La note doit être un entier de 1 à 5.', [{ field: 'rating', message: 'La note doit être un entier de 1 à 5.' }]);
  }
  const rawComment = body['comment'];
  if (rawComment !== undefined && rawComment !== null && typeof rawComment !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Le commentaire doit être un texte.', [{ field: 'comment', message: 'Le commentaire doit être un texte.' }]);
  }
  const comment = typeof rawComment === 'string' ? rawComment.trim() : '';
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new AppError(400, 'VALIDATION_ERROR', `Le commentaire ne doit pas dépasser ${MAX_COMMENT_LENGTH} caractères.`,
      [{ field: 'comment', message: `Le commentaire ne doit pas dépasser ${MAX_COMMENT_LENGTH} caractères.` }]);
  }
  return { rating, comment: comment || null };
}

export class CommunityService {
  private readonly db: Database;
  private readonly repository: SqliteCommunityRepository;
  private readonly now: () => Date;

  constructor(db: Database, options: { now?: () => Date } = {}) {
    this.db = db;
    this.repository = new SqliteCommunityRepository(db);
    this.now = options.now ?? (() => new Date());
  }

  /** Code de parrainage de l'étudiant (créé à la demande pour les anciens comptes) et suivi de ses filleuls. */
  referral(userId: string, slug: string) {
    const restaurant = requireStudentRestaurant(this.db, userId, slug);
    let code = this.repository.referralCodeOf(userId);
    while (!code) {
      const candidate = randomBytes(6).toString('hex').toUpperCase();
      if (this.repository.referralCodeExists(candidate)) continue;
      if (this.repository.setReferralCode(userId, candidate)) code = candidate;
      else code = this.repository.referralCodeOf(userId);
    }
    const referees = this.repository.referees(userId).map((referee) => ({
      name: referee.status === 'deleted' ? 'Compte supprimé' : maskName(referee.name),
      status: referee.referralStatus === 'rewarded' ? 'rewarded' : 'pending',
      rewardPoints: referee.rewardPoints,
      rewardedAt: referee.rewardedAt,
      rewardRestaurant: referee.rewardRestaurantSlug && referee.rewardRestaurantName
        ? { slug: referee.rewardRestaurantSlug, name: referee.rewardRestaurantName } : null,
      joinedAt: referee.joinedAt,
    }));
    return {
      code,
      restaurant: { slug: restaurant.slug, name: restaurant.name },
      referees,
      totals: {
        referees: referees.length,
        rewarded: referees.filter((referee) => referee.status === 'rewarded').length,
        pointsEarned: this.repository.pointsEarnedFromReferrals(userId, restaurant.id),
      },
    };
  }

  /** Note et commentaire d'une commande terminée, une seule fois. */
  review(userId: string, orderId: string, input: unknown) {
    const review = parseReview(input);
    const order = this.repository.findOrderForReview(orderId);
    if (!order || order.userId !== userId) throw new AppError(404, 'NOT_FOUND', 'Commande introuvable.');
    if (order.status !== 'completed') {
      throw new AppError(409, 'ORDER_NOT_COMPLETED', 'Vous pourrez donner votre avis une fois la commande terminée.');
    }
    if (order.commentedAt) throw new AppError(409, 'ALREADY_REVIEWED', 'Vous avez déjà donné votre avis sur cette commande.');
    const at = this.now().toISOString();
    if (!this.repository.saveReview(orderId, userId, { ...review, at })) {
      throw new AppError(409, 'ALREADY_REVIEWED', 'Vous avez déjà donné votre avis sur cette commande.');
    }
    return { orderId, rating: review.rating, comment: review.comment, commentedAt: at };
  }

  /** Les 10 clients du restaurant qui ont le plus de commandes terminées sur la période (noms masqués). */
  topClients(userId: string, slug: string, periodInput: unknown) {
    if (periodInput !== undefined && !isRankingPeriod(periodInput)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'La période doit valoir « day », « week » ou « month ».');
    }
    const period: RankingPeriod = periodInput === undefined ? 'month' : (periodInput as RankingPeriod);
    const restaurant = requireStudentRestaurant(this.db, userId, slug);
    const from = periodStart(period, this.now()).toISOString();
    return {
      period,
      from,
      restaurant: { slug: restaurant.slug, name: restaurant.name },
      items: this.repository.topClients(restaurant.id, from, RANKING_SIZE).map((client, index) => ({
        rank: index + 1,
        name: maskName(client.name),
        orders: client.orders,
        spentFc: client.spentFc,
        isMe: client.userId === userId,
      })),
    };
  }
}
