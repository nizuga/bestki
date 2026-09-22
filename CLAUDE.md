# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Vite)
npm run build        # Type-check + build for production
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier (write)
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run (CI)
npx vitest run src/lib/sm2.test.ts   # Run a single test file
```

Pre-commit hook runs ESLint + Prettier via lint-staged automatically.

## Architecture

**Stack:** React 19 + Vite + TypeScript, Zustand (state), Supabase (Postgres backend), Tailwind CSS, PWA target.

### Data flow

All persistent state lives in Supabase. There is no local-first sync layer — reads and writes go directly to Supabase on every action. The `idb` package is installed but offline sync is not yet wired up.

State is managed in three Zustand stores under `src/store/`:

- `useDecksStore` — deck CRUD and card list
- `useStudyStore` — study session lifecycle: queue, SM-2 rating, streak upsert
- `useStreakStore` — streak/freeze display on Home

### Study session lifecycle

`useStudyStore.startSession(deckId?)` fetches due cards from Supabase (new cards + cards where `next_review <= today`) and orders them most-overdue-first, with brand-new cards at the end. The session queue is an in-memory array; failed cards (rating < 3) are re-appended once per session (`retriedIds` prevents re-appending twice). On the first failed pass only a `reviews` row is logged — `card_progress` is updated only on the final attempt for the card this session, so SM-2 never runs on top of its own output. When the queue is exhausted, `upsertStreak` writes to the `streaks` table (using `onConflict: 'date'`). The `flipped` flag doubles as "submitted" — both flashcards and interactive card types set it to `true` to reveal feedback and unlock the rating buttons.

### Card types

8 types defined in `src/types/index.ts`. Each has a typed `content` shape (`CardContentByType`). In the study view:

- `flashcard` → `FlashCard` component (flip animation)
- All other types → `CardRenderer` (`src/components/study/CardRenderer.tsx`), which switches on `card.type` and renders a self-contained interactive sub-component

`CardRenderer` is stateful (each sub-component owns its answer state) and receives `submitted` + `onSubmit` from the parent. `onSubmit` calls `flip()` from the store, which sets `flipped: true`.

### SM-2 algorithm

`src/lib/sm2.ts` — modified SM-2. Ratings are 1–4 (mapped internally to 0–3 via `q = rating - 1`). Raw ratings 1 and 2 reset the card to `interval_days = 1`, `repetitions = 0`. On the first successful repetition (`repetitions === 0`), rating 4 gives a 4-day interval and rating 3 gives 1 day; the second successful repetition gives 6 days; subsequent successes give `round(interval_days * ease_factor)`. `ease_factor` is floored at 1.3 and `interval_days` is clamped by `maxIntervalDays` (default 180). Dates are formatted in **local time** (not UTC) to stay consistent with `useStudyStore.todayStr` and `streak.ts`.

### Supabase tables

`decks`, `cards`, `card_progress`, `reviews`, `streaks`, `streak_freezes`, `settings`, `tags`, `card_tags`. `card_progress` is upserted on every rating; `reviews` gets an insert. No RLS rules are enforced client-side — the client uses the anon key via `src/lib/supabase.ts`.

### Path alias

`@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig`).
