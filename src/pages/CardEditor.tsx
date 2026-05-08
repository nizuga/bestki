import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useDecksStore } from '@/store/useDecksStore';
import Button from '@/components/ui/Button';
import type { CardType, AnyCard } from '@/types';

// ── Type metadata ─────────────────────────────────────────────────────────────
const CARD_TYPES: { type: CardType; label: string; icon: string; desc: string }[] = [
  { type: 'flashcard', label: 'Flashcard', icon: '🃏', desc: 'Frente y reverso' },
  { type: 'multiple_choice', label: 'Opción múltiple', icon: '☑️', desc: 'Una o varias correctas' },
  { type: 'written', label: 'Respuesta escrita', icon: '✏️', desc: 'El usuario escribe' },
  { type: 'fill_blank', label: 'Llenar espacios', icon: '▭', desc: 'Texto con huecos ___' },
  { type: 'order_steps', label: 'Ordenar pasos', icon: '🔢', desc: 'Secuencia correcta' },
  { type: 'match_pairs', label: 'Emparejar', icon: '🔗', desc: 'Relacionar columnas' },
  { type: 'true_false', label: 'V / F', icon: '⚖️', desc: 'Con justificación' },
  { type: 'predict_output', label: 'Predecir salida', icon: '💻', desc: 'Código → resultado' },
];

// ── Content state (flat union of all type fields) ─────────────────────────────
interface ContentState {
  // flashcard
  back: string;
  // multiple_choice
  options: string[];
  correct: number[];
  multi_select: boolean;
  // written
  accepted_answers: string[];
  case_sensitive: boolean;
  flexible_order: boolean;
  // fill_blank
  template: string;
  fill_blanks: Array<{ position: number; answer: string }>;
  // order_steps
  steps: string[];
  // match_pairs
  left: string[];
  right: string[];
  // true_false
  tf_answer: boolean;
  justification: string;
  // predict_output
  code: string;
  language: string;
  expected_output: string;
  flexible_match: boolean;
}

const DEFAULT_CONTENT: ContentState = {
  back: '',
  options: ['', ''],
  correct: [],
  multi_select: false,
  accepted_answers: [''],
  case_sensitive: false,
  flexible_order: false,
  template: '',
  fill_blanks: [],
  steps: ['', ''],
  left: ['', ''],
  right: ['', ''],
  tf_answer: true,
  justification: '',
  code: '',
  language: 'javascript',
  expected_output: '',
  flexible_match: false,
};

// ── Helper: build content object from state ───────────────────────────────────
function buildContent(type: CardType, c: ContentState): unknown {
  switch (type) {
    case 'flashcard':
      return { back: c.back };
    case 'multiple_choice':
      return { options: c.options, correct: c.correct, multi_select: c.multi_select };
    case 'written':
      return {
        accepted_answers: c.accepted_answers,
        case_sensitive: c.case_sensitive,
        flexible_order: c.flexible_order,
      };
    case 'fill_blank':
      return { template: c.template, blanks: c.fill_blanks };
    case 'order_steps': {
      const validSteps = c.steps.filter((s) => s.trim());
      return { steps: validSteps, correct_order: validSteps.map((_, i) => i) };
    }
    case 'match_pairs':
      return { left: c.left, right: c.right };
    case 'true_false':
      return { answer: c.tf_answer, justification: c.justification };
    case 'predict_output':
      return {
        code: c.code,
        language: c.language,
        expected_output: c.expected_output,
        flexible_match: c.flexible_match,
      };
  }
}

// ── Helper: extract content state from existing card ─────────────────────────
function parseContent(card: AnyCard): Partial<ContentState> {
  const c = card.content as unknown as Record<string, unknown>;
  switch (card.type) {
    case 'flashcard':
      return { back: (c.back as string) ?? '' };
    case 'multiple_choice':
      return {
        options: (c.options as string[]) ?? [],
        correct: (c.correct as number[]) ?? [],
        multi_select: (c.multi_select as boolean) ?? false,
      };
    case 'written':
      return {
        accepted_answers: (c.accepted_answers as string[]) ?? [],
        case_sensitive: (c.case_sensitive as boolean) ?? false,
        flexible_order: (c.flexible_order as boolean) ?? false,
      };
    case 'fill_blank':
      return {
        template: (c.template as string) ?? '',
        fill_blanks: (c.blanks as ContentState['fill_blanks']) ?? [],
      };
    case 'order_steps':
      return { steps: (c.steps as string[]) ?? [] };
    case 'match_pairs':
      return { left: (c.left as string[]) ?? [], right: (c.right as string[]) ?? [] };
    case 'true_false':
      return {
        tf_answer: (c.answer as boolean) ?? true,
        justification: (c.justification as string) ?? '',
      };
    case 'predict_output':
      return {
        code: (c.code as string) ?? '',
        language: (c.language as string) ?? 'javascript',
        expected_output: (c.expected_output as string) ?? '',
        flexible_match: (c.flexible_match as boolean) ?? false,
      };
    default:
      return {};
  }
}

