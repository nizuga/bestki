import { sm2 } from '@/lib/sm2';
import type { CardProgress, CardRating } from '@/types';

interface Props {
  progress: CardProgress | undefined;
  onRate: (rating: CardRating) => void;
  disabled?: boolean;
}

const RATINGS: { rating: CardRating; label: string; color: string; fixedSub?: string }[] = [
  {
    rating: 1,
    label: 'Fallé',
    color: 'border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
    fixedSub: '10 min',
  },
  {
    rating: 2,
    label: 'Difícil',
    color: 'border-orange-400 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20',
    fixedSub: '1 hora',
  },
  {
    rating: 3,
    label: 'Bien',
    color: 'border-green-400 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20',
  },
  {
    rating: 4,
    label: 'Fácil',
    color: 'border-blue-400 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
  },
];

function intervalLabel(days: number): string {
  if (days === 0) return 'hoy';
  if (days === 1) return '1 día';
  if (days < 30) return `${days} días`;
  const months = Math.round(days / 30);
  return months === 1 ? '1 mes' : `${months} meses`;
}

const DUMMY_PROGRESS: CardProgress = {
  card_id: '',
  ease_factor: 2.5,
  interval_days: 0,
  repetitions: 0,
  next_review: '',
  status: 'new',
};

export default function RatingButtons({ progress, onRate, disabled }: Props) {
  const base = progress ?? DUMMY_PROGRESS;

  return (
    <div className="space-y-2">
      <p className="text-xs text-center text-gray-400 mb-3">¿Cómo te fue?</p>
      <div className="grid grid-cols-4 gap-2">
        {RATINGS.map(({ rating, label, color, fixedSub }) => {
          const next = sm2(base, rating);
          const sub = fixedSub ?? intervalLabel(next.interval_days);
          return (
            <button
              key={rating}
              onClick={() => onRate(rating)}
              disabled={disabled}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 bg-white dark:bg-white/5 transition-colors disabled:opacity-40 ${color}`}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-[10px] opacity-70">{sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
