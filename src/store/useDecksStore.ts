import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Deck } from '@/types';

type DeckInput = Pick<Deck, 'name' | 'color'> &
  Partial<Pick<Deck, 'description' | 'icon' | 'daily_new_limit' | 'max_repetition_days'>>;

interface DecksState {
  decks: Deck[];
  loading: boolean;
  error: string | null;
  fetchDecks: () => Promise<void>;
  createDeck: (input: DeckInput) => Promise<void>;
  updateDeck: (id: string, input: Partial<DeckInput>) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
}

export const useDecksStore = create<DecksState>((set) => ({
  decks: [],
  loading: false,
  error: null,

  fetchDecks: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.from('decks').select('*').order('created_at');
    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({ decks: (data ?? []) as Deck[], loading: false });
  },

  createDeck: async (input) => {
    const { data, error } = await supabase.from('decks').insert(input).select().single();
    if (error) {
      set({ error: error.message });
      return;
    }
    set((s) => ({ decks: [...s.decks, data as Deck] }));
  },

  updateDeck: async (id, input) => {
    const { data, error } = await supabase
      .from('decks')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      set({ error: error.message });
      return;
    }
    set((s) => ({ decks: s.decks.map((d) => (d.id === id ? (data as Deck) : d)) }));
  },

  deleteDeck: async (id) => {
    const { error } = await supabase.from('decks').delete().eq('id', id);
    if (error) {
      set({ error: error.message });
      return;
    }
    set((s) => ({ decks: s.decks.filter((d) => d.id !== id) }));
  },
}));
