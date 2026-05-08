interface Props {
  question: string;
  answer: string;
  flipped: boolean;
  onFlip: () => void;
}

export default function FlashCard({ question, answer, flipped, onFlip }: Props) {
  return (
    <div
      className="relative w-full h-64 cursor-pointer select-none"
      style={{ perspective: '1200px' }}
      onClick={!flipped ? onFlip : undefined}
    >
      <div
        className="absolute inset-0 transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl bg-white dark:bg-white/5 shadow-md border border-gray-100 dark:border-white/10"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <p className="text-center text-lg font-medium leading-relaxed">{question}</p>
          <p className="absolute bottom-4 text-xs text-gray-400">Toca para voltear</p>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl bg-primary-50 dark:bg-primary-900/20 shadow-md border border-primary-100 dark:border-primary-800/30"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <p className="text-center text-lg leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}
