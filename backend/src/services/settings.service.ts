import { randomUUID } from 'node:crypto';
import type { Database } from '../db/database.ts';
import { parseSettingsPatch, type OpeningHours } from '../domain/branding.ts';
import { parseUpload } from '../domain/images.ts';
import { AppError } from '../http/errors.ts';

interface SettingsRow {
  id: string; slug: string; name: string; tagline: string | null; logo_asset_id: string | null; primary_color: string; secondary_color: string;
  font_family: string; default_mode: string; spend_per_point_fc: number; points_per_meal: number; free_meal_cap_fc: number;
  points_validity_months: number; delivery_enabled: number; delivery_fee_fc: number; delivery_communes: string; opening_hours: string;
}

function parseJson<Value>(text: string, fallback: Value): Value {
  try { return JSON.parse(text) as Value; } catch { return fallback; }
}

export const assetUrl = (slug: string, id: string): string => `/api/restaurants/${encodeURIComponent(slug)}/assets/${encodeURIComponent(id)}`;

/** Réglages d'un restaurant : charte graphique, horaires, livraison et règles de fidélité. Réservé à son administrateur. */
export class SettingsService {
  private readonly db: Database;
  private readonly now: () => Date;

  constructor(db: Database, options: { now?: () => Date } = {}) {
    this.db = db;
    this.now = options.now ?? (() => new Date());
  }

  get(restaurantId: string) {
    const row = this.db.get<SettingsRow>(
      `SELECT r.id, r.slug, r.name, r.tagline, r.logo_asset_id, r.primary_color, r.secondary_color, r.font_family, r.default_mode,
         s.spend_per_point_fc, s.points_per_meal, s.free_meal_cap_fc, s.points_validity_months, s.delivery_enabled, s.delivery_fee_fc,
         s.delivery_communes, s.opening_hours
       FROM restaurants r JOIN restaurant_settings s ON s.restaurant_id = r.id WHERE r.id = ?`, [restaurantId]);
    if (!row) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable.');
    return {
      restaurant: { slug: row.slug, name: row.name, tagline: row.tagline },
      brand: {
        primaryColor: row.primary_color, secondaryColor: row.secondary_color, fontFamily: row.font_family, defaultMode: row.default_mode,
        logoAssetId: row.logo_asset_id, logoUrl: row.logo_asset_id ? assetUrl(row.slug, row.logo_asset_id) : null,
      },
      openingHours: parseJson<OpeningHours>(row.opening_hours, {}),
      delivery: { enabled: row.delivery_enabled === 1, feeFc: row.delivery_fee_fc, communes: parseJson<string[]>(row.delivery_communes, []) },
      loyalty: {
        spendPerPointFc: row.spend_per_point_fc, pointsForReward: row.points_per_meal, rewardValueFc: row.free_meal_cap_fc,
        validityMonths: row.points_validity_months,
      },
    };
  }

  update(restaurantId: string, input: unknown) {
    const patch = parseSettingsPatch(input);
    const at = this.now().toISOString();
    this.db.transaction(() => {
      if (patch.brand?.logoAssetId) this.requireAsset(restaurantId, patch.brand.logoAssetId, 'logo');
      const restaurant: Array<[string, string | null]> = [];
      if (patch.name !== undefined) restaurant.push(['name', patch.name]);
      if (patch.tagline !== undefined) restaurant.push(['tagline', patch.tagline]);
      if (patch.brand?.primaryColor) restaurant.push(['primary_color', patch.brand.primaryColor]);
      if (patch.brand?.secondaryColor) restaurant.push(['secondary_color', patch.brand.secondaryColor]);
      if (patch.brand?.fontFamily) restaurant.push(['font_family', patch.brand.fontFamily]);
      if (patch.brand?.defaultMode) restaurant.push(['default_mode', patch.brand.defaultMode]);
      if (patch.brand && 'logoAssetId' in patch.brand) restaurant.push(['logo_asset_id', patch.brand.logoAssetId ?? null]);
      if (restaurant.length > 0) {
        this.db.run(`UPDATE restaurants SET ${restaurant.map(([column]) => `${column} = ?`).join(', ')} WHERE id = ?`, [...restaurant.map(([, value]) => value), restaurantId]);
      }

      const settings: Array<[string, string | number]> = [];
      if (patch.openingHours) settings.push(['opening_hours', JSON.stringify(patch.openingHours)]);
      if (patch.delivery?.enabled !== undefined) settings.push(['delivery_enabled', patch.delivery.enabled ? 1 : 0]);
      if (patch.delivery?.feeFc !== undefined) settings.push(['delivery_fee_fc', patch.delivery.feeFc]);
      if (patch.delivery?.communes) settings.push(['delivery_communes', JSON.stringify(patch.delivery.communes)]);
      if (patch.loyalty?.spendPerPointFc !== undefined) settings.push(['spend_per_point_fc', patch.loyalty.spendPerPointFc]);
      if (patch.loyalty?.pointsForReward !== undefined) settings.push(['points_per_meal', patch.loyalty.pointsForReward]);
      if (patch.loyalty?.rewardValueFc !== undefined) settings.push(['free_meal_cap_fc', patch.loyalty.rewardValueFc]);
      if (patch.loyalty?.validityMonths !== undefined) settings.push(['points_validity_months', patch.loyalty.validityMonths]);
      if (settings.length > 0) {
        this.db.run(`UPDATE restaurant_settings SET ${settings.map(([column]) => `${column} = ?`).join(', ')}, updated_at = ? WHERE restaurant_id = ?`,
          [...settings.map(([, value]) => value), at, restaurantId]);
      }
    });
    return this.get(restaurantId);
  }

  /** Enregistre une image du restaurant. Le type est déduit des octets, jamais de ce que déclare le client. */
  uploadAsset(restaurantId: string, input: unknown) {
    const { kind, bytes, mime } = parseUpload(input);
    const slug = this.db.get<{ slug: string }>('SELECT slug FROM restaurants WHERE id = ?', [restaurantId])?.slug;
    if (!slug) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable.');
    const id = `ast_${randomUUID()}`;
    this.db.run('INSERT INTO assets (id, restaurant_id, kind, mime, data, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, restaurantId, kind, mime, bytes, bytes.length, this.now().toISOString()]);
    return { id, kind, mime, size: bytes.length, url: assetUrl(slug, id) };
  }

  /** Vérifie qu'une image appartient au restaurant ; sinon `422 ASSET_NOT_FOUND`. */
  requireAsset(restaurantId: string, assetId: string, kind: 'logo' | 'poster' | 'menu'): void {
    if (!this.db.get('SELECT 1 AS found FROM assets WHERE id = ? AND restaurant_id = ? AND kind = ?', [assetId, restaurantId, kind])) {
      throw new AppError(422, 'ASSET_NOT_FOUND', 'Image introuvable pour ce restaurant : envoyez-la d’abord.');
    }
  }
}
