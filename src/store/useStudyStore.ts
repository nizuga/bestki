import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { sm2 } from '@/lib/sm2';
import type { AnyCard, CardProgress, CardRating } from '@/types';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface StudyState {
  phase: 'idle' | 'loading' | 'studying' | 'done';
  queue: AnyCard[];
  currentIndex: number;
  retriedIds: string[]; // cards already re-queued once after failing
  progress: Record<string, CardProgress>;
  flipped: boolean;
  reviewed: number;
  correct: number;
  sessionStart: number;

  startSession: (deckId?: string) => Promise<void>;
  flip: () => void;
  rate: (rating: CardRating) => Promise<void>;
  reset: () => void;
}

async function fetchDueCards(
  deckId?: string,
): Promise<{ cards: AnyCard[]; progress: Record<string, CardProgress> }> {
  let query = supabase.from('cards').select('*');
  if (deckId) query = query.eq('deck_id', deckId);
  const { data: cardsData } = await query;
  const cards = (cardsData ?? []) as AnyCard[];

  if (cards.length === 0) return { cards: [], progress: {} };

  const { data: progressData } = await supabase
    .from('card_progress')
    .select('*')
    .in(
      'card_id',
      cards.map((c) => c.id),
    );

  const progress: Record<string, CardProgress> = {};
  for (const p of progressData ?? []) {
    const cp = p as CardProgress;
    progress[cp.card_id] = cp;
  }

  const today = todayStr();
  const due = cards.filter((card) => {
    const p = progress[card.id];
    if (!p) return true; // new card — always show
    if (p.status === 'suspended') return false;
    return p.next_review <= today;
  });

  return { cards: due, progress };
}

async function upsertStreak(cardsReviewed: number, sessionStart: number) {
  const today = todayStr();
  const minutes = Math.round((Date.now() - sessionStart) / 60_000);

  const { data: existing } = await supabase
    .from('streaks')
    .select('*')
    .eq('date', today)
    .maybeSingle();

  const prev = existing as { id: string; cards_reviewed: number; minutes_studied: number } | null;

  await supabase.from('streaks').upsert({
    id: prev?.id,
    date: today,
    cards_reviewed: (prev?.cards_reviewed ?? 0) + cardsReviewed,
    minutes_studied: (prev?.minutes_studied ?? 0) + minutes,
  });
}

export const useStudyStore = create<StudyState>((set, get) => ({
  phase: 'idle',
  queue: [],
  currentIndex: 0,
  retriedIds: [],
  progress: {},
  flipped: false,
  reviewed: 0,
  correct: 0,
  sessionStart: 0,

  startSession: async (deckId) => {
    set({ phase: 'loading', reviewed: 0, correct: 0, retriedIds: [], sessionStart: Date.now() });
    const { cards, progress } = await fetchDueCards(deckId);
    set({
      phase: cards.length === 0 ? 'done' : 'studying',
      queue: cards,
      currentIndex: 0,
      progress,
      flipped: false,
    });
  },

  flip: () => set({ flipped: true }),

  rate: async (rating) => {
    const { queue, currentIndex, progress, reviewed, correct, retriedIds, sessionStart } = get();
    const card = queue[currentIndex];
    if (!card) return;

    const existing: CardProgress = progress[card.id] ?? {
      card_id: card.id,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      next_review: todayStr(),
      status: 'new',
    };

    const newProgress = sm2(existing, rating);

    // Persist
    await supabase.from('card_progress').upsert({ ...newProgress });
    await supabase.from('reviews').insert({ card_id: card.id, rating });

    const newReviewed = reviewed + 1;
    const newCorrect = correct + (rating >= 3 ? 1 : 0);

    // Re-queue failed cards once per session
    const newQueue = [...queue];
    const newRetriedIds = [...retriedIds];
    if (rating < 3 && !retriedIds.includes(card.id)) {
      newQueue.push(card);
      newRetriedIds.push(card.id);
    }

    const nextIndex = currentIndex + 1;
    const isDone = nextIndex >= newQueue.length;

    if (isDone) {
      await upsertStreak(newReviewed, sessionStart);
    }

    set({
      queue: newQueue,
      currentIndex: nextIndex,
      retriedIds: newRetriedIds,
      progress: { ...progress, [card.id]: newProgress },
      reviewed: newReviewed,
      correct: newCorrect,
      flipped: false,
      phase: isDone ? 'done' : 'studying',
    });
  },

  reset: () =>
    set({
      phase: 'idle',
      queue: [],
      currentIndex: 0,
      retriedIds: [],
      progress: {},
      flipped: false,
      reviewed: 0,
      correct: 0,
      sessionStart: 0,
    }),
}));
