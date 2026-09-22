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

/** Sort key: [tier, timestamp]. Lower tier studies first. */
function dueKey(p: CardProgress | undefined): [number, string] {
  if (!p) return [2, '']; // new cards go last
  if (p.relearn_at) return [0, p.relearn_at];
  return [1, p.next_review];
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
  const nowIso = new Date().toISOString();
  const due = cards.filter((card) => {
    const p = progress[card.id];
    if (!p) return true; // new card — always show
    if (p.status === 'suspended') return false;
    // A card in a relearning step waits for that step, not for the day.
    if (p.relearn_at) return p.relearn_at <= nowIso;
    return p.next_review <= today;
  });

  // Relearning cards first (oldest step first), then most overdue, then new.
  due.sort((a, b) => {
    const [ta, ka] = dueKey(progress[a.id]);
    const [tb, kb] = dueKey(progress[b.id]);
    return ta !== tb ? ta - tb : ka.localeCompare(kb);
  });

  return { cards: due, progress };
}

async function upsertStreak(cardsReviewed: number, sessionStart: number): Promise<string | null> {
  const today = todayStr();
  const minutes = Math.round((Date.now() - sessionStart) / 60_000);

  const { data: existing, error: readError } = await supabase
    .from('streaks')
    .select('*')
    .eq('date', today)
    .maybeSingle();

  if (readError) return readError.message;

  const prev = existing as { id: string; cards_reviewed: number; minutes_studied: number } | null;

  const { error } = await supabase.from('streaks').upsert({
    id: prev?.id,
    date: today,
    cards_reviewed: (prev?.cards_reviewed ?? 0) + cardsReviewed,
    minutes_studied: (prev?.minutes_studied ?? 0) + minutes,
  });

  return error?.message ?? null;
}

// Las calificaciones se persisten en segundo plano para que un toque nunca espere
// a la red. La cadena las mantiene en orden, de modo que el upsert de la racha
// siempre cae despues de las escrituras de tarjeta que contabiliza.
let writeChain: Promise<void> = Promise.resolve();
function enqueueWrite(task: () => Promise<void>) {
  writeChain = writeChain.then(task).catch(() => {});
}

// Cada startSession lo incrementa: un reporte de error de una sesion vieja se
// descarta en lugar de aparecer sobre la nueva.
let sessionToken = 0;

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
    sessionToken += 1;
    set({
      phase: 'loading',
      reviewed: 0,
      correct: 0,
      retriedIds: [],
      sessionStart: Date.now(),
      error: null,
    });
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
      relearn_at: null,
      status: 'new',
    };

    // The card gets an immediate second chance inside the session, so only run
    // SM-2 on the final attempt — otherwise the retry would apply the ease
    // penalty twice and overwrite the relearning step it just set.
    const willRequeue = rating < 3 && !retriedIds.includes(card.id);
    const newProgress = willRequeue ? existing : sm2(existing, rating);

    const newReviewed = reviewed + 1;
    const newCorrect = correct + (rating >= 3 ? 1 : 0);

    // Re-queue failed cards once per session
    const newQueue = [...queue];
    const newRetriedIds = [...retriedIds];
    if (willRequeue) {
      newQueue.push(card);
      newRetriedIds.push(card.id);
    }

    const nextIndex = currentIndex + 1;
    const isDone = nextIndex >= newQueue.length;

    // Mover la UI de forma sincrona: el toque no debe esperar a la red, y al
    // salir de la tarjeta (flipped: false, indice avanzado) un toque de mas es
    // un no-op en vez de una review duplicada.
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

    // Persistir despues, en orden, avisando del primer fallo.
    const token = sessionToken;
    enqueueWrite(async () => {
      const errors: string[] = [];

      if (!willRequeue) {
        const { error: progressError } = await supabase
          .from('card_progress')
          .upsert({ ...newProgress });
        if (progressError) errors.push(progressError.message);
      }

      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({ card_id: card.id, rating });
      if (reviewError) errors.push(reviewError.message);

      if (isDone) {
        const streakError = await upsertStreak(newReviewed, sessionStart);
        if (streakError) errors.push(streakError);
      }

      // Descartar el reporte si la sesion se reinicio mientras tanto.
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
