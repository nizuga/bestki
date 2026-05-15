import { useState } from 'react';
import type { AnyCard } from '@/types';

interface RendererProps {
  card: AnyCard;
  submitted: boolean;
  onSubmit: (isCorrect?: boolean) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const verifyBtn =
  'w-full py-2.5 rounded-xl bg-primary-500 text-white font-semibold text-sm hover:bg-primary-600 disabled:opacity-40 transition-colors mt-2';

// ── Multiple Choice ───────────────────────────────────────────────────────────
function MultipleChoiceCard({ card, submitted, onSubmit }: RendererProps) {
  const { options, correct, multi_select } = card.content as unknown as {
    options: string[];
    correct: number[];
    multi_select: boolean;
  };
  const [selected, setSelected] = useState<number[]>([]);

  function toggle(i: number) {
    if (submitted) return;
    if (multi_select) {
      setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    } else {
      setSelected([i]);
    }
  }

  function colorFor(i: number) {
    if (!submitted) {
      return selected.includes(i)
        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
        : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20';
    }
    if (correct.includes(i)) return 'border-green-500 bg-green-50 dark:bg-green-900/20';
    if (selected.includes(i)) return 'border-red-400 bg-red-50 dark:bg-red-900/20';
    return 'border-gray-200 dark:border-white/10 opacity-50';
  }

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => toggle(i)}
          className={`w-full py-3 rounded-xl border-2 text-sm text-left px-4 transition-colors ${colorFor(i)}`}
        >
          <span className="font-medium text-gray-400 mr-2">{String.fromCharCode(65 + i)}.</span>
          {opt}
          {submitted && correct.includes(i) && (
            <span className="float-right text-green-500">✓</span>
          )}
          {submitted && !correct.includes(i) && selected.includes(i) && (
            <span className="float-right text-red-400">✗</span>
          )}
        </button>
      ))}
      {!submitted && (
        <button
          onClick={() => {
            const allCorrect =
              correct.every((i) => selected.includes(i)) &&
              selected.every((i) => correct.includes(i));
            onSubmit(allCorrect);
          }}
          disabled={selected.length === 0}
          className={verifyBtn}
        >
          Verificar
        </button>
      )}
    </div>
  );
}

// ── Written ───────────────────────────────────────────────────────────────────
function WrittenCard({ card, submitted, onSubmit }: RendererProps) {
  const { accepted_answers, case_sensitive, flexible_order } = card.content as unknown as {
    accepted_answers: string[];
    case_sensitive: boolean;
    flexible_order: boolean;
  };
  const [input, setInput] = useState('');

  function normalize(s: string) {
    let n = s.trim();
    if (!case_sensitive) n = n.toLowerCase();
    if (flexible_order) n = n.split(/\s+/).sort().join(' ');
    return n;
  }

  const isCorrect = submitted && accepted_answers.some((a) => normalize(a) === normalize(input));

  return (
    <div className="space-y-3">
      <textarea
        rows={3}
        className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={submitted}
        placeholder="Escribe tu respuesta…"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey && !submitted && input.trim())
            onSubmit(accepted_answers.some((a) => normalize(a) === normalize(input)));
        }}
      />
      {submitted && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30 text-red-800 dark:text-red-200'}`}
        >
          <p className="font-semibold mb-1">{isCorrect ? '✓ ¡Correcto!' : '✗ Incorrecto'}</p>
          <p className="text-xs opacity-80">Respuestas aceptadas: {accepted_answers.join(' · ')}</p>
        </div>
      )}
      {!submitted && (
        <button
          onClick={() => onSubmit(accepted_answers.some((a) => normalize(a) === normalize(input)))}
          disabled={!input.trim()}
          className={verifyBtn}
        >
          Verificar
        </button>
      )}
    </div>
  );
}

