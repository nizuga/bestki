import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStudyStore } from '@/store/useStudyStore';
import FlashCard from '@/components/cards/FlashCard';
import CardRenderer from '@/components/study/CardRenderer';
import ProgressBar from '@/components/study/ProgressBar';
import RatingButtons from '@/components/study/RatingButtons';
import Button from '@/components/ui/Button';
import type { CardRating } from '@/types';

export default function Study() {
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get('deck') ?? undefined;
  const navigate = useNavigate();

  const {
    phase,
    queue,
    currentIndex,
    progress,
    flipped,
    reviewed,
    correct,
    startSession,
    flip,
    rate,
    reset,
  } = useStudyStore();

  const [suggestion, setSuggestion] = useState<{ index: number; rating: CardRating } | null>(null);
  const suggestedRating = suggestion?.index === currentIndex ? suggestion.rating : undefined;

  useEffect(() => {
    startSession(deckId);
    return () => {
      reset();
    };
  }, [deckId]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = queue[currentIndex];
  const totalInSession = queue.length;
  const cardProgress = card ? progress[card.id] : undefined;

  function handleSubmit(isCorrect?: boolean) {
    if (isCorrect !== undefined) setSuggestion({ index: currentIndex, rating: isCorrect ? 4 : 1 });
    flip();
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-400">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p>Cargando tarjetas…</p>
      </div>
    );
  }

  // ── Done / Summary ───────────────────────────────────────────────────────
  if (phase === 'done') {
    const pct = reviewed === 0 ? 0 : Math.round((correct / reviewed) * 100);
    const emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';

    return (
      <section className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
        <p className="text-6xl">{emoji}</p>
        <div>
          <h2 className="text-2xl font-bold mb-1">¡Sesión completada!</h2>
          {reviewed === 0 ? (
            <p className="text-gray-500">No había tarjetas pendientes por ahora.</p>
          ) : (
            <p className="text-gray-500">
              {correct} de {reviewed} correctas — {pct}% de acierto
            </p>
          )}
        </div>

        {reviewed > 0 && (
          <div className="flex gap-8 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{correct}</p>
              <p className="text-gray-400">Correctas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{reviewed - correct}</p>
              <p className="text-gray-400">Falladas</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 w-full max-w-xs">
          <Button variant="ghost" onClick={() => navigate('/')} className="flex-1">
            Inicio
          </Button>
          <Button onClick={() => startSession(deckId)} className="flex-1">
            Otra vez
          </Button>
        </div>
      </section>
    );
  }

  // ── No card (shouldn't happen, but guard) ────────────────────────────────
  if (!card) return null;

  const isFlashcard = card.type === 'flashcard';

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
        >
          ← Salir
        </button>
        <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-1 rounded-full font-medium">
          {card.type.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Progress */}
      <ProgressBar current={currentIndex} total={totalInSession} />

      {/* Question */}
      {!isFlashcard && (
        <div className="bg-white dark:bg-white/5 rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{card.question}</p>
        </div>
      )}

      {/* Card — flashcard uses flip UI; other types use interactive renderer */}
      {isFlashcard ? (
        <FlashCard
          question={card.question}
          answer={(card.content as { back: string }).back}
          flipped={flipped}
          onFlip={handleSubmit}
        />
      ) : (
        <div className="bg-white dark:bg-white/5 rounded-2xl p-4 shadow-sm">
          <CardRenderer card={card} submitted={flipped} onSubmit={handleSubmit} />
        </div>
      )}

      {/* Explanation (shown after answering) */}
      {flipped && card.explanation && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          💡 {card.explanation}
        </div>
      )}

      {/* Rating buttons — only after answering */}
      {flipped ? (
        <RatingButtons
          progress={cardProgress}
          suggested={suggestedRating}
          onRate={(r: CardRating) => rate(r)}
        />
      ) : (
        <div className="h-[104px]" />
      )}
    </section>
  );
}