// ── Shared input classes ──────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';
const Toggle = ({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) => (
  <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-10 h-6 rounded-full transition-colors ${value ? 'bg-primary-500' : 'bg-gray-300 dark:bg-white/20'}`}
    >
      <span
        className={`block w-4 h-4 rounded-full bg-white mx-1 transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
    <span className="text-gray-600 dark:text-gray-300">{label}</span>
  </label>
);

// ── Dynamic list helper ───────────────────────────────────────────────────────
function ListInput({
  items,
  onChange,
  placeholder,
  min = 1,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  min?: number;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={inputCls}
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder ?? `Elemento ${i + 1}`}
          />
          {items.length > min && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-red-400 hover:text-red-600 px-1 text-lg"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="text-xs text-primary-500 hover:text-primary-700"
      >
        + Agregar
      </button>
    </div>
  );
}

// ── Content forms per type ────────────────────────────────────────────────────
function FlashcardForm({ c, set }: { c: ContentState; set: (p: Partial<ContentState>) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Respuesta (reverso)</label>
      <textarea
        rows={3}
        className={inputCls}
        value={c.back}
        onChange={(e) => set({ back: e.target.value })}
        placeholder="Escribe la respuesta…"
      />
    </div>
  );
}

function MultipleChoiceForm({
  c,
  set,
}: {
  c: ContentState;
  set: (p: Partial<ContentState>) => void;
}) {
  const toggleCorrect = (i: number) => {
    const next = c.correct.includes(i) ? c.correct.filter((x) => x !== i) : [...c.correct, i];
    set({ correct: next });
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">
          Opciones <span className="text-gray-400">(marca la(s) correcta(s))</span>
        </label>
        <div className="space-y-2">
          {c.options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => toggleCorrect(i)}
                className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${c.correct.includes(i) ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-white/20'}`}
              >
                {c.correct.includes(i) && <span className="text-[10px]">✓</span>}
              </button>
              <input
                className={inputCls}
                value={opt}
                onChange={(e) => {
                  const next = [...c.options];
                  next[i] = e.target.value;
                  set({ options: next });
                }}
                placeholder={`Opción ${i + 1}`}
              />
              {c.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const opts = c.options.filter((_, j) => j !== i);
                    const corr = c.correct.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x));
                    set({ options: opts, correct: corr });
                  }}
                  className="text-red-400 hover:text-red-600 px-1 text-lg"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ options: [...c.options, ''] })}
            className="text-xs text-primary-500 hover:text-primary-700"
          >
            + Agregar opción
          </button>
        </div>
      </div>
      <Toggle
        value={c.multi_select}
        onChange={(v) => set({ multi_select: v })}
        label="Permite múltiple selección"
      />
    </div>
  );
}

