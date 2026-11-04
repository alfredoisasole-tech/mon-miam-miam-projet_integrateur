import { AppError } from '../http/errors.ts';

/** Polices proposées : une seule est embarquée dans le site (Poppins), les autres sont des polices système sûres. */
export const FONT_FAMILIES = ['Poppins', 'Arial', 'Verdana', 'Trebuchet MS', 'Georgia', 'Tahoma', 'Times New Roman'] as const;
export const DISPLAY_MODES = ['light', 'dark', 'system'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MAX_ASSET_BYTES = 512 * 1024;
export const ASSET_KINDS = ['logo', 'poster', 'menu'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export interface OpeningInterval { open: string; close: string }
export type OpeningHours = Record<string, OpeningInterval[]>;

export interface SettingsPatch {
  name?: string;
  tagline?: string | null;
  brand?: { primaryColor?: string; secondaryColor?: string; fontFamily?: string; defaultMode?: DisplayMode; logoAssetId?: string | null };
  openingHours?: OpeningHours;
  delivery?: { enabled?: boolean; feeFc?: number; communes?: string[] };
  loyalty?: { spendPerPointFc?: number; pointsForReward?: number; rewardValueFc?: number; validityMonths?: number };
}

function invalid(field: string, message: string): AppError {
  return new AppError(400, 'VALIDATION_ERROR', message, [{ field, message }]);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(field, `${field} doit être un objet JSON.`);
  return value as Record<string, unknown>;
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const keys = Object.keys(body);
  if (keys.length === 0) throw invalid(field, `${field} ne contient aucune modification.`);
  const unknown = keys.find((key) => !allowed.includes(key));
  if (unknown) throw invalid(`${field}.${unknown}`.replace(/^body\./, ''), `Le champ « ${unknown} » n’est pas modifiable.`);
}

function integerIn(value: unknown, field: string, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw invalid(field, `${label} doit être un entier entre ${min} et ${max}.`);
  }
  return value;
}

export function parseColor(value: unknown, field: string): string {
  if (typeof value !== 'string' || !COLOR_PATTERN.test(value)) throw invalid(field, 'Une couleur s’écrit #rrggbb, par exemple #cfbd97.');
  return value.toLowerCase();
}

function parseOpeningHours(value: unknown): OpeningHours {
  const hours = record(value, 'openingHours');
  const result: OpeningHours = {};
  for (const [day, intervals] of Object.entries(hours)) {
    if (!(DAYS as readonly string[]).includes(day)) throw invalid('openingHours', `« ${day} » n’est pas un jour valide (mon, tue, wed, thu, fri, sat, sun).`);
    if (!Array.isArray(intervals) || intervals.length > 3) throw invalid('openingHours', `Au plus 3 plages horaires par jour (${day}).`);
    result[day] = intervals.map((interval) => {
      const { open, close } = record(interval, 'openingHours') as { open?: unknown; close?: unknown };
      if (typeof open !== 'string' || typeof close !== 'string' || !TIME_PATTERN.test(open) || !TIME_PATTERN.test(close) || open >= close) {
        throw invalid('openingHours', `Plage horaire invalide pour ${day} : HH:MM, l’ouverture avant la fermeture.`);
      }
      return { open, close };
    });
    const sorted = [...result[day]!].sort((first, second) => first.open.localeCompare(second.open));
    sorted.forEach((interval, index) => {
      const previous = sorted[index - 1];
      if (previous && previous.close > interval.open) throw invalid('openingHours', `Les plages horaires de ${day} se chevauchent.`);
    });
  }
  return result;
}

export function parseSettingsPatch(input: unknown): SettingsPatch {
  const body = record(input, 'body');
  onlyKeys(body, ['name', 'tagline', 'brand', 'openingHours', 'delivery', 'loyalty'], 'body');
  const patch: SettingsPatch = {};

  if ('name' in body) {
    if (typeof body['name'] !== 'string' || body['name'].trim().length < 2 || body['name'].trim().length > 80) {
      throw invalid('name', 'Le nom doit contenir de 2 à 80 caractères.');
    }
    patch.name = body['name'].trim();
  }
  if ('tagline' in body) {
    const tagline = body['tagline'];
    if (tagline !== null && (typeof tagline !== 'string' || tagline.trim().length > 120)) throw invalid('tagline', 'Le slogan doit contenir au plus 120 caractères.');
    patch.tagline = typeof tagline === 'string' ? tagline.trim() || null : null;
  }
  if ('brand' in body) {
    const brand = record(body['brand'], 'brand');
    onlyKeys(brand, ['primaryColor', 'secondaryColor', 'fontFamily', 'defaultMode', 'logoAssetId'], 'brand');
    patch.brand = {};
    if ('primaryColor' in brand) patch.brand.primaryColor = parseColor(brand['primaryColor'], 'brand.primaryColor');
    if ('secondaryColor' in brand) patch.brand.secondaryColor = parseColor(brand['secondaryColor'], 'brand.secondaryColor');
    if ('fontFamily' in brand) {
      if (typeof brand['fontFamily'] !== 'string' || !(FONT_FAMILIES as readonly string[]).includes(brand['fontFamily'])) {
        throw invalid('brand.fontFamily', `La police doit être l’une de : ${FONT_FAMILIES.join(', ')}.`);
      }
      patch.brand.fontFamily = brand['fontFamily'];
    }
    if ('defaultMode' in brand) {
      if (typeof brand['defaultMode'] !== 'string' || !(DISPLAY_MODES as readonly string[]).includes(brand['defaultMode'])) {
        throw invalid('brand.defaultMode', 'Le mode doit être « light », « dark » ou « system ».');
      }
      patch.brand.defaultMode = brand['defaultMode'] as DisplayMode;
    }
    if ('logoAssetId' in brand) {
      const logo = brand['logoAssetId'];
      if (logo !== null && (typeof logo !== 'string' || !logo.trim())) throw invalid('brand.logoAssetId', 'logoAssetId doit être un identifiant d’image ou null.');
      patch.brand.logoAssetId = typeof logo === 'string' ? logo.trim() : null;
    }
  }
  if ('openingHours' in body) patch.openingHours = parseOpeningHours(body['openingHours']);
  if ('delivery' in body) {
    const delivery = record(body['delivery'], 'delivery');
    onlyKeys(delivery, ['enabled', 'feeFc', 'communes'], 'delivery');
    patch.delivery = {};
    if ('enabled' in delivery) {
      if (typeof delivery['enabled'] !== 'boolean') throw invalid('delivery.enabled', 'enabled doit être vrai ou faux.');
      patch.delivery.enabled = delivery['enabled'];
    }
    if ('feeFc' in delivery) patch.delivery.feeFc = integerIn(delivery['feeFc'], 'delivery.feeFc', 'Les frais de livraison', 0, 100_000);
    if ('communes' in delivery) {
      const communes = delivery['communes'];
      if (!Array.isArray(communes) || communes.length > 30 || communes.some((commune) => typeof commune !== 'string' || !commune.trim() || commune.trim().length > 40)) {
        throw invalid('delivery.communes', 'communes est une liste de 30 noms au plus, de 1 à 40 caractères chacun.');
      }
      patch.delivery.communes = [...new Set((communes as string[]).map((commune) => commune.trim()))];
    }
  }
  if ('loyalty' in body) {
    const loyalty = record(body['loyalty'], 'loyalty');
    onlyKeys(loyalty, ['spendPerPointFc', 'pointsForReward', 'rewardValueFc', 'validityMonths'], 'loyalty');
    patch.loyalty = {};
    if ('spendPerPointFc' in loyalty) patch.loyalty.spendPerPointFc = integerIn(loyalty['spendPerPointFc'], 'loyalty.spendPerPointFc', 'La dépense par point', 100, 1_000_000);
    if ('pointsForReward' in loyalty) patch.loyalty.pointsForReward = integerIn(loyalty['pointsForReward'], 'loyalty.pointsForReward', 'Les points pour une réduction', 1, 1000);
    if ('rewardValueFc' in loyalty) patch.loyalty.rewardValueFc = integerIn(loyalty['rewardValueFc'], 'loyalty.rewardValueFc', 'La valeur de la réduction', 100, 1_000_000);
    if ('validityMonths' in loyalty) patch.loyalty.validityMonths = integerIn(loyalty['validityMonths'], 'loyalty.validityMonths', 'La validité des points', 1, 60);
  }
  return patch;
}
