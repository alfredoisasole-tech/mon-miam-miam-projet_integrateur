export type Rgb = [red: number, green: number, blue: number];

const HEX = /^#[\da-f]{6}$/i;

export const isHexColor = (value: string): boolean => HEX.test(value);

export function hexToRgb(hex: string): Rgb | null {
  if (!isHexColor(hex)) return null;
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)) as Rgb;
}

const clamp = (value: number) => Math.min(255, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

export function rgbToHex([red, green, blue]: Rgb): string {
  return `#${[red, green, blue].map(channel => clamp(channel).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const [red, green, blue] = (hexToRgb(hex) ?? [0, 0, 0]).map(channel => channel / 255)
    .map(channel => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)) as Rgb;
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

/** Rapport de contraste WCAG entre deux couleurs : de 1 (identiques) à 21 (noir sur blanc). */
export function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Noir ou blanc, selon ce qui se lit le mieux sur cette couleur. */
export function readableOn(background: string): '#000000' | '#ffffff' {
  return contrastRatio(background, '#000000') >= contrastRatio(background, '#ffffff') ? '#000000' : '#ffffff';
}

/** Fonds de page du site, en mode clair et en mode sombre. */
export const PAGE_BACKGROUNDS = { light: '#ffffff', dark: '#14110d' } as const;

/** Une couleur qui sert de texte (liens, prix) reste-t-elle au moins visible sur ce fond ? Le seuil est bas : il écarte les teintes presque confondues avec le fond. */
export const isVisibleOn = (color: string, background: string, minimum = 1.5): boolean => contrastRatio(color, background) >= minimum;
