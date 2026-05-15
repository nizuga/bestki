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

`useStudyStore.startSession(deckId?)` fetches due cards from Supabase (new cards + cards where `next_review <= today`). The session queue is an in-memory array; failed cards (rating < 3) are re-appended once per session (`retriedIds` prevents re-appending twice). When the queue is exhausted, `upsertStreak` writes to the `streaks` table. The `flipped` flag doubles as "submitted" — both flashcards and interactive card types set it to `true` to reveal feedback and unlock the rating buttons.

### Card types

8 types defined in `src/types/index.ts`. Each has a typed `content` shape (`CardContentByType`). In the study view:

- `flashcard` → `FlashCard` component (flip animation)
- All other types → `CardRenderer` (`src/components/study/CardRenderer.tsx`), which switches on `card.type` and renders a self-contained interactive sub-component

`CardRenderer` is stateful (each sub-component owns its answer state) and receives `submitted` + `onSubmit` from the parent. `onSubmit` calls `flip()` from the store, which sets `flipped: true`.

### SM-2 algorithm

`src/lib/sm2.ts` — modified SM-2. Ratings are 1–4 (mapped internally to 0–3). Ratings < 2 reset the card. First repetition with rating 3 gives 4 days; rating 4 gives 1 day (next interval), then 6 days on the second repetition, then `interval * ease_factor`. `ease_factor` is capped at 1.3 minimum.

### Supabase tables

`decks`, `cards`, `card_progress`, `reviews`, `streaks`, `streak_freezes`, `settings`, `tags`, `card_tags`. `card_progress` is upserted on every rating; `reviews` gets an insert. No RLS rules are enforced client-side — the client uses the anon key via `src/lib/supabase.ts`.

### Path alias

`@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig`).
