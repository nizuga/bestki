import { describe, it, expect } from 'vitest';
import { sm2 } from './sm2';
import type { CardProgress } from '@/types';

const NOW = new Date('2026-05-08');

function makeCard(overrides: Partial<CardProgress> = {}): CardProgress {
  return {
    card_id: 'test-id',
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    next_review: '2026-05-08',
    status: 'new',
    ...overrides,
  };
}

function nextDate(days: number): string {
  const d = new Date('2026-05-08');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

describe('sm2 — fallos (rating 1 y 2)', () => {
  it('rating 1: reinicia repetitions e interval a 1', () => {
    const result = sm2(makeCard({ repetitions: 3, interval_days: 15 }), 1, 180, NOW);
    expect(result.repetitions).toBe(0);
    expect(result.interval_days).toBe(1);
    expect(result.status).toBe('learning');
    expect(result.next_review).toBe(nextDate(1));
  });

  it('rating 2: reinicia repetitions e interval a 1', () => {
    const result = sm2(makeCard({ repetitions: 2, interval_days: 6 }), 2, 180, NOW);
    expect(result.repetitions).toBe(0);
    expect(result.interval_days).toBe(1);
    expect(result.status).toBe('learning');
  });

  it('rating 1 baja el ease_factor', () => {
    const result = sm2(makeCard(), 1, 180, NOW);
    expect(result.ease_factor).toBeCloseTo(2.18, 5);
  });

  it('rating 2 baja el ease_factor menos que rating 1', () => {
    const result = sm2(makeCard(), 2, 180, NOW);
    expect(result.ease_factor).toBeCloseTo(2.36, 5);
  });
});

describe('sm2 — progresión normal (rating 3 y 4)', () => {
  it('primera vez bien (rep=0): interval=1, repetitions=1', () => {
    const result = sm2(makeCard(), 3, 180, NOW);
    expect(result.repetitions).toBe(1);
    expect(result.interval_days).toBe(1);
    expect(result.next_review).toBe(nextDate(1));
    expect(result.status).toBe('learning');
  });

  it('segunda vez bien (rep=1, interval=1): interval=6, repetitions=2', () => {
    const card = makeCard({ repetitions: 1, interval_days: 1 });
    const result = sm2(card, 3, 180, NOW);
    expect(result.repetitions).toBe(2);
    expect(result.interval_days).toBe(6);
    expect(result.next_review).toBe(nextDate(6));
    expect(result.status).toBe('learning');
  });

  it('tercera vez bien (rep=2, interval=6, ef=2.5): interval=round(6*2.5)=15', () => {
    const card = makeCard({ repetitions: 2, interval_days: 6, ease_factor: 2.5 });
    const result = sm2(card, 3, 180, NOW);
    expect(result.repetitions).toBe(3);
    expect(result.interval_days).toBe(15);
    expect(result.status).toBe('learning');
  });

  it('cuarta vez bien (rep=3, interval=15, ef=2.5): interval=round(15*2.5)=38 → status review', () => {
    const card = makeCard({ repetitions: 3, interval_days: 15, ease_factor: 2.5 });
    const result = sm2(card, 3, 180, NOW);
    expect(result.interval_days).toBe(38);
    expect(result.status).toBe('review');
  });

  it('rating 4 mantiene ease_factor igual (no lo baja ni sube más allá de +0.1)', () => {
    const result = sm2(makeCard(), 4, 180, NOW);
    expect(result.ease_factor).toBeCloseTo(2.6, 5);
  });

  it('rating 3 no modifica el ease_factor', () => {
    const result = sm2(makeCard(), 3, 180, NOW);
    expect(result.ease_factor).toBeCloseTo(2.5, 5);
  });
});

describe('sm2 — ease_factor mínimo', () => {
  it('ease_factor nunca baja de 1.3', () => {
    const card = makeCard({ ease_factor: 1.3 });
    const result = sm2(card, 1, 180, NOW);
    expect(result.ease_factor).toBeGreaterThanOrEqual(1.3);
  });

  it('ease_factor con 1.31 y rating 1 queda en 1.3', () => {
    const card = makeCard({ ease_factor: 1.31 });
    const result = sm2(card, 1, 180, NOW);
    expect(result.ease_factor).toBe(1.3);
  });
});

describe('sm2 — límite maxIntervalDays', () => {
  it('interval no supera maxIntervalDays', () => {
    const card = makeCard({ repetitions: 5, interval_days: 100, ease_factor: 2.5 });
    const result = sm2(card, 4, 90, NOW);
    expect(result.interval_days).toBeLessThanOrEqual(90);
  });

  it('maxIntervalDays default es 180', () => {
    const card = makeCard({ repetitions: 5, interval_days: 90, ease_factor: 2.5 });
    const result = sm2(card, 4, undefined, NOW);
    expect(result.interval_days).toBeLessThanOrEqual(180);
  });
});

describe('sm2 — status', () => {
  it('status es learning cuando interval <= 21', () => {
    const card = makeCard({ repetitions: 2, interval_days: 6, ease_factor: 2.5 });
    const result = sm2(card, 3, 180, NOW);
    expect(result.interval_days).toBe(15);
    expect(result.status).toBe('learning');
  });

  it('status es review cuando interval > 21', () => {
    const card = makeCard({ repetitions: 3, interval_days: 15, ease_factor: 2.5 });
    const result = sm2(card, 3, 180, NOW);
    expect(result.interval_days).toBe(38);
    expect(result.status).toBe('review');
  });

  it('status es learning después de un fallo aunque venía de review', () => {
    const card = makeCard({
      repetitions: 5,
      interval_days: 60,
      ease_factor: 2.5,
      status: 'review',
    });
    const result = sm2(card, 1, 180, NOW);
    expect(result.status).toBe('learning');
    expect(result.repetitions).toBe(0);
  });
});
