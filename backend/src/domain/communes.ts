/** Les 24 communes officielles de Kinshasa, avec leur graphie d'affichage. */
export const KINSHASA_COMMUNES = ['Bandalungwa', 'Barumbu', 'Bumbu', 'Gombe', 'Kalamu', 'Kasa-Vubu', 'Kimbanseke', 'Kinshasa', 'Kintambo', 'Kisenso', 'Lemba', 'Limete', 'Lingwala', 'Makala', 'Maluku', 'Masina', 'Matete', 'Mont-Ngafula', "N'djili", "N'sele", 'Ngaba', 'Ngaliema', 'Ngiri-Ngiri', 'Selembao'];

/** Retrouve une commune sans tenir compte des accents, de la casse ni du type d'apostrophe ; null si inconnue. */
export function canonicalCommune(value: string): string | null {
  const normalizedName = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
  return KINSHASA_COMMUNES.find((name) => name.toLowerCase() === normalizedName) ?? null;
}
