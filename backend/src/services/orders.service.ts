import { randomUUID } from 'node:crypto';
import { AppError } from '../http/errors.ts';
import type { CreateOrderInput, DeliveryDetails, DeliveryInput, Order, OrderItem, OrderStatus, OrdersRepository, Restaurant } from '../domain/orders.ts';

const TIME_ZONE = 'Africa/Kinshasa';
const KINSHASA_COMMUNES = ['Bandalungwa', 'Barumbu', 'Bumbu', 'Gombe', 'Kalamu', 'Kasa-Vubu', 'Kimbanseke', 'Kinshasa', 'Kintambo', 'Kisenso', 'Lemba', 'Limete', 'Lingwala', 'Makala', 'Maluku', 'Masina', 'Matete', 'Mont-Ngafula', "N'djili", "N'sele", 'Ngaba', 'Ngaliema', 'Ngiri-Ngiri', 'Selembao'];

interface ParsedOrderInput extends Omit<CreateOrderInput, 'restaurant'> { restaurant: string | null }

function createValidationError(message: string): AppError { return new AppError(400, 'VALIDATION_ERROR', message); }

function readText(value: unknown, label: string, optional = false): string | null {
  if (value === undefined || value === null) {
    if (optional) return null;
    throw createValidationError(`Le champ « ${label} » est obligatoire.`);
  }
  if (typeof value !== 'string' || value.trim().length === 0) throw createValidationError(`Le champ « ${label} » doit être un texte non vide.`);
  return value.trim();
}
function normalizeCommune(value: string): string | null {
  const normalizedName = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
  return KINSHASA_COMMUNES.find((name) => name.toLowerCase() === normalizedName) ?? null;
}

function parseDeliveryDetails(value: unknown): DeliveryInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw createValidationError('Les informations de livraison sont obligatoires.');
  const raw = value as Record<string, unknown>;
  const normalizedCommune = normalizeCommune(readText(raw['commune'], 'delivery.commune')!);
  if (!normalizedCommune) throw createValidationError('La commune indiquée ne fait pas partie des communes reconnues de Kinshasa.');
  const address = readText(raw['address'], 'delivery.address', true);
  const landmark = readText(raw['landmark'], 'delivery.landmark', true);
  if (!address && !landmark) throw createValidationError('Indiquez une adresse complète ou un repère pour la livraison.');
  return { commune: normalizedCommune, quartier: readText(raw['quartier'], 'delivery.quartier', true), address, landmark, phone: readText(raw['phone'], 'delivery.phone', true) };
}

