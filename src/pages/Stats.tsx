import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStreakStore } from '@/store/useStreakStore';
import type { Deck, AnyCard } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReviewRow {
  card_id: string;
  rating: number;
  reviewed_at: string;
}
interface DeckStat {
  deck: Deck;
  total: number;
  correct: number;
}
interface FailedCard {
  id: string;
  question: string;
  deckName: string;
  deckColor: string;
  failCount: number;
}
interface ActivityDay {
  date: string;
  count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(correct: number, total: number) {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

function last30Dates(): string[] {
  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return dates;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl p-4 text-center shadow-sm">
      <p className={`text-2xl font-bold ${accent ?? 'text-gray-800 dark:text-gray-100'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ActivityChart({ days }: { days: ActivityDay[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  const dates = last30Dates();

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Actividad — últimos 30 días
      </h2>
      <div className="flex items-end gap-[3px] h-20">
        {dates.map((date) => {
          const day = days.find((d) => d.date === date);
          const count = day?.count ?? 0;
          const heightPct = count === 0 ? 4 : Math.max(8, Math.round((count / max) * 100));
          return (
            <div
              key={date}
              className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative"
            >
              <div
                className={`w-full rounded-t transition-colors ${count === 0 ? 'bg-gray-100 dark:bg-white/10' : 'bg-primary-500'}`}
                style={{ height: `${heightPct}%` }}
              />
              {/* tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-gray-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap">
                  {count} tarjetas · {date.slice(5)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{dates[0].slice(5)}</span>
        <span>hoy</span>
      </div>
    </div>
  );
}

function DeckAccuracyList({ stats }: { stats: DeckStat[] }) {
  if (stats.length === 0) return <p className="text-sm text-gray-400">Sin datos aún.</p>;
  return (
    <ul className="space-y-3">
      {stats.map(({ deck, total, correct }) => {
        const p = pct(correct, total);
        return (
          <li key={deck.id}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium truncate max-w-[60%]">
                {deck.icon ?? '📚'} {deck.name}
              </span>
              <span className="text-xs text-gray-500">
                {p}% · {total} rev.
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${p}%`, backgroundColor: deck.color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FailedCardsList({ cards }: { cards: FailedCard[] }) {
  if (cards.length === 0) return <p className="text-sm text-gray-400">¡Sin fallos por ahora! 🎉</p>;
  return (
    <ol className="space-y-2">
      {cards.map((c, i) => (
        <li key={c.id} className="flex items-start gap-3">
          <span className="text-xs font-bold text-gray-400 w-5 pt-0.5 flex-shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{c.question}</p>
            <p className="text-[10px] text-gray-400">{c.deckName}</p>
          </div>
          <span className="text-xs font-semibold text-red-400 flex-shrink-0">{c.failCount}✕</span>
        </li>
      ))}
    </ol>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Stats() {
  const { currentStreak, bestStreak, fetchStreak, loading: streakLoading } = useStreakStore();

  const [loading, setLoading] = useState(true);
  const [totalReviews, setTotalReviews] = useState(0);
  const [overallPct, setOverallPct] = useState(0);
  const [deckStats, setDeckStats] = useState<DeckStat[]>([]);
  const [failedCards, setFailedCards] = useState<FailedCard[]>([]);
  const [activityDays, setActivityDays] = useState<ActivityDay[]>([]);

  async function loadStats() {
    const [{ data: reviewsData }, { data: cardsData }, { data: decksData }, { data: streakData }] =
      await Promise.all([
        supabase.from('reviews').select('card_id, rating, reviewed_at'),
        supabase.from('cards').select('id, deck_id, question'),
        supabase.from('decks').select('*'),
        supabase.from('streaks').select('date, cards_reviewed').order('date'),
      ]);

    const reviews = (reviewsData ?? []) as ReviewRow[];
    const cards = (cardsData ?? []) as Pick<AnyCard, 'id' | 'deck_id' | 'question'>[];
    const decks = (decksData ?? []) as Deck[];

    // ── Global metrics ──────────────────────────────────────────────────────
    const correct = reviews.filter((r) => r.rating >= 3).length;
    setTotalReviews(reviews.length);
    setOverallPct(pct(correct, reviews.length));

    // ── Activity (last 30 days from streaks table) ──────────────────────────
    const streakMap = new Map<string, number>();
    for (const s of streakData ?? []) {
      streakMap.set(s.date as string, s.cards_reviewed as number);
    }
    setActivityDays(last30Dates().map((date) => ({ date, count: streakMap.get(date) ?? 0 })));

    // ── Per-deck accuracy ───────────────────────────────────────────────────
    const cardMap = new Map(cards.map((c) => [c.id, c]));
    const deckMap = new Map(decks.map((d) => [d.id, d]));

    const deckTotals = new Map<string, { total: number; correct: number }>();
    for (const r of reviews) {
      const card = cardMap.get(r.card_id);
      if (!card) continue;
      const prev = deckTotals.get(card.deck_id) ?? { total: 0, correct: 0 };
      deckTotals.set(card.deck_id, {
        total: prev.total + 1,
        correct: prev.correct + (r.rating >= 3 ? 1 : 0),
      });
    }
    const dStats: DeckStat[] = [];
    for (const [deckId, counts] of deckTotals.entries()) {
      const deck = deckMap.get(deckId);
      if (deck) dStats.push({ deck, ...counts });
    }
    dStats.sort((a, b) => b.total - a.total);
    setDeckStats(dStats);

    // ── Top 10 failed cards ─────────────────────────────────────────────────
    const failMap = new Map<string, number>();
    for (const r of reviews) {
      if (r.rating < 3) failMap.set(r.card_id, (failMap.get(r.card_id) ?? 0) + 1);
    }
    const failed: FailedCard[] = [];
    for (const [cardId, count] of failMap.entries()) {
      const card = cardMap.get(cardId);
      if (!card) continue;
      const deck = deckMap.get(card.deck_id);
      failed.push({
        id: cardId,
        question: card.question,
        deckName: deck?.name ?? '—',
        deckColor: deck?.color ?? '#999',
        failCount: count,
      });
    }
    failed.sort((a, b) => b.failCount - a.failCount);
    setFailedCards(failed.slice(0, 10));

    setLoading(false);
  }

  useEffect(() => {
    void (async () => {
      await fetchStreak();
      await loadStats();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = loading || streakLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <section className="space-y-7 pb-6">
      <h1 className="text-2xl font-semibold">Estadísticas</h1>

      {/* Global metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Revisiones totales" value={totalReviews.toLocaleString()} />
        <MetricCard
          label="Acierto global"
          value={`${overallPct}%`}
          accent={
            overallPct >= 80
              ? 'text-green-500'
              : overallPct >= 50
                ? 'text-amber-500'
                : 'text-red-400'
          }
        />
        <MetricCard
          label="Racha actual"
          value={`🔥 ${currentStreak}`}
          sub="días consecutivos"
          accent="text-orange-500"
        />
        <MetricCard
          label="Mejor racha"
          value={`🏆 ${bestStreak}`}
          sub="días"
          accent="text-primary-500"
        />
      </div>

      {/* Activity chart */}
      <div className="bg-white dark:bg-white/5 rounded-2xl p-4 shadow-sm">
        <ActivityChart days={activityDays} />
      </div>

      {/* Per-deck accuracy */}
      <div className="bg-white dark:bg-white/5 rounded-2xl p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Precisión por mazo
        </h2>
        <DeckAccuracyList stats={deckStats} />
      </div>

      {/* Top failed cards */}
      <div className="bg-white dark:bg-white/5 rounded-2xl p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Top 10 tarjetas falladas
        </h2>
        <FailedCardsList cards={failedCards} />
      </div>
    </section>
  );
}
