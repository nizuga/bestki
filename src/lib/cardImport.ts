import type { AnyCard, CardType } from '@/types';

export type ImportCard = Pick<AnyCard, 'type' | 'question' | 'content'> & {
  explanation?: string | null;
};

export interface ImportError {
  index: number;
  field: string;
  message: string;
}

export type ImportResult = { ok: true; cards: ImportCard[] } | { ok: false; errors: ImportError[] };

const CARD_TYPES: CardType[] = [
  'flashcard',
  'multiple_choice',
  'written',
  'fill_blank',
  'order_steps',
  'match_pairs',
  'true_false',
  'predict_output',
];

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isInteger(x));
}

function validateContent(
  type: CardType,
  content: unknown,
  index: number,
  errors: ImportError[],
): boolean {
  if (!isObj(content)) {
    errors.push({ index, field: 'content', message: 'debe ser un objeto' });
    return false;
  }

  const start = errors.length;

  switch (type) {
    case 'flashcard': {
      if (typeof content.back !== 'string' || !content.back.trim())
        errors.push({ index, field: 'content.back', message: 'requerido (string no vacío)' });
      break;
    }
    case 'multiple_choice': {
      if (!isStringArray(content.options) || content.options.length < 2)
        errors.push({
          index,
          field: 'content.options',
          message: 'mínimo 2 opciones (string[])',
        });
      if (!isNumberArray(content.correct) || content.correct.length === 0)
        errors.push({
          index,
          field: 'content.correct',
          message: 'requerido (number[] no vacío con índices)',
        });
      if (typeof content.multi_select !== 'boolean')
        errors.push({ index, field: 'content.multi_select', message: 'debe ser boolean' });
      if (
        isStringArray(content.options) &&
        isNumberArray(content.correct) &&
        content.correct.some((i) => i < 0 || i >= (content.options as string[]).length)
      )
        errors.push({
          index,
          field: 'content.correct',
          message: 'algún índice está fuera de rango',
        });
      break;
    }
    case 'written': {
      if (!isStringArray(content.accepted_answers) || content.accepted_answers.length === 0)
        errors.push({
          index,
          field: 'content.accepted_answers',
          message: 'mínimo 1 respuesta (string[])',
        });
      if (typeof content.case_sensitive !== 'boolean')
        errors.push({ index, field: 'content.case_sensitive', message: 'debe ser boolean' });
      if (typeof content.flexible_order !== 'boolean')
        errors.push({ index, field: 'content.flexible_order', message: 'debe ser boolean' });
      break;
    }
    case 'fill_blank': {
      if (typeof content.template !== 'string' || !content.template.trim())
        errors.push({ index, field: 'content.template', message: 'requerido (string no vacío)' });
      if (!Array.isArray(content.blanks) || content.blanks.length === 0) {
        errors.push({
          index,
          field: 'content.blanks',
          message: 'mínimo 1 ({ position, answer }[])',
        });
      } else {
        content.blanks.forEach((b, i) => {
          if (
            !isObj(b) ||
            typeof b.position !== 'number' ||
            typeof b.answer !== 'string' ||
            !b.answer.trim()
          )
            errors.push({
              index,
              field: `content.blanks[${i}]`,
              message: 'forma { position: number, answer: string }',
            });
        });
      }
      break;
    }
    case 'order_steps': {
      if (!isStringArray(content.steps) || content.steps.length < 2)
        errors.push({ index, field: 'content.steps', message: 'mínimo 2 pasos (string[])' });
      if (!isNumberArray(content.correct_order))
        errors.push({
          index,
          field: 'content.correct_order',
          message: 'requerido (number[] con permutación de índices)',
        });
      if (
        isStringArray(content.steps) &&
        isNumberArray(content.correct_order) &&
        content.correct_order.length !== content.steps.length
      )
        errors.push({
          index,
          field: 'content.correct_order',
          message: 'debe tener misma longitud que steps',
        });
      break;
    }
    case 'match_pairs': {
      if (!isStringArray(content.left) || content.left.length < 2)
        errors.push({ index, field: 'content.left', message: 'mínimo 2 (string[])' });
      if (!isStringArray(content.right))
        errors.push({ index, field: 'content.right', message: 'requerido (string[])' });
      if (
        isStringArray(content.left) &&
        isStringArray(content.right) &&
        content.left.length !== content.right.length
      )
        errors.push({
          index,
          field: 'content.right',
          message: 'debe tener misma longitud que left',
        });
      break;
    }
    case 'true_false': {
      if (typeof content.answer !== 'boolean')
        errors.push({ index, field: 'content.answer', message: 'debe ser boolean' });
      if (typeof content.justification !== 'string')
        errors.push({ index, field: 'content.justification', message: 'debe ser string' });
      break;
    }
    case 'predict_output': {
      if (typeof content.code !== 'string' || !content.code.trim())
        errors.push({ index, field: 'content.code', message: 'requerido (string no vacío)' });
      if (typeof content.language !== 'string' || !content.language.trim())
        errors.push({ index, field: 'content.language', message: 'requerido (string no vacío)' });
      if (typeof content.expected_output !== 'string')
        errors.push({ index, field: 'content.expected_output', message: 'debe ser string' });
      if (typeof content.flexible_match !== 'boolean')
        errors.push({ index, field: 'content.flexible_match', message: 'debe ser boolean' });
      break;
    }
  }

  return errors.length === start;
}

export function validateImportPayload(raw: unknown): ImportResult {
  const errors: ImportError[] = [];

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return {
        ok: false,
        errors: [{ index: -1, field: 'json', message: (e as Error).message }],
      };
    }
  }

  const cardsRaw = Array.isArray(parsed)
    ? parsed
    : isObj(parsed) && Array.isArray(parsed.cards)
      ? parsed.cards
      : null;

  if (!cardsRaw) {
    return {
      ok: false,
      errors: [
        {
          index: -1,
          field: 'root',
          message: 'esperado un array o un objeto con la propiedad "cards"',
        },
      ],
    };
  }

  if (cardsRaw.length === 0) {
    return { ok: false, errors: [{ index: -1, field: 'cards', message: 'array vacío' }] };
  }

  const cards: ImportCard[] = [];

  cardsRaw.forEach((item, index) => {
    if (!isObj(item)) {
      errors.push({ index, field: 'root', message: 'debe ser un objeto' });
      return;
    }

    const type = item.type;
    if (typeof type !== 'string' || !CARD_TYPES.includes(type as CardType)) {
      errors.push({
        index,
        field: 'type',
        message: `debe ser uno de: ${CARD_TYPES.join(', ')}`,
      });
      return;
    }

    if (typeof item.question !== 'string' || !item.question.trim()) {
      errors.push({ index, field: 'question', message: 'requerido (string no vacío)' });
    }

    const contentOk = validateContent(type as CardType, item.content, index, errors);

    if (
      item.explanation !== undefined &&
      item.explanation !== null &&
      typeof item.explanation !== 'string'
    ) {
      errors.push({ index, field: 'explanation', message: 'debe ser string o null' });
    }

    if (typeof item.question === 'string' && item.question.trim() && contentOk) {
      cards.push({
        type: type as CardType,
        question: item.question.trim(),
        content: item.content as ImportCard['content'],
        explanation:
          typeof item.explanation === 'string' && item.explanation.trim()
            ? item.explanation.trim()
            : null,
      });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, cards };
}
