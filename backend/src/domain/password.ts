import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export const DUMMY_PASSWORD_HASH =
  'scrypt$00112233445566778899aabbccddeeff$' +
  'b4c99c1a8ed980a70e4d95e37d2c7d148295e6b1a326c6f828bd48a0a13c22c7' +
  'fdca1f10b986ff3a01909e46fc6c9e6d3fc9cab59b5e9fb65cf14a5d97e1a60a';

/**
 * Hache un mot de passe en utilisant scrypt (node:crypto) avec un sel aléatoire.
 * Résultat au format scrypt$<selHex>$<hashHex>.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Vérifie un mot de passe contre son empreinte hachée en temps constant (timingSafeEqual).
 */
export function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, saltHex, hashHex] = encoded.split('$');
  if (
    algorithm !== 'scrypt' ||
    !saltHex ||
    !hashHex ||
    !/^[a-f\d]+$/i.test(saltHex) ||
    !/^[a-f\d]+$/i.test(hashHex)
  ) {
    return false;
  }
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Règle de sécurité du mot de passe : au moins 8 caractères, une majuscule et un chiffre.
 */
export function isPasswordStrong(password: string): boolean {
  return typeof password === 'string' && PASSWORD_PATTERN.test(password);
}