function parseCreateOrderRequest(body: unknown, idempotencyKey: string | undefined): ParsedOrderInput {
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,64}$/.test(idempotencyKey)) throw createValidationError('L’en-tête Idempotency-Key doit contenir de 8 à 64 caractères autorisés.');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw createValidationError('Le corps doit être un objet JSON.');
  const raw = body as Record<string, unknown>;
  const type = raw['type'];
  if (type !== 'dine_in' && type !== 'delivery') throw createValidationError('Le type doit être « dine_in » ou « delivery ».');
  const paymentMethod = raw['paymentMethod'] === undefined ? 'cash' : raw['paymentMethod'];
  if (paymentMethod !== 'cash' && paymentMethod !== 'mobile_money') throw createValidationError('Le moyen de paiement doit être « cash » ou « mobile_money ».');
  const restaurant = readText(raw['restaurant'], 'restaurant', true);
  let arrivalTime: string | null = null;
  let delivery: DeliveryInput | null = null;
  if (type === 'dine_in') {
    if (raw['delivery'] !== undefined && raw['delivery'] !== null) throw createValidationError('Le champ delivery ne s’applique pas à une commande sur place.');
    if (raw['arrivalTime'] !== undefined && raw['arrivalTime'] !== null) {
      if (typeof raw['arrivalTime'] !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(raw['arrivalTime'])) throw createValidationError('arrivalTime doit être une date ISO 8601 en UTC.');
      const arrival = new Date(raw['arrivalTime']);
      if (Number.isNaN(arrival.getTime()) || arrival.toISOString().slice(0, 19) !== raw['arrivalTime'].slice(0, 19)) throw createValidationError('arrivalTime doit être une date ISO 8601 en UTC valide.');
      arrivalTime = arrival.toISOString();
    }
  } else {
    if (raw['arrivalTime'] !== undefined && raw['arrivalTime'] !== null) throw createValidationError('arrivalTime doit être omis pour une livraison.');
    delivery = parseDeliveryDetails(raw['delivery']);
  }
  if (!Array.isArray(raw['items']) || raw['items'].length < 1 || raw['items'].length > 30) throw createValidationError('Le panier doit contenir de 1 à 30 lignes.');
  const grouped = new Map<string, number>();
  for (const [index, value] of raw['items'].entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw createValidationError(`La ligne ${index + 1} est invalide.`);
    const item = value as Record<string, unknown>;
    const menuItemId = readText(item['menuItemId'], `items[${index}].menuItemId`)!;
    const quantity = item['quantity'];
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 20) throw createValidationError(`La quantité du plat ${menuItemId} doit être un entier de 1 à 20.`);
    const total = (grouped.get(menuItemId) ?? 0) + (quantity as number);
    if (total > 20) throw createValidationError(`La quantité cumulée du plat ${menuItemId} ne peut pas dépasser 20.`);
    grouped.set(menuItemId, total);
  }
  const note = readText(raw['note'], 'note', true);
  if (note !== null && note.length > 300) throw createValidationError('La note ne peut pas dépasser 300 caractères.');
  const redeemMeal = raw['redeemMeal'] === undefined ? false : raw['redeemMeal'];
  if (typeof redeemMeal !== 'boolean') throw createValidationError('redeemMeal doit être un booléen.');
  return { idempotencyKey, restaurant, type, paymentMethod, arrivalTime, items: [...grouped].map(([menuItemId, quantity]) => ({ menuItemId, quantity })), delivery, note, redeemMeal };
}

function getKinshasaDateParts(date: Date): { day: string; hour: number; minute: number; year: number; month: number; date: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { day: get('weekday').toLowerCase().slice(0, 3), hour: Number(get('hour')), minute: Number(get('minute')), year: Number(get('year')), month: Number(get('month')), date: Number(get('day')) };
}

function parseTimeInMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function isRestaurantOpenAt(restaurant: Restaurant, date: Date): boolean {
  const local = getKinshasaDateParts(date); const minuteNow = local.hour * 60 + local.minute;
  return (restaurant.settings.openingHours[local.day] ?? []).some((interval) => {
    const open = parseTimeInMinutes(interval.open); const close = parseTimeInMinutes(interval.close);
    if (open === null || close === null) return false;
    return close > open ? minuteNow >= open && minuteNow < close : minuteNow >= open || minuteNow < close;
  });
}

