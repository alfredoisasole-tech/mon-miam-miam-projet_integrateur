import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToRgb, isVisibleOn, readableOn, rgbToHex } from '../models/color.ts';

describe('Couleurs', () => {
  it('convertit entre code hexadécimal et rouge, vert, bleu', () => {
    expect(hexToRgb('#cfbd97')).toEqual([207, 189, 151]);
    expect(rgbToHex([207, 189, 151])).toBe('#cfbd97');
    expect(hexToRgb('rouge')).toBeNull();
    expect(hexToRgb('#abc')).toBeNull();
  });
  it('borne et arrondit les canaux', () => {
    expect(rgbToHex([300, -5, 12.6])).toBe('#ff000d');
    expect(rgbToHex([Number.NaN, 0, 0])).toBe('#000000');
  });
  it('calcule le contraste WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
  });
  it('choisit noir ou blanc selon la couleur de fond', () => {
    expect(readableOn('#000000')).toBe('#ffffff');
    expect(readableOn('#ffffff')).toBe('#000000');
    expect(readableOn('#cfbd97')).toBe('#000000');
  });
  it('repère une couleur presque confondue avec le fond de la page', () => {
    expect(isVisibleOn('#cfbd97', '#ffffff')).toBe(true);
    expect(isVisibleOn('#f8f8f0', '#ffffff')).toBe(false);
    expect(isVisibleOn('#1a1612', '#14110d')).toBe(false);
    expect(isVisibleOn('#cfbd97', '#14110d')).toBe(true);
  });
});
