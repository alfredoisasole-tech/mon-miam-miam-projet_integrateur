/** Catégories de plats acceptées par l'API et leurs libellés affichés. */
export type DishCategory = 'plat' | 'boisson' | 'dessert' | 'snack';

export const CATEGORIES: DishCategory[] = ['plat', 'boisson', 'dessert', 'snack'];
export const CATEGORY_LABEL: Record<string, string> = { plat: 'Plat', boisson: 'Boisson', dessert: 'Dessert', snack: 'Snack' };
