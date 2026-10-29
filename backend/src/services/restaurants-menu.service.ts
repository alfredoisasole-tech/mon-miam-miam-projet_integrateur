import { AppError } from '../http/errors.ts';
import type { Database } from '../db/database.ts';
import { restaurantsMenuRepository, type RestaurantRow } from '../repositories/restaurants-menu.repo.ts';

const categoryLabels = { plat: 'Plats', boisson: 'Boissons', dessert: 'Desserts', snack: 'Snacks' } as const;

type Hours = Record<string, Array<{ open: string; close: string }>>;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function isOpenNow(row: RestaurantRow, now: Date): boolean {
  const hours = parseJson<Hours>(row.opening_hours, {});
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: row.timezone || 'Africa/Kinshasa', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const day = get('weekday').toLowerCase();
  const minute = Number(get('hour')) * 60 + Number(get('minute'));
  return (hours[day] ?? []).some(({ open, close }) => {
    const toMinutes = (time: string) => {
      const match = /^(\d{2}):(\d{2})$/.exec(time);
      return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
    };
    const start = toMinutes(open); const end = toMinutes(close);
    return Number.isFinite(start) && Number.isFinite(end) && minute >= start && minute < end;
  });
}

function restaurantCard(row: RestaurantRow, now: Date) {
  return {
    slug: row.slug,
    name: row.name,
    slogan: row.tagline,
    logoUrl: row.logo_asset_id ? `/api/restaurants/${encodeURIComponent(row.slug)}/assets/${encodeURIComponent(row.logo_asset_id)}` : null,
    colors: { primary: row.primary_color, secondary: row.secondary_color },
    isOpenNow: isOpenNow(row, now),
  };
}

function publicSettings(row: RestaurantRow) {
  return {
    deliveryEnabled: row.delivery_enabled === 1,
    deliveryFeeFc: row.delivery_fee_fc ?? 0,
    deliveryCommunes: parseJson<string[]>(row.delivery_communes, []),
    openingHours: parseJson<Hours>(row.opening_hours, {}),
    loyalty: {
      spendPerPointFc: row.spend_per_point_fc ?? 3000,
      pointsForReward: row.points_per_meal ?? 15,
      rewardValueFc: row.free_meal_cap_fc ?? 3000,
      validityMonths: row.points_validity_months ?? 12,
    },
  };
}

export function restaurantsMenuService(db: Database, options: { now?: () => Date } = {}) {
  const repository = restaurantsMenuRepository(db);
  const now = options.now ?? (() => new Date());

  function requireRestaurant(slug: string): RestaurantRow {
    const row = repository.findActiveBySlug(slug);
    if (!row) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable ou désactivé.');
    return row;
  }

  return {
    list(page = 1, pageSize = 20) {
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Les paramètres page et pageSize doivent être des entiers valides (pageSize maximal : 100).');
      }
      const current = now();
      return {
        items: repository.listActive(pageSize, (page - 1) * pageSize).map((row) => restaurantCard(row, current)),
        total: repository.countActive(), page, pageSize,
      };
    },
    detail(slug: string) {
      const row = requireRestaurant(slug);
      return { ...restaurantCard(row, now()), settings: publicSettings(row) };
    },
    menu(slug: string) {
      const restaurant = requireRestaurant(slug);
      const items = repository.listAvailableMenu(restaurant.id).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        priceFc: item.price_fc,
        isDaily: item.is_daily === 1,
        isAvailable: item.is_available === 1,
        imageUrl: item.image_asset_id ? `/api/restaurants/${encodeURIComponent(restaurant.slug)}/assets/${encodeURIComponent(item.image_asset_id)}` : null,
        category: item.category,
      }));
      const dailyItems = items.filter((item) => item.isDaily);
      const categories = (Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>)
        .map((key) => ({ name: categoryLabels[key], items: items.filter((item) => !item.isDaily && item.category === key) }))
        .filter((category) => category.items.length > 0)
        .map(({ name, items: categoryItems }) => ({
          name,
          items: categoryItems.map(({ category: _category, ...item }) => item),
        }));
      return { restaurant: restaurant.slug, categories, dailyItems: dailyItems.map(({ category: _category, ...item }) => item) };
    },
    asset(slug: string, assetId: string) {
      const restaurant = requireRestaurant(slug);
      return repository.getAsset(restaurant.id, assetId);
    },
  };
}
