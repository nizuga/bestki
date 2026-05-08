export type CardType =
  | 'flashcard'
  | 'multiple_choice'
  | 'written'
  | 'fill_blank'
  | 'order_steps'
  | 'match_pairs'
  | 'true_false'
  | 'predict_output';

export interface FlashcardContent {
  back: string;
}

export interface MultipleChoiceContent {
  options: string[];
  correct: number[];
  multi_select: boolean;
}

export interface WrittenContent {
  accepted_answers: string[];
  case_sensitive: boolean;
  flexible_order: boolean;
}

export interface FillBlankContent {
  template: string;
  blanks: Array<{ position: number; answer: string }>;
}

export interface OrderStepsContent {
  steps: string[];
  correct_order: number[];
}

export interface MatchPairsContent {
  left: string[];
  right: string[];
}

export interface TrueFalseContent {
  answer: boolean;
  justification: string;
}

export interface PredictOutputContent {
  code: string;
  language: string;
  expected_output: string;
  flexible_match: boolean;
}

export type CardContentByType = {
  flashcard: FlashcardContent;
  multiple_choice: MultipleChoiceContent;
  written: WrittenContent;
  fill_blank: FillBlankContent;
  order_steps: OrderStepsContent;
  match_pairs: MatchPairsContent;
  true_false: TrueFalseContent;
  predict_output: PredictOutputContent;
};

export type CardRating = 1 | 2 | 3 | 4;

export type CardStatus = 'new' | 'learning' | 'review' | 'suspended';

export interface Deck {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  daily_new_limit: number;
  max_repetition_days: number;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Card<T extends CardType = CardType> {
  id: string;
  deck_id: string;
  type: T;
  question: string;
  content: CardContentByType[T];
  image_url: string | null;
  explanation: string | null;
  created_at: string;
  updated_at: string;
}

export type AnyCard = {
  [T in CardType]: Card<T>;
}[CardType];

export interface CardTag {
  card_id: string;
  tag_id: string;
}

export interface CardProgress {
  card_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
  status: CardStatus;
}

export interface Review {
  id: string;
  card_id: string;
  rating: CardRating;
  response_time_ms: number | null;
  reviewed_at: string;
}

export interface StreakDay {
  id: string;
  date: string;
  cards_reviewed: number;
  minutes_studied: number;
}

export interface StreakFreeze {
  id: string;
  month: string;
  used_at: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      decks: { Row: Row<Deck>; Insert: Insert<Deck>; Update: Update<Deck> };
      tags: { Row: Row<Tag>; Insert: Insert<Tag>; Update: Update<Tag> };
      cards: { Row: Row<AnyCard>; Insert: Insert<AnyCard>; Update: Update<AnyCard> };
      card_tags: { Row: Row<CardTag>; Insert: Insert<CardTag>; Update: Update<CardTag> };
      card_progress: {
        Row: Row<CardProgress>;
        Insert: Insert<CardProgress>;
        Update: Update<CardProgress>;
      };
      reviews: { Row: Row<Review>; Insert: Insert<Review>; Update: Update<Review> };
      streaks: { Row: Row<StreakDay>; Insert: Insert<StreakDay>; Update: Update<StreakDay> };
      streak_freezes: {
        Row: Row<StreakFreeze>;
        Insert: Insert<StreakFreeze>;
        Update: Update<StreakFreeze>;
      };
      settings: { Row: Row<Setting>; Insert: Insert<Setting>; Update: Update<Setting> };
    };
  };
}
