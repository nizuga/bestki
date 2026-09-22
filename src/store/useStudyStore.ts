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
  error: string | null;

  startSession: (deckId?: string) => Promise<void>;
  flip: () => void;
  rate: (rating: CardRating) => Promise<void>;
  reset: () => void;
}

async function fetchDueCards(
  deckId?: string,
): Promise<{ cards: AnyCard[]; progress: Record<string, CardProgress> }> {
  // Hard upper bound to keep the in-memory session reasonable for very large
  // decks. The due-filter below trims further; this just prevents loading
  // tens of thousands of rows at once.
  const MAX_CARDS_FETCHED = 500;
  let query = supabase.from('cards').select('*').limit(MAX_CARDS_FETCHED);
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

  // Most overdue first; new cards (no progress) at the end.
  due.sort((a, b) => {
    const pa = progress[a.id]?.next_review ?? '9999-12-31';
    const pb = progress[b.id]?.next_review ?? '9999-12-31';
    return pa.localeCompare(pb);
  });

  return { cards: due, progress };
}

async function upsertStreak(cardsReviewed: number, sessionStart: number): Promise<string | null> {
  const today = todayStr();
  const minutes = Math.round((Date.now() - sessionStart) / 60_000);

  const { data: existing, error: readError } = await supabase
    .from('streaks')
    .select('cards_reviewed, minutes_studied')
    .eq('date', today)
    .maybeSingle();

  if (readError) return readError.message;

  const prev = existing as { cards_reviewed: number; minutes_studied: number } | null;

  const { error } = await supabase.from('streaks').upsert(
    {
      date: today,
      cards_reviewed: (prev?.cards_reviewed ?? 0) + cardsReviewed,
      minutes_studied: (prev?.minutes_studied ?? 0) + minutes,
    },
    { onConflict: 'date' },
  );

  return error?.message ?? null;
}

// Monotonic token: each startSession call bumps it. In-flight loads check on
// completion and bail if a newer session has started (StrictMode double-mount,
// or rapid deck switching).
let sessionToken = 0;

// Ratings persist in the background so a tap never waits on the network. The
// chain keeps them in order, so the streak upsert always lands after the card
// writes it accounts for.
let writeChain: Promise<void> = Promise.resolve();
function enqueueWrite(task: () => Promise<void>) {
  writeChain = writeChain.then(task).catch(() => {});
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
  error: null,

  startSession: async (deckId) => {
    const token = sessionToken + 1;
    sessionToken = token;
    set({
      phase: 'loading',
      reviewed: 0,
      correct: 0,
      retriedIds: [],
      sessionStart: Date.now(),
      error: null,
    });
    const { cards, progress } = await fetchDueCards(deckId);
    // Drop the result if a newer session has started in the meantime.
    if (token !== sessionToken) return;
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

    const willRequeue = rating < 3 && !retriedIds.includes(card.id);

    // Only advance SM-2 when this is the final attempt this session: skip on the
    // first failed attempt that will be re-queued so the second attempt doesn't
    // run SM-2 on top of an already-updated state.
    const newProgress = willRequeue ? existing : sm2(existing, rating);

    const newReviewed = reviewed + 1;
    const newCorrect = correct + (rating >= 3 ? 1 : 0);

    const newQueue = [...queue];
    const newRetriedIds = [...retriedIds];
    if (willRequeue) {
      newQueue.push(card);
      newRetriedIds.push(card.id);
    }

    const nextIndex = currentIndex + 1;
    const isDone = nextIndex >= newQueue.length;

    // Move the UI on synchronously: a tap must never wait on the network, and
    // leaving the card (flipped: false, index advanced) makes an extra tap a
    // no-op instead of a duplicate review.
    set({
      queue: newQueue,
      currentIndex: nextIndex,
      retriedIds: newRetriedIds,
      progress: willRequeue ? progress : { ...progress, [card.id]: newProgress },
      reviewed: newReviewed,
      correct: newCorrect,
      flipped: false,
      phase: isDone ? 'done' : 'studying',
    });

    // Persist afterwards, in order, surfacing the first failure to the user.
    const token = sessionToken;
    enqueueWrite(async () => {
      const errors: string[] = [];

      // Always log the review (history is faithful to every attempt).
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({ card_id: card.id, rating });
      if (reviewError) errors.push(reviewError.message);

      if (!willRequeue) {
        const { error: progressError } = await supabase.from('card_progress').upsert(newProgress);
        if (progressError) errors.push(progressError.message);
      }

      if (isDone) {
        const streakError = await upsertStreak(newReviewed, sessionStart);
        if (streakError) errors.push(streakError);
      }

      // Drop the report if the session was reset or restarted meanwhile.
      if (errors.length > 0 && token === sessionToken) set({ error: errors[0] });
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
      error: null,
    }),
}));
