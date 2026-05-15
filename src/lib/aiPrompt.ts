const TYPES_BLOCK = `type CardType =
  | 'flashcard'
  | 'multiple_choice'
  | 'written'
  | 'fill_blank'
  | 'order_steps'
  | 'match_pairs'
  | 'true_false'
  | 'predict_output';

type CardContentByType = {
  flashcard:        { back: string };
  multiple_choice:  { options: string[]; correct: number[]; multi_select: boolean };
  written:          { accepted_answers: string[]; case_sensitive: boolean; flexible_order: boolean };
  fill_blank:       { template: string; blanks: Array<{ position: number; answer: string }> };
  order_steps:      { steps: string[]; correct_order: number[] };
  match_pairs:      { left: string[]; right: string[] };
  true_false:       { answer: boolean; justification: string };
  predict_output:   { code: string; language: string; expected_output: string; flexible_match: boolean };
};

type ImportCard = {
  type: CardType;
  question: string;
  content: CardContentByType[CardType];
  explanation?: string;
};`;

const EXAMPLES = `{
  "cards": [
    {
      "type": "flashcard",
      "question": "¿Qué es la fotosíntesis?",
      "content": { "back": "Proceso por el cual las plantas convierten luz solar en energía química." },
      "explanation": "Ocurre principalmente en los cloroplastos."
    },
    {
      "type": "multiple_choice",
      "question": "¿Cuáles son gases nobles?",
      "content": {
        "options": ["Helio", "Oxígeno", "Argón", "Cloro"],
        "correct": [0, 2],
        "multi_select": true
      }
    },
    {
      "type": "written",
      "question": "¿Cuál es la capital de Francia?",
      "content": {
        "accepted_answers": ["París", "Paris"],
        "case_sensitive": false,
        "flexible_order": false
      }
    },
    {
      "type": "fill_blank",
      "question": "Completa la fórmula del agua",
      "content": {
        "template": "H_2_O",
        "blanks": [{ "position": 0, "answer": "2" }]
      }
    },
    {
      "type": "order_steps",
      "question": "Ordena el ciclo del agua",
      "content": {
        "steps": ["Evaporación", "Condensación", "Precipitación", "Recolección"],
        "correct_order": [0, 1, 2, 3]
      }
    },
    {
      "type": "match_pairs",
      "question": "Empareja país con su capital",
      "content": {
        "left": ["Francia", "Japón", "Brasil"],
        "right": ["París", "Tokio", "Brasilia"]
      }
    },
    {
      "type": "true_false",
      "question": "El Sol es una estrella.",
      "content": {
        "answer": true,
        "justification": "El Sol es una estrella de tipo G de la secuencia principal."
      }
    },
    {
      "type": "predict_output",
      "question": "¿Qué imprime este código?",
      "content": {
        "code": "console.log([1,2,3].map(x => x*2))",
        "language": "javascript",
        "expected_output": "[2, 4, 6]",
        "flexible_match": true
      }
    }
  ]
}`;

export function buildAIPrompt(deckTopic?: string): string {
  const topic = deckTopic?.trim()
    ? `sobre **${deckTopic.trim()}**`
    : 'sobre un tema que elegiré yo';

  return `Eres un generador de tarjetas de estudio para una app de repetición espaciada (tipo Anki). Genera un set de tarjetas ${topic}, mezclando varios tipos de los disponibles.

## Tipos soportados (TypeScript)

\`\`\`ts
${TYPES_BLOCK}
\`\`\`

## Reglas

1. Responde **únicamente** con un bloque \`\`\`json válido, sin texto antes ni después.
2. La raíz es un objeto \`{ "cards": ImportCard[] }\`.
3. No incluyas \`id\`, \`deck_id\`, \`created_at\` ni \`updated_at\` — los asigna la app.
4. \`question\` siempre es obligatorio y no vacío.
5. Mezcla tipos: idealmente al menos 4 tipos distintos en cada lote.
6. Para \`multiple_choice.correct\` usa **índices** de \`options\` (empezando en 0).
7. Para \`order_steps.correct_order\` debe ser una permutación de índices con la misma longitud que \`steps\`.
8. Para \`match_pairs\`, \`left[i]\` empareja con \`right[i]\` (misma longitud).
9. \`explanation\` es opcional pero útil — añádela cuando aporte contexto.
10. Genera entre 10 y 20 tarjetas a menos que se indique otro número.

## Ejemplo de salida válida

\`\`\`json
${EXAMPLES}
\`\`\`

Ahora genera las tarjetas ${topic}.`;
}
