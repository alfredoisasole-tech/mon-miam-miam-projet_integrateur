export function formatPrice(amountFc: number): string {
  // Utilise Intl pour avoir automatiquement les espaces (ex: 4 000 FC)
  return new Intl.NumberFormat('fr-FR').format(amountFc) + ' FC';
}
