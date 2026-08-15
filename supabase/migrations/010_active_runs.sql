-- Lets everyone see who's currently racing a game on that game's page —
-- "Active Runs": avatar, elapsed time since they went active, and progress.
-- No new policy needed — the existing "Profiles are viewable by everyone"
-- policy already covers these columns. Safe to re-run, standalone from
-- schema.sql.

alter table public.profiles add column if not exists active_game_started_at timestamptz;

alter table public.profiles add column if not exists active_game_progress smallint not null default 0;

alter table public.profiles drop constraint if exists profiles_active_game_progress_check;
alter table public.profiles add constraint profiles_active_game_progress_check
  check (active_game_progress between 0 and 100);
