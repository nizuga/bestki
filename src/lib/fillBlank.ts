/**
 * Parsing de plantillas de `fill_blank`.
 *
 * Se aceptan tres formas de marcar un hueco, porque los lotes generados por IA
 * mezclan convenciones:
 *   - `___`      → guiones bajos consecutivos (2 o más)
 *   - `{{algo}}` → llaves dobles
 *   - `_Madrid_` → la respuesta envuelta en guiones bajos simples (estilo markdown)
 *
 * La última forma lleva la respuesta escrita dentro del template, así que hay que
 * ocultarla al mostrar la tarjeta: de lo contrario el hueco se resuelve solo.
 */

export type TemplateToken = { text: string } | { blank: true; index: number };

const MARKER_RE = /_{2,}|\{\{[^}]*\}\}|_[^_\n]+_/g;

/**
 * Divide la plantilla en texto literal y huecos, en orden de aparición.
 * Cada hueco lleva su `index`, que es la posición correspondiente en `blanks`.
 */
export function parseFillBlankTemplate(template: string): TemplateToken[] {
  const tokens: TemplateToken[] = [];
  let last = 0;
  let index = 0;

  for (const m of template.matchAll(MARKER_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    // `snake_case` no es un hueco: exigimos que el marcador no esté pegado a
    // caracteres de palabra por ninguno de los dos lados.
    if (/\w/.test(template[start - 1] ?? '') || /\w/.test(template[end] ?? '')) continue;
    tokens.push({ text: template.slice(last, start) });
    tokens.push({ blank: true, index: index++ });
    last = end;
  }

  tokens.push({ text: template.slice(last) });
  return tokens;
}

/** Nº de huecos marcados en la plantilla. */
export function countFillBlankMarkers(template: string): number {
  return parseFillBlankTemplate(template).filter((t) => 'blank' in t).length;
}
