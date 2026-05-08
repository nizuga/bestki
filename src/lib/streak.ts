import type { StreakDay, StreakFreeze } from '@/types';

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function buildQualifyingSet(
  streakDays: StreakDay[],
  freezes: StreakFreeze[],
  minCards: number,
): Set<string> {
  const set = new Set<string>();
  for (const day of streakDays) {
    if (day.cards_reviewed >= minCards) set.add(day.date);
  }
  for (const freeze of freezes) {
    set.add(freeze.used_at);
  }
  return set;
}

// Counts consecutive qualifying days going backwards from today.
// A day qualifies if cards_reviewed >= minCards OR it has a freeze.
export function calculateCurrentStreak(
  streakDays: StreakDay[],
  freezes: StreakFreeze[],
  minCards: number,
  today = new Date(),
): number {
  const qualifying = buildQualifyingSet(streakDays, freezes, minCards);

  let streak = 0;
  let cursor: Date;

  if (qualifying.has(toDateStr(today))) {
    streak = 1;
    cursor = subtractDays(today, 1);
  } else {
    cursor = subtractDays(today, 1);
  }

  while (qualifying.has(toDateStr(cursor))) {
    streak++;
    cursor = subtractDays(cursor, 1);
  }

  return streak;
}

export function calculateBestStreak(
  streakDays: StreakDay[],
  freezes: StreakFreeze[],
  minCards: number,
): number {
  const qualifying = buildQualifyingSet(streakDays, freezes, minCards);
  if (qualifying.size === 0) return 0;

  const sorted = [...qualifying].sort();
  let best = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00');
    const curr = new Date(sorted[i] + 'T12:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);

    if (diffDays === 1) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }

  return best;
}

export function availableFreezes(
  freezes: StreakFreeze[],
  maxPerMonth: number,
  month: string,
): number {
  const used = freezes.filter((f) => f.month === month).length;
  return Math.max(0, maxPerMonth - used);
}
