import { describe, it, expect } from 'vitest';
import { calculateCurrentStreak, calculateBestStreak, availableFreezes } from './streak';
import type { StreakDay, StreakFreeze } from '@/types';

const TODAY = new Date('2026-05-08T12:00:00');
const MIN_CARDS = 10;

function day(date: string, cards: number): StreakDay {
  return { id: date, date, cards_reviewed: cards, minutes_studied: 0 };
}

function freeze(date: string, month: string): StreakFreeze {
  return { id: date, month, used_at: date };
}

// ─── calculateCurrentStreak ──────────────────────────────────────────────────

describe('calculateCurrentStreak — sin datos', () => {
  it('sin días ni freezes → 0', () => {
    expect(calculateCurrentStreak([], [], MIN_CARDS, TODAY)).toBe(0);
  });

  it('días con menos tarjetas que el mínimo → 0', () => {
    const days = [day('2026-05-08', 5), day('2026-05-07', 3)];
    expect(calculateCurrentStreak(days, [], MIN_CARDS, TODAY)).toBe(0);
  });
});

describe('calculateCurrentStreak — días consecutivos', () => {
  it('solo hoy estudiado → 1', () => {
    const days = [day('2026-05-08', 10)];
    expect(calculateCurrentStreak(days, [], MIN_CARDS, TODAY)).toBe(1);
  });

  it('hoy y ayer → 2', () => {
    const days = [day('2026-05-08', 10), day('2026-05-07', 10)];
    expect(calculateCurrentStreak(days, [], MIN_CARDS, TODAY)).toBe(2);
  });

  it('3 días consecutivos → 3', () => {
    const days = [day('2026-05-08', 10), day('2026-05-07', 15), day('2026-05-06', 12)];
    expect(calculateCurrentStreak(days, [], MIN_CARDS, TODAY)).toBe(3);
  });

  it('hoy no estudiado pero ayer y antes de ayer sí → 2', () => {
    const days = [day('2026-05-07', 10), day('2026-05-06', 10)];
    expect(calculateCurrentStreak(days, [], MIN_CARDS, TODAY)).toBe(2);
  });

  it('gap en el pasado no rompe racha actual', () => {
    // hoy + ayer + brecha + hace 3 días
    const days = [day('2026-05-08', 10), day('2026-05-07', 10), day('2026-05-05', 10)];
    expect(calculateCurrentStreak(days, [], MIN_CARDS, TODAY)).toBe(2);
  });
});

describe('calculateCurrentStreak — con freezes', () => {
  it('freeze en ayer mantiene racha cuando hoy sí se estudió', () => {
    const days = [day('2026-05-08', 10), day('2026-05-06', 10)];
    const freezes = [freeze('2026-05-07', '2026-05')];
    expect(calculateCurrentStreak(days, freezes, MIN_CARDS, TODAY)).toBe(3);
  });

  it('freeze solo no cuenta si no hay días reales antes', () => {
    const freezes = [freeze('2026-05-07', '2026-05')];
    // ayer es freeze pero hoy no se estudió y antes del freeze tampoco
    expect(calculateCurrentStreak([], freezes, MIN_CARDS, TODAY)).toBe(1);
  });

  it('freeze extiende racha desde días anteriores', () => {
    const days = [day('2026-05-08', 10), day('2026-05-05', 10), day('2026-05-04', 10)];
    const freezes = [freeze('2026-05-07', '2026-05'), freeze('2026-05-06', '2026-05')];
    expect(calculateCurrentStreak(days, freezes, MIN_CARDS, TODAY)).toBe(5);
  });
});

// ─── calculateBestStreak ─────────────────────────────────────────────────────

describe('calculateBestStreak', () => {
  it('sin datos → 0', () => {
    expect(calculateBestStreak([], [], MIN_CARDS)).toBe(0);
  });

  it('un solo día → 1', () => {
    expect(calculateBestStreak([day('2026-05-08', 10)], [], MIN_CARDS)).toBe(1);
  });

  it('5 días consecutivos → 5', () => {
    const days = [
      day('2026-05-04', 10),
      day('2026-05-05', 10),
      day('2026-05-06', 10),
      day('2026-05-07', 10),
      day('2026-05-08', 10),
    ];
    expect(calculateBestStreak(days, [], MIN_CARDS)).toBe(5);
  });

  it('dos rachas separadas: devuelve la más larga', () => {
    const days = [
      day('2026-04-01', 10),
      day('2026-04-02', 10),
      day('2026-04-03', 10), // racha de 3
      day('2026-05-06', 10),
      day('2026-05-07', 10),
      day('2026-05-08', 10),
      day('2026-05-09', 10),
      day('2026-05-10', 10), // racha de 5
    ];
    expect(calculateBestStreak(days, [], MIN_CARDS)).toBe(5);
  });

  it('freeze cuenta en la mejor racha', () => {
    const days = [day('2026-05-06', 10), day('2026-05-08', 10)];
    const freezes = [freeze('2026-05-07', '2026-05')];
    expect(calculateBestStreak(days, freezes, MIN_CARDS)).toBe(3);
  });
});

// ─── availableFreezes ────────────────────────────────────────────────────────

describe('availableFreezes', () => {
  it('sin freezes usados → maxPerMonth disponibles', () => {
    expect(availableFreezes([], 2, '2026-05')).toBe(2);
  });

  it('1 freeze usado este mes → maxPerMonth - 1', () => {
    const freezes = [freeze('2026-05-03', '2026-05')];
    expect(availableFreezes(freezes, 2, '2026-05')).toBe(1);
  });

  it('todos los freezes usados → 0', () => {
    const freezes = [freeze('2026-05-03', '2026-05'), freeze('2026-05-06', '2026-05')];
    expect(availableFreezes(freezes, 2, '2026-05')).toBe(0);
  });

  it('freezes de otro mes no cuentan', () => {
    const freezes = [freeze('2026-04-28', '2026-04'), freeze('2026-04-29', '2026-04')];
    expect(availableFreezes(freezes, 2, '2026-05')).toBe(2);
  });

  it('nunca retorna negativo', () => {
    // 3 freezes pero máximo es 2 (edge case)
    const freezes = [
      freeze('2026-05-01', '2026-05'),
      freeze('2026-05-02', '2026-05'),
      freeze('2026-05-03', '2026-05'),
    ];
    expect(availableFreezes(freezes, 2, '2026-05')).toBe(0);
  });
});
