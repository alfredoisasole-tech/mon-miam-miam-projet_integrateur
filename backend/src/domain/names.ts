/** Masque un nom pour l'afficher à d'autres clients : « Marie Kabila » devient « Marie K. ». */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return 'Client';
  const second = parts[1];
  return second ? `${first} ${second.charAt(0).toLocaleUpperCase('fr')}.` : first;
}
