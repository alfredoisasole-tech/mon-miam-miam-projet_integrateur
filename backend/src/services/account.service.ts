import { randomBytes } from 'node:crypto';
import type { Database } from '../db/database.ts';
import { maskName } from '../domain/names.ts';
import { verifyPassword } from '../domain/password.ts';
import { AppError } from '../http/errors.ts';

interface AccountRow {
  id: string; name: string; email: string; phone: string; role: string; address: string | null; commune: string | null;
  quartier: string | null; referral_code: string | null; accepted_terms_at: string | null; created_at: string; password_hash: string; status: string;
}

/** Droits des personnes sur leurs données : export de leurs informations et suppression (anonymisation) du compte. */
export class AccountService {
  private readonly db: Database;
  private readonly now: () => Date;

  constructor(db: Database, options: { now?: () => Date } = {}) {
    this.db = db;
    this.now = options.now ?? (() => new Date());
  }

  /** Toutes les données d'un étudiant, dans un format lisible. Aucun mot de passe, aucune donnée d'un tiers non masquée. */
  exportData(userId: string) {
    const account = this.db.get<AccountRow>(
      `SELECT id, name, email, phone, role, address, commune, quartier, referral_code, accepted_terms_at, created_at, password_hash, status
       FROM users WHERE id = ?`, [userId]);
    if (!account) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

    const memberships = this.db.all<{ restaurant: string; name: string; since: string; remainder: number }>(
      `SELECT r.slug AS restaurant, r.name, m.created_at AS since, m.loyalty_remainder_fc AS remainder
       FROM memberships m JOIN restaurants r ON r.id = m.restaurant_id WHERE m.user_id = ? ORDER BY m.created_at, r.slug`, [userId]);

    const orders = this.db.all<{
      id: string; order_number: string; restaurant: string; type: string; status: string; payment_method: string; payment_status: string;
      subtotal_fc: number; discount_fc: number; delivery_fee_fc: number; total_fc: number; points_redeemed: number; points_earned: number;
      arrival_time: string | null; delivery_commune: string | null; delivery_quartier: string | null; delivery_address: string | null;
      delivery_landmark: string | null; delivery_phone: string | null; note: string | null; rating: number | null; comment: string | null;
      created_at: string; completed_at: string | null;
    }>(`SELECT o.id, o.order_number, r.slug AS restaurant, o.type, o.status, o.payment_method, o.payment_status, o.subtotal_fc, o.discount_fc,
          o.delivery_fee_fc, o.total_fc, o.points_redeemed, o.points_earned, o.arrival_time, o.delivery_commune, o.delivery_quartier,
          o.delivery_address, o.delivery_landmark, o.delivery_phone, o.note, o.rating, o.comment, o.created_at, o.completed_at
        FROM orders o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.user_id = ? ORDER BY o.created_at, o.id`, [userId])
      .map((order) => ({
        id: order.id, orderNumber: order.order_number, restaurant: order.restaurant, type: order.type, status: order.status,
        paymentMethod: order.payment_method, paymentStatus: order.payment_status, subtotalFc: order.subtotal_fc,
        discountFc: order.discount_fc, deliveryFeeFc: order.delivery_fee_fc, totalFc: order.total_fc,
        pointsRedeemed: order.points_redeemed, pointsEarned: order.points_earned, arrivalTime: order.arrival_time,
        delivery: order.type === 'delivery' ? {
          commune: order.delivery_commune, quartier: order.delivery_quartier, address: order.delivery_address,
          landmark: order.delivery_landmark, phone: order.delivery_phone,
        } : null,
        note: order.note, rating: order.rating, comment: order.comment, createdAt: order.created_at, completedAt: order.completed_at,
        items: this.db.all<{ name: string; quantity: number; unit_price_fc: number }>(
          'SELECT name, quantity, unit_price_fc FROM order_items WHERE order_id = ? ORDER BY rowid', [order.id],
        ).map((item) => ({ name: item.name, quantity: item.quantity, unitPriceFc: item.unit_price_fc })),
      }));

    const points = this.db.all<{ restaurant: string; kind: string; points: number; created_at: string; expires_at: string | null; note: string | null }>(
      `SELECT r.slug AS restaurant, l.kind, l.points, l.created_at, l.expires_at, l.note
       FROM points_ledger l JOIN restaurants r ON r.id = l.restaurant_id WHERE l.user_id = ? ORDER BY l.created_at, l.rowid`, [userId])
      .map((entry) => ({ restaurant: entry.restaurant, kind: entry.kind, points: entry.points, createdAt: entry.created_at, expiresAt: entry.expires_at, note: entry.note }));

    const claims = this.db.all<{
      id: string; restaurant: string; kind: string; subject: string; message: string; status: string; decision: string | null;
      response: string | null; created_at: string;
    }>(`SELECT c.id, r.slug AS restaurant, c.kind, c.subject, c.message, c.status, c.decision, c.response, c.created_at
        FROM claims c JOIN restaurants r ON r.id = c.restaurant_id WHERE c.user_id = ? ORDER BY c.created_at, c.rowid`, [userId])
      .map((claim) => ({
        id: claim.id, restaurant: claim.restaurant, kind: claim.kind, subject: claim.subject, message: claim.message, status: claim.status,
        decision: claim.status === 'resolved' ? claim.decision : null, response: claim.status === 'resolved' ? claim.response : null,
        createdAt: claim.created_at,
      }));

    const referrals = this.db.all<{ name: string; status: string; referral_status: string | null; reward_points: number | null; created_at: string }>(
      `SELECT u.name, u.status, r.status AS referral_status, r.reward_points, u.created_at
       FROM users u LEFT JOIN referrals r ON r.referee_id = u.id WHERE u.referred_by = ? ORDER BY u.created_at, u.id`, [userId])
      .map((referee) => ({
        name: referee.status === 'deleted' ? 'Compte supprimé' : maskName(referee.name),
        status: referee.referral_status === 'rewarded' ? 'rewarded' : 'pending',
        rewardPoints: referee.referral_status === 'rewarded' ? referee.reward_points : null,
        joinedAt: referee.created_at,
      }));

    return {
      exportedAt: this.now().toISOString(),
      account: {
        id: account.id, name: account.name, email: account.email, phone: account.phone, role: account.role, address: account.address,
        commune: account.commune, quartier: account.quartier, referralCode: account.referral_code,
        acceptedTermsAt: account.accepted_terms_at, createdAt: account.created_at,
      },
      memberships: memberships.map((item) => ({ restaurant: item.restaurant, name: item.name, since: item.since, loyaltyRemainderFc: item.remainder })),
      orders, points, claims, referrals,
    };
  }

