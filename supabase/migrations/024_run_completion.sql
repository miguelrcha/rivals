-- Lets a run's owner mark it as finished (cleared the game or not) and
-- delete it, from the "Active Runs" panel. active_game_run_id links a
-- profile's in-progress run straight to its runs row, so the owner-only
-- edit/complete/delete actions don't have to guess which row is "the"
-- active one when switching between games. Safe to re-run, standalone
-- from schema.sql.

alter table public.runs add column if not exists cleared boolean;
alter table public.runs add column if not exists completed_at timestamptz;

alter table public.profiles
  add column if not exists active_game_run_id uuid references public.runs (id) on delete set null;
