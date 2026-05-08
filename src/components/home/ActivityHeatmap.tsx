import type { StreakDay } from '@/types';

interface Props {
  streakDays: StreakDay[];
  minCards: number;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function intensity(cards: number, minCards: number): number {
  if (cards === 0) return 0;
  if (cards < minCards) return 1; // studied but not enough
  if (cards < minCards * 2) return 2;
  if (cards < minCards * 3) return 3;
  return 4;
}

const LEVEL_CLASSES = [
  'bg-gray-100 dark:bg-white/5', // 0 — nothing
  'bg-primary-100 dark:bg-primary-900/40', // 1 — partial
  'bg-primary-300 dark:bg-primary-700', // 2 — met min
  'bg-primary-500 dark:bg-primary-500', // 3 — good
  'bg-primary-700 dark:bg-primary-400', // 4 — excellent
];

export default function ActivityHeatmap({ streakDays, minCards }: Props) {
  const DAYS = 91; // 13 weeks
  const today = new Date();

  // Build map date→cards
  const dayMap = new Map<string, number>();
  for (const d of streakDays) dayMap.set(d.date, d.cards_reviewed);

  // Build array of 91 days, oldest first
  const cells = Array.from({ length: DAYS }, (_, i) => {
    const date = subtractDays(today, DAYS - 1 - i);
    const dateStr = toDateStr(date);
    const cards = dayMap.get(dateStr) ?? 0;
    return { dateStr, cards, level: intensity(cards, minCards) };
  });

  // Pad so the first column starts on Monday
  const firstDayOfWeek = new Date(cells[0].dateStr).getDay(); // 0=Sun
  const padStart = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl p-5 shadow-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-3">
        Actividad — últimas 13 semanas
      </p>

      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: 'repeat(13, 1fr)', gridAutoRows: '1fr' }}
      >
        {/* Padding cells for alignment */}
        {Array.from({ length: padStart }).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}

        {cells.map(({ dateStr, cards, level }) => (
          <div
            key={dateStr}
            className={`aspect-square rounded-sm ${LEVEL_CLASSES[level]}`}
            title={cards > 0 ? `${dateStr}: ${cards} tarjetas` : dateStr}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-xs text-gray-400">Menos</span>
        {LEVEL_CLASSES.map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
        ))}
        <span className="text-xs text-gray-400">Más</span>
      </div>
    </div>
  );
}
