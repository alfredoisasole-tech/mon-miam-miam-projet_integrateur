/**
 * Formate un montant en FC avec des espaces (ex: 4000 → "4 000 FC")
 */
export function formatPrice(amountFc: number): string {
  return new Intl.NumberFormat('fr-FR').format(amountFc) + ' FC';
}
