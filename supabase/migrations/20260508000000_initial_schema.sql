-- AnkiPlus / Bestki — initial schema
-- 8 tables aligned with PROYECTO_CONTEXTO.md
-- No RLS: single-user, no auth (per project context)

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- decks
-- ============================================================================
create table decks (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  color               text not null default '#534AB7',
  icon                text,
  daily_new_limit     int  not null default 10,
  max_repetition_days int  not null default 180,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger decks_set_updated_at
  before update on decks
  for each row execute function set_updated_at();

-- ============================================================================
-- tags
-- ============================================================================
create table tags (
  id    uuid primary key default gen_random_uuid(),
  name  text unique not null,
  color text not null default '#534AB7'
);

-- ============================================================================
-- cards
-- ============================================================================
create table cards (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid not null references decks(id) on delete cascade,
  type        text not null check (type in (
    'flashcard',
    'multiple_choice',
    'written',
    'fill_blank',
    'order_steps',
    'match_pairs',
    'true_false',
    'predict_output'
  )),
  question    text not null,
  content     jsonb not null,
  image_url   text,
  explanation text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index cards_deck_id_idx on cards(deck_id);

create trigger cards_set_updated_at
  before update on cards
  for each row execute function set_updated_at();

-- ============================================================================
-- card_tags (many-to-many)
-- ============================================================================
create table card_tags (
  card_id uuid not null references cards(id) on delete cascade,
  tag_id  uuid not null references tags(id)  on delete cascade,
  primary key (card_id, tag_id)
);

-- ============================================================================
-- card_progress (SM-2 state per card)
-- ============================================================================
create table card_progress (
  card_id       uuid primary key references cards(id) on delete cascade,
  ease_factor   float not null default 2.5,
  interval_days int   not null default 0,
  repetitions   int   not null default 0,
  next_review   date  not null default current_date,
  status        text  not null default 'new'
                check (status in ('new', 'learning', 'review', 'suspended'))
);

create index card_progress_next_review_idx on card_progress(next_review);

-- ============================================================================
-- reviews (rating history)
-- ============================================================================
create table reviews (
  id               uuid primary key default gen_random_uuid(),
  card_id          uuid not null references cards(id) on delete cascade,
  rating           int  not null check (rating between 1 and 4),
  response_time_ms int,
  reviewed_at      timestamptz not null default now()
);

create index reviews_card_id_reviewed_at_idx on reviews(card_id, reviewed_at desc);

-- ============================================================================
-- streaks (daily aggregate)
-- ============================================================================
create table streaks (
  id              uuid primary key default gen_random_uuid(),
  date            date unique not null,
  cards_reviewed  int  not null default 0,
  minutes_studied int  not null default 0
);

create index streaks_date_idx on streaks(date desc);

-- ============================================================================
-- streak_freezes (escudos por mes)
-- ============================================================================
create table streak_freezes (
  id      uuid primary key default gen_random_uuid(),
  month   text not null,
  used_at date not null
);

-- ============================================================================
-- settings (key-value)
-- ============================================================================
create table settings (
  key   text primary key,
  value jsonb not null
);

-- Initial settings
insert into settings (key, value) values
  ('streak_min_cards',         to_jsonb(10)),
  ('streak_freezes_per_month', to_jsonb(2)),
  ('theme',                    to_jsonb('dark'::text));