  /**
   * Supprime le compte d'un étudiant en l'anonymisant : l'identité, l'adresse et les textes personnels sont effacés,
   * les montants et les dates des commandes restent pour la comptabilité des restaurants.
   */
  deleteAccount(userId: string, passwordInput: unknown): { deleted: true } {
    const password = typeof passwordInput === 'string' ? passwordInput : '';
    if (!password) throw new AppError(400, 'VALIDATION_ERROR', 'Saisissez votre mot de passe pour confirmer la suppression.');
    const account = this.db.get<{ password_hash: string; status: string }>('SELECT password_hash, status FROM users WHERE id = ? AND role = \'student\'', [userId]);
    if (!account || account.status !== 'active') throw new AppError(403, 'FORBIDDEN', 'Cette action est réservée aux comptes étudiants actifs.');
    if (!verifyPassword(password, account.password_hash)) throw new AppError(401, 'INVALID_CREDENTIALS', 'Mot de passe incorrect.');

    this.db.transaction(() => {
      if (this.db.get("SELECT 1 AS found FROM orders WHERE user_id = ? AND status NOT IN ('completed', 'cancelled')", [userId])) {
        throw new AppError(409, 'ORDER_IN_PROGRESS', 'Vous avez une commande en cours : attendez qu’elle soit terminée pour supprimer votre compte.');
      }
      this.db.run(`UPDATE users SET name = 'Compte supprimé', email = ?, phone = ?, password_hash = '!supprime', address = NULL, commune = NULL,
        quartier = NULL, referral_code = NULL, status = 'deleted', must_change_password = 0, auth_version = auth_version + 1 WHERE id = ?`,
      [`supprime-${userId}-${randomBytes(4).toString('hex')}@supprime.invalid`, `supprime:${userId}`, userId]);
      this.db.run(`UPDATE orders SET delivery_commune = NULL, delivery_quartier = NULL, delivery_address = NULL, delivery_landmark = NULL,
        delivery_phone = NULL, note = NULL, comment = NULL WHERE user_id = ?`, [userId]);
      this.db.run("UPDATE claims SET subject = 'Contenu supprimé', message = 'Contenu supprimé' WHERE user_id = ?", [userId]);
      this.db.run('UPDATE points_ledger SET remaining = 0 WHERE user_id = ? AND remaining > 0', [userId]);
      this.db.run('DELETE FROM password_resets WHERE user_id = ?', [userId]);
      this.db.run('DELETE FROM auth_lockouts WHERE user_id = ?', [userId]);
    });
    return { deleted: true };
  }
}
