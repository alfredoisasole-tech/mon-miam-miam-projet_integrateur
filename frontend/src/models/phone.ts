/**
 * Met un numéro congolais saisi à la main au format attendu par l'API, « +243XXXXXXXXX ».
 * Accepte « 0991234567 », « 991234567 », « 243991234567 », « 00243991234567 » et « +243 99 123 45 67 ».
 */
export function normalizePhone(value: string): string {
  const digits = value.replace(/[\s.()-]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00243')) return `+${digits.slice(2)}`;
  if (digits.startsWith('243') && digits.length >= 12) return `+${digits}`;
  return `+243${digits.replace(/^0/, '')}`;
}
