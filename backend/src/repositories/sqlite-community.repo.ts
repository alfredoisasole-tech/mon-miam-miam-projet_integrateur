import type { Database } from '../db/database.ts';

export interface RefereeRecord {
  name: string;
  status: string;
  joinedAt: string;
  referralStatus: string | null;
  rewardPoints: number | null;
  rewardedAt: string | null;
  rewardRestaurantSlug: string | null;
  rewardRestaurantName: string | null;
}

export interface RankingRecord { userId: string; name: string; orders: number; spentFc: number }

export interface OrderForReview {
  id: string;
  userId: string;
  status: string;
  commentedAt: string | null;
}

/** Requêtes de la vie communautaire : parrainage, avis sur les commandes et classement des clients. */
export class SqliteCommunityRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  referralCodeOf(userId: string): string | null {
    return this.db.get<{ referral_code: string | null }>('SELECT referral_code FROM users WHERE id = ?', [userId])?.referral_code ?? null;
  }

  setReferralCode(userId: string, code: string): boolean {
    return Number(this.db.run('UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL', [code, userId]).changes) > 0;
  }

  referralCodeExists(code: string): boolean {
    return Boolean(this.db.get('SELECT 1 AS found FROM users WHERE referral_code = ?', [code]));
  }

  referees(referrerId: string): RefereeRecord[] {
    return this.db.all<{
      name: string; status: string; created_at: string; referral_status: string | null; reward_points: number | null;
      rewarded_at: string | null; restaurant_slug: string | null; restaurant_name: string | null;
    }>(`SELECT u.name, u.status, u.created_at, r.status AS referral_status, r.reward_points, r.rewarded_at,
          rr.slug AS restaurant_slug, rr.name AS restaurant_name
        FROM users u
        LEFT JOIN referrals r ON r.referee_id = u.id
        LEFT JOIN restaurants rr ON rr.id = r.restaurant_id
        WHERE u.referred_by = ?
        ORDER BY u.created_at, u.id`, [referrerId]).map((row) => ({
      name: row.name, status: row.status, joinedAt: row.created_at, referralStatus: row.referral_status,
      rewardPoints: row.referral_status === 'rewarded' ? row.reward_points : null, rewardedAt: row.rewarded_at,
      rewardRestaurantSlug: row.restaurant_slug, rewardRestaurantName: row.restaurant_name,
    }));
  }

  pointsEarnedFromReferrals(referrerId: string, restaurantId: string): number {
    return this.db.get<{ total: number }>(
      "SELECT COALESCE(SUM(reward_points), 0) AS total FROM referrals WHERE referrer_id = ? AND restaurant_id = ? AND status = 'rewarded'",
      [referrerId, restaurantId],
    )?.total ?? 0;
  }

  findOrderForReview(orderId: string): OrderForReview | undefined {
    const row = this.db.get<{ id: string; user_id: string; status: string; commented_at: string | null }>(
      'SELECT id, user_id, status, commented_at FROM orders WHERE id = ?', [orderId],
    );
    return row && { id: row.id, userId: row.user_id, status: row.status, commentedAt: row.commented_at };
  }

  saveReview(orderId: string, userId: string, review: { rating: number; comment: string | null; at: string }): boolean {
    const result = this.db.run(
      'UPDATE orders SET rating = ?, comment = ?, commented_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND commented_at IS NULL',
      [review.rating, review.comment, review.at, review.at, orderId, userId],
    );
    return Number(result.changes) > 0;
  }

  topClients(restaurantId: string, since: string, limit: number): RankingRecord[] {
    return this.db.all<{ user_id: string; name: string; orders: number; spent: number }>(
      `SELECT u.id AS user_id, u.name, COUNT(*) AS orders, COALESCE(SUM(o.subtotal_fc - o.discount_fc), 0) AS spent
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.restaurant_id = ? AND o.status = 'completed' AND o.completed_at >= ?
         AND u.role = 'student' AND u.status = 'active'
       GROUP BY u.id
       ORDER BY orders DESC, spent DESC, u.name COLLATE NOCASE, u.id
       LIMIT ?`, [restaurantId, since, limit],
    ).map((row) => ({ userId: row.user_id, name: row.name, orders: row.orders, spentFc: row.spent }));
  }
}
