import type { CardProgress, CardRating } from '@/types';

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
}

export function sm2(
  card: CardProgress,
  rating: CardRating,
  maxIntervalDays = 180,
  now = new Date(),
): CardProgress {
  const q = rating - 1; // normalize to 0–3

  let { ease_factor, interval_days, repetitions } = card;

  if (q < 2) {
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) interval_days = q === 3 ? 4 : 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);

    repetitions += 1;
  }

  ease_factor = Math.max(1.3, ease_factor + 0.1 - (3 - q) * (0.08 + (3 - q) * 0.02));

  interval_days = Math.min(interval_days, maxIntervalDays);

  const next_review = addDays(now, interval_days);
  const status = repetitions === 0 ? 'learning' : interval_days > 21 ? 'review' : 'learning';

  return { ...card, ease_factor, interval_days, repetitions, next_review, status } as CardProgress;
}
