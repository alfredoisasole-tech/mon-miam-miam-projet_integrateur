export const RANKING_PERIODS = ['day', 'week', 'month'] as const;
export type RankingPeriod = (typeof RANKING_PERIODS)[number];

/** Kinshasa est à UTC+1 toute l'année, sans changement d'heure. */
const KINSHASA_OFFSET_MS = 60 * 60 * 1000;

export function isRankingPeriod(value: unknown): value is RankingPeriod {
  return typeof value === 'string' && (RANKING_PERIODS as readonly string[]).includes(value);
}

/** Début de la période en cours : minuit à Kinshasa, la semaine commençant le lundi. Résultat en UTC. */
export function periodStart(period: RankingPeriod, now: Date): Date {
  const local = new Date(now.getTime() + KINSHASA_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  let day = local.getUTCDate();
  if (period === 'week') day -= (local.getUTCDay() + 6) % 7;
  if (period === 'month') day = 1;
  return new Date(Date.UTC(year, month, day) - KINSHASA_OFFSET_MS);
}