function WrittenForm({ c, set }: { c: ContentState; set: (p: Partial<ContentState>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Respuestas aceptadas</label>
        <ListInput
          items={c.accepted_answers}
          onChange={(v) => set({ accepted_answers: v })}
          placeholder="Respuesta válida…"
        />
      </div>
      <Toggle
        value={c.case_sensitive}
        onChange={(v) => set({ case_sensitive: v })}
        label="Distingue mayúsculas/minúsculas"
      />
      <Toggle
        value={c.flexible_order}
        onChange={(v) => set({ flexible_order: v })}
        label="Acepta orden flexible de palabras"
      />
    </div>
  );
}

function FillBlankForm({ c, set }: { c: ContentState; set: (p: Partial<ContentState>) => void }) {
  const handleTemplate = (tpl: string) => {
    const count = (tpl.match(/___/g) ?? []).length;
    const blanks: ContentState['fill_blanks'] = Array.from({ length: count }, (_, i) => ({
      position: i,
      answer: c.fill_blanks[i]?.answer ?? '',
    }));
    set({ template: tpl, fill_blanks: blanks });
  };
  const setBlankAnswer = (i: number, answer: string) => {
    const next = c.fill_blanks.map((b, j) => (j === i ? { ...b, answer } : b));
    set({ fill_blanks: next });
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Plantilla <span className="text-gray-400">(usa ___ para cada hueco)</span>
        </label>
        <textarea
          rows={3}
          className={inputCls}
          value={c.template}
          onChange={(e) => handleTemplate(e.target.value)}
          placeholder="Ej: El algoritmo ___ fue diseñado por ___"
        />
      </div>
      {c.fill_blanks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Respuestas para cada hueco</p>
          {c.fill_blanks.map((b, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-xs text-gray-400 w-16 flex-shrink-0">Hueco {i + 1}</span>
              <input
                className={inputCls}
                value={b.answer}
                onChange={(e) => setBlankAnswer(i, e.target.value)}
                placeholder="Respuesta correcta…"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderStepsForm({ c, set }: { c: ContentState; set: (p: Partial<ContentState>) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        Pasos <span className="text-gray-400">(en el orden correcto)</span>
      </label>
      <ListInput items={c.steps} onChange={(v) => set({ steps: v })} placeholder="Paso…" min={2} />
    </div>
  );
}

function MatchPairsForm({ c, set }: { c: ContentState; set: (p: Partial<ContentState>) => void }) {
  const addPair = () => set({ left: [...c.left, ''], right: [...c.right, ''] });
  const removePair = (i: number) =>
    set({ left: c.left.filter((_, j) => j !== i), right: c.right.filter((_, j) => j !== i) });
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Cada fila es un par. La columna A se empareja con la B del mismo índice.
      </p>
      {c.left.map((l, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className={inputCls}
            value={l}
            onChange={(e) => {
              const next = [...c.left];
              next[i] = e.target.value;
              set({ left: next });
            }}
            placeholder={`A${i + 1}`}
          />
          <span className="text-gray-400 flex-shrink-0">↔</span>
          <input
            className={inputCls}
            value={c.right[i] ?? ''}
            onChange={(e) => {
              const next = [...c.right];
              next[i] = e.target.value;
              set({ right: next });
            }}
            placeholder={`B${i + 1}`}
          />
          {c.left.length > 1 && (
            <button
              type="button"
              onClick={() => removePair(i)}
              className="text-red-400 hover:text-red-600 px-1 text-lg"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addPair}
        className="text-xs text-primary-500 hover:text-primary-700"
      >
        + Agregar par
      </button>
    </div>
  );
}

function TrueFalseForm({ c, set }: { c: ContentState; set: (p: Partial<ContentState>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Respuesta correcta</label>
        <div className="flex gap-3">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => set({ tf_answer: v })}
              className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${c.tf_answer === v ? (v ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600') : 'border-gray-200 dark:border-white/10 text-gray-500'}`}
            >
              {v ? 'Verdadero' : 'Falso'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Justificación <span className="text-gray-400">(opcional)</span>
        </label>
        <textarea
          rows={2}
          className={inputCls}
          value={c.justification}
          onChange={(e) => set({ justification: e.target.value })}
          placeholder="¿Por qué?"
        />
      </div>
    </div>
  );
}

function PredictOutputForm({
  c,
  set,
}: {
  c: ContentState;
  set: (p: Partial<ContentState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Lenguaje</label>
          <input
            className={inputCls}
            value={c.language}
            onChange={(e) => set({ language: e.target.value })}
            placeholder="javascript"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Código</label>
        <textarea
          rows={6}
          className={`${inputCls} font-mono text-xs`}
          value={c.code}
          onChange={(e) => set({ code: e.target.value })}
          placeholder="console.log('hello')"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Salida esperada</label>
        <textarea
          rows={2}
          className={`${inputCls} font-mono text-xs`}
          value={c.expected_output}
          onChange={(e) => set({ expected_output: e.target.value })}
          placeholder="hello"
        />
      </div>
      <Toggle
        value={c.flexible_match}
        onChange={(v) => set({ flexible_match: v })}
        label="Ignorar espacios/mayúsculas extra"
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CardEditor() {
  const { deckId, cardId } = useParams<{ deckId?: string; cardId?: string }>();
  const navigate = useNavigate();
  const { decks, fetchDecks } = useDecksStore();

  const isEdit = !!cardId;

  const [selectedDeckId, setSelectedDeckId] = useState(deckId ?? '');
  const [cardType, setCardType] = useState<CardType>('flashcard');
  const [question, setQuestion] = useState('');
  const [explanation, setExplanation] = useState('');
  const [content, setContentRaw] = useState<ContentState>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setContent = useCallback((patch: Partial<ContentState>) => {
    setContentRaw((prev) => ({ ...prev, ...patch }));
  }, []);

  // Fetch decks for selector
  useEffect(() => {
    if (decks.length === 0) fetchDecks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing card in edit mode
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data } = await supabase.from('cards').select('*').eq('id', cardId).single();
      if (data) {
        const card = data as AnyCard;
        setSelectedDeckId(card.deck_id);
        setCardType(card.type);
        setQuestion(card.question);
        setExplanation(card.explanation ?? '');
        setContentRaw((prev) => ({ ...prev, ...parseContent(card) }));
      }
      setLoading(false);
    })();
  }, [cardId, isEdit]);

  const validate = (): string | null => {
    if (!selectedDeckId) return 'Selecciona un mazo.';
    if (!question.trim()) return 'La pregunta no puede estar vacía.';
    if (cardType === 'flashcard' && !content.back.trim())
      return 'La respuesta no puede estar vacía.';
    if (cardType === 'multiple_choice' && content.correct.length === 0)
      return 'Marca al menos una opción correcta.';
    if (cardType === 'fill_blank' && !content.template.trim())
      return 'Escribe la plantilla con los huecos (___).';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      deck_id: selectedDeckId,
      type: cardType,
      question: question.trim(),
      explanation: explanation.trim() || null,
      content: buildContent(cardType, content),
    };

    if (isEdit) {
      const { error: e } = await supabase.from('cards').update(payload).eq('id', cardId!);
      if (e) {
        setError(e.message);
        setSaving(false);
        return;
      }
      navigate(-1);
    } else {
      const { error: e } = await supabase.from('cards').insert(payload);
      if (e) {
        setError(e.message);
        setSaving(false);
        return;
      }
      navigate(deckId ? `/decks` : (-1 as never));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <section className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
        >
          ← Volver
        </button>
        <h1 className="text-lg font-bold">{isEdit ? 'Editar tarjeta' : 'Nueva tarjeta'}</h1>
        <div className="w-12" />
      </div>

      {/* Deck selector (only when no deckId in URL) */}
      {!deckId && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Mazo</label>
          <select
            className={inputCls}
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
          >
            <option value="">Selecciona un mazo…</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.icon ?? ''} {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Type selector */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Tipo de tarjeta</label>
        <div className="grid grid-cols-2 gap-2">
          {CARD_TYPES.map(({ type, label, icon, desc }) => (
            <button
              key={type}
              type="button"
              onClick={() => setCardType(type)}
              className={`flex items-start gap-2 p-3 rounded-xl border-2 text-left transition-colors ${cardType === type ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-100 dark:border-white/10 hover:border-gray-300'}`}
            >
              <span className="text-xl">{icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{label}</p>
                <p className="text-[10px] text-gray-400 leading-tight">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Question */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Pregunta / Enunciado</label>
        <textarea
          rows={3}
          className={inputCls}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="¿Qué es la notación Big-O?"
        />
      </div>

      {/* Content form (type-specific) */}
      <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {CARD_TYPES.find((t) => t.type === cardType)?.label}
        </p>
        {cardType === 'flashcard' && <FlashcardForm c={content} set={setContent} />}
        {cardType === 'multiple_choice' && <MultipleChoiceForm c={content} set={setContent} />}
        {cardType === 'written' && <WrittenForm c={content} set={setContent} />}
        {cardType === 'fill_blank' && <FillBlankForm c={content} set={setContent} />}
        {cardType === 'order_steps' && <OrderStepsForm c={content} set={setContent} />}
        {cardType === 'match_pairs' && <MatchPairsForm c={content} set={setContent} />}
        {cardType === 'true_false' && <TrueFalseForm c={content} set={setContent} />}
        {cardType === 'predict_output' && <PredictOutputForm c={content} set={setContent} />}
      </div>

      {/* Explanation */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Explicación <span className="text-gray-400">(opcional, se muestra tras responder)</span>
        </label>
        <textarea
          rows={2}
          className={inputCls}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Contexto adicional o referencia…"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="flex-1">
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear tarjeta'}
        </Button>
      </div>
    </section>
  );
}
