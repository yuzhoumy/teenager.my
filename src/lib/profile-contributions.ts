export type ContributionCell = {
  dateKey: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
};

export type ContributionActivityType = "upload" | "fork";

export type ContributionActivity = {
  id: string;
  type: ContributionActivityType;
  title: string;
  href: string;
  createdAt: string;
};

export type ContributionWeek = {
  weekStartKey: string;
  cells: ContributionCell[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getSunday(date: Date): Date {
  const sunday = new Date(date);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  return sunday;
}

function getLevelFromCount(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) {
    return 0;
  }
  if (count === 1) {
    return 1;
  }
  if (count <= 3) {
    return 2;
  }
  if (count <= 5) {
    return 3;
  }
  return 4;
}

export function buildContributionWeeks(activity: ContributionActivity[], lookbackDays = 365): ContributionWeek[] {
  const today = toUtcDate(new Date());
  const endSunday = getSunday(today);
  const startDate = new Date(today.getTime() - (lookbackDays - 1) * DAY_MS);
  const startSunday = getSunday(startDate);

  const counts = new Map<string, number>();
  for (const item of activity) {
    const parsed = new Date(item.createdAt);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }
    const key = toDateKey(toUtcDate(parsed));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const weeks: ContributionWeek[] = [];
  for (let cursor = new Date(startSunday); cursor <= endSunday; cursor = new Date(cursor.getTime() + 7 * DAY_MS)) {
    const cells: ContributionCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const cellDate = new Date(cursor.getTime() + day * DAY_MS);
      const dateKey = toDateKey(cellDate);
      const count = counts.get(dateKey) ?? 0;
      const isFuture = cellDate > today;
      cells.push({
        dateKey,
        count,
        level: isFuture ? 0 : getLevelFromCount(count),
        isFuture,
      });
    }
    weeks.push({ weekStartKey: toDateKey(cursor), cells });
  }

  return weeks;
}

export function getContributionTotal(activityDates: string[], lookbackDays = 365): number {
  const cutoff = toUtcDate(new Date(Date.now() - (lookbackDays - 1) * DAY_MS));
  return activityDates.reduce((total, activityDate) => {
    const parsed = new Date(activityDate);
    if (Number.isNaN(parsed.getTime())) {
      return total;
    }
    return toUtcDate(parsed) >= cutoff ? total + 1 : total;
  }, 0);
}

export function getContributionActivityByDate(
  activity: ContributionActivity[],
  lookbackDays = 365,
): Map<string, ContributionActivity[]> {
  const cutoff = toUtcDate(new Date(Date.now() - (lookbackDays - 1) * DAY_MS));
  const grouped = new Map<string, ContributionActivity[]>();

  for (const item of activity) {
    const parsed = new Date(item.createdAt);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }
    const utcDate = toUtcDate(parsed);
    if (utcDate < cutoff) {
      continue;
    }
    const dateKey = toDateKey(utcDate);
    const bucket = grouped.get(dateKey) ?? [];
    bucket.push(item);
    grouped.set(dateKey, bucket);
  }

  for (const [key, bucket] of grouped.entries()) {
    grouped.set(
      key,
      [...bucket].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    );
  }

  return grouped;
}
