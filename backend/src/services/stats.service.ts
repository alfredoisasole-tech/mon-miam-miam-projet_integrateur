import {
  ORDER_STATUSES,
  type DateRange,
  type StatsRepository,
} from '../repositories/stats.repo.ts';

export type StatsPeriod = 'day' | 'week' | 'month';

const TIME_ZONE = 'Africa/Kinshasa';
const KINSHASA_OFFSET_MINUTES = 60;
const WEEKDAY_LABELS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

export interface StatsOverview {
  period: StatsPeriod;
  from: string;
  to: string;
  orders: {
    total: number;
    completed: number;
    active: number;
    cancelled: number;
    byStatus: Record<(typeof ORDER_STATUSES)[number], number>;
  };
  salesFc: number;
  averageOrderFc: number;
  topItems: Array<{ name: string; quantity: number; revenueFc: number }>;
  /** Utilisation du programme de fidélité : points de la période, membres au total. */
  loyalty: { members: number; pointsEarned: number; pointsRedeemed: number };
  /** Parrainages récompensés pendant la période et filleuls qui n'ont pas encore commandé. */
  referrals: { rewarded: number; pointsGranted: number; pending: number };
}

export interface WeeklyStats {
  from: string;
  to: string;
  totalSalesFc: number;
  ordersCompleted: number;
  days: Array<{ date: string; label: string; salesFc: number; orders: number }>;
}

export interface StatsService {
  overview(restaurantId: string, period: StatsPeriod): StatsOverview;
  weekly(restaurantId: string): WeeklyStats;
}

function kinshasaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values['year']}-${values['month']}-${values['day']}`;
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Kinshasa reste en UTC+1 ; convertit une date de calendrier locale en instant UTC. */
function localMidnight(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day) - KINSHASA_OFFSET_MINUTES * 60_000);
}

function weekStartKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return shiftDateKey(dateKey, -((weekday + 6) % 7));
}

function periodRange(period: StatsPeriod, now: Date): DateRange {
  const today = kinshasaDateKey(now);
  const fromDate = period === 'day'
    ? today
    : period === 'week'
      ? weekStartKey(today)
      : `${today.slice(0, 7)}-01`;
  return { from: localMidnight(fromDate).toISOString(), to: now.toISOString() };
}

function mondayFirstDates(now: Date): string[] {
  const monday = weekStartKey(kinshasaDateKey(now));
  return WEEKDAY_LABELS.map((_label, index) => shiftDateKey(monday, index));
}

export function createStatsService(repository: StatsRepository, now: () => Date = () => new Date()): StatsService {
  return {
    overview(restaurantId, period) {
      const range = periodRange(period, now());
      const byStatus = repository.ordersByStatus(restaurantId, range);
      const totals = repository.completedTotals(restaurantId, range);
      const active = byStatus.pending + byStatus.confirmed + byStatus.preparing
        + byStatus.ready + byStatus.out_for_delivery;
      return {
        period,
        ...range,
        orders: {
          total: ORDER_STATUSES.reduce((sum, status) => sum + byStatus[status], 0),
          completed: byStatus.completed,
          active,
          cancelled: byStatus.cancelled,
          byStatus,
        },
        salesFc: totals.salesFc,
        averageOrderFc: totals.orders > 0 ? Math.floor(totals.salesFc / totals.orders) : 0,
        topItems: repository.topItems(restaurantId, range, 5),
        loyalty: { members: repository.memberCount(restaurantId), ...repository.loyaltyTotals(restaurantId, range) },
        referrals: { ...repository.referralTotals(restaurantId, range), pending: repository.pendingReferees(restaurantId) },
      };
    },

    weekly(restaurantId) {
      const nowInstant = now();
      const dates = mondayFirstDates(nowInstant);
      const from = localMidnight(dates[0]!).toISOString();
      const to = localMidnight(shiftDateKey(dates[6]!, 1)).toISOString();
      const completed = repository.completedOrders(restaurantId, { from, to: nowInstant.toISOString() });
      const byDate = new Map(dates.map((date) => [date, { salesFc: 0, orders: 0 }]));
      for (const order of completed) {
        const date = kinshasaDateKey(new Date(order.completedAt));
        const bucket = byDate.get(date);
        if (bucket) {
          bucket.salesFc += order.totalFc;
          bucket.orders += 1;
        }
      }
      return {
        from,
        to,
        totalSalesFc: completed.reduce((sum, order) => sum + order.totalFc, 0),
        ordersCompleted: completed.length,
        days: dates.map((date, index) => ({ date, label: WEEKDAY_LABELS[index]!, ...byDate.get(date)! })),
      };
    },
  };
}
