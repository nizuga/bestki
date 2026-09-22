-- ============================================================================
-- Relearning steps
-- ============================================================================
-- `next_review` is a DATE, so the smallest interval it can express is one day.
-- That made the "10 min" / "1 hora" steps promised by the rating buttons
-- impossible: a failed card disappeared for 24h instead of coming back within
-- the session. `relearn_at` carries the sub-day step; `next_review` stays as
-- the day-granularity schedule and doubles as the fallback if the relearning
-- window is missed.
--
-- A card is due when `relearn_at <= now()` OR `next_review <= current_date`.
-- It is null for cards that are not in a relearning step.

alter table card_progress add column relearn_at timestamptz;

create index card_progress_relearn_at_idx
  on card_progress(relearn_at)
  where relearn_at is not null;