// ── Fill Blank ────────────────────────────────────────────────────────────────
function FillBlankCard({ card, submitted, onSubmit }: RendererProps) {
  const { template, blanks } = card.content as unknown as {
    template: string;
    blanks: Array<{ position: number; answer: string }>;
  };
  const parts = template.split('___');
  const [inputs, setInputs] = useState<string[]>(blanks.map(() => ''));

  function setInput(i: number, v: string) {
    setInputs((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function blankCorrect(i: number) {
    return inputs[i]?.trim().toLowerCase() === blanks[i]?.answer.trim().toLowerCase();
  }

  const allFilled = inputs.every((v) => v.trim());

  return (
    <div className="space-y-4">
      <p className="text-sm leading-loose">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < blanks.length && (
              <span className="inline-block align-middle mx-1">
                {submitted ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold border ${blankCorrect(i) ? 'bg-green-100 border-green-400 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-red-100 border-red-400 text-red-800 dark:bg-red-900/30 dark:text-red-200'}`}
                  >
                    {inputs[i] || '—'}
                    {!blankCorrect(i) && (
                      <span className="text-gray-400">→ {blanks[i].answer}</span>
                    )}
                  </span>
                ) : (
                  <input
                    className="border-b-2 border-primary-400 bg-transparent focus:outline-none text-sm px-1 w-24 text-center"
                    value={inputs[i] ?? ''}
                    onChange={(e) => setInput(i, e.target.value)}
                    placeholder={`hueco ${i + 1}`}
                  />
                )}
              </span>
            )}
          </span>
        ))}
      </p>
      {submitted && (
        <p
          className={`text-sm font-semibold ${blanks.every((_, i) => blankCorrect(i)) ? 'text-green-500' : 'text-red-400'}`}
        >
          {blanks.every((_, i) => blankCorrect(i))
            ? '✓ ¡Todo correcto!'
            : '✗ Revisa las correcciones marcadas'}
        </p>
      )}
      {!submitted && (
        <button
          onClick={() => onSubmit(blanks.every((_, i) => blankCorrect(i)))}
          disabled={!allFilled}
          className={verifyBtn}
        >
          Verificar
        </button>
      )}
    </div>
  );
}

// ── Order Steps ───────────────────────────────────────────────────────────────
function OrderStepsCard({ card, submitted, onSubmit }: RendererProps) {
  const { steps } = card.content as unknown as { steps: string[] };
  const [order, setOrder] = useState<number[]>(() => shuffle(steps.map((_, i) => i)));

  function moveUp(pos: number) {
    if (pos === 0) return;
    setOrder((o) => {
      const n = [...o];
      [n[pos - 1], n[pos]] = [n[pos], n[pos - 1]];
      return n;
    });
  }
  function moveDown(pos: number) {
    if (pos === order.length - 1) return;
    setOrder((o) => {
      const n = [...o];
      [n[pos], n[pos + 1]] = [n[pos + 1], n[pos]];
      return n;
    });
  }

  return (
    <div className="space-y-2">
      {order.map((stepIdx, pos) => {
        const isCorrect = submitted && stepIdx === pos;
        return (
          <div
            key={stepIdx}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
              submitted
                ? isCorrect
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                  : 'border-red-300 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${submitted ? (isCorrect ? 'bg-green-500 text-white' : 'bg-red-400 text-white') : 'bg-gray-100 dark:bg-white/10 text-gray-500'}`}
            >
              {pos + 1}
            </span>
            <span className="flex-1 text-sm">{steps[stepIdx]}</span>
            {!submitted && (
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(pos)}
                  disabled={pos === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveDown(pos)}
                  disabled={pos === order.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                >
                  ▼
                </button>
              </div>
            )}
            {submitted && !isCorrect && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">→ pos. {stepIdx + 1}</span>
            )}
          </div>
        );
      })}
      {!submitted && (
        <button
          onClick={() => onSubmit(order.every((stepIdx, pos) => stepIdx === pos))}
          className={verifyBtn}
        >
          Verificar orden
        </button>
      )}
    </div>
  );
}

