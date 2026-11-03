/**
 * Règle métier : normalisation et validation des numéros de téléphone de la République Démocratique du Congo.
 * Format cible : +243XXXXXXXXX (9 chiffres après l'indicatif international).
 */

export const CONGO_PHONE_REGEX = /^\+243\d{9}$/;

/**
 * Normalise un numéro de téléphone brut au format congolais officiel (+243XXXXXXXXX).
 * Accepte les formats courants : "0820000001", "820000001", "243820000001", "+243 820 000 001", etc.
 * Renvoie null si le numéro est invalide.
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\s\-_().]/g, '');

  if (CONGO_PHONE_REGEX.test(cleaned)) {
    return cleaned;
  }

  // Format avec 0 au début (ex: 0820000001 -> 10 chiffres)
  if (/^0\d{9}$/.test(cleaned)) {
    return `+243${cleaned.slice(1)}`;
  }

  // Format sans préfixe (ex: 820000001 -> 9 chiffres)
  if (/^\d{9}$/.test(cleaned)) {
    return `+243${cleaned}`;
  }

  // Format sans le + (ex: 243820000001 -> 12 chiffres commençant par 243)
  if (/^243\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Vérifie si un numéro de téléphone est déjà au format valide +243XXXXXXXXX.
 */
export function isValidCongoPhone(phone: unknown): phone is string {
  return typeof phone === 'string' && CONGO_PHONE_REGEX.test(phone);
}
