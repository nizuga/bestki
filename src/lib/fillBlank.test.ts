import { describe, it, expect } from 'vitest';
import { parseFillBlankTemplate, countFillBlankMarkers } from './fillBlank';

/** Texto visible de la plantilla, con los huecos como "[]". */
function render(template: string): string {
  return parseFillBlankTemplate(template)
    .map((t) => ('text' in t ? t.text : '[]'))
    .join('');
}

describe('parseFillBlankTemplate', () => {
  it('reconoce ___ y ____', () => {
    expect(render('El ___ es azul y el ____ verde.')).toBe('El [] es azul y el [] verde.');
    expect(countFillBlankMarkers('El ___ es azul y el ____ verde.')).toBe(2);
  });

  it('reconoce {{algo}}', () => {
    expect(render('La capital es {{capital}}.')).toBe('La capital es [].');
    expect(countFillBlankMarkers('La capital es {{capital}}.')).toBe(1);
  });

  it('reconoce _respuesta_ y oculta la respuesta del texto', () => {
    const out = render('La capital es _Madrid_.');
    expect(out).toBe('La capital es [].');
    expect(out).not.toContain('Madrid');
  });

  it('parsea la frase real de la tarjeta de Dartmouth', () => {
    const template =
      'El nombre «inteligencia artificial» nace en la conferencia de _Dartmouth_ en _1956_; ' +
      'seis años antes, _Turing_ publicó «Computing Machinery and Intelligence» en la revista Mind.';

    expect(countFillBlankMarkers(template)).toBe(3);
    const out = render(template);
    expect(out).toContain('nace en la conferencia de [] en [];');
    expect(out).toContain('seis años antes, [] publicó');
    for (const answer of ['Dartmouth', '1956', 'Turing']) {
      expect(out).not.toContain(answer);
    }
  });

  it('no confunde snake_case ni H_2_O con huecos', () => {
    expect(countFillBlankMarkers('La variable my_var_name guarda el total.')).toBe(0);
    expect(countFillBlankMarkers('La fórmula del agua es H_2_O.')).toBe(0);
  });

  it('admite marcadores mezclados en una misma plantilla', () => {
    const template = 'El ___ nació en _1856_ y murió en {{year}}.';
    expect(countFillBlankMarkers(template)).toBe(3);
    expect(render(template)).toBe('El [] nació en [] y murió en [].');
  });

  it('devuelve 0 marcadores cuando no hay huecos', () => {
    expect(countFillBlankMarkers('Una frase sin huecos.')).toBe(0);
    expect(render('Una frase sin huecos.')).toBe('Una frase sin huecos.');
  });
});
