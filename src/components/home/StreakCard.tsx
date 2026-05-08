interface Props {
  currentStreak: number;
  bestStreak: number;
  freezesLeft: number;
  minCards: number;
}

export default function StreakCard({ currentStreak, bestStreak, freezesLeft, minCards }: Props) {
  const daysToRecord = Math.max(0, bestStreak - currentStreak + 1);
  const isRecord = currentStreak > 0 && currentStreak >= bestStreak;

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl p-5 shadow-sm">
      {/* Main streak */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-1">
            Racha actual
          </p>
          <div className="flex items-center gap-2">
            <span className="text-5xl font-bold tabular-nums">{currentStreak}</span>
            <span className="text-3xl">{currentStreak > 0 ? '🔥' : '💤'}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {currentStreak === 1 ? '1 día' : `${currentStreak} días`} consecutivos
          </p>
        </div>

        {/* Shields */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Escudos</p>
          <div className="flex gap-1 justify-center">
            {Array.from({ length: 2 }).map((_, i) => (
              <span key={i} className={`text-xl ${i < freezesLeft ? 'opacity-100' : 'opacity-20'}`}>
                🛡️
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">{freezesLeft}/2 disponibles</p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 dark:border-white/10 my-4" />

      {/* Stats row */}
      <div className="flex justify-between text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Mejor racha</p>
          <p className="font-semibold">
            {bestStreak} {bestStreak === 1 ? 'día' : 'días'} 🏆
          </p>
        </div>

        <div className="text-right">
          {isRecord ? (
            <p className="text-primary-600 dark:text-primary-400 font-semibold text-sm">
              ¡Nuevo récord! 🎉
            </p>
          ) : (
            <>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Al récord le faltan</p>
              <p className="font-semibold">
                {daysToRecord} {daysToRecord === 1 ? 'día' : 'días'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Min cards reminder */}
      <p className="text-xs text-gray-400 mt-3 text-center">
        Estudia al menos {minCards} tarjetas para que el día cuente
      </p>
    </div>
  );
}
