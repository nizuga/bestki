import { describe, it, expect } from 'vitest';
import { validateImportPayload } from './cardImport';

function payload(template: string, answers: string[]) {
  return {
    cards: [
      {
        type: 'fill_blank',
        question: 'Completa la frase',
        content: {
          template,
          blanks: answers.map((answer, position) => ({ position, answer })),
        },
      },
    ],
  };
}

describe('validateImportPayload — fill_blank', () => {
  it('acepta un ___ por cada hueco', () => {
    expect(payload('El ___ nació en ___.', ['Turing', '1912']).cards).toHaveLength(1);
    const result = validateImportPayload(payload('El ___ nació en ___.', ['Turing', '1912']));
    expect(result.ok).toBe(true);
  });

  it('acepta plantillas estilo _respuesta_', () => {
    const result = validateImportPayload(payload('La conferencia de _Dartmouth_.', ['Dartmouth']));
    expect(result.ok).toBe(true);
  });

  it('rechaza más huecos que marcadores', () => {
    const result = validateImportPayload(payload('El ___ nació en 1912.', ['Turing', '1912']));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].field).toBe('content.template');
    expect(result.errors[0].message).toMatch(/1 marcador\(es\) vs 2 hueco\(s\)/);
  });

  it('rechaza más marcadores que huecos', () => {
    const result = validateImportPayload(payload('El ___ nació en ___.', ['Turing']));
    expect(result.ok).toBe(false);
  });

  it('rechaza una plantilla sin ningún marcador', () => {
    const result = validateImportPayload(payload('La fórmula del agua es H_2_O.', ['2']));
    expect(result.ok).toBe(false);
  });
});