function formatKinshasaDayKey(date: Date): string {
  const { year, month, date: day } = getKinshasaDateParts(date);
  return `${String(year).slice(-2)}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}

function buildDeliveryDetails(input: DeliveryInput | null, phone: string): DeliveryDetails | null {
  return input ? { ...input, phone: input.phone ?? phone } : null;
}

function canonicalizeOrder(order: Order): string {
  return JSON.stringify({ restaurantId: order.restaurantId, type: order.type, paymentMethod: order.paymentMethod,
    items: order.items.map(({ menuItemId, quantity }) => ({ menuItemId, quantity })).sort((a, b) => a.menuItemId.localeCompare(b.menuItemId)),
    arrivalTime: order.arrivalTime, delivery: order.delivery, note: order.note, redeemMeal: order.pointsRedeemed > 0 });
}

function canonicalizeRequest(input: ParsedOrderInput, restaurantId: string, delivery: DeliveryDetails | null): string {
  return JSON.stringify({ restaurantId, type: input.type, paymentMethod: input.paymentMethod,
    items: [...input.items].sort((a, b) => a.menuItemId.localeCompare(b.menuItemId)), arrivalTime: input.arrivalTime,
    delivery, note: input.note, redeemMeal: input.redeemMeal });
}

type PublicOrder = Omit<Order, 'userId' | 'restaurantId' | 'idempotencyKey' | 'items'> & {
  items: Array<Omit<OrderItem, 'category'>>;
};
type PublicOrderSummary = Omit<PublicOrder, 'events'>;

function serializeOrder(order: Order): PublicOrder {
  const { userId: _userId, restaurantId: _restaurantId, idempotencyKey: _key, items, ...response } = order;
  return { ...response, items: items.map(({ category: _category, ...item }) => item) };
}

export class OrdersService {
  private readonly repository: OrdersRepository;
  private readonly options: { now?: () => Date };

  constructor(repository: OrdersRepository, options: { now?: () => Date } = {}) {
    this.repository = repository;
    this.options = options;
  }

  async create(userId: string, body: unknown, keyHeader: string | undefined): Promise<{ order: PublicOrder; replayed: boolean }> {
    const input = parseCreateOrderRequest(body, keyHeader);
    const student = await this.repository.findStudent(userId);
    if (!student) throw new AppError(404, 'NOT_FOUND', 'Profil étudiant introuvable.');
    const restaurant = input.restaurant ? await this.repository.findRestaurantBySlug(input.restaurant) : await this.repository.findRestaurantById(student.restaurantId);
    const existing = await this.repository.findOrderByIdempotencyKey(userId, input.idempotencyKey);
    if (existing) {
      if (restaurant && canonicalizeOrder(existing) === canonicalizeRequest(input, restaurant.id, buildDeliveryDetails(input.delivery, student.phone))) return { order: serializeOrder(existing), replayed: true };
      throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'Cette clé a déjà servi pour une commande au contenu différent.');
    }
    if (!restaurant) throw new AppError(404, 'NOT_FOUND', 'Restaurant introuvable.');
    if (restaurant.status !== 'active') throw new AppError(404, 'RESTAURANT_INACTIVE', 'Ce restaurant n’accepte pas de commandes.');
    const now = this.options.now?.() ?? new Date();
    if (!isRestaurantOpenAt(restaurant, now)) throw new AppError(422, 'RESTAURANT_CLOSED', 'Le restaurant est fermé au moment de la commande.');
    if (input.arrivalTime) {
      const arrival = new Date(input.arrivalTime); const delta = arrival.getTime() - now.getTime();
      if (delta <= 0 || delta > 12 * 60 * 60 * 1000) throw new AppError(422, 'INVALID_ARRIVAL_TIME', 'L’heure d’arrivée doit être future et située dans les 12 prochaines heures.');
      if (!isRestaurantOpenAt(restaurant, arrival)) throw new AppError(422, 'OUTSIDE_OPENING_HOURS', 'L’heure d’arrivée est en dehors des horaires d’ouverture.');
    }
    if (input.type === 'delivery') {
      if (!restaurant.settings.deliveryEnabled) throw new AppError(422, 'DELIVERY_DISABLED', 'La livraison est désactivée pour ce restaurant.');
      if (!restaurant.settings.deliveryCommunes.some((served) => normalizeCommune(served) === input.delivery!.commune)) throw new AppError(422, 'COMMUNE_NOT_SERVED', 'Cette commune n’est pas desservie par le restaurant.');
    }
    if (input.paymentMethod === 'mobile_money' && !restaurant.settings.mobileMoneyEnabled) throw new AppError(422, 'PAYMENT_METHOD_UNAVAILABLE', 'Le paiement mobile money n’est pas disponible pour ce restaurant.');

    const menuItems = await this.repository.findMenuItemsByIds(input.items.map((item) => item.menuItemId));
    const itemsById = new Map(menuItems.map((item) => [item.id, item]));
    const items: OrderItem[] = input.items.map((requested) => {
      const item = itemsById.get(requested.menuItemId);
      if (!item || item.deletedAt !== null || item.restaurantId !== restaurant.id) throw new AppError(422, 'ITEM_NOT_FOUND', 'Un plat est introuvable dans ce restaurant.');
      if (!item.isAvailable) throw new AppError(422, 'ITEM_UNAVAILABLE', `Le plat « ${item.name} » n’est pas disponible.`);
      return { menuItemId: item.id, name: item.name, category: item.category, unitPriceFc: item.priceFc, quantity: requested.quantity, lineTotalFc: item.priceFc * requested.quantity };
    });
    const subtotalFc = items.reduce((sum, item) => sum + item.lineTotalFc, 0);
    const requiredPoints = restaurant.settings.pointsPerMeal;
    const discountFc = input.redeemMeal ? Math.min(restaurant.settings.freeMealCapFc, subtotalFc) : 0;
    const pointsAvailable = await this.repository.getAvailablePoints(userId, restaurant.id, now.toISOString());
    if (input.redeemMeal && pointsAvailable < requiredPoints) throw new AppError(422, 'INSUFFICIENT_POINTS', 'Le solde de points est insuffisant dans ce restaurant.');
    const deliveryFeeFc = input.type === 'delivery' ? restaurant.settings.deliveryFeeFc : 0;
    const totalFc = subtotalFc - discountFc + deliveryFeeFc;
    const delivery = buildDeliveryDetails(input.delivery, student.phone);
    const createdAt = now.toISOString(); const day = formatKinshasaDayKey(now);
    const sequence = await this.repository.nextOrderSequence(restaurant.id, day);
    const order: Order = {
      id: `ord_${randomUUID()}`, userId, restaurantId: restaurant.id, idempotencyKey: input.idempotencyKey,
      orderNumber: `${day}-${String(sequence).padStart(3, '0')}`, restaurant: { slug: restaurant.slug, name: restaurant.name },
      type: input.type, status: 'pending', paymentMethod: input.paymentMethod, paymentStatus: totalFc === 0 ? 'paid' : 'unpaid',
      items, subtotalFc, discountFc, deliveryFeeFc, totalFc, pointsRedeemed: input.redeemMeal ? requiredPoints : 0, pointsEarned: 0,
      arrivalTime: input.arrivalTime, delivery, note: input.note, comment: null, rating: null,
      events: [{ status: 'pending', at: createdAt }], createdAt, updatedAt: createdAt, completedAt: null, cancelledAt: null,
    };
    const result = await this.repository.createOrder(order);
    if (!result.created) {
      if (canonicalizeOrder(result.order) === canonicalizeRequest(input, restaurant.id, delivery)) return { order: serializeOrder(result.order), replayed: true };
      throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'Cette clé a déjà servi pour une commande au contenu différent.');
    }
    return { order: serializeOrder(result.order), replayed: false };
  }

  async list(userId: string, query: { page: number; pageSize: number; status?: OrderStatus }): Promise<{
    items: PublicOrderSummary[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const result = await this.repository.listOrders(userId, {
      status: query.status,
      offset: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
    });
    const items = result.orders.map((order) => {
      const { events: _events, ...summary } = serializeOrder(order);
      return summary;
    });
    return { items, total: result.total, page: query.page, pageSize: query.pageSize };
  }

  async getById(userId: string, orderId: string): Promise<PublicOrder | null> {
    const order = await this.repository.findOrderForUser(orderId, userId);
    if (!order) return null;
    const events = [...order.events].sort((first, second) => first.at.localeCompare(second.at));
    return serializeOrder({ ...order, events });
  }

  async cancel(userId: string, orderId: string): Promise<PublicOrder> {
    const now = (this.options.now?.() ?? new Date()).toISOString();
    const result = await this.repository.cancelOrder(userId, orderId, now);
    if (result.kind === 'not_found') throw new AppError(404, 'NOT_FOUND', 'Commande introuvable.');
    if (result.kind === 'cannot_cancel') throw new AppError(409, 'CANNOT_CANCEL', 'Cette commande ne peut plus être annulée.');
    const events = [...result.order.events].sort((first, second) => first.at.localeCompare(second.at));
    return serializeOrder({ ...result.order, events });
  }
}
