import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStreakStore } from '@/store/useStreakStore';
import { useDecksStore } from '@/store/useDecksStore';
import StreakCard from '@/components/home/StreakCard';
import ActivityHeatmap from '@/components/home/ActivityHeatmap';
import Button from '@/components/ui/Button';

export default function Home() {
  const {
    currentStreak,
    bestStreak,
    freezesLeft,
    minCards,
    streakDays,
    loading: streakLoading,
    fetchStreak,
  } = useStreakStore();
  const { decks, loading: decksLoading, fetchDecks } = useDecksStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchStreak();
    fetchDecks();
  }, [fetchStreak, fetchDecks]);

  const loading = streakLoading || decksLoading;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bestki</h1>
        {!loading && decks.length > 0 && (
          <Button onClick={() => navigate('/study')} size="sm">
            Estudiar todo
          </Button>
        )}
      </div>

      {/* Streak */}
      {loading ? (
        <div className="h-44 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
      ) : (
        <StreakCard
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          freezesLeft={freezesLeft}
          minCards={minCards}
        />
      )}

      {/* Decks with pending */}
      {!loading && decks.length > 0 && (
        <div className="bg-white dark:bg-white/5 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-3">
            Tus mazos
          </p>
          <ul className="space-y-2">
            {decks.map((deck) => (
              <li key={deck.id}>
                <button
                  onClick={() => navigate(`/study?deck=${deck.id}`)}
                  className="w-full flex items-center gap-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                >
                  <span
                    className="w-2 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: deck.color }}
                  />
                  <span className="text-lg">{deck.icon ?? '📚'}</span>
                  <span className="flex-1 font-medium text-sm truncate">{deck.name}</span>
                  <span className="text-xs text-gray-400">Estudiar →</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {!loading && decks.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <p className="text-4xl mb-3">🌱</p>
          <p className="font-medium">Empieza creando un mazo</p>
          <Button onClick={() => navigate('/decks')} className="mt-4" size="sm">
            Ir a Mazos
          </Button>
        </div>
      )}

      {/* Heatmap */}
      {loading ? (
        <div className="h-36 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
      ) : (
        <ActivityHeatmap streakDays={streakDays} minCards={minCards} />
      )}
    </section>
  );
}
