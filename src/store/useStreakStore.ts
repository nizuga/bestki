import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { calculateCurrentStreak, calculateBestStreak, availableFreezes } from '@/lib/streak';
import type { StreakDay, StreakFreeze } from '@/types';

interface StreakState {
  streakDays: StreakDay[];
  freezes: StreakFreeze[];
  minCards: number;
  maxFreezesPerMonth: number;
  currentStreak: number;
  bestStreak: number;
  freezesLeft: number;
  loading: boolean;
  fetchStreak: () => Promise<void>;
}

export const useStreakStore = create<StreakState>((set) => ({
  streakDays: [],
  freezes: [],
  minCards: 10,
  maxFreezesPerMonth: 2,
  currentStreak: 0,
  bestStreak: 0,
  freezesLeft: 2,
  loading: false,

  fetchStreak: async () => {
    set({ loading: true });

    const [{ data: days }, { data: frzs }, { data: settings }] = await Promise.all([
      supabase.from('streaks').select('*').order('date'),
      supabase.from('streak_freezes').select('*'),
      supabase
        .from('settings')
        .select('*')
        .in('key', ['streak_min_cards', 'streak_freezes_per_month']),
    ]);

    const streakDays = (days ?? []) as StreakDay[];
    const freezes = (frzs ?? []) as StreakFreeze[];

    const minCards =
      (settings ?? []).find((s: { key: string }) => s.key === 'streak_min_cards')?.value ?? 10;
    const maxPerMonth =
      (settings ?? []).find((s: { key: string }) => s.key === 'streak_freezes_per_month')?.value ??
      2;

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    set({
      streakDays,
      freezes,
      minCards: Number(minCards),
      maxFreezesPerMonth: Number(maxPerMonth),
      currentStreak: calculateCurrentStreak(streakDays, freezes, Number(minCards)),
      bestStreak: calculateBestStreak(streakDays, freezes, Number(minCards)),
      freezesLeft: availableFreezes(freezes, Number(maxPerMonth), currentMonth),
      loading: false,
    });
  },
}));
