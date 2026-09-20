import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardRenderer from './CardRenderer';
import type { AnyCard } from '@/types';

const TEMPLATE =
  'El nombre «inteligencia artificial» nace en la conferencia de _Dartmouth_ en _1956_; ' +
  'seis años antes, _Turing_ publicó «Computing Machinery and Intelligence» en la revista Mind.';

function fillBlankCard(): AnyCard {
  return {
    id: 'card-1',
    deck_id: 'deck-1',
    type: 'fill_blank',
    question: 'Completa los orígenes del campo',
    content: {
      template: TEMPLATE,
      blanks: [
        { position: 0, answer: 'Dartmouth' },
        { position: 1, answer: '1956' },
        { position: 2, answer: 'Turing' },
      ],
    },
    image_url: null,
    explanation: null,
    created_at: '2026-09-20T00:00:00Z',
    updated_at: '2026-09-20T00:00:00Z',
  };
}

describe('FillBlankCard con plantilla estilo _respuesta_', () => {
  it('muestra un input por hueco y no filtra las respuestas', () => {
    render(<CardRenderer card={fillBlankCard()} submitted={false} onSubmit={vi.fn()} />);

    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    for (const answer of ['Dartmouth', '1956', 'Turing']) {
      expect(screen.queryByText(new RegExp(answer))).not.toBeInTheDocument();
    }
  });

  it('marca como correcto solo cuando todos los huecos coinciden', () => {
    const onSubmit = vi.fn();
    render(<CardRenderer card={fillBlankCard()} submitted={false} onSubmit={onSubmit} />);
    const [a, b, c] = screen.getAllByRole('textbox');

    fireEvent.change(a, { target: { value: 'cualquier palabra' } });
    fireEvent.change(b, { target: { value: '1956' } });
    fireEvent.change(c, { target: { value: 'turing' } }); // sin distinguir mayúsculas
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(onSubmit).toHaveBeenLastCalledWith(false);

    fireEvent.change(a, { target: { value: ' Dartmouth ' } }); // con espacios sobrantes
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(onSubmit).toHaveBeenLastCalledWith(true);
  });

  it('permite verificar aunque queden huecos vacíos', () => {
    const onSubmit = vi.fn();
    render(<CardRenderer card={fillBlankCard()} submitted={false} onSubmit={onSubmit} />);

    const verify = screen.getByRole('button', { name: 'Verificar' });
    expect(verify).toBeEnabled();
    fireEvent.click(verify);
    expect(onSubmit).toHaveBeenCalledWith(false);
  });

  it('al corregir muestra la respuesta esperada de cada fallo', () => {
    render(<CardRenderer card={fillBlankCard()} submitted={true} onSubmit={vi.fn()} />);

    expect(screen.getByText('→ Dartmouth')).toBeInTheDocument();
    expect(screen.getByText('→ 1956')).toBeInTheDocument();
    expect(screen.getByText('→ Turing')).toBeInTheDocument();
    expect(screen.getByText('✗ Revisa las correcciones marcadas')).toBeInTheDocument();
  });
});

function simpleFillBlank(id: string, template: string, answers: string[]): AnyCard {
  return {
    id,
    deck_id: 'deck-1',
    type: 'fill_blank',
    question: 'Completa la frase',
    content: {
      template,
      blanks: answers.map((answer, position) => ({ position, answer })),
    },
    image_url: null,
    explanation: null,
    created_at: '2026-09-20T00:00:00Z',
    updated_at: '2026-09-20T00:00:00Z',
  };
}

describe('estado entre tarjetas', () => {
  it('no arrastra lo escrito a la siguiente tarjeta del mismo tipo', () => {
    const a = simpleFillBlank('a', 'La capital es ___.', ['Madrid']);
    const b = simpleFillBlank('b', 'El río es ___ y mide ___ km.', ['Ebro', '930']);

    const { rerender } = render(<CardRenderer card={a} submitted={false} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Madrid' } });

    rerender(<CardRenderer card={b} submitted={false} onSubmit={vi.fn()} />);
    const values = (screen.getAllByRole('textbox') as HTMLInputElement[]).map((i) => i.value);
    expect(values).toEqual(['', '']);
  });

  it('tampoco arrastra la opción elegida en multiple_choice', () => {
    const mc = (id: string): AnyCard => ({
      id,
      deck_id: 'deck-1',
      type: 'multiple_choice',
      question: '¿Cuál?',
      content: { options: ['Uno', 'Dos'], correct: [0], multi_select: false },
      image_url: null,
      explanation: null,
      created_at: '2026-09-20T00:00:00Z',
      updated_at: '2026-09-20T00:00:00Z',
    });

    const onSubmit = vi.fn();
    const { rerender } = render(
      <CardRenderer card={mc('a')} submitted={false} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Uno/ }));
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeEnabled();

    // La tarjeta nueva empieza sin selección, así que Verificar vuelve a estar
    // deshabilitado en vez de heredar la respuesta anterior.
    rerender(<CardRenderer card={mc('b')} submitted={false} onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('tarjeta fill_blank malformada', () => {
  it('no da por buena una tarjeta sin huecos declarados', () => {
    const onSubmit = vi.fn();
    render(
      <CardRenderer
        card={simpleFillBlank('vacia', 'Una frase sin huecos.', [])}
        submitted={false}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(onSubmit).toHaveBeenCalledWith(false);
  });
});