// ── Match Pairs ───────────────────────────────────────────────────────────────
function MatchPairsCard({ card, submitted, onSubmit }: RendererProps) {
  const { left, right } = card.content as unknown as { left: string[]; right: string[] };
  // shuffledRight[i] = original index into `right`
  const [shuffledRight] = useState<number[]>(() => shuffle(right.map((_, i) => i)));
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  // matches[leftIdx] = shuffledRight index that was matched (null = unmatched)
  const [matches, setMatches] = useState<(number | null)[]>(left.map(() => null));

  function clickLeft(i: number) {
    if (submitted) return;
    setSelectedLeft((s) => (s === i ? null : i));
  }

  function clickRight(shuffledIdx: number) {
    if (submitted || selectedLeft === null) return;
    setMatches((m) => {
      const next = [...m];
      // unlink any left already pointing here
      const prev = next.findIndex((v) => v === shuffledIdx);
      if (prev !== -1) next[prev] = null;
      next[selectedLeft] = shuffledIdx;
      return next;
    });
    setSelectedLeft(null);
  }

  function isMatchCorrect(leftIdx: number) {
    const mIdx = matches[leftIdx];
    return mIdx !== null && shuffledRight[mIdx] === leftIdx;
  }

  const allMatched = matches.every((m) => m !== null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <p className="text-[10px] text-gray-400 text-center font-semibold uppercase tracking-wide">
            Columna A
          </p>
          {left.map((item, i) => (
            <button
              key={i}
              onClick={() => clickLeft(i)}
              className={`w-full py-2 px-3 rounded-lg border-2 text-xs text-left transition-colors ${
                submitted
                  ? matches[i] !== null
                    ? isMatchCorrect(i)
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                      : 'border-red-400 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-white/10 opacity-50'
                  : selectedLeft === i
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : matches[i] !== null
                      ? 'border-primary-300 bg-primary-50/50 dark:bg-primary-900/10'
                      : 'border-gray-200 dark:border-white/10 hover:border-gray-300'
              }`}
            >
              <span>{item}</span>
              {matches[i] !== null && !submitted && (
                <span className="block text-[10px] text-primary-400 truncate mt-0.5">
                  → {right[shuffledRight[matches[i]!]]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] text-gray-400 text-center font-semibold uppercase tracking-wide">
            Columna B
          </p>
          {shuffledRight.map((originalIdx, shuffledIdx) => (
            <button
              key={shuffledIdx}
              onClick={() => clickRight(shuffledIdx)}
              className={`w-full py-2 px-3 rounded-lg border-2 text-xs text-left transition-colors ${
                submitted
                  ? 'border-gray-200 dark:border-white/10 opacity-60'
                  : matches.includes(shuffledIdx)
                    ? 'border-primary-300 opacity-60'
                    : selectedLeft !== null
                      ? 'border-primary-400 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer'
                      : 'border-gray-200 dark:border-white/10'
              }`}
            >
              {right[originalIdx]}
            </button>
          ))}
        </div>
      </div>
      {!submitted && (
        <button
          onClick={() => onSubmit(left.every((_, i) => isMatchCorrect(i)))}
          disabled={!allMatched}
          className={verifyBtn}
        >
          Verificar
        </button>
      )}
      {submitted && (
        <div className="space-y-1 pt-1 border-t border-gray-100 dark:border-white/10">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
            Pares correctos
          </p>
          {left.map((l, i) => (
            <p key={i} className="text-xs text-gray-500">
              {l} ↔ {right[i]}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── True / False ──────────────────────────────────────────────────────────────
function TrueFalseCard({ card, submitted, onSubmit }: RendererProps) {
  const { answer, justification } = card.content as unknown as {
    answer: boolean;
    justification: string;
  };
  const [selected, setSelected] = useState<boolean | null>(null);

  function choose(v: boolean) {
    if (submitted) return;
    setSelected(v);
    onSubmit(v === answer);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {([true, false] as const).map((v) => {
          const isSelected = selected === v;
          const isCorrect = v === answer;
          let cls = 'py-4 rounded-2xl border-2 text-sm font-bold transition-colors w-full';
          if (!submitted) {
            cls += isSelected
              ? ' border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : ' border-gray-200 dark:border-white/10 hover:border-gray-300';
          } else if (isCorrect) {
            cls +=
              ' border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300';
          } else if (isSelected) {
            cls += ' border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600';
          } else {
            cls += ' border-gray-200 dark:border-white/10 opacity-40';
          }
          return (
            <button key={String(v)} onClick={() => choose(v)} className={cls}>
              {v ? '✓ Verdadero' : '✗ Falso'}
            </button>
          );
        })}
      </div>
      {submitted && justification && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {justification}
        </div>
      )}
    </div>
  );
}

// ── Predict Output ────────────────────────────────────────────────────────────
function PredictOutputCard({ card, submitted, onSubmit }: RendererProps) {
  const { code, language, expected_output, flexible_match } = card.content as unknown as {
    code: string;
    language: string;
    expected_output: string;
    flexible_match: boolean;
  };
  const [input, setInput] = useState('');

  function normalize(s: string) {
    return flexible_match ? s.trim().replace(/\s+/g, ' ').toLowerCase() : s.trim();
  }

  const isCorrect = submitted && normalize(input) === normalize(expected_output);

  return (
    <div className="space-y-3">
      <div className="bg-gray-900 dark:bg-black/50 rounded-xl p-4 overflow-x-auto">
        <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wide font-mono">
          {language}
        </p>
        <pre className="text-xs text-gray-100 font-mono whitespace-pre-wrap">{code}</pre>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1 font-medium">¿Cuál es la salida?</p>
        <textarea
          rows={3}
          className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitted}
          placeholder="Escribe la salida esperada…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey && !submitted && input.trim())
              onSubmit(normalize(input) === normalize(expected_output));
          }}
        />
      </div>
      {submitted && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30'}`}
        >
          <p
            className={`font-semibold mb-1 ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}
          >
            {isCorrect ? '✓ ¡Correcto!' : '✗ Incorrecto'}
          </p>
          <p className="text-xs text-gray-500">Salida correcta:</p>
          <pre className="text-xs font-mono mt-1 text-gray-700 dark:text-gray-300">
            {expected_output}
          </pre>
        </div>
      )}
      {!submitted && (
        <button
          onClick={() => onSubmit(normalize(input) === normalize(expected_output))}
          disabled={!input.trim()}
          className={verifyBtn}
        >
          Verificar
        </button>
      )}
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
export default function CardRenderer({ card, submitted, onSubmit }: RendererProps) {
  switch (card.type) {
    case 'multiple_choice':
      return <MultipleChoiceCard card={card} submitted={submitted} onSubmit={onSubmit} />;
    case 'written':
      return <WrittenCard card={card} submitted={submitted} onSubmit={onSubmit} />;
    case 'fill_blank':
      return <FillBlankCard card={card} submitted={submitted} onSubmit={onSubmit} />;
    case 'order_steps':
      return <OrderStepsCard card={card} submitted={submitted} onSubmit={onSubmit} />;
    case 'match_pairs':
      return <MatchPairsCard card={card} submitted={submitted} onSubmit={onSubmit} />;
    case 'true_false':
      return <TrueFalseCard card={card} submitted={submitted} onSubmit={onSubmit} />;
    case 'predict_output':
      return <PredictOutputCard card={card} submitted={submitted} onSubmit={onSubmit} />;
    default:
      return null;
  }
}
