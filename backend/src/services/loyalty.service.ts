import { AppError } from '../http/errors.ts';
import { MAX_POINT_MOVEMENTS, type LoyaltyBalance, type LoyaltyRepository } from '../domain/loyalty.ts';

/**
 * Consultation du solde de fidélité d'un étudiant dans un restaurant.
 * Le solde vient du même calcul que celui qui contrôle l'utilisation des points à la commande :
 * le navigateur n'est jamais une source de vérité.
 */
export class LoyaltyService {
  private readonly repository: LoyaltyRepository;
  private readonly options: { now?: () => Date };

  constructor(repository: LoyaltyRepository, options: { now?: () => Date } = {}) {
    this.repository = repository;
    this.options = options;
  }

  async balance(userId: string, slug: string): Promise<LoyaltyBalance> {
    const restaurant = await this.repository.findRestaurantBySlug(slug);
    if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant introuvable.');
    // Un étudiant qui n'a pas encore commandé ici n'a pas d'adhésion : son solde est simplement de 0 point.
    const at = (this.options.now?.() ?? new Date()).toISOString();
    const [rules, availablePoints, remainderFc, movements] = await Promise.all([
      this.repository.getLoyaltyRules(restaurant.id),
      this.repository.getAvailablePoints(userId, restaurant.id, at),
      this.repository.getLoyaltyRemainderFc(userId, restaurant.id),
      this.repository.listPointMovements(userId, restaurant.id, MAX_POINT_MOVEMENTS),
    ]);
    return {
      restaurant: { slug: restaurant.slug, name: restaurant.name },
      availablePoints,
      remainderFc,
      canRedeem: availablePoints >= rules.pointsForReward,
      rules,
      movements,
    };
  }
}
